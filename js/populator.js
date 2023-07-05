const cardSuggestions = $('#cardSuggestions');
const cardsPerPage = 40;
let currentPage = 1;
let startIndex = 0;
let endIndex = cardsPerPage;
const offset = 100; // Offset in pixels from the bottom of the container
let data; // Declare the data variable
let totalCards; // Declare the totalCards variable
let filteredData = []; // Declare the filteredData variable

function createCardElement(card) {
  const cardElement = $(`
    <!-- Card -->
    <div class="card" data-card-name="${card.name}" data-colors="${card.color_identity}" data-properties="${card.properties}" data-rank="${card.edhrec_rank}" tabindex="0"></div>
    <!-- End Card -->
  `);

  if (card.card_faces) {
    cardElement.html(`
      <div class="cardContent dfc">
        <div class="artContainer">
          <img class="back" loading="eager" src="${card.card_faces[1].image_uris.normal}" alt="${card.card_faces[1].name}">
          <img class="front" loading="eager" src="${card.card_faces[0].image_uris.normal}" alt="${card.card_faces[0].name}">
        </div>
      </div>
      <span class="cardName">${card.name}</span>
      <button type="button hidden" title="Transform" tabindex="-1" class="flip-button" style="--hiddenCount: 12;"></button>
    `);
  } else {
    cardElement.html(`
      <div class="cardContent">
        <div class="artContainer">
          <img loading="eager" src="${card.image_uris.normal}" alt="${card.name}">
        </div>
      </div>
      <span class="cardName">${card.name}</span>
    `);
  }

  return cardElement;
}

// Function to filter cards based on search value and selected colors
function filterCards() {
  const searchValue = $('#search').val();
  const formattedSearchValue = formatCardName(searchValue);

  const selectedColors = $('.color:checked').map(function() {
    return $(this).val().toLowerCase(); // Convert to lowercase
  }).get();

  filteredData = data.data.filter(function(card) {
    const formattedCardName = formatCardName(card.name);
    const cardColors = card.color_identity.map(function(color) {
      return color.toLowerCase(); // Convert to lowercase
    });

    const matchesSearch = formattedCardName.includes(formattedSearchValue);

    // Check if card has color identity
    const hasColorIdentity = cardColors.length > 0;

    // Check if no filters are selected or if "C" is selected and the card has no color identity
    const showCard = (selectedColors.length === 0) || (selectedColors.includes('c') && !hasColorIdentity);

    // Check if card colors are a subset of the selected colors, excluding cards with no color identity
    const isSubset = hasColorIdentity && cardColors.every(function(color) {
      return selectedColors.includes(color);
    });

    return matchesSearch && (isSubset || showCard);
  });

  console.log('Filtered Data:', filteredData); // Log filtered data

  startIndex = 0;
  endIndex = cardsPerPage;
  cardSuggestions.empty(); // Clear the card pool
  loadCards();
}

// Event listener for search input
$('#search').on('input', debounce(function() {
  filterCards();
}, 300));

// Event listener for color checkboxes
$('.color').on('change', function() {
  filterCards();
});

// Function to load and append cards to the card pool
function loadCards() {
  if (!filteredData) {
    // No matching cards found, do not load any cards
    return;
  }

  const sortedData = filteredData.sort((a, b) => a.edhrec_rank - b.edhrec_rank);

  for (let i = startIndex; i < endIndex; i++) {
    if (i >= sortedData.length) {
      break;
    }

    const card = sortedData[i];
    const cardName = card.name;
    const isDuplicate = cardSuggestions.find(`[data-card-name="${cardName}"]`).length > 0;

    if (!isDuplicate) {
      const cardElement = createCardElement(card);
      cardSuggestions.append(cardElement);
    }
  }
}

// Initialize debouncer
var debounceTimeout;
function debounce(func, delay) {
  return function() {
    var context = this;
    var args = arguments;
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(function() {
      func.apply(context, args);
    }, delay);
  };
}

// Function to format card name for search
function formatCardName(cardName) {
  return cardName.replace(/[^\w\s]|_/g, "").toLowerCase();
}

// Function to update filters based on URL parameters
const updateFiltersFromUrl = () => {
  const queryParams = new URLSearchParams(window.location.search);
  const selectedColors = queryParams.get('colors')?.split(',') ?? [];
  const selectedProperties = queryParams.get('properties')?.split(',') ?? [];

  $('.color').each(function() {
    const checkbox = $(this);
    const value = checkbox.val();
    checkbox.prop('checked', selectedColors.includes(value));
  });

  $('.property').each(function() {
    const checkbox = $(this);
    const value = checkbox.val();
    checkbox.prop('checked', selectedProperties.includes(value));
  });
};

// Function to update URL parameters based on filters
const updateUrlFromFilters = () => {
  const selectedColors = $('.color:checked').map(function() {
    return $(this).val();
  }).get();

  const selectedProperties = $('.property:checked').map(function() {
    return $(this).val();
  }).get();

  const queryParams = new URLSearchParams();

  if (selectedColors.length > 0) {
    queryParams.set('colors', selectedColors.join(','));
  }

  if (selectedProperties.length > 0) {
    queryParams.set('properties', selectedProperties.join(','));
  }

  const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?${queryParams.toString()}${window.location.hash}`;
  window.history.replaceState({ path: newUrl }, '', newUrl);
};

$.getJSON('../lands/lands.json')
  .done(function(responseData) {
    data = responseData;

    
    // Update filter checkboxes from URL
    updateFiltersFromUrl();
    
    
        filterCards();

    // Scroll event listener
    $(window).on('scroll', function() {
      const cardSuggestionsOffset = cardSuggestions.offset().top + cardSuggestions.height();
      const windowOffset = $(window).scrollTop() + $(window).height();

      if (windowOffset >= cardSuggestionsOffset - offset) {
        startIndex += cardsPerPage;
        endIndex += cardsPerPage;

        if (endIndex <= filteredData.length) {
          loadCards();
        }
      }
    });

  })
  .fail(function(error) {
    console.error('Error:', error);
  });

// Add event listener to color and property checkboxes
$('.color, .property').on('change', function() {
  filterCards();
  updateUrlFromFilters();
});