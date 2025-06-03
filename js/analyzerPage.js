'use strict';

function getAnalyzerDataFromLocalStorage() {
  const responseDataString = localStorage.getItem('responseData');
  const analyzedDataString = localStorage.getItem('analyzedData');

  let responseData = null;
  let analyzedData = null;

  if (responseDataString) {
    try {
      responseData = JSON.parse(responseDataString);
      console.log('Successfully retrieved responseData from localStorage:', responseData);
    } catch (error) {
      console.error('Error parsing responseData from localStorage:', error);
    }
  } else {
    console.log('responseData not found in localStorage.');
  }

  if (analyzedDataString) {
    try {
      analyzedData = JSON.parse(analyzedDataString);
      console.log('Successfully retrieved analyzedData from localStorage:', analyzedData);
    } catch (error) {
      console.error('Error parsing analyzedData from localStorage:', error);
    }
  } else {
    console.log('analyzedData not found in localStorage.');
  }

  return { responseData, analyzedData };
}

function parseManaCost(manaCostString) {
  'use strict';
  if (!manaCostString) {
    return '';
  }
  // Regex to find all occurrences of {MANA_SYMBOL}
  const manaSymbolRegex = /{([^}]+)}/g;
  let html = '';
  let match;
  while ((match = manaSymbolRegex.exec(manaCostString)) !== null) {
    let symbol = match[1];
    // Remove slashes for hybrid symbols, e.g., "W/U" -> "WU"
    symbol = symbol.replace('/', '');
    // Convert to lowercase for the CSS class
    const className = symbol.toLowerCase();
    html += `<i class="ms ms-${className}"></i>`;
  }
  return html;
}

function getWeightForCardColor(cardCmC, specificColor, analyzedCardEntry, recommendations) {
  if (!analyzedCardEntry || !analyzedCardEntry.colorWeight) {
    return 3;
  }

  let effectiveCmC = cardCmC;
  if (cardCmC < 1) effectiveCmC = 1;

  const maxCmcKey = recommendations && Object.keys(recommendations).length > 0 ?
                    Math.max(...Object.keys(recommendations)
                                    .filter(k => k.startsWith('cmc_'))
                                    .map(k => parseInt(k.split('_')[1], 10)))
                    : 7;
  if (cardCmC > maxCmcKey) effectiveCmC = maxCmcKey;

  const symbolCount = analyzedCardEntry.colorWeight[specificColor];

  if (typeof symbolCount !== 'number' || symbolCount <= 0) {
    return 3;
  }

  let lookupCmc = effectiveCmC;
  let baseWeight = 0;

  while (lookupCmc >= 1) {
    const recoCmcKey = `cmc_${lookupCmc}`;
    // Cap symbol count at 5 for lookup as per common recommendation structures.
    // Adjust if your recommendations.json uses higher symbol counts.
    const recoSymbolKey = `symbols_${Math.min(symbolCount, 5)}`;

    if (recommendations && recommendations[recoCmcKey] && recommendations[recoCmcKey][recoSymbolKey] !== undefined) {
      baseWeight = recommendations[recoCmcKey][recoSymbolKey];
      break;
    } else if (lookupCmc > 1) {
      lookupCmc--;
    } else {
      baseWeight = 0;
      break;
    }
  }
  return baseWeight * 3;
}

function createCardListItem(cardData, specificColor, analyzedCardEntry, recommendations) {
  const weight = getWeightForCardColor(cardData.cmc, specificColor, analyzedCardEntry, recommendations);
  const id = cardData.id;
  const name = cardData.name;
  const manaCostHtml = parseManaCost(cardData.mana_cost || '');

  let dataColorsString = "C";
  if (cardData.colors && cardData.colors.length > 0) {
    dataColorsString = cardData.colors.join("");
  }

  return `
    <li class="addedCard" data-card-id="${id}" data-card-name="${name}" data-colors="${dataColorsString}" data-weight="${weight}" style="--weight: ${weight}%;">
      <span class="chCardTextContainer cardName">${name}</span>
      <span class="cost">${manaCostHtml}</span>
    </li>
  `;
}

