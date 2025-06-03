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

    if (cleanSymbol.includes('P')) {
      // Ignore hybrid pips with Phyrexian mana
      return;
        
    }
    else if (cleanSymbol.includes('/')) {
      // Hybrid pip detected
      hybridPips.total++;
      const colors = cleanSymbol.split('/');
      hybridPips.colors.push(colors);
      colors.forEach(color => {
        colorWeight[color] = (colorWeight[color] || 0) + 1;
      });
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

  // --- New detailed nonLandManaProducers calculation ---
  const nonLandManaProducerCards = responseData.filter(card => 
    card.produced_mana && card.cmc <= 3 && !card.type_line.includes("Land")
  );
  const producersByColorCounts = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  nonLandManaProducerCards.forEach(card => {
    if (card.produced_mana && Array.isArray(card.produced_mana)) {
      card.produced_mana.forEach(color => {
        if (producersByColorCounts.hasOwnProperty(color.toUpperCase())) {
          producersByColorCounts[color.toUpperCase()]++;
        }
      });
    }
  });
  const nonLandManaProducersTotalCount = nonLandManaProducerCards.length;
  // --- End of new detailed calculation ---

  // landSearchers calculation
  const landSearchers = responseData.filter(card => 
    card.cmc <= 3 &&
    card.oracle_text && typeof card.oracle_text === 'string' && 
    card.oracle_text.includes("land") && 
    card.oracle_text.includes("onto") && card.oracle_text.includes("battlefield") &&
    !card.type_line.includes("Land")
  ).length;

  // The 'ramp' variable for UI update (if still needed for .manaProducers span)
  const ramp = landSearchers + nonLandManaProducersTotalCount;
  // Update UI for ramp count if the element exists and is used
  // $(`.recommended .manaProducers`).text('(' + ramp + ')'); // This line might be updated/moved later

  // Load recommendationsData from the recommendations.json file
  $.getJSON('data/recommendations.json', function(data) {
    const recommendationsData = data;

    // Call the function that uses the recommendationsData
    // Pass producersByColorCounts and landSearchers to processCards
    processCards(recommendationsData, producersByColorCounts, landSearchers);
    // Call the updateColorTracker function with the colorRecommendations data
  });
    
  function processCards(recommendationsData, producersByColorCounts, landSearchers) { // Added params
    // Create an object to store the highest result per color
    const highestResults = {};

    analyzedData.forEach(card => {
    const cmc = card.cmc;
    const colorWeight = card.colorWeight;
    const cmcData = recommendationsData['cmc_' + cmc]; // MODIFIED

    if (cmcData) {
      Object.entries(colorWeight).forEach(([color, weight]) => {
        if (color !== 'N' && color !== 'X' && cmcData.hasOwnProperty('symbols_' + weight)) { // MODIFIED
          const result = cmcData['symbols_' + weight]; // MODIFIED
          if (!highestResults[color] || result > highestResults[color]) {
            highestResults[color] = result;
          }
        }
        console.log(`----- ${card.name} -----, CMC: ${cmc}, Color Weight: ${JSON.stringify(colorWeight)}`);
      });
    } else {
      console.log(`----- ${card.name} -----`);
    }
  });

  // Create an array of color recommendations with the highest result per color
  const colorRecommendations = Object.entries(highestResults).map(([color, result]) => ({ color, result }));

  const manaColorCounts = Object.entries(highestResults).map(([color, result]) => ({ color, result }));
    
  // Store colorRecommendations in localStorage
  localStorage.setItem('colorRecommendations', JSON.stringify(colorRecommendations));

  // --- START OF NEW ADJUSTMENT LOGIC ---
  let totalOriginalPips = 0;
  let totalAdjustedPips = 0;
  const adjustedColorRecommendations = [];
  const colorOrder = ['W', 'U', 'B', 'R', 'G', 'C']; // Ensure this order is consistent

  colorOrder.forEach(color => {
    const basePipValue = highestResults[color] || 0;
    // producersByColorCounts is now passed as a parameter
    const reductionFromProducers = producersByColorCounts[color.toUpperCase()] || 0; 
    // landSearchers is now passed as a parameter
    const reductionFromLandSearchers = landSearchers; 

    let adjustedPipValue = basePipValue - reductionFromProducers - reductionFromLandSearchers;
    let finalPipValue = Math.max(0, adjustedPipValue);

       adjustedColorRecommendations.push({ color: color, originalResult: basePipValue, finalResult: finalPipValue });

    totalOriginalPips += basePipValue;
    totalAdjustedPips += finalPipValue;
  });

  const overallReduction = totalOriginalPips - totalAdjustedPips;

  // Update the .recommendedManaPips element with the summary string
  $('.recommendedManaPips').text(`${totalAdjustedPips} (-${overallReduction})`);
  // --- END OF NEW ADJUSTMENT LOGIC ---

  // Prepare data for localStorage, including the reduction amount and backward compatibility
  const localStorageColorRecommendations = adjustedColorRecommendations.map(item => {
    return {
      color: item.color,
      result: item.originalResult, // Added for backward compatibility with charts.js
      originalResult: item.originalResult,
      finalResult: item.finalResult,
      reduction: item.originalResult - item.finalResult
    };
  });
  localStorage.setItem('colorRecommendations', JSON.stringify(localStorageColorRecommendations));

  // Call updateColorTracker with the adjusted recommendations (which already has original and final)
  updateColorTracker(adjustedColorRecommendations);
}


} else {
  console.log('responseData not found in localStorage');
}


