const propertyCheckboxes = document.querySelectorAll('.property');
const colorCheckboxes = document.querySelectorAll('.color, .colorless');
const checkboxes = document.querySelectorAll('.color, .colorless, .property');
const resetFiltersButton = document.querySelector('.reset-filters');
const selectedColorCheckboxes = Array.from(colorCheckboxes).filter(checkbox => checkbox.checked);
const selectedCards = new Set();
const colorCounts = new Map([
    ['w', 0],
    ['u', 0],
    ['b', 0],
    ['r', 0],
    ['g', 0],
    ['c', 0]
]);


const properties = new Map([
    ['ability', 0],
    ['tap', 0],
    ['untap', 0],
    ['artifact', 0],
    ['creature', 0],
    ['snow', 0]
]);

const cards = document.querySelectorAll('.card');
const dfcs = document.querySelectorAll('.card:has(.dfc)');

function setTrackerTotals() {
  const trackerTotals = document.querySelectorAll('[class^="tracker tracker-"] .total');
  trackerTotals.forEach(total => {
    const recommendedCount = total.dataset.recommended;
    if (recommendedCount) {
      total.classList.add('recommended');
      total.textContent = recommendedCount;
    } else {
     total.style.display = 'none';
    }
  });
}

window.addEventListener('load', setTrackerTotals);


let numCardsAdded = 0;

const addCard = (card) => {
  const cardName = card.dataset.cardName;
  let cardColors;
  let cardAdds;

  if (card.dataset.adds) {
    cardAdds = card.dataset.adds.split(',');
    cardColors = cardAdds;
  } else {
    cardColors = card.dataset.colors.split(',');
    cardAdds = [];
  }


  if (selectedCards.has(cardName)) {
    selectedCards.delete(cardName);
    card.classList.remove('selected', 'active');
     if (card.dataset.adds) {
          cardColors = card.dataset.colors.split(',');
      }
    const addedCard = document.querySelector(`[data-combination*="${cardColors.join('')}"] .addedCard[data-card-name="${cardName}"]`);
    addedCard.remove();
    const totalElement = document.querySelector(`[data-combination*="${cardColors.join('')}"] h3 .total`);
    totalElement.textContent = parseInt(totalElement.textContent) - 1;
    cardAdds.forEach(color => colorCounts.set(color, colorCounts.get(color) - 1));
    if (cardAdds.length === 0) {
      cardColors.forEach(color => colorCounts.set(color, colorCounts.get(color) - 1));
    }
      
       
  const addedCardsElement = document.querySelector('.added-cards i');
  addedCardsElement.classList.remove(`ms-${numCardsAdded}`); 
  numCardsAdded--; 
  addedCardsElement.classList.add(`ms-${numCardsAdded}`);  
    if (numCardsAdded === 0) {
      const addedCardsInput = document.querySelector('.isAdded');
      addedCardsInput.checked = false;
    }

  } else {
    selectedCards.add(cardName);
    card.classList.add('selected');
      if (card.dataset.adds) {
          cardColors = card.dataset.colors.split(',');
      }
    const cardCombination = cardColors.sort((a, b) => "wubrgc".indexOf(a) - "wubrgc".indexOf(b)).join('');
    let cardWrapper = document.querySelector(`[data-combination*="${cardCombination}"]`);
    if (!cardWrapper) {
      cardWrapper = document.createElement('div');
      cardWrapper.dataset.combination = cardCombination;
      cardWrapper.innerHTML = `
        <h3>${cardColors.map(color => `Category not found `).join('')}<total>0</total></h3>
        <ul></ul>
      `;
      document.querySelector('.chCardWrapper').appendChild(cardWrapper);
    }
    const addedCard = document.createElement('li');
    addedCard.classList.add('addedCard');
    addedCard.dataset.cardName = card.dataset.cardName;
    addedCard.dataset.colors = card.dataset.colors;
    addedCard.textContent = card.dataset.cardName;
    cardWrapper.querySelector('ul').appendChild(addedCard);
    const totalElement = cardWrapper.querySelector('h3 .total');
    totalElement.textContent = parseInt(totalElement.textContent) + 1;
    cardAdds.forEach(color => colorCounts.set(color, colorCounts.get(color) + 1));
    if (cardAdds.length === 0) {
      cardColors.forEach(color => colorCounts.set(color, colorCounts.get(color) + 1));
    }
  
  const addedCardsElement = document.querySelector('.added-cards i');
  addedCardsElement.classList.remove(`ms-${numCardsAdded}`); 
  numCardsAdded++; 
  addedCardsElement.classList.add(`ms-${numCardsAdded}`);   

  
  }
    
    

  updateCardsVisibility();
  updateProgressBar();

};


