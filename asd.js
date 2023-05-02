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
};

checkboxes.forEach(checkbox => checkbox.addEventListener('change', updateCardsVisibility));

    cards.forEach(card => {
      card.addEventListener('click', () => addCard(card));
      card.addEventListener('keydown', event => (event.code === 'Enter' || event.code === 'Space') && addCard(card));
    });


resetFiltersButton.addEventListener('click', () => {
  checkboxes.forEach(checkbox => checkbox.checked = false);
  cards.forEach(card => card.classList.remove('hide-card'));
});