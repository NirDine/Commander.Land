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
let responseData;
let userList;

// Scryfall API endpoint
const scryfallEndpoint = 'https://api.scryfall.com/cards/collection';

// Flag to track whether a request is in progress
let requestInProgress = false;

// Disable analyze button to prevent further requests
$analyze.prop('disabled', true);

// Update textarea and highlights when analyze button is clicked
$analyze.on('click', function() {
  // Check if a request is already in progress
  if (requestInProgress) {
    return;
  }

  const cardList = $textarea.val().trim();

  // Split the card list into individual lines
  const lines = cardList.split('\n');

  // Filter out empty lines
  const nonEmptyLines = lines.filter(line => line.trim() !== '');

  // Extract card names and quantities
  const cardNames = {};

    
const storedData = localStorage.getItem('landsData');

    
if (storedData) {
  data = JSON.parse(storedData);
} else {
  $.getJSON('data/lands.json')
    .done(function(responseData) {
      // Assign the data to the data variable
      data = responseData;
      localStorage.setItem('landsData', JSON.stringify(data));
});
}
    
    
    
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

  // Prepare the payload with unique card names
  const identifiers = [...new Set(Object.keys(cardNames))].map(cardName => ({ name: cardName }));
  const payload = { identifiers };

  console.log('Sending request...');
  // Make the requests with a delay of 100ms between each request
  let currentOffset = 0;
  let requestsMade = 0;
  let responseData = [];
  let accumulatedNotFound = [];

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
        console.log('Request successful!', response);
        responseData = responseData.concat(response.data);
        // nameErrors = response.not_found.map(card => card.name.toLowerCase()); // Old logic
        const currentBatchNotFoundNames = response.not_found.map(card => card.name.toLowerCase());
        accumulatedNotFound = accumulatedNotFound.concat(currentBatchNotFoundNames);
        // nameErrors = accumulatedNotFound; // UI update and final nameErrors assignment moved to after all requests
        const namesCorrect = response.data.map(cardData => cardData.name);

        // UI UPDATE LOGIC MOVED TO AFTER ALL REQUESTS

        // Console.log errors and matches for current batch
        console.log('Batch Errors:', currentBatchNotFoundNames);
        console.log('Matches:', namesCorrect);

        // Check if there are more requests to be made
        requestsMade++;
        if (requestsMade < Math.ceil(payload.identifiers.length / 70)) {
          // Increment the offset for the next request
          currentOffset += 70;

          // Delay the next request by 100ms
          setTimeout(makeRequest, 100);
        } else {
          // All requests completed
          console.log('All requests completed!');
          nameErrors = [...new Set(accumulatedNotFound)]; // Finalize nameErrors with unique values

          // MOVED UI UPDATE LOGIC STARTS HERE
          // Order the card names based on the textarea order
          const orderedCardNames = [];

          // Add error cards first
          Object.entries(cardNames).forEach(([name, card]) => {
            // Ensure comparison is with normalized names if cardNames keys are not already normalized
            if (nameErrors.includes(name.toLowerCase())) { 
              orderedCardNames.push({ ...card, card: null });
            }
          });

          // Add remaining card names from responseData
          Object.entries(cardNames).forEach(([name, card]) => {
            const normalizedCardName = name.toLowerCase();
            if (!nameErrors.includes(normalizedCardName)) {
              const matchingCardData = responseData.find(cardData => cardData.name.toLowerCase() === normalizedCardName);
              orderedCardNames.push({ ...card, card: matchingCardData });
            }
          });

          // Order the highlights based on the ordered card names
          const orderedHighlights = applyHighlights(
            orderedCardNames.map(card => ({ name: card.name, quantity: card.quantity })),
            nameErrors // Use the finalized nameErrors
          );

          // Update the textarea with the ordered card names and quantities
          const updatedLines = orderedCardNames.map(
            card => (card.quantity > 1 ? `${card.quantity} ${card.name}` : '1' + ' ' + card.name)
          );
          $textarea.val(updatedLines.join('\n'));

          // Update the highlights with the ordered highlights
          $highlights.html(orderedHighlights);
          // MOVED UI UPDATE LOGIC ENDS HERE

          const hasErrors = nameErrors.length > 0;
          $analyze.prop('disabled', hasErrors);

          if (!hasErrors) {
            console.log('All card names found!');

            // Update the orderedCardNames with cardName from responseData
            // Note: orderedCardNames is already defined and populated above
            const updatedUserList = orderedCardNames.map(card => ({
              quantity: card.quantity,
              name: card.card ? card.card.name : card.name
            }));
            // Save updated user list and JSON response in localStorage
            localStorage.setItem('userList', JSON.stringify(updatedUserList));
            localStorage.setItem('responseData', JSON.stringify(responseData));

            localStorage.removeItem('selectedCards');
            // Determine the colorIdentity
            const colorIdentity = determineColorIdentity(responseData);
            // Redirect to /buffet.html with colorIdentity as query parameter
            window.location.href = `buffet.html?colors=${colorIdentity.toLowerCase()}`;
          } else {
            console.log('Card names not found!');
            // applyHighlights(); // Removed as main highlighting is done above
          }
        }
      },
      error: function(xhr, status, error) {
        console.error('Error retrieving card data:', error);
      },
      fail: function() {
        console.error('Request failed!');
      },
      complete: function() {
        // Enable analyze button after a delay of 100 milliseconds
        setTimeout(function() {
          requestInProgress = false;
        }, 100);
      }
    });
  }

  // Make the first request
  makeRequest();
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

  // Ensure cardInfoArray is an array and nameErrors is also an array
  if (!Array.isArray(cardInfoArray) || !Array.isArray(nameErrors)) {
    console.error("Invalid input: cardInfoArray or nameErrors is not an array");
    return highlightedText;
  }

  // Generate the highlighted text with correct ordering
  cardInfoArray.forEach(cardInfo => {
    if (cardInfo && cardInfo.name && typeof cardInfo.quantity !== 'undefined') {
      const { name, quantity } = cardInfo;

      // Handle names with "//"
      const sanitizedName = name.replace(/ \/\/ /g, ' // ');

      if (nameErrors.includes(sanitizedName.toLowerCase())) {
        highlightedText += `<mark class="error" data-card-name="${sanitizedName}">${quantity} ${sanitizedName}</mark>\n`;
      } else {
        highlightedText += `${quantity} ${sanitizedName}\n`;
      }
    } else {
      console.error("Invalid cardInfo object:", cardInfo);
    }
  });

  // Add a line break to the end of the text
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
      // Ensure there's a name part; match[2] could be undefined if line is just "1x"
      const cardNamePart = match[2] || ''; 
      const cardName = cardNamePart.trim().toLowerCase();
      if (cardName) { // Add only if cardName is not empty
        currentCardNamesFromText.add(cardName);
      }
    }
  });

  // Filter nameErrors: keep only errors for cards still present in the textarea
  nameErrors = nameErrors.filter(errorKey => currentCardNamesFromText.has(errorKey));

  // Reconstruct cardInfoArray for applyHighlights based on current textarea content
  const cardInfoArrayForHighlights = lines.map(line => {
    const match = line.match(/^(\d+)?x?\s?(.*)$/i);
    if (match) {
      const quantity = match[1] ? parseInt(match[1].trim().replace(/x/gi, '')) : 1;
      // Ensure there's a name part for the object
      const namePart = match[2] || ''; 
      const name = namePart.trim();
      // Return object only if name is not empty, otherwise it's not a valid card line
      if (name) {
        return { name, quantity };
      }
    }
    return null;
  }).filter(Boolean); // filter(Boolean) removes null entries

  const highlightedText = applyHighlights(cardInfoArrayForHighlights, nameErrors);
  $highlights.html(highlightedText);

  // Check if the highlighted text contains the <mark> tag
  const highlightsExist = $highlights.find('mark').length > 0 || highlightedText.includes('<mark>');

  // Apply or remove error class based on highlightsExist
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

// Fix iOS padding issues if applicable
if (isIOS) {
  fixIOS();
}

// Bind event handlers to the textarea
bindEvents();
