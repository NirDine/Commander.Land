// Cache jQuery objects for improved performance
const $backdrop = $('.backdrop');
const $textarea = $('#deckList');
const $analyze = $('#analyze');
const $highlights = $('.highlights');

// Detect the user agent to handle different browsers
const ua = window.navigator.userAgent.toLowerCase();
const isIE = !!ua.match(/msie|trident\/7|edge/);
const isWinPhone = ua.indexOf('windows phone') !== -1;
const isIOS = !isWinPhone && !!ua.match(/ipad|iphone|ipod/);

let nameErrors = []; // Initialize nameErrors as an empty
let responseData; // To be populated by Scryfall API
let userList; // Not currently used, but was in original HTML

// Helper function to get a Scryfall API comparable name
function getScryfallComparableName(nameKey) { // nameKey is assumed lowercased
  let scryfallName = nameKey;
  if (nameKey.includes('//') && !nameKey.includes(' // ')) {
    scryfallName = nameKey.replace('//', ' // ');
  }
  return scryfallName;
}

// Scryfall API endpoint
const scryfallEndpoint = 'https://api.scryfall.com/cards/collection';

// Flag to track whether a request is in progress
let requestInProgress = false;

// Disable analyze button to prevent further requests initially
$analyze.prop('disabled', true);

