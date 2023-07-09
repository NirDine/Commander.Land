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

let nameErrors = []; // Initialize nameErrors as an empty array

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

  nonEmptyLines.forEach(line => {
    const match = line.match(/^(\d+)?x?\s?(.*)$/i);
    if (match) {
      const quantity = match[1] ? parseInt(match[1].trim().replace(/x/gi, '')) : 1;
      const cardName = match[2].trim();
      const normalizedCardName = cardName.toLowerCase();
      if (cardNames[normalizedCardName]) {
        cardNames[normalizedCardName] += quantity;
      } else {
        cardNames[normalizedCardName] = quantity;
      }
    }
  });

  // Prepare the payload with unique card names
  const identifiers = [...new Set(Object.keys(cardNames))].map(cardName => ({ name: cardName }));
  const payload = { identifiers };

  console.log('Sending request...');
  // Make the request to the Scryfall API
  requestInProgress = true;
  $.ajax({
    url: scryfallEndpoint,
    type: 'POST',
    dataType: 'json',
    contentType: 'application/json',
    data: JSON.stringify(payload),
    success: function(response) {
      console.log('Request successful!');
      nameErrors = response.not_found.map(card => card.name.toLowerCase());
      const namesCorrect = response.data.map(cardData => cardData.name);

      // Order the card names based on the textarea order
      const orderedCardNames = [];

      // Add error cards first
      Object.entries(cardNames).forEach(([name, quantity]) => {
        if (nameErrors.includes(name)) {
          orderedCardNames.push({ name, quantity });
        }
      });

      // Add remaining card names
      Object.entries(cardNames).forEach(([name, quantity]) => {
        if (!nameErrors.includes(name)) {
          orderedCardNames.push({ name, quantity });
        }
      });

      // Order the highlights based on the ordered card names
      const orderedHighlights = applyHighlights(
        orderedCardNames.map(card => card.name),
        nameErrors
      );

      // Update the textarea with the ordered card names and quantities
      const updatedLines = orderedCardNames.map(card =>
        card.quantity > 1 ? `${card.quantity} ${card.name}` : '1' + " " + card.name
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

      // Console.log positive message if no errors
      if (!hasErrors) {
        console.log('All card names found!');

        // Save user list and JSON response in localStorage
        localStorage.setItem('userList', JSON.stringify(orderedCardNames));
        localStorage.setItem('responseData', JSON.stringify(response));

        // Redirect to /buffet.html
        window.location.href = '/buffet.html';
      }
    },
    error: function(xhr, status, error) {
      console.error('Error retrieving card data:', error);
    },
    complete: function() {
      // Enable analyze button after a delay of 50 milliseconds
      setTimeout(function() {
        requestInProgress = false;
      }, 100);
    }
  });
});



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
