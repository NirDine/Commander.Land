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


function recalculateAndDisplayData() {
  const storedResponseData = localStorage.getItem('responseData');
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
    
      if (typeof ramp !== 'undefined') {
        $(`.recommended .manaProducers`).text('(' + ramp + ')');
      }
    
      // Load recommendationsData from the recommendations.json file
      $.getJSON('data/recommendations.json', function(data) {
        const recommendationsData = data;
    
        // Call the function that uses the recommendationsData
        // Pass producersByColorCounts and landSearchers to processCards
        processCards(analyzedData, recommendationsData, producersByColorCounts, landSearchers); // Added analyzedData
        // Call the updateColorTracker function with the colorRecommendations data
      });
      // Note: processCards is defined below, but it's accessible due to function hoisting.
      // If processCards itself needed to be inside recalculateAndDisplayData, it would be more complex.

    // --- Start of logic moved from the second if (storedResponseData) block ---
    // Calculate the average cmc of all cards in responseData
    const totalCmc = responseData.filter(card => 
        !card.type_line.includes("Land")
      ).reduce((sum, card) => sum + card.cmc, 0);
    
    // Count the number of unique non-land cards in the user's list
    const NonLandCardsTotal = responseData.filter(card => 
        !card.type_line.includes("Land")
      ).length;
      
    const averageCmc = NonLandCardsTotal > 0 ? totalCmc / NonLandCardsTotal : 0; // Avoid division by zero
    
    // Count the number of cards that draw cards with cmc between 1 and 3 (inclusive)
    const cantrips = responseData.filter(card => 
      card.oracle_text && typeof card.oracle_text === 'string' && 
      (card.oracle_text.includes("Draw") || card.oracle_text.includes("draw")) &&
      card.cmc <= 3 && 
      !card.type_line.includes("Land")
    ).length;
      
    // Calculate the original count of non-land producers (needed for recommendedLandCount)
    // This repeats the filter from above, which is acceptable for now.
    // Could be optimized if nonLandManaProducersTotalCount from above was passed/scoped differently,
    // but given the existing structure, this is the direct move.
    // const tempNonLandManaProducerCards = responseData.filter(card => 
    //   card.produced_mana && card.cmc <= 3 && !card.type_line.includes("Land")
    // );
    // const originalNonLandProducersCount = tempNonLandManaProducerCards.length;
  
    // Determine the count to use for the formula based on the checkbox
    // const nonLandsForFormula = $('#include-nonlands').prop('checked') ? originalNonLandProducersCount : 0;
  
    // Calculate the recommendedLandCount using the formula
    // nonLandManaProducersTotalCount and landSearchers are available from the first part of recalculateAndDisplayData
    let recommendedLandCount = 31.42 + (3.13 * averageCmc) - (0.28 * (nonLandManaProducersTotalCount + cantrips + landSearchers));
    recommendedLandCount = Math.round(recommendedLandCount);
    localStorage.setItem('recommendedLandCount', recommendedLandCount.toString());
    $(`.totalCards .total`).text(recommendedLandCount).addClass('hasUserData');
    
    $(`.recommended .recommendedLandCount`).text(recommendedLandCount);
    $(`.recommended .recommendedTotalCards`).text('(' + NonLandCardsTotal + ')');
    $(`.recommended .averageCmc`).text(averageCmc.toFixed(2));

    // --- START OF maxTapLands CALCULATION ---
    console.log('[MAX_TAPLANDS] Calculating maxTapLands...');
    console.log('[MAX_TAPLANDS] Using averageCmc:', averageCmc, 'and recommendedLandCount:', recommendedLandCount);
  
    const lowCmcCardCount = responseData.filter(card => {
      const typeLine = card.type_line || '';
      return !typeLine.includes("Land") && (card.cmc === 0 || card.cmc === 1);
    }).length;
    console.log('[MAX_TAPLANDS] Calculated lowCmcCardCount:', lowCmcCardCount);
  
    const benchmarkAvgCmc = 2.75;
    const benchmarkLowCmcCount = 10;
    const baseTapPercentage = 5;
    const avgCmcMultiplier = 10;
    const lowCmcMultiplier = 1.5;
    const maxAllowableTapPercentage = 33;
  
    const avgCmcBonusPoints = (averageCmc - benchmarkAvgCmc) * avgCmcMultiplier;
    const lowCmcBonusPoints = (benchmarkLowCmcCount - lowCmcCardCount) * lowCmcMultiplier;
    
    const targetTapPercentage = baseTapPercentage + avgCmcBonusPoints + lowCmcBonusPoints;
    console.log('[MAX_TAPLANDS] targetTapPercentage (before constraints):', targetTapPercentage);
  
    const constrainedTapPercentage = Math.max(0, Math.min(targetTapPercentage, maxAllowableTapPercentage));
    console.log('[MAX_TAPLANDS] constrainedTapPercentage (0-33%):', constrainedTapPercentage);
  
    const calculatedMaxTapLands = (constrainedTapPercentage / 100) * recommendedLandCount;
    const maxTapLands = Math.round(calculatedMaxTapLands);
    console.log('[MAX_TAPLANDS] Calculated maxTapLands (rounded):', maxTapLands);
  
    localStorage.setItem('maxTapLands', maxTapLands.toString());
  
    const maxTapLandsSpan = $('.maxTapLands');
    if (maxTapLandsSpan.length) {
      maxTapLandsSpan.text(maxTapLands);
      console.log('[MAX_TAPLANDS] Updated .maxTapLands span.');
    } else {
      console.warn('[MAX_TAPLANDS] Span with class .maxTapLands not found.');
    }
    
    const lowCmcCardCountSpan = $('.lowCmcCardCount');
    if (lowCmcCardCountSpan.length) {
      lowCmcCardCountSpan.text(lowCmcCardCount);
      console.log('[MAX_TAPLANDS] Updated .lowCmcCardCount span.');
    } else {
      console.warn('[MAX_TAPLANDS] Span with class .lowCmcCardCount not found.');
    }
    
    $('.recommended').css('display', 'flex');
    // --- END OF maxTapLands CALCULATION ---
  
    console.log('Average CMC:', averageCmc);
    console.log('Card draw (1-3 CMC):',  cantrips);
    console.log('Recommended land count:', recommendedLandCount);
    // --- End of logic moved from the second if (storedResponseData) block ---

    updateTappedLandsDisplay(); // Moved from global scope

  } else {
    console.log('responseData not found in localStorage. Cannot recalculate.');
    // Optionally, clear parts of the UI if responseData is gone.
  }
}

