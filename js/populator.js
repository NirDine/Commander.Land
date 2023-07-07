const cardSuggestions = $('#cardSuggestions');
const cardsPerPage = 40;
let currentPage = 1;
let startIndex = 0;
let endIndex = cardsPerPage;
const offset = 100; // Offset in pixels from the bottom of the container
let data; // Declare the data variable
let totalCards; // Declare the totalCards variable
let filteredData = []; // Declare the filteredData variable
let selectedCards = [];
let maxCardSelected = 100;

function createCardElement(card) {
  const cardElement = $(`
    <!-- Card -->
    <div class="card" data-card-id="${card.id}" data-card-name="${card.name}" data-colors="${card.color_identity}" data-properties="${card.properties}" data-rank="${card.edhrec_rank}" tabindex="0"></div>
    <!-- End Card -->
  `);

  if (card.card_faces) {
    cardElement.html(`
      <div class="cardContent dfc">
        <div class="artContainer">
          <img class="back" loading="eager" src="${card.card_faces[1].image_uris.normal}" alt="${card.card_faces[1].name}" aria-oracle="${card.name}. It reads: ${card.oracle_text}">
          <img class="front" loading="eager" src="${card.card_faces[0].image_uris.normal}" alt="${card.card_faces[0].name}" aria-oracle="${card.name}. It reads: ${card.oracle_text}">
        </div>
      </div>
      <span class="cardName">${card.name}</span>
      <button type="button hidden" title="Transform" tabindex="-1" class="flip-button" style="--hiddenCount: 12;"></button>
    `);
  } else {
    cardElement.html(`
      <div class="cardContent">
        <div class="artContainer">
          <img loading="eager" src="${card.image_uris.normal}" alt="${card.name}" aria-oracle="${card.name}. It reads: ${card.oracle_text}">
        </div>
      </div>
      <span class="cardName">${card.name}</span>
    `);
  }

  return cardElement;
}

// Event listener for search input
$('#search').on('input', debounce(function() {
  filterCards();
}, 300));

// Automatically focus search input when typing starts with letters
$(document).on('keydown', function(event) {
  const searchInput = $('#search');
  const key = event.key;

  // Check if the key is an alphabetic character
  if (/^[a-zA-Z]$/.test(key)) {
    searchInput.focus();
  }
});


// Function to load and append cards to the card pool
function loadCards() {
  if (!filteredData || filteredData.length === 0 || !data) {
    // No matching cards found or data is not available, do not load any cards
    return;
  }

  let cardsToAdd = [];

  if ($("#isAdded").is(":checked")) {
    // Filter cardsToAdd based on selectedCards
    cardsToAdd = selectedCards
      .map(cardId => filteredData.find(card => card.id === cardId))
      .filter(card => card !== undefined); // Exclude undefined values
  } else {
    // Filter cardsToAdd to exclude already loaded cards
    const sortedData = filteredData.sort((a, b) => a.edhrec_rank - b.edhrec_rank);
    cardsToAdd = sortedData
      .slice(startIndex, endIndex)
      .filter(card => !cardSuggestions.find(`[data-card-id="${card.id}"]`).length);
  }

  for (let i = 0; i < cardsToAdd.length; i++) {
    const card = cardsToAdd[i];
    const cardElement = createCardElement(card);

    // Check if the card is already selected
    if (selectedCards.includes(card.id)) {
      cardElement.addClass('selected');
    }

    const isDuplicate = cardSuggestions.find(`[data-card-name="${card.name}"]`).length > 0;

    if (!isDuplicate) {
      cardSuggestions.append(cardElement);
    }
  }
}


// Function to filter cards based on search value and selected colors
function filterCards() {
  const searchValue = $('#search').val();
  const formattedSearchValue = formatCardName(searchValue);

  const selectedColors = $('.color:checked').map(function() {
    return $(this).val().toLowerCase(); // Convert to lowercase
  }).get();

  filteredData = data?.data.filter(function(card) {
    const formattedCardName = formatCardName(card.name);
    const formattedCardType = formatCardName(card.type_line);
    const formattedCardText = formatCardName(card.oracle_text);
    const cardColors = card.color_identity.map(function(color) {
      return color.toLowerCase(); // Convert to lowercase
    });

    const matchesSearch = formattedCardName.includes(formattedSearchValue) ||
      formattedCardType.includes(formattedSearchValue) ||
      formattedCardText.includes(formattedSearchValue);

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

  startIndex = 0;
  endIndex = cardsPerPage;
  cardSuggestions.empty(); // Clear the card pool
  loadCards();
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

function formatCardName(cardName) {
  if (typeof cardName === 'string' && cardName.trim().length > 0) {
    return cardName.replace(/[^\w\s]|_/g, "").toLowerCase();
  }
  return '';
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


// Check if the data is already stored in localStorage
const storedData = localStorage.getItem('landsData');

if (storedData) {
  // If the data is already present in localStorage, parse and assign it to the data variable
  data = JSON.parse(storedData);

  // Retrieve selectedCards from localStorage
  const storedSelectedCards = localStorage.getItem('selectedCards');
  selectedCards = storedSelectedCards ? JSON.parse(storedSelectedCards) : [];

  // Update filter checkboxes from URL
  updateFiltersFromUrl();
  filterCards();

} else {
  // If the data is not present in localStorage, fetch it from the JSON file
  $.getJSON('../lands/lands.json')
    .done(function(responseData) {
      // Store the fetched data in localStorage
      localStorage.setItem('landsData', JSON.stringify(responseData));

      // Assign the data to the data variable
      data = responseData;

      // Retrieve selectedCards from localStorage
      const storedSelectedCards = localStorage.getItem('selectedCards');
      selectedCards = storedSelectedCards ? JSON.parse(storedSelectedCards) : [];

      // Update filter checkboxes from URL
      updateFiltersFromUrl();
      filterCards();


    })
    .fail(function(error) {
      console.error('JSON Error:', error);
    });
}
// Update filter checkboxes from URL
updateFiltersFromUrl();
filterCards();

// Scroll event listener
$(window).on('scroll', function() {
  const cardSuggestionsOffset = cardSuggestions.offset().top + cardSuggestions.height();
  const windowOffset = $(window).scrollTop() + $(window).height();

  if (!$("#isAdded").is(":checked") && windowOffset >= cardSuggestionsOffset - offset) {
    startIndex += cardsPerPage;
    endIndex += cardsPerPage;

    if (filteredData && endIndex <= filteredData.length) {
      loadCards();
    }
  }
});



// Check and hide/show the #isAdded checkbox
if (selectedCards.length > 0) {
  $(".mana:has(#isAdded)").show();
} else {
  $(".mana:has(#isAdded)").prop("checked", false).hide();
  $("#isAdded").prop("checked", false);
  loadCards();
}



// Add event listener to color and property checkboxes
$('.color, .property').on('change', function() {
  filterCards();
  updateUrlFromFilters();
});

$('#isAdded').on('change', function() {
  const isChecked = $(this).is(':checked');
  
  if (isChecked) {
    // Load and append cards from selectedCards
    cardSuggestions.empty(); // Clear the card pool
    startIndex = 0;
    endIndex = cardsPerPage;
    loadCards();
  } else {
    // Reset the card pool to show filtered cards
    filterCards();
  }
});

$('.reset-filters').on('click', function() {

    $('.color, .property, #isAdded').each(function() {
        const checkbox = $(this);
        const value = checkbox.val();
        checkbox.prop('checked', false);
      });
    $('#search').val('');
    filterCards();
});