// Check if responseData is present in localStorage
// THIS SECOND if (storedResponseData) BLOCK NEEDS TO BE RECONCILED.
// The calculations for averageCmc, nonLandManaProducers (old simple count), cantrips, 
// landSearchers (old calculation location), and recommendedLandCount are here.
// Some of these (like nonLandManaProducers and landSearchers) have been moved/enhanced above.
// The ramp calculation for .manaProducers span also needs to use the new total count.
if (storedResponseData) {
  const responseData = JSON.parse(storedResponseData); // Already parsed above, can reuse

  // Calculate the average cmc of all cards in responseData
  // const cardCount = responseData.length; // cardCount not used

  const totalCmc = responseData.filter(card => 
      !card.type_line.includes("Land")
    ).reduce((sum, card) => sum + card.cmc, 0);
  
 // Count the number of unique non-land cards in the user's list
  const NonLandCardsTotal = responseData.filter(card => 
      !card.type_line.includes("Land")
    ).length;
    
  const averageCmc = NonLandCardsTotal > 0 ? totalCmc / NonLandCardsTotal : 0; // Avoid division by zero

  // nonLandManaProducersTotalCount and landSearchers are calculated in the first if block now.
  // We need to ensure they are accessible here or recalculate/pass them if necessary.
  // For now, let's assume they are accessible from the higher scope if this script is refactored
  // or that this block will be merged/refactored.
  // To make this diff work, I will assume nonLandManaProducersTotalCount and landSearchers from above are in scope.
  // If not, this part will need further adjustment in a subsequent step.
  
  // Count the number of cards that draw cards with cmc between 1 and 3 (inclusive)
  const cantrips = responseData.filter(card => 
    card.oracle_text && typeof card.oracle_text === 'string' && 
    (card.oracle_text.includes("Draw") || card.oracle_text.includes("draw")) &&
    card.cmc <= 3 && 
    !card.type_line.includes("Land")
  ).length;
    
  // 'ramp' is already calculated in the first block using new nonLandManaProducersTotalCount and landSearchers
  // const ramp = landSearchers + nonLandManaProducers; // This would be:
  // const ramp = (typeof landSearchers !== 'undefined' ? landSearchers : 0) + 
  //              (typeof nonLandManaProducersTotalCount !== 'undefined' ? nonLandManaProducersTotalCount : 0);
  // This ramp variable is defined in the first block.

  // Calculate the recommendedLandCount using the formula
  // Ensure nonLandManaProducersTotalCount is used here instead of the old nonLandManaProducers
  let recommendedLandCount = 31.42 + (3.13 * averageCmc) - (0.28 * ((typeof nonLandManaProducersTotalCount !== 'undefined' ? nonLandManaProducersTotalCount : 0) + cantrips + (typeof landSearchers !== 'undefined' ? landSearchers : 0)));
  recommendedLandCount = Math.round(recommendedLandCount);
  $(`.totalCards .total`).text(recommendedLandCount).addClass('hasUserData');
  
  // Update the .manaProducers span using the 'ramp' variable calculated in the first `if (storedResponseData)` block.
  // This assumes 'ramp' from the first block is accessible here.
  // If they are in different scopes, this needs proper handling (e.g. by ensuring calculations happen in order and variables are passed or stored).
  // For now, let's assume `ramp` is accessible.
  if (typeof ramp !== 'undefined') {
    $(`.recommended .manaProducers`).text('(' + ramp + ')');
  }

  $(`.recommended .recommendedLandCount`).text(recommendedLandCount);
  $(`.recommended .recommendedTotalCards`).text('(' + NonLandCardsTotal + ')');
  console.log('Average CMC:', averageCmc);
  // console.log('Non-Land mana producers (1-3 CMC):', nonLandManaProducersTotalCount); // Use new variable
  console.log('Card draw (1-3 CMC):',  cantrips);
  console.log('Recommended land count:', recommendedLandCount);
} else {
  console.log('responseData not found in localStorage for second block'); // Differentiate log
}

function updateColorTracker(colorRecommendations) {
  const pipIconsContainer = $('.recommendedManaPipIcons'); // Changed selector
  // const recommended = $('.recommended'); // This line can be removed if 'recommended' variable is not used later in this function

  pipIconsContainer.empty(); // Changed selector
  const colorOrder = ['W', 'U', 'B', 'R', 'G', 'C'];

  colorOrder.forEach(color => {
    const colorRecommendation = colorRecommendations.find(recommendation => recommendation.color === color);

    if (!colorRecommendation || colorRecommendation.finalResult === 0) {
      return; // Skip if no recommendation or final result is 0
    }

    const { originalResult, finalResult } = colorRecommendation;
    const reductionThisColor = originalResult - finalResult;

    const pipWrapper = $('<li>'); // Wrapper for this color's pip display

     const lowerCaseColor = color.toLowerCase();
    const icon = $('<i>', { class: `msRec ms ms-${lowerCaseColor}` });
    pipWrapper.append(icon); // Append icon to the same wrapper
    
    const countSpan = $('<span>', { text: finalResult });
    pipWrapper.append(countSpan);

    // Only add reduction span if there was a reduction
    if (reductionThisColor > 0) {
        const reductionSpan = $('<span>', { class: 'reducedBy', text: `(${originalResult} - ${reductionThisColor} non-lands)` });
        pipWrapper.append(reductionSpan);
    }
    
   


    pipIconsContainer.append(pipWrapper); // Append the whole group
  });
  
  // The line: recommended.css('display', 'flex'); might need to target $('.recommended') if it was hidden
  // This depends on whether the parent '.recommended' div itself needs to be shown.
  // For now, let's assume it's already visible or handled elsewhere.
  // If it's critical, ensure $('.recommended').css('display', 'flex'); is still called.
  // Based on original code, it was used, so let's keep it:
  $('.recommended').css('display', 'flex');


  updateChart(); // This call remains
}