// Function processCards remains defined in this scope, accessible by recalculateAndDisplayData
function processCards(analyzedData, recommendationsData, producersByColorCounts, landSearchers) { // Added analyzedData
  // Create an object to store the highest result per color
  const highestResults = {};

  // Assuming analyzedData is accessible in this scope (it should be if processCards is called within recalculateAndDisplayData where analyzedData is defined)
  // This is a potential issue: analyzedData is defined inside recalculateAndDisplayData.
  // processCards is defined outside but called within. For this to work, analyzedData needs to be passed to processCards,
  // or processCards needs to be defined inside recalculateAndDisplayData, or analyzedData needs a broader scope.
  // Given the current structure, let's assume for now that processCards can access analyzedData if it's called from within recalculateAndDisplayData's scope.
  // This might need adjustment if `analyzedData` is not found.
  // Let's refine: processCards uses `analyzedData`. analyzedData is calculated inside `recalculateAndDisplayData`.
  // To make this work cleanly, `analyzedData` should be passed to `processCards`.

  // Correction: `analyzedData` is used by `processCards`. It's defined inside `recalculateAndDisplayData`.
  // `processCards` is defined globally but called from within `recalculateAndDisplayData` via `$.getJSON` callback.
  // The `analyzedData` variable will be in scope for the `processCards` call because of the closure over `recalculateAndDisplayData`.
  // So, this should be fine without explicitly passing `analyzedData`.

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
    });
  } else {

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

// const nonLandUserCheckbox = $('#include-nonlands'); // Removed: No longer conditional here

colorOrder.forEach(color => {
  const basePipValue = highestResults[color] || 0;
  // producersByColorCounts is now passed as a parameter
  const reductionFromProducers = producersByColorCounts[color.toUpperCase()] || 0; // Always calculate
  // landSearchers is now passed as a parameter
  const reductionFromLandSearchers = landSearchers; // This is a single value

  let adjustedPipValue = basePipValue - reductionFromProducers - reductionFromLandSearchers;
  let finalPipValue = Math.max(0, adjustedPipValue);

  adjustedColorRecommendations.push({
    color: color,
    originalResult: basePipValue,
    finalResult: finalPipValue,
    reductionProducers: reductionFromProducers,
    reductionLandSearchers: reductionFromLandSearchers
  });

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
    result: item.originalResult, // 'result' for backward compatibility if needed by charts.js's direct use of 'result'
    originalResult: item.originalResult,
    finalResult: item.finalResult,
    reductionProducers: item.reductionProducers,
    reductionLandSearchers: item.reductionLandSearchers, // Store this
    // Keep total reduction for any parts that might still use it, or for simplicity in some contexts
    totalReduction: item.originalResult - item.finalResult 
  };
});
localStorage.setItem('colorRecommendations', JSON.stringify(localStorageColorRecommendations));

