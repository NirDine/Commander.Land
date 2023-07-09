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
    .map(cardId => data.data.find(card => card.id === cardId))
    .filter(card => card !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Add cards in alphabetical order to the appropriate combination elements
  sortedSelectedCards.forEach(card => {
    const colorIdentity = card.color_identity?.join('') || 'C';
    const combinationElement = $(`.combination[data-combination="${colorIdentity}"]`);

    // Check if the card is already present in the combination element
    if (!combinationElement.find(`[data-card-id="${card.id}"]`).length) {
      const cardLiElement = $('<li></li>')
        .addClass('addedCard')
        .attr('data-card-id', card.id)
        .attr('data-card-name', card.name)
        .attr('data-colors', card.color_identity || '')
        .attr('tabindex', '-1')
        .text(card.name);

      combinationElement.find('ul').append(cardLiElement);

      if (!combinations[colorIdentity]) {
        combinations[colorIdentity] = 1;
      } else {
        combinations[colorIdentity]++;
      }
    }
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
    console.log(colorCount);
    updateManaColorProgress();
}

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

  selectedCards.forEach((cardId) => {
    const card = data?.data.find((item) => item.id === cardId);

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

  return colorCount;
}



function updateManaColorProgress() {
  const colorCounts = countProducedManaColors();

  Object.entries(colorCounts).forEach(([color, count]) => {
    const totalColorCount = Object.values(colorCounts).reduce((total, count) => total + count, 0);
    const percentage = totalColorCount === 0 ? 0 : Math.round((count / totalColorCount) * 100);
    const progressBar = $(`.progress-bar-${color}`);

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


    
    function recordSelectedCards() {
      // Create a deep copy of selectedCards array
      const selectedCardsCopy = JSON.parse(JSON.stringify(selectedCards));

      // Push the copy into selectedCardsHistory
      selectedCardsHistory.push(selectedCardsCopy);
    }

    function clearSelectedCards() {
      // Remove the .selected class from the cards being removed
      $('.card.selected').removeClass('selected');

      // Clear the selectedCards array
      selectedCards = [];
      totalCardCount();
      // Update the UI or perform any necessary actions to reflect the cleared selectedCards
      updateCardList();

      // Save the updated selectedCards to localStorage
      localStorage.setItem('selectedCards', JSON.stringify(selectedCards));
    }


    function undoClearSelectedCards() {
        if (selectedCardsHistory.length > 0) {
        // Retrieve the last recorded selectedCards state
        const previousSelectedCards = selectedCardsHistory.pop();

        // Iterate over the current selectedCards and remove the .selected class from the cards that are being removed
        selectedCards.forEach(cardId => {
          if (!previousSelectedCards.includes(cardId)) {
            const cardElement = $(`.card[data-card-id="${cardId}"]`);
            cardElement.removeClass('selected');
          }
    });

    // Iterate over the previous selectedCards and add the .selected class to the cards that are being added back
    previousSelectedCards.forEach(cardId => {
      if (!selectedCards.includes(cardId)) {
        const cardElement = $(`.card[data-card-id="${cardId}"]`);
        cardElement.addClass('selected');
      }
    });

    // Set selectedCards to the previous state
    selectedCards = previousSelectedCards;

    // Update the UI or perform any necessary actions based on the previous selectedCards state
    updateCardList();

    // Save the updated selectedCards to localStorage
    localStorage.setItem('selectedCards', JSON.stringify(selectedCards));
  }
}

function downloadCardList(action) {
  if (selectedCards.length > 1) {
    const cardNames = selectedCards.map(cardId => {
      const card = data?.data.find(item => item.id === cardId);
      return card ? card.name : '';
    });

    cardNames.sort((a, b) => {
      const aIsBasic = data?.data.find(card => card.name === a)?.type_line.includes('Basic');
      const bIsBasic = data?.data.find(card => card.name === b)?.type_line.includes('Basic');

      // Sort cards with "basic" in type_line first
      if (aIsBasic && !bIsBasic) {
        return -1;
      } else if (!aIsBasic && bIsBasic) {
        return 1;
      }

      // Sort alphabetically otherwise
      return a.localeCompare(b);
    });

    const cardListText = cardNames.join('\n');

    if (action === 'download') {
      // Download the text file
      const blob = new Blob([cardListText], { type: 'text/plain' });
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
      navigator.clipboard.writeText(cardListText)
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
        }
    }
    
  function handleCardInteraction(card) {
  const cardId = card.data('card-id');
  const isSelected = card.hasClass('selected');
  recordSelectedCards();
  if (!isSelected) {
    card.addClass('selected');
    selectedCards.push(cardId);
  } else {
    card.removeClass('selected');
    const index = selectedCards.indexOf(cardId);
    if (index !== -1) {
      selectedCards.splice(index, 1);
     
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


// Initialize card list on page load
updateCardList();
totalCardCount();