// Update textarea and highlights when analyze button is clicked
$analyze.on('click', function() {
  if (requestInProgress) {
    return;
  }
  requestInProgress = true;
  $analyze.prop('disabled', true);

  const cardList = $textarea.val().trim();
  const lines = cardList.split('\n');
  const nonEmptyLines = lines.filter(line => line.trim() !== '');

  const cardNames = {}; // Object to store card names and quantities
  nonEmptyLines.forEach(line => {
    const match = line.match(/^(\d+)?x?\s?(.*)$/i);
    if (match) {
      const quantity = match[1] ? parseInt(match[1].trim().replace(/x/gi, '')) : 1;
      const cardName = match[2].trim();
      const normalizedCardName = cardName.toLowerCase();
      if (cardNames[normalizedCardName]) {
        cardNames[normalizedCardName].quantity += quantity;
      } else {
        cardNames[normalizedCardName] = { name: cardName, quantity };
      }
    }
  });

  // Prepare the payload with unique card names (keys of cardNames are already normalized)
  const identifiers = Object.keys(cardNames).map(key => {
    let nameForScryfall = key; // key is a lowercased card name
    if (key.includes('//') && !key.includes(' // ')) {
      nameForScryfall = key.replace('//', ' // ');
    }
    return { name: nameForScryfall };
  });
  const payload = { identifiers };

  console.log('Sending request to Scryfall API...');
  
  let currentOffset = 0;
  let requestsMade = 0;
  responseData = []; // General responseData, will be populated later from different phases
  let accumulatedNotFound = []; // General accumulatedNotFound, will be populated later
  
  let responseDataFromCollection = [];
  let accumulatedNotFoundFromCollection = [];
  let specialLookupLowercasedNames = []; // Initialize list for special lookups
  
  let exactLookupFoundData = [];
  let exactLookupNotFoundNames = [];

  // Populate specialLookupLowercasedNames
  const allLowercasedNamesFromInput = Object.keys(cardNames);
  for (const lcName of allLowercasedNamesFromInput) {
    if (lcName.includes('/') || lcName.includes('//')) { // Check for single or double slash
      specialLookupLowercasedNames.push(lcName);
    }
  }
  // console.log("Special lookup names:", specialLookupLowercasedNames); // For debugging

  function makeRequest() {
    const requestPayload = {
      identifiers: payload.identifiers.slice(currentOffset, currentOffset + 70)
    };

    $.ajax({
      url: scryfallEndpoint,
      type: 'POST',
      dataType: 'json',
      contentType: 'application/json',
      data: JSON.stringify(requestPayload),
      success: function(response) {
        console.log('Request successful (Phase 1 - Collection)!', response);
        responseDataFromCollection = responseDataFromCollection.concat(response.data);
        
        // response.not_found contains identifier objects like {name: "transformed_name"}
        // These names are already transformed as they were sent in the payload.
        const currentBatchNotFoundNamesFromCollection = response.not_found.map(card => card.name); // Keep as is from Scryfall
        accumulatedNotFoundFromCollection = accumulatedNotFoundFromCollection.concat(currentBatchNotFoundNamesFromCollection);
        
        console.log('Batch Errors (Phase 1 - Collection):', currentBatchNotFoundNamesFromCollection);
        console.log('Matches:', response.data.map(cardData => cardData.name));

        requestsMade++;
        if (requestsMade < Math.ceil(payload.identifiers.length / 70)) {
          currentOffset += 70;
          setTimeout(makeRequest, 100); // Scryfall API rate limit recommendation
        } else {
          // All requests completed for Phase 1 (Collection lookup)
          console.log('All requests for Phase 1 (Collection) completed!');
          console.log("Starting Phase 2 (exact lookups for special names)...");

          await performExactLookups(); // Perform Phase 2

          console.log("Phase 2 complete.");
          console.log("Exact lookup found data:", exactLookupFoundData);
          console.log("Exact lookup not found names:", exactLookupNotFoundNames);

          // --- Phase 3: Merge Results ---
          console.log("Starting Phase 3 (Merge Results)...");
          let finalResponseData = [];
          let finalAccumulatedNotFound = [];
          const allUserInputLcNames = Object.keys(cardNames); // Already lowercased

          for (const lcUserInputName of allUserInputLcNames) {
            const scryfallComparableUserInputName = getScryfallComparableName(lcUserInputName);
            if (specialLookupLowercasedNames.includes(lcUserInputName)) {
              // Processed by Phase 2 (Exact Lookup)
              if (exactLookupNotFoundNames.includes(lcUserInputName)) {
                finalAccumulatedNotFound.push(scryfallComparableUserInputName);
              } else {
                const foundCard = exactLookupFoundData.find(
                  card => getScryfallComparableName(card.name.toLowerCase()) === scryfallComparableUserInputName
                );
                if (foundCard) {
                  finalResponseData.push(foundCard);
                } else {
                  console.warn(`Phase 3 Warning: Card "${lcUserInputName}" was in specialLookup but not found in exactLookupFoundData or exactLookupNotFoundNames.`);
                  finalAccumulatedNotFound.push(scryfallComparableUserInputName);
                }
              }
            } else {
              // Processed by Phase 1 (Collection Lookup)
              // Note: accumulatedNotFoundFromCollection stores names as transformed by getScryfallComparableName
              if (accumulatedNotFoundFromCollection.includes(scryfallComparableUserInputName)) {
                finalAccumulatedNotFound.push(scryfallComparableUserInputName);
              } else {
                const foundCard = responseDataFromCollection.find(
                  card => getScryfallComparableName(card.name.toLowerCase()) === scryfallComparableUserInputName
                );
                if (foundCard) {
                  finalResponseData.push(foundCard);
                } else {
                  console.warn(`Phase 3 Warning: Card "${lcUserInputName}" (Comparable: "${scryfallComparableUserInputName}") not found in responseDataFromCollection or accumulatedNotFoundFromCollection.`);
                  finalAccumulatedNotFound.push(scryfallComparableUserInputName);
                }
              }
            }
          }

          responseData = finalResponseData;
          nameErrors = [...new Set(finalAccumulatedNotFound)];
          console.log("Phase 3 (Merge Results) complete.");
          console.log("Final responseData length:", responseData.length);
          console.log("Final nameErrors:", nameErrors);

          // --- Final UI Update ---
          const orderedCardNames = [];
          Object.entries(cardNames).forEach(([normalizedKey, originalCardDetails]) => {
            const scryfallComparableKey = getScryfallComparableName(normalizedKey);
            if (nameErrors.includes(scryfallComparableKey)) {
              orderedCardNames.push({ ...originalCardDetails, card: null });
            } else {
              const matchingCardData = responseData.find(rd => getScryfallComparableName(rd.name.toLowerCase()) === scryfallComparableKey);
              orderedCardNames.push({ 
                name: matchingCardData ? matchingCardData.name : originalCardDetails.name, 
                quantity: originalCardDetails.quantity, 
                card: matchingCardData 
              });
            }
          });
          
          const orderedHighlights = applyHighlights(
            orderedCardNames.map(card => ({ name: card.name, quantity: card.quantity })),
            nameErrors
          );
          
          $textarea.val(orderedCardNames.map(
            card => (card.quantity > 1 ? `${card.quantity}x ${card.name}` : `1x ${card.name}`) 
          ).join('\n'));
          
          $highlights.html(orderedHighlights);

          const hasErrors = nameErrors.length > 0;
          if (!hasErrors) {
            console.log('All card names found!');
            const updatedUserList = orderedCardNames.map(card => ({
              quantity: card.quantity,
              name: card.card ? card.card.name : card.name
            }));
            localStorage.setItem('userList', JSON.stringify(updatedUserList));
            localStorage.setItem('responseData', JSON.stringify(responseData));
            localStorage.removeItem('selectedCards');
            const colorIdentity = determineColorIdentity(responseData);
            window.location.href = `buffet.html?colors=${colorIdentity.toLowerCase()}`;
          } else {
            console.log('Card names not found or other errors occurred.');
          }
          
          requestInProgress = false;
          $analyze.prop('disabled', hasErrors); // Re-enable button if errors, or if no errors and not redirecting (covered by redirection)
        }
      },
      error: async function(xhr, status, error) { // Make error handler async for await
        console.error('Error retrieving card data (Phase 1):', error);
        const failedBatchIdentifiers = requestPayload.identifiers.map(id => id.name);
        accumulatedNotFoundFromCollection = accumulatedNotFoundFromCollection.concat(failedBatchIdentifiers);
        
        requestsMade++;
        if (requestsMade < Math.ceil(payload.identifiers.length / 70)) {
          currentOffset += 70;
          setTimeout(makeRequest, 100);
        } else {
          // All requests for Phase 1 completed (some batches failed)
          console.log('All requests for Phase 1 (Collection) completed, with some batch errors!');
          console.log("Starting Phase 2 (exact lookups for special names)...");
          
          await performExactLookups(); // Perform Phase 2 even if Phase 1 had errors

          console.log("Phase 2 complete.");
          console.log("Exact lookup found data:", exactLookupFoundData);
          console.log("Exact lookup not found names:", exactLookupNotFoundNames);
          
          // --- Phase 3: Merge Results (Error Path) ---
          console.log("Starting Phase 3 (Merge Results) after Phase 1 errors...");
          let finalResponseData = []; // Should mostly be from exactLookupFoundData if Phase 1 failed badly
          let finalAccumulatedNotFound = [];
          const allUserInputLcNames = Object.keys(cardNames);

          for (const lcUserInputName of allUserInputLcNames) {
            const scryfallComparableUserInputName = getScryfallComparableName(lcUserInputName);
            if (specialLookupLowercasedNames.includes(lcUserInputName)) {
              if (exactLookupNotFoundNames.includes(lcUserInputName)) {
                finalAccumulatedNotFound.push(scryfallComparableUserInputName);
              } else {
                const foundCard = exactLookupFoundData.find(
                  card => getScryfallComparableName(card.name.toLowerCase()) === scryfallComparableUserInputName
                );
                if (foundCard) {
                  finalResponseData.push(foundCard);
                } else {
                  finalAccumulatedNotFound.push(scryfallComparableUserInputName);
                }
              }
            } else {
              // Must have been in a failed Phase 1 batch or a successful one prior to failure
              if (accumulatedNotFoundFromCollection.includes(scryfallComparableUserInputName)) {
                 finalAccumulatedNotFound.push(scryfallComparableUserInputName);
              } else {
                // Attempt to find in any data from successful Phase 1 batches
                const foundCard = responseDataFromCollection.find( 
                  card => getScryfallComparableName(card.name.toLowerCase()) === scryfallComparableUserInputName
                );
                if (foundCard) {
                  finalResponseData.push(foundCard);
                } else {
                  // If not explicitly in accumulatedNotFoundFromCollection but also not in responseDataFromCollection,
                  // it implies it was in a batch that might not have completed or was processed before a later batch failed.
                  // Assume not found if not in successfully collected data.
                  finalAccumulatedNotFound.push(scryfallComparableUserInputName);
                }
              }
            }
          }
          responseData = finalResponseData;
          nameErrors = [...new Set(finalAccumulatedNotFound)];
          console.log("Phase 3 (Merge Results) complete after Phase 1 errors.");
          
          // --- Final UI Update (Error Path) ---
          const orderedCardNames = [];
          Object.entries(cardNames).forEach(([normalizedKey, originalCardDetails]) => {
             const scryfallComparableKey = getScryfallComparableName(normalizedKey);
            if (nameErrors.includes(scryfallComparableKey)) {
              orderedCardNames.push({ ...originalCardDetails, card: null });
            } else {
              const matchingCardData = responseData.find(rd => getScryfallComparableName(rd.name.toLowerCase()) === scryfallComparableKey);
              orderedCardNames.push({ 
                name: matchingCardData ? matchingCardData.name : originalCardDetails.name, 
                quantity: originalCardDetails.quantity, 
                card: matchingCardData 
              });
            }
          });
          const orderedHighlights = applyHighlights(
            orderedCardNames.map(card => ({ name: card.name, quantity: card.quantity })),
            nameErrors
          );
          $textarea.val(orderedCardNames.map(
             card => (card.quantity > 1 ? `${card.quantity}x ${card.name}` : `1x ${card.name}`) 
          ).join('\n'));
          $highlights.html(orderedHighlights);

          requestInProgress = false;
          $analyze.prop('disabled', false); // Enable button as there were errors.
        }
      },
      complete: function() {
        // This 'complete' might be called for each batch. 
        // We need a single point of completion after all phases.
        // For now, requestInProgress and button state are handled at the end of Phase 2 logic.
        // if (requestsMade >= Math.ceil(payload.identifiers.length / 70)) {
        //     // This condition is met at the end of Phase 1.
        //     // But we need to wait for Phase 2.
        // }
      }
    });
  }

  // --- Definition of performExactLookups (Phase 2) ---
  async function performExactLookups() {
    console.log("Executing performExactLookups for:", specialLookupLowercasedNames);
    for (const lcName of specialLookupLowercasedNames) {
      // Scryfall API base URL is defined globally as scryfallApiBaseUrl
      // However, if it's not, it should be: const scryfallApiBaseUrl = 'https://api.scryfall.com';
      const scryfallCardUrl = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(lcName)}`;
      try {
        const response = await $.ajax({
          url: scryfallCardUrl,
          type: 'GET',
          dataType: 'json'
        });
        exactLookupFoundData.push(response);
        console.log(`Phase 2: Found "${lcName}"`);
      } catch (error) {
        if (error.status === 404) {
          exactLookupNotFoundNames.push(lcName);
          console.log(`Phase 2: Not found "${lcName}"`);
        } else {
          console.error(`Phase 2: API Error for "${lcName}":`, error.status, error.statusText, error.responseJSON);
          exactLookupNotFoundNames.push(lcName); // Treat other errors as "not found" for this phase
        }
      }
      await new Promise(resolve => setTimeout(resolve, 50)); // 50ms delay
    }
  }

  makeRequest(); // Initial call to start Phase 1
});

// Function to determine the colorIdentity from the response data
function determineColorIdentity(responseData) {
  const colors = new Set();
  responseData.forEach(cardData => {
    if (cardData.color_identity) {
      cardData.color_identity.forEach(color => {
        colors.add(color);
      });
    }
  });
  colors.add('c'); // Add "c" to the set of colors
  const colorIdentity = Array.from(colors).join(',');
  return colorIdentity;
}

// Function to apply highlights
function applyHighlights(cardInfoArray, nameErrors) {
  let highlightedText = '';
  if (!Array.isArray(cardInfoArray) || !Array.isArray(nameErrors)) {
    console.error("Invalid input: cardInfoArray or nameErrors is not an array");
    return highlightedText;
  }
  cardInfoArray.forEach(cardInfo => {
    if (cardInfo && cardInfo.name && typeof cardInfo.quantity !== 'undefined') {
      const originalName = cardInfo.name; // Original casing for display
      const quantity = cardInfo.quantity;
      const scryfallComparableKey = getScryfallComparableName(originalName.toLowerCase());

      if (nameErrors.includes(scryfallComparableKey)) {
        // Use originalName for display and data-card-name to maintain original input casing
        highlightedText += `<mark class="error" data-card-name="${originalName}">${quantity} ${originalName}</mark>\n`;
      } else {
        highlightedText += `${quantity} ${originalName}\n`;
      }
    } else {
      console.error("Invalid cardInfo object:", cardInfo);
    }
  });
  return highlightedText.replace(/\n$/g, '\n\n');
}

// Function to handle input changes in the textarea
function handleInput() {
  const text = $textarea.val().trim();
  const lines = text.split('\n');
  const currentCardNamesFromText = new Set();

  lines.forEach(line => {
    const match = line.match(/^(\d+)?x?\s?(.*)$/i);
    if (match) {
      const cardNamePart = match[2] || ''; 
      const cardName = cardNamePart.trim().toLowerCase();
      if (cardName) {
        currentCardNamesFromText.add(cardName);
      }
    }
  });

  nameErrors = nameErrors.filter(errorKey => currentCardNamesFromText.has(errorKey));

  const cardInfoArrayForHighlights = lines.map(line => {
    const match = line.match(/^(\d+)?x?\s?(.*)$/i);
    if (match) {
      const quantity = match[1] ? parseInt(match[1].trim().replace(/x/gi, '')) : 1;
      const namePart = match[2] || ''; 
      const name = namePart.trim();
      if (name) {
        return { name, quantity };
      }
    }
    return null;
  }).filter(Boolean);

  const highlightedText = applyHighlights(cardInfoArrayForHighlights, nameErrors);
  $highlights.html(highlightedText);

  const highlightsExist = $highlights.find('mark').length > 0 || highlightedText.includes('<mark>');
  if (highlightsExist) {
    $highlights.addClass('error');
    $analyze.prop('disabled', true);
  } else {
    $highlights.removeClass('error');
    $analyze.prop('disabled', text === '');
  }
}

// Synchronize the scroll position between the textarea and backdrop
function handleScroll() {
  const scrollTop = $textarea.scrollTop();
  $backdrop.scrollTop(scrollTop);
  const scrollLeft = $textarea.scrollLeft();
  $backdrop.scrollLeft(scrollLeft);
}

// Fix padding issues on iOS devices
function fixIOS() {
  $highlights.css({
    'padding-left': '+=3px',
    'padding-right': '+=3px'
  });
}

// Bind input and scroll event handlers to the textarea
function bindEvents() {
  $textarea.on({
    input: handleInput,
    scroll: handleScroll
  });
}

if (isIOS) {
  fixIOS();
}
bindEvents();

// Initial call to handleInput to set initial button state if textarea is empty/filled
handleInput();
