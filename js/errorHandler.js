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
  responseData = []; // Reset responseData for new analysis
  let accumulatedNotFound = []; // Reset accumulatedNotFound

  function makeRequest() {
    const requestPayload = {
      identifiers: payload.identifiers.slice(currentOffset, currentOffset + 70)
    };

    $.ajax({
      url: scryfallEndpoint,
      type: 'POST',
      dataType: 'json',
      contentType: 'application/json',
      headers: {
        "User-Agent": "Commander-Land/1.0",
        "Accept": "application/json",
      },
      data: JSON.stringify(requestPayload),
      success: function(response) {
        console.log('Request successful!', response);
        responseData = responseData.concat(response.data);
        
        const currentBatchNotFoundNames = response.not_found.map(card => card.name.toLowerCase());
        accumulatedNotFound = accumulatedNotFound.concat(currentBatchNotFoundNames);
        
        console.log('Batch Errors:', currentBatchNotFoundNames);
        console.log('Matches:', response.data.map(cardData => cardData.name));

        requestsMade++;
        if (requestsMade < Math.ceil(payload.identifiers.length / 70)) {
          currentOffset += 70;
          setTimeout(makeRequest, 100); // Scryfall API rate limit recommendation
        } else {
          // All requests completed
          console.log('All requests completed!');
          nameErrors = [...new Set(accumulatedNotFound)]; // Finalize nameErrors

          // Order the card names based on the textarea order, using original input from cardNames
          const orderedCardNames = [];
          Object.entries(cardNames).forEach(([normalizedKey, originalCardDetails]) => {
            const scryfallComparableKey = getScryfallComparableName(normalizedKey);
            if (nameErrors.includes(scryfallComparableKey)) {
              orderedCardNames.push({ ...originalCardDetails, card: null });
            } else {
              // When finding matching card data, ensure we use the same comparable key if Scryfall returns it that way,
              // or compare against all known variations if necessary. For now, responseData names are generally canonical.
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
          
          // This update will trigger 'handleInput'
          $textarea.val(orderedCardNames.map(
            card => (card.quantity > 1 ? `${card.quantity} ${card.name}` : `1 ${card.name}`) 
          ).join('\n'));
          
          $highlights.html(orderedHighlights);

          const hasErrors = nameErrors.length > 0;
          // $analyze.prop('disabled', hasErrors); // Re-enabled by complete or handleInput

          if (!hasErrors) {
            console.log('All card names found!');
            const updatedUserList = orderedCardNames.map(card => ({
              quantity: card.quantity,
              name: card.card ? card.card.name : card.name // Use Scryfall's name if available
            }));
            localStorage.setItem('userList', JSON.stringify(updatedUserList));
            localStorage.setItem('responseData', JSON.stringify(responseData));
            localStorage.removeItem('selectedCards');
            const colorIdentity = determineColorIdentity(responseData);
            window.location.href = `buffet.html?colors=${colorIdentity.toLowerCase()}`;
          } else {
            console.log('Card names not found or other errors occurred.');
             $analyze.prop('disabled', false); // Re-enable if errors and not redirecting
          }
          // requestInProgress = false; // Moved to 'complete'
        }
      },
      error: function(xhr, status, error) {
        console.error('Error retrieving card data:', error);
        // Handle cases where a batch might fail, potentially add all its names to accumulatedNotFound
        const failedBatchIdentifiers = requestPayload.identifiers.map(id => id.name.toLowerCase());
        accumulatedNotFound = accumulatedNotFound.concat(failedBatchIdentifiers);
        
        requestsMade++; // Count this as a completed (though failed) request for batching logic
        if (requestsMade < Math.ceil(payload.identifiers.length / 70)) {
          currentOffset += 70;
          setTimeout(makeRequest, 100);
        } else {
           // All requests completed (some might have failed)
          console.log('All requests completed, with some batch errors!');
          nameErrors = [...new Set(accumulatedNotFound)];
          // Perform final UI update similar to success case, but knowing some data is missing
          const orderedCardNames = [];
           Object.entries(cardNames).forEach(([normalizedKey, originalCardDetails]) => {
            const scryfallComparableKey = getScryfallComparableName(normalizedKey);
            if (nameErrors.includes(scryfallComparableKey)) {
              orderedCardNames.push({ ...originalCardDetails, card: null });
            } else {
              // Should only be cards from successful batches, if any
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
             card => (card.quantity > 1 ? `${card.quantity} ${card.name}` : `1 ${card.name}`) 
          ).join('\n'));
          $highlights.html(orderedHighlights);
          $analyze.prop('disabled', false); // Re-enable button
          // requestInProgress = false; // Moved to 'complete'
        }
      },
      complete: function() {
        // Only set requestInProgress to false when the very last batch (successful or not) is done
        if (requestsMade >= Math.ceil(payload.identifiers.length / 70)) {
            requestInProgress = false;
            // If not redirecting and button is still disabled, re-enable it.
            // Redirection happens only if no errors. If errors, button should be enabled.
            if (nameErrors.length > 0) {
                 $analyze.prop('disabled', false);
            }
        }
      }
    });
  }

  makeRequest(); // Initial call
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