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

const addCard = (card) => {
  const cardName = card.dataset.cardName;
  const cardColors = card.dataset.colors.split(',');

  if (selectedCards.has(cardName)) {
    selectedCards.delete(cardName);
    card.classList.remove('selected', 'active');
    document.querySelector(`.addedCard[data-card-name="${cardName}"]`).remove();
    cardColors.forEach(color => colorCounts.set(color, colorCounts.get(color) - 1));
  } else {
    selectedCards.add(cardName);
    card.classList.add('selected');
    const addedCard = card.cloneNode(true);
    addedCard.classList.remove('card');
    addedCard.classList.add('addedCard');
    document.querySelector('.chContainer').appendChild(addedCard);
    cardColors.forEach(color => colorCounts.set(color, colorCounts.get(color) + 1));
  }

  cards.forEach(card => {
    const cardColors = card.dataset.colors.split(',');
    const shouldShowCard = Array.from(selectedColorCheckboxes).every(checkbox => !checkbox.checked || cardColors.includes(checkbox.value));
    const addedCard = document.querySelector(`.addedCard[data-card-name="${card.dataset.cardName}"]`);
    card.classList.toggle('hide-card', !shouldShowCard);
    if (addedCard) addedCard.classList.toggle('hide-card', !shouldShowCard);
  });

  updateCardsVisibility();
};

const removeAddedCard = (addedCard) => {
  const cardName = addedCard.dataset.cardName;
  selectedCards.delete(cardName);
  addedCard.remove();
  addedCard.dataset.colors.split(',').forEach(color => colorCounts.set(color, colorCounts.get(color) - 1));
  const correspondingCard = document.querySelector(`.card[data-card-name="${cardName}"]`);
  if (correspondingCard) {
    correspondingCard.classList.remove('selected');
  }
};

document.querySelector('.chContainer').addEventListener('click', (event) => {
  const addedCard = event.target.closest('.addedCard');
  if (addedCard) removeAddedCard(addedCard);
});


const updateCardsVisibility = () => {
  const selectedColors = Array.from(document.querySelectorAll('.color:checked, .colorless:checked')).map(checkbox => checkbox.value);
  const selectedProperties = Array.from(document.querySelectorAll('.property:checked')).map(checkbox => checkbox.value);

  cards.forEach(card => {
    const cardColors = card.dataset.colors?.split(',') ?? [];
    const cardProperties = card.dataset.properties?.split(',') ?? [];

    const shouldShowCard =
      (selectedColors.length === 0 || cardColors.some(color => selectedColors.includes(color))) &&
      (selectedProperties.length === 0 || cardProperties.some(prop => selectedProperties.includes(prop)));

    card.classList.toggle('hide-card', !shouldShowCard);
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
  card.addEventListener('click', () => addCard(card));
  card.addEventListener('keydown', event => (event.code === 'Enter' || event.code === 'Space') && addCard(card));
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
      i.classList.add('ms', 'ms-' + cb.value);
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
  window.history.replaceState({ path: newUrl }, '', newUrl);
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