const removeAddedCard = (addedCard) => {
  const cardName = addedCard.dataset.cardName;
  const cardColors = addedCard.dataset.colors;
  selectedCards.delete(cardName);
  addedCard.remove();
  const correspondingCard = document.querySelector(`.card[data-card-name="${cardName}"]`);
  if (correspondingCard) {
    correspondingCard.classList.remove('selected');
    const cardAdds = correspondingCard.dataset.adds ? correspondingCard.dataset.adds.split(',') : [];
    const cardColors = correspondingCard.dataset.colors.split(',');

    cardAdds.forEach(color => colorCounts.set(color, colorCounts.get(color) - 1));
    if (cardAdds.length === 0) {
      cardColors.forEach(color => colorCounts.set(color, colorCounts.get(color) - 1));
    }
  }

  // Sort cardColors before using it to find the corresponding colorList
  const sortedCardColors = cardColors.split(',').sort((a, b) => "wubrgc".indexOf(a) - "wubrgc".indexOf(b)).join('');

  // Update the list with the corresponding cardColors
  const colorList = document.querySelector(`div[data-combination="${sortedCardColors}"] ul`);
  if (colorList) {
    const totalElement = document.querySelector(`[data-combination*="${sortedCardColors}"] h3 .total`);
    totalElement.textContent = parseInt(totalElement.textContent) - 1;
  }

  // remove .selected class from corresponding .card element if it exists
  const selectedCard = document.querySelector(`.card.selected[data-card-name="${cardName}"]`);
  if (selectedCard) {
    selectedCard.classList.remove('selected');
  }

  const addedCardsElement = document.querySelector('.added-cards i');
  addedCardsElement.classList.remove(`ms-${numCardsAdded}`);
  numCardsAdded--;
  addedCardsElement.classList.add(`ms-${numCardsAdded}`);
  if (numCardsAdded === 0) {
    const addedCardsInput = document.querySelector('.isAdded');
    addedCardsInput.checked = false;
  }

  // Store a copy of the card node instead of a reference to the original node

  updateCardsVisibility();
  updateProgressBar();
};

// define a global variable to store previously selected cards
let previousSelectedCards = new Set();

const clearSelectedCards = () => {
  if (selectedCards.size === 0) {
    return;
  }
  // store the current set of selected cards before clearing
  previousSelectedCards = new Set(selectedCards);
  selectedCards.clear();
  document.querySelectorAll('.card.selected').forEach(card => {
    card.classList.remove('selected', 'active');
  });
  document.querySelectorAll('.addedCard').forEach(card => {
    card.remove();
  });
  colorCounts.forEach((count, color) => {
    colorCounts.set(color, 0);
  });
    const totalElements = document.querySelectorAll('.combination h3 .total');
    totalElements.forEach((totalElement) => {
      totalElement.textContent = '0';
    });
    const addedCardsElement = document.querySelector('.added-cards i');
    addedCardsElement.classList.remove(`ms-${numCardsAdded}`);
    numCardsAdded = 0;
    addedCardsElement.classList.add(`ms-${numCardsAdded}`);
    const addedCardsInput = document.querySelector('.isAdded');
    addedCardsInput.checked = false;
    
    updateCardsVisibility();
    updateProgressBar();
};