// Call updateColorTracker with the adjusted recommendations (which already has original and final)
updateColorTracker(adjustedColorRecommendations);
}

// updateColorTracker remains global as it's called by processCards
function updateColorTracker(colorRecommendations) {
  const pipIconsContainer = $('.recommendedManaPipIcons'); // Changed selector
  // const recommended = $('.recommended'); // This line can be removed if 'recommended' variable is not used later in this function

  pipIconsContainer.empty(); // Changed selector
  const colorOrder = ['W', 'U', 'B', 'R', 'G', 'C'];

  colorOrder.forEach(color => {
    const colorRecommendation = colorRecommendations.find(recommendation => recommendation.color === color);

    if (!colorRecommendation) {
        return; 
    }

    const includeAllRamp = $('#include-nonlands').prop('checked');
    const { originalResult, finalResult, totalReduction } = colorRecommendation; // Destructure relevant fields

    let displayedPipValue;
    let reductionText = "";

    if (includeAllRamp) {
        displayedPipValue = finalResult;
        if (totalReduction > 0) {
            reductionText = `(- ${totalReduction} ramp)`;
        }
    } else {
        displayedPipValue = originalResult;
        reductionText = ""; // No reduction text when ramp is not included
    }

    // Skip display if the value is 0 or less, unless it's colorless (C) which might still be shown even at 0.
    // For now, sticking to the previous logic: skip if displayedPipValue <= 0 for any color.
    if (displayedPipValue <= 0) { 
        return;
    }

    const pipWrapper = $('<li>'); 
    const lowerCaseColor = color.toLowerCase();
    const icon = $('<i>', { class: `msRec ms  ms-cost ms-${lowerCaseColor}` });
    pipWrapper.append(icon);
    
    const countSpan = $('<span>', { text: displayedPipValue });
    
    if (reductionText) {
        const reductionSpan = $('<span>', { class: 'reducedBy', text: reductionText });
        pipWrapper.append(reductionSpan);
    }
    
    pipWrapper.append(countSpan);
    
    pipIconsContainer.append(pipWrapper);
  });
  
  // The line: recommended.css('display', 'flex'); might need to target $('.recommended') if it was hidden
  // This depends on whether the parent '.recommended' div itself needs to be shown.
  // For now, let's assume it's already visible or handled elsewhere.
  // If it's critical, ensure $('.recommended').css('display', 'flex'); is still called.
  // Based on original code, it was used, so let's keep it:
  $('.recommended').css('display', 'flex');


  updateChart(); // This call remains
}