async function fetchRecommendations() {
  try {
    const response = await fetch('data/recommendations.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const recommendations = await response.json();
    console.log('Successfully fetched recommendations.json:', recommendations);
    return recommendations;
  } catch (error) {
    console.error('Error fetching recommendations.json:', error);
    return null;
  }
}

async function populateCardLists() {
  'use strict';

  const { responseData, analyzedData } = getAnalyzerDataFromLocalStorage();
  const recommendations = await fetchRecommendations();

  if (!responseData || !recommendations) {
    console.error('Missing responseData or recommendations. Cannot populate card lists.');
    if (!responseData) console.log('responseData:', responseData);
    if (!recommendations) console.log('recommendations:', recommendations);
    // Optionally display a user-friendly message on the page
    // For example: document.getElementById('some-status-area').textContent = 'Error loading card data.';
    return;
  }

  const analyzedDataMap = new Map();
  if (analyzedData) {
    analyzedData.forEach(item => analyzedDataMap.set(item.name, item));
  }
  console.log('AnalyzedDataMap created:', analyzedDataMap);

  // Clear existing dynamically added cards from all target .cardList uls
  document.querySelectorAll('.cardList ul').forEach(ul => {
    ul.querySelectorAll('li.addedCard').forEach(li => li.remove());
  });
  console.log('Cleared existing card items (li.addedCard) from lists.');

  responseData.forEach(card => {
    // --- START OF CMC/MANA_VALUE FILTER LOGIC ---
    // We only want to display cards that have a CMC > 0.
    // The 'cmc' field in Scryfall data corresponds to mana_value.
    if (!(card.cmc > 0)) { // Checks if cmc is not null, undefined, 0, or negative
      console.log(`Skipping card with cmc not greater than 0: ${card.name} (cmc: ${card.cmc})`);
      return; // Skips current iteration of responseData.forEach
    }
    // --- END OF CMC/MANA_VALUE FILTER LOGIC ---
    const analyzedCardEntry = analyzedDataMap.get(card.name) || null;

    let cardColors = card.colors;
    // If a card is colorless (e.g. an artifact with no colored mana symbols in its cost)
    // or if its colors array is empty for any other reason, treat it as 'C'.
    if (!cardColors || cardColors.length === 0) {
      // Scryfall data for "colorless" cards (like artifacts, lands) might have an empty `colors` array.
      // For our purpose, we want to categorize them under 'C'.
      cardColors = ['C'];
    }

    cardColors.forEach(color => {
      const specificColor = color.toUpperCase(); // Ensure consistency e.g. 'W', 'U', 'C'
      const listItemHtml = createCardListItem(card, specificColor, analyzedCardEntry, recommendations);

      const targetListSelector = `.cardList.color-${specificColor.toLowerCase()} ul`;
      const targetUl = document.querySelector(targetListSelector);

      if (targetUl) {
        targetUl.insertAdjacentHTML('beforeend', listItemHtml);
      } else {
        console.warn(`Target UL not found for selector: ${targetListSelector} for card ${card.name} with color ${specificColor}`);
      }
    });
  });
  console.log('Finished adding new card items to lists (unsorted).');

  // Sort cards within each list and update counts
  document.querySelectorAll('.cardList').forEach(cardListDiv => {
    const ul = cardListDiv.querySelector('ul');
    if (!ul) return;

    const listItems = Array.from(ul.querySelectorAll('li.addedCard'));

    listItems.sort((a, b) => {
      const weightA = parseFloat(a.dataset.weight) || 0;
      const weightB = parseFloat(b.dataset.weight) || 0;
      // Primary sort: weight descending
      // Secondary sort: card name ascending if weights are equal
      if (weightB !== weightA) {
        return weightB - weightA;
      }
      const nameA = a.dataset.cardName || '';
      const nameB = b.dataset.cardName || '';
      return nameA.localeCompare(nameB);
    });

    listItems.forEach(li => ul.appendChild(li));

    const headerTotalSpan = cardListDiv.querySelector('.cardListHeader .total');
    if (headerTotalSpan) {
      headerTotalSpan.textContent = listItems.length;
    }
  });
  console.log('Finished sorting lists and updating counts.');
}
