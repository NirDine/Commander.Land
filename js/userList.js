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
      const quantity = userCard.quantity;
      const cardName = userCard.name;
      
      // Find the corresponding card in landsData based on card name
      const matchedCard = landsData.data.find(card => {
        if (card.card_faces && card.card_faces.length > 1) {
          // Check if the card has two faces
          const frontFaceName = card.card_faces[0].name;
          const backFaceName = card.card_faces[1].name;
          // Match the card names with both the front face name and the combined name of frontName // backName
          return cardName === frontFaceName || cardName === `${frontFaceName} // ${backFaceName}`;
        } else {
          // For cards without two faces, match the card name directly
          return card.name === cardName;
        }
      });

      // Check if a match is found and the card is a basic land
      if (matchedCard && matchedCard.is_basic) {
        // Add the card name to selectedCards multiple times based on quantity
        for (let i = 0; i < quantity; i++) {
          selectedCards.push(cardName);
        }
      } else if (matchedCard && !matchedCard.is_basic && !processedNonBasicLands.includes(cardName)) {
        // Add non-basic land card only once
        if (matchedCard.card_faces) {
          const frontFaceName = matchedCard.card_faces[0].name;
          const backFaceName = matchedCard.card_faces[1].name;
        selectedCards.push(frontFaceName + ' // ' + backFaceName);
        }
        else {
            selectedCards.push(cardName);
        }

        processedNonBasicLands.push(cardName);
      
      } else {

      }

      for (let i = 0; i < quantity; i++) {
        // Check if the card is already selected in the UI
        const cardElement = cardSuggestions.find(`[data-card-name="${cardName}"]`);
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
const analyzedData = responseData.map(card => {

  
  let cmc = card.cmc;
  let analyzedCardName = card.name;
  let colorWeight = {};
  let hybridPips = {
    total: 0,
    colors: []
  };

  const manaCost = card.mana_cost || ''; // Add this line to handle missing mana_cost property
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
    cmc,
    colorWeight,
    hybridPips,
  };
});


  // Store analyzedData in local storage as a JSON string
  localStorage.setItem('analyzedData', JSON.stringify(analyzedData));
    
// Load recommendationsData from the recommendations.json file
$.getJSON('/Commander.Land/data/recommendations.json', function(data) {
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
    console.log(`Card CMC: ${cmc}, Color Weight: ${JSON.stringify(colorWeight)}`);
    
    
    });
    
  } else {
    console.log(`Card CMC: ${cmc}, Color Weight: ${JSON.stringify(colorWeight)}, Result: Not found`);
  }
    
// Create an array of color recommendations with the highest result per color
const colorRecommendations = Object.entries(highestResults).map(([color, result]) => ({ color, result }));


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
  const cardCount = responseData.length;
  const totalCmc = responseData.reduce((sum, card) => sum + card.cmc, 0);
  const averageCmc = totalCmc / cardCount;

 // Count the number of unique non-land cards in the user's list
  const NonLandCardsTotal = responseData.filter(card => 
      !card.type_line.includes("Land")
    ).length;
    
  // Count the number of cards with non-zero produced_mana value and cmc between 1 and 3 (inclusive)
    const nonLandManaProducers = responseData.filter(card => 
      card.produced_mana && card.cmc <= 3 && !card.type_line.includes("Land")
    ).length;
    
   // Count the number of cards that draw cards with cmc between 1 and 3 (inclusive)
    const cantrips = responseData.filter(card => 
      (card.oracle_text.includes("Draw") || card.oracle_text.includes("draw")) &&
      card.cmc <= 3 && 
      !card.type_line.includes("Land")
    ).length;

    // Count the number of cards that put lands into play with cmc between 1 and 3 (inclusive)
    const ramp = responseData.filter(card => 
      card.cmc <= 3 &&
      card.oracle_text.includes("land") && 
      card.oracle_text.includes("onto") && card.oracle_text.includes("battlefield") &&
      !card.type_line.includes("Land")
    ).length;
    
  // Calculate the recommendedLandCount using the formula
  let recommendedLandCount = 31.42 + (3.13 * averageCmc) - (0.28 * (nonLandManaProducers + cantrips + ramp));
  recommendedLandCount = Math.round(recommendedLandCount);
  $(`.totalCards .total`).text(recommendedLandCount).addClass('hasUserData');
  $(`.recommended .manaProducers`).text('(' + nonLandManaProducers + ramp + ')');  
  $(`.recommended .recommendedLandCount`).text(recommendedLandCount);
  $(`.recommended .recommendedTotalCards`).text('(' + NonLandCardsTotal + ')');
 console.log('Average CMC:', averageCmc);
 console.log('Non-Land mana producers (1-3 CMC):', nonLandManaProducers);
 console.log('Card draw (1-3 CMC):',  cantrips);
 console.log('Recommended land count:', recommendedLandCount);
} else {
  console.log('responseData not found in localStorage');
}

function updateColorTracker(colorRecommendations) {
    const recommended = $('.recommended');
  const recommendedManaPips = $('.recommendedManaPips');
  
  // Empty the recommendedManaPips element
  recommendedManaPips.empty();
      // Define the color order
    const colorOrder = ['W', 'U', 'B', 'R', 'G', 'C'];
  // Iterate over the colorOrder
  colorOrder.forEach(color => {
    // Find the color recommendation in colorRecommendations
    const colorRecommendation = colorRecommendations.find(recommendation => recommendation.color === color);
    if (colorRecommendation) {
      const { result } = colorRecommendation;
      






      // Create a new span element with the color recommendation
      const span = $('<span>', { text: result });
      
      const lowerCaseColor = color.toLowerCase();
      // Create a new i element with the corresponding icon classes
      const icon = $('<i>', { class: `msRec ms ms-${lowerCaseColor}` });
      
      // Append the span and icon to the recommendedManaPips element
      recommendedManaPips.append(span, icon);
    }
  });
  
recommended.show();
}