// --- START OF TAPPED LAND METRICS CALCULATION ---
// This IIFE remains global as it's likely for one-time calculation based on selectedCards,
// not directly tied to the responseData recalculation flow triggered by the checkbox.
// If it needs to be refreshed, it would also need to be part of recalculateAndDisplayData.
// For now, keeping it as is, assuming its current placement is intentional for its specific purpose.
(function() {
  'use strict';

  const storedSelectedCards = localStorage.getItem('selectedCards');
  const storedLandsData = localStorage.getItem('landsData');
  const storedColorRecommendations = localStorage.getItem('colorRecommendations');

  if (!storedSelectedCards || !storedLandsData || !storedColorRecommendations) {
    console.log('Tapped Land Metrics: Missing required data from localStorage (selectedCards, landsData, or colorRecommendations).');
    return;
  }

  try {
    const selectedCards = JSON.parse(storedSelectedCards);
    const landsData = JSON.parse(storedLandsData); // This is an object with a 'data' array
    const colorRecommendations = JSON.parse(storedColorRecommendations);

    if (!Array.isArray(selectedCards) || !landsData || !Array.isArray(landsData.data) || !Array.isArray(colorRecommendations)) {
      console.error('Tapped Land Metrics: Invalid data format in localStorage.');
      return;
    }

    const recommendedColorsSet = new Set(
      colorRecommendations
        .filter(rec => rec && rec.result > 0) // rec.result is originalResult
        .map(rec => rec.color.toUpperCase())
    );

    let totalTappedLands = 0;
    const tappedLandsByColor = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
    const tapPhraseClassic = "This land enters tapped."; // Renamed
    const tapPhraseFetchEffect = "put it onto the battlefield tapped"; // Added

    selectedCards.forEach(cardNameInSelection => {
      const cardObject = landsData.data.find(dbCard => {
        // Handle potential DFC names stored in selectedCards
        let nameToMatch = cardNameInSelection;
        // Normalize matching by comparing cardNameInSelection against dbCard.name
        // and also against front face name if dbCard is a DFC.
        if (dbCard.name.toLowerCase() === nameToMatch.toLowerCase()) return true;
        if (dbCard.card_faces && dbCard.card_faces.length > 0 && dbCard.card_faces[0].name.toLowerCase() === nameToMatch.toLowerCase()) return true;
        // A common pattern for selectedCards from deck builders is "Card Name // Other Card Name" for DFCs.
        // We need to check if dbCard.name matches the first part of such a string.
        if (nameToMatch.includes(' // ')) {
            const firstFaceSelected = nameToMatch.split(' // ')[0];
            if (dbCard.name.toLowerCase() === firstFaceSelected.toLowerCase()) return true;
        }
        return false;
      });

      if (cardObject) {
        const typeLine = cardObject.type_line || '';
        if (typeLine.includes('Land')) {
          const oracleText = cardObject.oracle_text || '';
          // New condition:
          if (oracleText.includes(tapPhraseClassic) || oracleText.includes(tapPhraseFetchEffect)) {
            totalTappedLands++;

            let cardColors = cardObject.color_identity;
            if (!cardColors || cardColors.length === 0) {
              cardColors = ['C']; // Treat colorless lands as having 'C' identity
            }

            cardColors.forEach(color => {
              const upperColor = color.toUpperCase();
              if (tappedLandsByColor.hasOwnProperty(upperColor) && recommendedColorsSet.has(upperColor)) {
                tappedLandsByColor[upperColor]++;
              }
            });
          }
        }
      } else {
        // console.warn(`Tapped Land Metrics: Card "${cardNameInSelection}" not found in landsData.`);
      }
    });

    localStorage.setItem('totalTappedLands', totalTappedLands.toString());
    localStorage.setItem('tappedLandsByColor', JSON.stringify(tappedLandsByColor));
    console.log('Tapped Land Metrics Calculated:', { totalTappedLands, tappedLandsByColor });
    
    
    $(`.manaBaseHealthContainer .totalTapLands`).text(totalTappedLands);


  } catch (error) {
    console.error('Error processing tapped land metrics:', error);
  }
})();
// --- END OF TAPPED LAND METRICS CALCULATION ---