const undoClearSelectedCards = () => {
  // re-select previously selected cards
  previousSelectedCards.forEach(cardName => {
    const card = document.querySelector(`.card[data-card-name="${cardName}"]`);
    addCard(card);
  });
};

document.querySelector('.clearList').addEventListener('click', clearSelectedCards);
document.querySelector('.undoButton').addEventListener('click', undoClearSelectedCards);



document.querySelector('.chCardWrapper').addEventListener('click', (event) => {
  const addedCard = event.target.closest('.addedCard');
  if (addedCard) removeAddedCard(addedCard);
});




function updateProgressBar() {
  let totalColorCount = Array.from(colorCounts.values()).reduce((a, b) => a + b, 0);

  const totalCount = Object.values(colorCounts).reduce((acc, count) => acc + count, 0);

  colorCounts.forEach((count, color) => {
    const percentage = totalColorCount === 0 ? 0 : Math.round(count / totalColorCount * 100);
    const progressBar = document.querySelector(`.progress-bar-${color}`);
    if (progressBar) {
        if (count != 0) {
            progressBar.classList.add('hasMana');
        }
        else {
            progressBar.classList.remove('hasMana');
        }
      progressBar.style.width = `${percentage}%`;
      progressBar.textContent = `${percentage}%`;
    }

    const currentCount = document.querySelector(`.tracker-${color} .current`);
    if (currentCount) {
      currentCount.textContent = count || 0;
    }

    const total = document.querySelector(`.tracker-${color} .total`);
    const recommendedCount = total.dataset.recommended;
    if (currentCount && currentCount.textContent >= recommendedCount) {
      currentCount.classList.add('quotaFilled');
    } else if (currentCount) {
      currentCount.classList.remove('quotaFilled');
    }
  });
}

$(document).on('click', '.flip-button', function() {
  const card = $(this).closest('.card');
  card.toggleClass('flipped');
});



const updateCardsVisibility = () => {
    const selectedColors = Array.from(document.querySelectorAll('.color:checked, .colorless:checked')).map(checkbox => checkbox.value);
    const selectedProperties = Array.from(document.querySelectorAll('.property:checked')).map(checkbox => checkbox.value);

    cards.forEach(card => {
        const cardColors = card.dataset.colors?.split(',') ?? [];
        const cardProperties = card.dataset.properties?.split(',') ?? [];

        const shouldShowColor = selectedColors.length === 0 ||
            cardColors.length === 0 ||
            cardColors.every(color => selectedColors.includes(color));

        const shouldShowProperties = selectedProperties.length === 0 ||
            cardProperties.length === 0 ||
            selectedProperties.every(property => cardProperties.includes(property));

        card.classList.toggle('hide-card', !(shouldShowColor && shouldShowProperties));
    });
    updateMobileColorFilters();
};




document.querySelectorAll('.buffet-filters .parent').forEach(parentCheckbox => {
    parentCheckbox.addEventListener('change', () => {
        if (parentCheckbox.checked) {
            document.querySelectorAll('.buffet-filters .parent:checked').forEach(otherChecked => {
                if (otherChecked !== parentCheckbox) {
                    otherChecked.checked = false;
                }
            });
        }
    });
});


resetFiltersButton.addEventListener('click', () => {
    checkboxes.forEach(checkbox => checkbox.checked = false);
    cards.forEach(card => card.classList.remove('hide-card'));
    updateMobileColorFilters();


    $('#search').val('');
    $('#search').trigger('input');

});

checkboxes.forEach(checkbox => checkbox.addEventListener('change', updateCardsVisibility));

cards.forEach(card => {
  const flipButton = card.querySelector('.flip-button');
  
  const handleClick = event => {
    // Check if the clicked element is the flip button or its descendant
    if (!flipButton || !flipButton.contains(event.target)) {
      addCard(card);
    }
  };
  
  card.addEventListener('click', handleClick);
  card.addEventListener('keydown', event => (event.code === 'Enter' || event.code === 'Space') && handleClick(event));
});


