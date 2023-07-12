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
  $.getJSON('../data/lands.json')
    .done(function(responseData) {
      // Assign the data to the data variable
      data = responseData;
      localStorage.setItem('landsData', JSON.stringify(data));
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
        nameErrors = response.not_found.map(card => card.name.toLowerCase());
        const namesCorrect = response.data.map(cardData => cardData.name);

        // Order the card names based on the textarea order
        const orderedCardNames = [];

        // Add error cards first
        Object.entries(cardNames).forEach(([name, card]) => {
          if (nameErrors.includes(name)) {
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
          orderedCardNames.map(card => card.name),
          nameErrors
        );

        // Update the textarea with the ordered card names and quantities
        const updatedLines = orderedCardNames.map(
          card => (card.quantity > 1 ? `${card.quantity} ${card.name}` : '1' + ' ' + card.name)
        );
        $textarea.val(updatedLines.join('\n'));

        // Update the highlights with the ordered highlights
        $highlights.html(orderedHighlights);

        // Enable or disable analyze button based on whether there are errors
        const hasErrors = nameErrors.length > 0;
        $analyze.prop('disabled', hasErrors);

        // Console.log errors and matches
        console.log('Errors:', nameErrors);
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

          // Check if there are no errors
          if (!hasErrors) {
            console.log('All card names found!');

            // Update the orderedCardNames with cardId from responseData
            const updatedUserList = orderedCardNames.map(card => ({
              quantity: card.quantity,
              cardId: card.card ? card.card.id : null,
              name: card.name
            }));
            // Save updated user list and JSON response in localStorage
            localStorage.setItem('userList', JSON.stringify(updatedUserList));
            localStorage.setItem('responseData', JSON.stringify(responseData));

            localStorage.removeItem('selectedCards');
            // Redirect to /buffet.html
            window.location.href = '/buffet.html';
          } else {
            console.log('Card names not found!');
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



// Function to get the card ID by name from responseData
function getCardIdByName(name) {
  const matchedCard = responseData?.data.find(item => item.name.toLowerCase() === name.toLowerCase());
  return matchedCard?.id;
}

// Function to apply highlights
function applyHighlights(cardNames, nameErrors) {
  let highlightedText = '';

  // Generate the highlighted text with correct ordering
  cardNames.forEach(cardName => {
    if (nameErrors.includes(cardName)) {
      highlightedText += `<mark data-card-name="${cardName}">${cardName}</mark>\n`;
    } else {
      highlightedText += `${cardName}\n`;
    }
  });

  // Add a line break to the end of the text
  return highlightedText.replace(/\n$/g, '\n\n');
}

// Function to handle input changes in the textarea
function handleInput() {
  const text = $textarea.val().trim();
  const cardNames = text.split('\n');

  // Remove mark tags from deleted nameErrors
  nameErrors = nameErrors.filter(error => cardNames.includes(error));

  // Apply highlights for the remaining card names
  const highlightedText = applyHighlights(cardNames, nameErrors);
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
