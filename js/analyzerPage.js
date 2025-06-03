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
    html += `<i class="ms ms-cost ms-${className}"></i>`;
  }
  return html;
}

function getWeightForCardColor(cardCmC, specificColor, analyzedCardEntry, recommendations, recommendedLandCount) {
  if (!analyzedCardEntry || !analyzedCardEntry.colorWeight) {
    return 3; // Default weight if essential data is missing
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
    return 3; // Default weight if symbol count is invalid
  }

  let lookupCmc = effectiveCmC;
  let baseWeight = 0;

  while (lookupCmc >= 1) {
    const recoCmcKey = `cmc_${lookupCmc}`;
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
  
  if (recommendedLandCount > 0) {
    const percentage = (baseWeight / recommendedLandCount) * 100;
    return Math.round(percentage); // Round to nearest whole number
  } else {
    console.warn(`recommendedLandCount is not positive (${recommendedLandCount}), defaulting weight to 0 for ${specificColor} symbol requirement ${baseWeight}`);
    return 0; 
  }
}

function createCardListItem(cardData, specificColor, analyzedCardEntry, recommendations, recommendedLandCount) {
  const weight = getWeightForCardColor(cardData.cmc, specificColor, analyzedCardEntry, recommendations, recommendedLandCount);
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

  // Helper function defined inside populateCardLists
  function deriveColorsFromManaCost(manaCostString) {
    if (!manaCostString || manaCostString.trim() === '') {
      return [];
    }
    const costColors = new Set();
    const manaSymbolRegex = /{([^}]+)}/g;
    let match;
    while ((match = manaSymbolRegex.exec(manaCostString)) !== null) {
      let symbolPart = match[1].toUpperCase();
      symbolPart = symbolPart.replace('/P', '').replace('P/', '');
      
      if (symbolPart.includes('/')) { 
        const parts = symbolPart.split('/');
        parts.forEach(p => {
          if (['W', 'U', 'B', 'R', 'G'].includes(p)) {
            costColors.add(p);
          }
        });
      } else { 
        if (['W', 'U', 'B', 'R', 'G'].includes(symbolPart)) {
          costColors.add(symbolPart);
        }
      }
    }
    return Array.from(costColors);
  }

  const { responseData, analyzedData } = getAnalyzerDataFromLocalStorage();
  const recommendations = await fetchRecommendations();

  let recommendedLandCount = parseInt(localStorage.getItem('recommendedLandCount'), 10);
  if (isNaN(recommendedLandCount) || recommendedLandCount <= 0) {
    console.warn('Invalid or missing recommendedLandCount from localStorage, defaulting to 38 for weight calculation.');
    recommendedLandCount = 38; // Default fallback
  }

  if (!responseData || !recommendations) {
    console.error('Missing responseData or recommendations. Cannot populate card lists.');
    if (!responseData) console.log('responseData:', responseData);
    if (!recommendations) console.log('recommendations:', recommendations);
    return;
  }

  const analyzedDataMap = new Map();
  if (analyzedData) {
    analyzedData.forEach(item => analyzedDataMap.set(item.name, item));
  }
  console.log('AnalyzedDataMap created:', analyzedDataMap);

  document.querySelectorAll('.cardList ul').forEach(ul => {
    ul.querySelectorAll('li.addedCard').forEach(li => li.remove());
  });
  console.log('Cleared existing card items (li.addedCard) from lists.');

  responseData.forEach(card => {
    console.log(`Processing card for analyzer list: Name: "${card.name}", Mana Cost: "${card.mana_cost}", Colors: ${JSON.stringify(card.colors)}, CMC: ${card.cmc}`);
    if (!(card.cmc > 0)) { 
      console.log(`Skipping card with cmc not greater than 0: ${card.name} (cmc: ${card.cmc})`);
      return; 
    }
    const analyzedCardEntry = analyzedDataMap.get(card.name) || null;
    
    // --- START OF NEW REFINED COLOR DETERMINATION (for DFCs) ---
    let determinedCardColors = [];

    // 1. Try top-level card.colors
    if (card.colors && card.colors.length > 0) {
      determinedCardColors = card.colors;
    }

    // 2. If no colors yet, and it's a DFC, try face 0 colors
    if (determinedCardColors.length === 0 && card.card_faces && card.card_faces.length > 0) {
      const firstFace = card.card_faces[0];
      if (firstFace.colors && firstFace.colors.length > 0) {
        determinedCardColors = firstFace.colors;
        console.log(`Using colors from face 0 for "${card.name}": ${JSON.stringify(determinedCardColors)}`);
      } else if (firstFace.mana_cost && firstFace.mana_cost.trim() !== '') {
        // 3. If face 0 has no colors, try deriving from face 0 mana_cost
        determinedCardColors = deriveColorsFromManaCost(firstFace.mana_cost);
        if (determinedCardColors.length > 0) {
          console.log(`Derived colors from face 0 mana_cost for "${card.name}": ${JSON.stringify(determinedCardColors)}`);
        }
      }
    }

    // 4. If still no colors, try top-level card.mana_cost (general fallback)
    if (determinedCardColors.length === 0 && card.mana_cost && card.mana_cost.trim() !== '') {
      determinedCardColors = deriveColorsFromManaCost(card.mana_cost);
      if (determinedCardColors.length > 0) {
        console.log(`Derived colors from top-level mana_cost for "${card.name}": ${JSON.stringify(determinedCardColors)}`);
      }
    }

    // 5. Final fallback to Colorless
    if (determinedCardColors.length === 0) {
      determinedCardColors = ['C'];
    }
    // --- END OF NEW REFINED COLOR DETERMINATION ---

    determinedCardColors.forEach(colorString => {
      const specificColor = colorString.toUpperCase(); 
      const listItemHtml = createCardListItem(card, specificColor, analyzedCardEntry, recommendations, recommendedLandCount);
      
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

  document.querySelectorAll('.cardList').forEach(cardListDiv => {
    const ul = cardListDiv.querySelector('ul');
    if (!ul) return;

    const listItems = Array.from(ul.querySelectorAll('li.addedCard')); 
    
    listItems.sort((a, b) => {
      const weightA = parseFloat(a.dataset.weight) || 0;
      const weightB = parseFloat(b.dataset.weight) || 0;
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

  console.log('Starting cleanup and reveal of card lists...');
  document.querySelectorAll('.analyzer .cardList').forEach(cardListDiv => {
    const ul = cardListDiv.querySelector('ul');
    let hasCards = false;
    if (ul) {
      if (ul.querySelector('li.addedCard')) {
        hasCards = true;
      }
    }

    if (hasCards) {
      cardListDiv.style.display = 'block'; 
      console.log(`Revealed card list: ${cardListDiv.className}`);
    } else {
      cardListDiv.remove();
      console.log(`Removed empty card list: ${cardListDiv.className}`);
    }
  });
  console.log('Finished cleanup and reveal of card lists.');
}