dfcs.forEach(dfc => {
  const dfcButton = dfc.querySelector('.flip-button');
  dfcButton.addEventListener('click', () => flipCard(dfc));
});


const updateMobileColorFilters = () => {
    const selectedColorCheckboxes = document.querySelectorAll('.color:checked, .colorless:checked');
    const selectedPropertyCheckboxes = document.querySelectorAll('.section-dropdown .property:checked');

    const iElements = Array.from(selectedColorCheckboxes).map(cb => {
        const i = document.createElement('i');
        i.classList.add('ms', 'ms-' + cb.value);
        return i;
    });

    if (selectedColorCheckboxes.length === 0) {
        const i = document.createElement('i');
        i.classList.add('ms', 'ms-multicolor');
        iElements.push(i);
    }

    const targetElements = document.querySelectorAll('.mobileColorTarget');
    targetElements.forEach(target => {
        target.querySelectorAll('i').forEach(i => i.remove());
        iElements.forEach(i => target.appendChild(i));
    });

    const propertyElements = document.querySelectorAll('.propertyTarget');
    propertyElements.forEach(target => {
        target.querySelectorAll('i').forEach(i => i.remove());

        
 Array.from(selectedPropertyCheckboxes).forEach(cb => {
  const i = document.createElement('i');
  if (cb.value !== 'gtc') {
    i.classList.add('ms', 'ms-' + cb.value);
    
  } else {
    i.classList.add('ss', 'ss-' + cb.value);

  }

  target.appendChild(i);
});

        
        
        
        
        
        
        if (selectedPropertyCheckboxes.length === 0) {
            const i = document.createElement('i');
            i.classList.add('ms', 'ms-land');
            target.appendChild(i);
        }
    });
};


const updateFiltersFromUrl = () => {
    const queryParams = new URLSearchParams(window.location.search);
    const selectedColors = queryParams.get('colors')?.split(',') ?? [];
    const selectedProperties = queryParams.get('properties')?.split(',') ?? [];

    colorCheckboxes.forEach(checkbox => {
        const value = checkbox.value;
        checkbox.checked = selectedColors.includes(value);
    });

    propertyCheckboxes.forEach(checkbox => {
        const value = checkbox.value;
        checkbox.checked = selectedProperties.includes(value);
    });
};

const updateUrlFromFilters = () => {
    const selectedColors = Array.from(colorCheckboxes).filter(checkbox => checkbox.checked).map(checkbox => checkbox.value);
    const selectedProperties = Array.from(propertyCheckboxes).filter(checkbox => checkbox.checked).map(checkbox => checkbox.value);
    const queryParams = new URLSearchParams();

    if (selectedColors.length > 0) {
        queryParams.set('colors', selectedColors.join(','));
    }

    if (selectedProperties.length > 0) {
        queryParams.set('properties', selectedProperties.join(','));
    }

    const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?${queryParams.toString()}${window.location.hash}`;
    window.history.replaceState({
        path: newUrl
    }, '', newUrl);
};

document.querySelectorAll('.buffet-filters .parent').forEach(parentCheckbox => {
    parentCheckbox.addEventListener('change', () => {
        if (parentCheckbox.checked) {
            document.querySelectorAll('.buffet-filters .parent:checked').forEach(otherChecked => {
                if (otherChecked !== parentCheckbox) {
                    otherChecked.checked = false;
                }
            });
        }
    });
});

resetFiltersButton.addEventListener('click', () => {
    checkboxes.forEach(checkbox => checkbox.checked = false);
    cards.forEach(card => card.classList.remove('hide-card'));
    updateMobileColorFilters();
    updateUrlFromFilters();
});

checkboxes.forEach(checkbox => checkbox.addEventListener('change', () => {
    updateCardsVisibility();
    updateUrlFromFilters();
}));


updateFiltersFromUrl();
updateCardsVisibility();