// updateTappedLandsDisplay is called inside recalculateAndDisplayData now
function updateTappedLandsDisplay() {
  'use strict';
  console.log('[TAPLAND_METERS] Attempting to update tapped lands display...');

  const storedTappedLandsByColor = localStorage.getItem('tappedLandsByColor');
  // console.log('[TAPLAND_METERS] storedTappedLandsByColor from localStorage:', storedTappedLandsByColor);
  const storedRecLandCount = localStorage.getItem('recommendedLandCount');
  // console.log('[TAPLAND_METERS] storedRecLandCount from localStorage:', storedRecLandCount);
  const storedColorRecs = localStorage.getItem('colorRecommendations');
  // console.log('[TAPLAND_METERS] storedColorRecs from localStorage:', storedColorRecs);

  if (!storedTappedLandsByColor || !storedRecLandCount || !storedColorRecs) {
    console.warn('[TAPLAND_METERS] Missing one or more required items from localStorage for display update.');
    return;
  }

  try {
    const tappedLandsByColor = JSON.parse(storedTappedLandsByColor);
    // console.log('[TAPLAND_METERS] Parsed tappedLandsByColor:', tappedLandsByColor);
    const recommendedLandCount = parseInt(storedRecLandCount, 10);
    // console.log('[TAPLAND_METERS] Parsed recommendedLandCount:', recommendedLandCount);
    const colorRecommendations = JSON.parse(storedColorRecs);
    // console.log('[TAPLAND_METERS] Parsed colorRecommendations:', colorRecommendations);

    if (typeof tappedLandsByColor !== 'object' || tappedLandsByColor === null || isNaN(recommendedLandCount) || !Array.isArray(colorRecommendations)) {
      console.error('[TAPLAND_METERS] Invalid data format in localStorage after parsing for display update.');
      return;
    }
    
    if (isNaN(recommendedLandCount)) { 
        console.error('[TAPLAND_METERS] recommendedLandCount is NaN after parse for display update.');
        return;
    }

    const recommendedColorsSet = new Set(
      colorRecommendations
        .filter(rec => rec && rec.finalResult > 0) // Changed to finalResult for consistency in display
        .map(rec => rec.color.toUpperCase())
    );
    // console.log('[TAPLAND_METERS] recommendedColorsSet for display:', recommendedColorsSet);

    const container = $('.manaBaseHealthContainer .tappedLandContainer');
    // console.log('[TAPLAND_METERS] Target container .manaBaseHealthContainer .tappedLandContainer, length:', container.length);
    if (!container.length) {
      console.warn('[TAPLAND_METERS] Container .manaBaseHealthContainer .tappedLandContainer not found for display update.');
      return;
    }
    container.empty();
    // console.log('[TAPLAND_METERS] Container emptied for display update.');

    const colorOrder = ['W', 'U', 'B', 'R', 'G', 'C'];
    let metersAdded = 0;
    colorOrder.forEach(color => {
      if (recommendedColorsSet.has(color)) {
        // console.log(`[TAPLAND_METERS] Processing recommended color for display: ${color}`);
        const count = tappedLandsByColor[color] || 0;
        // Ensure recommendedLandCount is not zero to avoid division by zero, though percentage would be 0 anyway.
        const percentage = (recommendedLandCount > 0 && count > 0) ? Math.round((count / recommendedLandCount) * 100) : 0;
        const lowerCaseColor = color.toLowerCase();

        const meterHtml = `
          <div class="taplandMeter taplands-${lowerCaseColor}">
            <i class="ms ms-cost ms-${lowerCaseColor}"></i>
            <div class="progress">
              <div class="progress-bar progress-bar-${color} hasMana" style="width: ${percentage}%;">${percentage}%</div>
            </div>
            <span class="tapLandTotal">${count}</span>
            
          </div>
        `;
        // console.log(`[TAPLAND_METERS] Generated HTML for display ${color}:`, meterHtml);
        container.append(meterHtml);
        metersAdded++;
      } else {
        // console.log(`[TAPLAND_METERS] Skipping color (not in recommendedSet for display): ${color}`);
      }
    });
    
    // console.log(`[TAPLAND_METERS] Tapped lands display update attempt finished. Meters added: ${metersAdded}`);

  } catch (error) {
    console.error('[TAPLAND_METERS] Error in updateTappedLandsDisplay:', error);
  }
}

function includeNonLandsCheckEvent() {
  const isChecked = $('#include-nonlands').prop('checked');
  localStorage.setItem('includeNonLandsPreference', isChecked);
  recalculateAndDisplayData();
}

// Initial load and event listener setup
$(document).ready(function() {
  // Load checkbox state from localStorage
  const storedCheckboxState = localStorage.getItem('includeNonLandsPreference');
  if (storedCheckboxState !== null) { // Check if the item exists
    $('#include-nonlands').prop('checked', storedCheckboxState === 'true');
  }

  $('#include-nonlands').on('change', includeNonLandsCheckEvent);
  recalculateAndDisplayData(); 
});