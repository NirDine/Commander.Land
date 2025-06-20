const basicCardsCount = {
    W: 0,
    U: 0,
    B: 0,
    R: 0,
    G: 0,
    C: 0
  };

// Retrieve selectedCards from localStorage
const storedSelectedCards = localStorage.getItem('selectedCards');
selectedCards = storedSelectedCards ? JSON.parse(storedSelectedCards) : [];

let totalSelectedCards = selectedCards.length;

let selectedCardsHistory = []; // Array to store selectedCards history


function updateCardList() {
  const chContainer = $('#chContainer');
  const combinations = {};

  // Remove cards that are not in the selectedCards array anymore and update combinations
  $('.combination ul').empty();

  // Sort selectedCards by card name in alphabetical order
  const sortedSelectedCards = selectedCards
    .map(cardName => data.data.find(card => card.name === cardName))
    .filter(card => card !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Add cards in alphabetical order to the appropriate combination elements
  sortedSelectedCards.forEach(card => {
    const colorIdentity = card.color_identity?.join('') || 'C';
    const combinationElement = $(`.combination[data-combination="${colorIdentity}"]`);

    // Check if the card is already present in the combination element
    if (!combinationElement.find(`[data-card-name="${card.name}"]`).length) {
      cardLiElement = $(`<li class="addedCard" data-card-id="${card.id}" data-card-name="${card.name}" data-colors="${card.color_identity}" data-properties="${card.properties}"><span class="chCardTextContainer"><span class="basicTotal"></span><span>${card.name}</span></span></li>`);

      combinationElement.find('ul').append(cardLiElement);
    }

// Update the card count for the color combination
  const cardCount = selectedCards.filter(cardName => {
    const selectedCard = data?.data.find(item => item.name === cardName);
    if (colorIdentity === 'C') {
      // For colorless, only count cards with no color identity
      return !selectedCard.color_identity || selectedCard.color_identity.length === 0;
    } else {
      // For other colors, use the existing logic
      return selectedCard?.color_identity?.join('') === colorIdentity;
    }
  }).length;
  
  combinations[colorIdentity] = cardCount;
});


  // Update the totalSpan for each combination and remove combinations with count 0
  for (const colorIdentity in combinations) {
    const combinationElement = $(`.combination[data-combination="${colorIdentity}"]`);
    const totalSpan = combinationElement.find('.total');
    const count = combinations[colorIdentity];
    totalSpan.text(count);

    if (count === 0) {
      combinationElement.remove();
    }
  }

  const colorCount = countProducedManaColors();
  updateManaColorProgress();
  updateBasicCardsCount();
}


function updateBasicCardsCount() {
  selectedCards.forEach(cardName => {
    const card = data?.data.find(item => item.name === cardName);
    if (card && card.is_basic && card.color_identity) {
      const count = selectedCards.filter(name => name === cardName).length;
      const cardInMenu = $(`.addedCard[data-card-name="${cardName}"] .basicTotal`)[0];
      const cardInPool = $(`.selected[data-card-name="${cardName}"] .totalBasics`)[0];
      if (cardInMenu !== undefined && cardInPool !== undefined) {
        cardInMenu.textContent = count;
        cardInPool.textContent = "x" + count;

        card.color_identity.forEach(color => {
          if (basicCardsCount.hasOwnProperty(color)) {
            basicCardsCount[color] += count;
          }
        });
      }
    }
  });

}



// Function to record the selected cards and mana color counts in history
function recordSelectedCards() {
  // Create a deep copy of selectedCards array
  const selectedCardsCopy = JSON.parse(JSON.stringify(selectedCards));

  // Also record the current mana color counts
  const currentColorCounts = JSON.parse(localStorage.getItem('manaColorCounts')) || {};

  // Push the object with both selectedCards and manaColorCounts into selectedCardsHistory
  selectedCardsHistory.push({
    selectedCards: selectedCardsCopy,
    manaColorCounts: currentColorCounts
  });
}

// Function to clear selected cards and reset color counts
function clearSelectedCards() {
  recordSelectedCards(); // Record the current state before clearing

  // Remove the .selected class from the cards being removed
  $('.card.selected').removeClass('selected');

  // Clear the selectedCards array
  selectedCards = [];
  
  // Update the UI or perform any necessary actions to reflect the cleared selectedCards
  updateCardList();

  // Save the updated selectedCards to localStorage
  localStorage.setItem('selectedCards', JSON.stringify(selectedCards));

  // Clear the color counters and update the local storage
  const colorCount = {
    W: 0,
    U: 0,
    B: 0,
    R: 0,
    G: 0,
    C: 0
  };

  Object.entries(colorCount).forEach(([color, _]) => {
    $(`.tracker-${color} span .current`).text(0);
  });

  localStorage.setItem('manaColorCounts', JSON.stringify(colorCount));

  // Optional: If responseData is no longer needed, you can clear it
  localStorage.removeItem('responseData');

  // Clear colorRecommendations from localStorage
  localStorage.removeItem('colorRecommendations');

  // Recalculate mana color counts
  updateManaColorProgress();

  totalCardCount();
    updateChart();
}


// Function to undo the last clear action
function undoClearSelectedCards() {
  if (selectedCardsHistory.length > 0) {
    // Retrieve the last recorded state
    const previousState = selectedCardsHistory.pop();

    // Ensure previousState is defined and has selectedCards and manaColorCounts
    if (previousState && previousState.selectedCards && previousState.manaColorCounts) {
      const previousSelectedCards = previousState.selectedCards;
      const previousManaColorCounts = previousState.manaColorCounts;

      // Iterate over the current selectedCards and remove the .selected class from the cards that are being removed
      selectedCards.forEach(cardName => {
        if (!previousSelectedCards.includes(cardName)) {
          const cardElement = $(`.card[data-card-name="${cardName}"]`);
          cardElement.removeClass('selected');
            
            
        }
      });

      // Iterate over the previous selectedCards and add the .selected class to the cards that are being added back
      previousSelectedCards.forEach(cardName => {
        if (!selectedCards.includes(cardName)) {
          const cardElement = $(`.card[data-card-name="${cardName}"]`);
          cardElement.addClass('selected');
        }
      });

      // Set selectedCards to the previous state
      selectedCards = previousSelectedCards;

      // Update the UI or perform any necessary actions based on the previous selectedCards state
      updateCardList();

      // Save the updated selectedCards to localStorage
      localStorage.setItem('selectedCards', JSON.stringify(selectedCards));

      // Restore the previous mana color counts and update the UI
      Object.entries(previousManaColorCounts).forEach(([color, count]) => {
        $(`.tracker-${color} span .current`).text(count);
      });

      localStorage.setItem('manaColorCounts', JSON.stringify(previousManaColorCounts));

      // Recalculate mana color counts
      updateManaColorProgress();
    }
  }
  updateChart();
  totalCardCount();
}

// Function to update mana color progress
function updateManaColorProgress() {
  const colorCounts = countProducedManaColors();
  const storedRecLandCount = localStorage.getItem('recommendedLandCount');
  Object.entries(colorCounts).forEach(([color, count]) => {
    const totalColorCount = Object.values(colorCounts).reduce((total, count) => total + count, 0);
    const percentage = totalColorCount === 0 ? 0 : Math.round((count / totalSelectedCards) * 100);
    const progressBar = $(`.chFooter .progress-bar-${color}`);

    if (progressBar.length) {
      if (count !== 0) {
        progressBar.addClass('hasMana');
      } else {
        progressBar.removeClass('hasMana');
      }

      progressBar.css('width', `${percentage}%`);
      progressBar.text(`${percentage}%`);
    }
  });
}

// Function to count mana colors
function countProducedManaColors() {
  const colorCount = {
    W: 0,
    U: 0,
    B: 0,
    R: 0,
    G: 0,
    C: 0
  };

  if (selectedCards.length === 0) {
    // Set count to 0 for each color when no cards are selected
    Object.entries(colorCount).forEach(([color, _]) => {
      $(`.tracker-${color} span .current`).text(0);
    });
    return colorCount;
  }

  selectedCards.forEach((cardName) => {
    const card = data?.data.find((item) => item.name === cardName);

    if (card && card.produced_mana && card.produced_mana.length > 0) {
      card.produced_mana.forEach((color) => {
        if (colorCount.hasOwnProperty(color)) {
          colorCount[color]++;
        }
      });
    }
  });

  // Update the .current element for each color
  Object.entries(colorCount).forEach(([color, count]) => {
    $(`.tracker-${color} span .current`).text(count);
  });

  // Store the colorCount in local storage
  localStorage.setItem('manaColorCounts', JSON.stringify(colorCount));

  updateChart();
  return colorCount;
}


function getUniqueCardList(storedCards) {
  const cardCount = {};
  const uniqueCardList = [];

  // Count the occurrences of each card ID
  storedCards.forEach(cardName => {
    cardCount[cardName] = (cardCount[cardName] || 0) + 1;
  });

  // Generate the formatted list with quantities and names
  Object.entries(cardCount).forEach(([cardName, quantity]) => {
    const card = data?.data.find(item => item.name === cardName);
    if (card) {
      const formattedCard = `${quantity} ${card.name}`;
      uniqueCardList.push(formattedCard);
    }
  });

  // Return the unique card list with line breaks
  return uniqueCardList.join('\n');
}

function downloadCardList(action) {
  if (selectedCards.length > 0) {
    // Get the unique card list with quantities and names
    const uniqueCardList = getUniqueCardList(selectedCards);

    if (action === 'download') {
      // Download the text file
      const blob = new Blob([uniqueCardList], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'card-list.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      URL.revokeObjectURL(url);
    } else if (action === 'copy') {
      // Copy the text to clipboard
      navigator.clipboard.writeText(uniqueCardList)
        .then(() => {
          console.log('Text copied to clipboard');
          // Show a success message or perform any additional actions
        })
        .catch(err => {
          console.error('Failed to copy text to clipboard', err);
          // Handle the error, if any
        });
    }
  }
}


    function totalCardCount() {
        totalSelectedCards = selectedCards.length;
        $(".added-cards").text(totalSelectedCards);
        $(".totalCards .current").text(totalSelectedCards);
        if (totalSelectedCards > maxCardSelected) {
            $(".totalCards .current").addClass("overLimit");
        }
        else {
            $(".totalCards .current").removeClass("overLimit");
        }

        // Check and hide/show the #isAdded checkbox
        if (totalSelectedCards > 0) {
            $(".mana:has(#isAdded)").show();
        } else {
            $(".mana:has(#isAdded)").prop("checked", false).hide();
            $("#isAdded").prop("checked", false);

            filterCards();
            startIndex += cardsPerPage;
            endIndex += cardsPerPage;

            loadCards();
        }
    }
    
function handleCardInteraction(card) {
  const cardName = card.data('card-name');
  const cardIsBasic = card.data('basic' || false);
  const isSelected = card.hasClass('selected');
  recordSelectedCards();


  if (cardIsBasic === true && !card.find('.remove-basic-button').is(event.target) && isSelected) {
    selectedCards.push(cardName);
  } else if (cardIsBasic && isSelected) {
    const index = selectedCards.indexOf(cardName);
    if (index !== -1) {
      selectedCards.splice(index, 1);
      if (selectedCards.filter(name => name === cardName).length === 0) {
        // If it's the last card with the same ID, remove the .selected class from the card
        card.removeClass('selected');
      }
    }
  } else {
    if (!isSelected) {
      card.addClass('selected');
      selectedCards.push(cardName);
    } else {
      card.removeClass('selected');
      const index = selectedCards.indexOf(cardName);
      if (index !== -1) {
        selectedCards.splice(index, 1);
        if (selectedCards.filter(name => name === cardName).length === 0) {
          // If it's the last card with the same ID, remove the .selected class from the card
          card.removeClass('selected');
            
            if (selectedCards.length === 0) {
                colorCount = {
                    W: 0,
                    U: 0,
                    B: 0,
                    R: 0,
                    G: 0,
                    C: 0
                  };

            localStorage.setItem('manaColorCounts', JSON.stringify(colorCount));
            }
    
        }
      }
    }
  }
  
  totalCardCount();
  countProducedManaColors();
  // Save selectedCards to localStorage
  localStorage.setItem('selectedCards', JSON.stringify(selectedCards));

  // Update the card list
  updateCardList();


}




// Event handler for card click
function handleCardClick(event) {
  const card = $(event.currentTarget);
  const flipButton = card.find('.flip-button');

  // Check if the clicked element is the flip button or its descendant
  if (!flipButton || !flipButton.is(event.target) && !flipButton.has(event.target).length) {
    handleCardInteraction(card);
    updateCardList();
  }
}

 // Event handler for card click
function handleMenuCardClick(event) {
  const card = $(event.currentTarget);
    card.addClass('selected');
    handleCardInteraction(card)

  }
 
    
    
// Event handler for key press (Space or Enter)
function handleKeyPress(event) {
  if (event.keyCode === 32 || event.keyCode === 13) {
    const card = $(event.currentTarget);
    handleCardInteraction(card);
  }
}

function handleExportToPlatform(platformUrl) {
  const uniqueCardList = getUniqueCardList(selectedCards);

  const encodedCardList = encodeURIComponent(uniqueCardList);
  const url = `${platformUrl}${encodedCardList}`;
  window.location.href = url;
}




// Attach event listeners to the cards
$(document).on('click', '.card', handleCardClick);
$(document).on('keypress', '.card', handleKeyPress);
$(document).on('click', '.addedCard', handleMenuCardClick) ;
$(document).on('click', '.clearList', clearSelectedCards);
$(document).on('click', '.undoButton', undoClearSelectedCards);
$(document).on('click', '.downloadAsTxt', function() {
  downloadCardList('download');
});

$(document).on('click', '.copyAsTxt', function() {
  downloadCardList('copy');
});
$(document).on('click', '.exportToArchidekt', function() {
  handleExportToPlatform('https://archidekt.com/cardImport?c=');
});

$(document).on('click', '.exportToMoxfield', function() {
  handleExportToPlatform('https://www.moxfield.com/import?c=');
});

// Initialize card list on page load

updateBasicCardsCount();


totalCardCount();

updateCardList();
countProducedManaColors();
