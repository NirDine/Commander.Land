(function() {
  // Load userList and landsData from localStorage
  const storedUserList = localStorage.getItem('userList');
  const storedLandsData = localStorage.getItem('landsData');

  if (storedUserList) {
    const userList = JSON.parse(storedUserList);
    const landsData = JSON.parse(storedLandsData);

    // Check if userList is empty
    if (userList.length === 0) {
      // No need to update selectedCards if userList is empty
      // Clear the userList once cards are added
      localStorage.removeItem('userList');
      return;
    }

    // Retrieve selectedCards from localStorage
    const storedSelectedCards = localStorage.getItem('selectedCards');
    let selectedCards = storedSelectedCards ? JSON.parse(storedSelectedCards) : [];

    // Track the processed non-basic lands
    const processedNonBasicLands = [];

    // Iterate over each entry in userList
    userList.forEach(userCard => {
      const cardId = userCard.cardId;
      const quantity = userCard.quantity;

      // Find the corresponding card in landsData based on card ID
      const matchedCard = landsData.data.find(card => card.id === cardId);

      // Check if a match is found and the card is a basic land
      if (matchedCard && matchedCard.is_basic) {
        // Add the card ID to selectedCards multiple times based on quantity
        for (let i = 0; i < quantity; i++) {
          selectedCards.push(cardId);
        }
      } else if (matchedCard && !matchedCard.is_basic && !processedNonBasicLands.includes(cardId)) {
        // Add non-basic land card only once
        selectedCards.push(cardId);
        processedNonBasicLands.push(cardId);
      }
        
      for (let i = 0; i < quantity; i++) {
            
        // Check if the card is already selected in the UI
            const cardElement = cardSuggestions.find(`[data-card-id="${cardId}"]`);
            if (cardElement && !cardElement.hasClass('selected')) {
            cardElement.addClass('selected');
          }
        } 
    });

    // Clear the userList once cards are added
    localStorage.removeItem('userList');

    // Store updated selectedCards in localStorage
    localStorage.setItem('selectedCards', JSON.stringify(selectedCards));

  }
})();


// Retrieve responseData from localStorage
const storedResponseData = localStorage.getItem('responseData');

// Check if responseData is present in localStorage
if (storedResponseData) {
  const responseData = JSON.parse(storedResponseData);
    
// Analyze responseData and calculate cmc, colorWeight, and hybridPips for each card
const analyzedData = responseData.data.map(card => {
  console.log(`Analyzing card: ${card.name}`);
  
  let cmc = card.cmc;
  let colorWeight = {};
  let hybridPips = {
    total: 0,
    colors: []
  };

  const manaCost = card.mana_cost;
  const manaSymbols = manaCost.match(/{.*?}/g) || [];

  manaSymbols.forEach(symbol => {
    const cleanSymbol = symbol.replace(/[{}]/g, '');

    if (cleanSymbol.includes('/')) {
      // Hybrid pip detected
      hybridPips.total++;
      const colors = cleanSymbol.split('/');
      hybridPips.colors.push(colors);
      colors.forEach(color => {
        colorWeight[color] = (colorWeight[color] || 0) + 1;
      });
    } else if (cleanSymbol === 'P') {
      // Ignore hybrid pips with Phyrexian mana
      return;
    } else if (!isNaN(cleanSymbol)) {
      // Generic mana
      colorWeight['N'] = (colorWeight['N'] || 0) + parseInt(cleanSymbol);
    } else {
      // Colored pip
      colorWeight[cleanSymbol] = (colorWeight[cleanSymbol] || 0) + 1;
    }
  });

  return {
    name: card.name,
    id: card.id,
    cmc,
    colorWeight,
    hybridPips,
  };
});

  console.log(analyzedData);

  // Store analyzedData in local storage as a JSON string
  localStorage.setItem('analyzedData', JSON.stringify(analyzedData));
    
// Load recommendationsData from the recommendations.json file
$.getJSON('../data/recommendations.json', function(data) {
  const recommendationsData = data;

  // Call the function that uses the recommendationsData
  processCards(recommendationsData);
  // Call the updateColorTracker function with the colorRecommendations data


});

function processCards(recommendationsData) {

// Create an object to store the highest result per color
const highestResults = {};

analyzedData.forEach(card => {
  const cmc = card.cmc;
  const colorWeight = card.colorWeight;
  const cmcData = recommendationsData[cmc];

  if (cmcData) {
    Object.entries(colorWeight).forEach(([color, weight]) => {
      if (color !== 'N' && color !== 'X' && cmcData.hasOwnProperty(weight)) {
        const result = cmcData[weight];
        if (!highestResults[color] || result > highestResults[color]) {
          highestResults[color] = result;
        }
      }
    });
    
  } else {
    console.log(`Card CMC: ${cmc}, Color Weight: ${JSON.stringify(colorWeight)}, Result: Not found`);
  }
    
// Create an array of color recommendations with the highest result per color
const colorRecommendations = Object.entries(highestResults).map(([color, result]) => ({ color, result }));

console.log(colorRecommendations);
updateColorTracker(colorRecommendations);

});



}

} else {
  console.log('responseData not found in localStorage');
}


// Check if responseData is present in localStorage
if (storedResponseData) {
  const responseData = JSON.parse(storedResponseData);

  // Calculate the average cmc of all cards in responseData
  const cardCount = responseData.data.length;
  const totalCmc = responseData.data.reduce((sum, card) => sum + card.cmc, 0);
  const averageCmc = totalCmc / cardCount;

  // Count the number of cards with non-zero produced_mana value and cmc between 1 and 3 (inclusive)
  const nonLandManaProducers = responseData.data.filter(card => card.produced_mana && card.cmc >= 1 && card.cmc <= 3).length;

  // Calculate the recommendedLandCount using the formula
  let recommendedLandCount = 31.42 + (3.13 * averageCmc) - (0.28 * nonLandManaProducers);
  recommendedLandCount = Math.round(recommendedLandCount);
  $(`.totalCards .total`).text(recommendedLandCount).addClass('hasUserData');
  console.log('Average CMC:', averageCmc);
  console.log('Non-Land Mana Producers (1-3 CMC):', nonLandManaProducers);
  console.log('Recommended Land Count:', recommendedLandCount);
} else {
  console.log('responseData not found in localStorage');
}


function updateColorTracker(colorRecommendations) {
  // Iterate over the colorRecommendations data
  colorRecommendations.forEach(({ color, result }) => {
    // Check if the color recommendation exists

      $(`.tracker-${color} span .total`).text(result).removeClass('noRec').addClass('recommended');
      


  });
}