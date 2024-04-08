const cardSuggestions = $('#cardSuggestions');
const cardsPerPage = 40;
let currentPage = 1;
let startIndex = 0;
let endIndex = cardsPerPage;
const offset = 100; // Offset in pixels from the bottom of the container
let data; // Declare the data variable
let totalCards; // Declare the totalCards variable
let filteredData = []; // Declare the filteredData variable
let selectedCards = localStorage.getItem('selectedCards') || [];
let maxCardSelected = 100;

function createCardElement(card) {
  const cardElement = $(`
    <!-- Card -->
    <div class="card" data-card-id="${card.id}" data-card-name="${card.name}" data-colors="${card.color_identity}" data-properties="${card.properties}" data-rank="${card.edhrec_rank}" data-basic="${card.is_basic}" tabindex="0"></div>
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
  } 
  else if (card.is_basic) {
    cardElement.html(`
      <div class="cardContent basic">
        <div class="artContainer">
          <img loading="eager" src="${card.image_uris.normal}" alt="${card.name}" aria-oracle="${card.name}. It reads: ${card.oracle_text}">
        </div>
      </div>
      <span class="cardName">${card.name}</span>
      <button type="button hidden" title="Remove  ${card.name}" tabindex="-1" class="remove-basic-button" style="--hiddenCount: 12;">—</button>
      <span class="totalBasics"></span>
    `);
  }
    else {
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
  const searchValue = $(this).val().trim();
  const nonSymbolCharsCount = searchValue.replace(/[^a-zA-Z0-9]/g, '').length;

  if (nonSymbolCharsCount >= 3 || nonSymbolCharsCount === 0) {
    filterCards();
  updateBasicCardsCount(); 
  }
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
      .map(cardName => filteredData.find(card => card.name === cardName))
      .filter(card => card !== undefined); // Exclude undefined values
  } else {
    // Filter cardsToAdd to exclude already loaded cards
    const sortedData = filteredData.sort((a, b) => a.edhrec_rank - b.edhrec_rank);
    cardsToAdd = sortedData
      .slice(startIndex, endIndex)
      .filter(card => !cardSuggestions.find(`[data-card-name="${card.name}"]`).length);
  }

  for (let i = 0; i < cardsToAdd.length; i++) {
    const card = cardsToAdd[i];
    const cardElement = createCardElement(card);

    // Check if the card is already selected
    if (selectedCards.includes(card.name)) {
      cardElement.addClass('selected');
    }

    const isDuplicate = cardSuggestions.find(`[data-card-name="${card.name}"]`).length > 0;

    if (!isDuplicate) {
      cardSuggestions.append(cardElement);
    }
  }
}

// Function to filter cards based on search value, selected colors, and card properties
function filterCards() {
  const searchValue = $('#search').val();
  const formattedSearchValue = formatCardName(searchValue);

  const selectedColors = $('.color:checked').map(function() {
    return $(this).val().toLowerCase(); // Convert to lowercase
  }).get();

  const selectedProperties = $('.property:checked').map(function() {
    return $(this).val().toLowerCase(); // Convert to lowercase
  }).get();

  filteredData = data?.data.filter(function(card) {
    const formattedCardName = formatCardName(card.name);
    const formattedCardType = formatCardName(card.type_line);
    const formattedCardText = formatCardName(card.oracle_text);
    const cardColors = card.color_identity?.map(function(color) {
      return color.toLowerCase(); // Convert to lowercase
    }) || [];
    const cardProperties = card.properties?.map(function(property) {
      return property.toLowerCase(); // Convert to lowercase
    }) || [];

    const matchesSearch = formattedCardName.includes(formattedSearchValue) ||
      formattedCardType.includes(formattedSearchValue) ||
      formattedCardText.includes(formattedSearchValue) ||
      cardProperties.some(function(property) {
        return formatCardName(property).includes(formattedSearchValue);
      });

    // Check if card has color identity
    const hasColorIdentity = cardColors.length > 0;

    // Check if no filters are selected or if "C" is selected and the card has no color identity
    const showCard = (selectedColors.length === 0) || (selectedColors.includes('c') && !hasColorIdentity);

    // Check if card colors are a subset of the selected colors, excluding cards with no color identity
    const isSubset = hasColorIdentity && cardColors.every(function(color) {
      return selectedColors.includes(color);
    });

    // Check if any selected properties match any card properties
    const hasMatchingProperties = selectedProperties.some(function(property) {
      if (property === 'untap') {
        return !cardProperties.includes('tapland');
      }
      return cardProperties.includes(property);
    });

    return matchesSearch && (isSubset || showCard) && (hasMatchingProperties || selectedProperties.length === 0);
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
  const searchTerms = queryParams.get('q') || ''; // Get the search terms from the URL query parameter 'q'
  const selectedColors = queryParams.get('colors')?.split(',') ?? [];
  const selectedProperties = queryParams.get('properties')?.split(',') ?? [];

  // Set the search input value
  $('#search').val(searchTerms);

  // Filter cards based on the search input
  filterCards();

  // Set the selected colors
  $('.color').each(function() {
    const checkbox = $(this);
    const value = checkbox.val();
    checkbox.prop('checked', selectedColors.includes(value));
  });

  // Set the selected properties
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

  const searchTerms = $('#search').val().trim(); // Get the search terms from the search input
  const queryParams = new URLSearchParams();

  if (searchTerms !== '') {
    queryParams.set('q', searchTerms); // Set the search terms in the URL query parameter 'q'
  }

  if (selectedColors.length > 0) {
    queryParams.set('colors', selectedColors.join(','));
  }

  if (selectedProperties.length > 0) {
    queryParams.set('properties', selectedProperties.join(','));
  }

  const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?${queryParams.toString()}${window.location.hash}`;
  window.history.replaceState({ path: newUrl }, '', newUrl);
};

const updateMobileColorFilters = () => {
  const selectedColorCheckboxes = $('.color:checked, .colorless:checked');
  const selectedPropertyCheckboxes = $('.section-dropdown .property:checked');

  const iElements = selectedColorCheckboxes.map(function() {
    const i = $('<i></i>').addClass('ms ms-' + $(this).val());
    return i[0];
  }).get();

  if (selectedColorCheckboxes.length === 0) {
    const i = $('<i></i>').addClass('ms ms-multicolor');
    iElements.push(i[0]);
  }

  const targetElements = $('.mobileColorTarget');
  targetElements.each(function() {
    $(this).find('i').remove();
    $(this).append(iElements);
  });

  const propertyElements = $('.propertyTarget');
  propertyElements.each(function() {
    $(this).find('i').remove();

    selectedPropertyCheckboxes.each(function() {
      const i = $('<i></i>');

      if ($(this).val() !== 'gtc') {
        i.addClass('ms ms-' + $(this).val());
      } else {
        i.addClass('ss ss-' + $(this).val());
      }

      $(this).parent().append(i);
    });
  });
};


// Check if the data is already stored in localStorage
const storedData = localStorage.getItem('landsData');
const storedVersion = localStorage.getItem('landsDataVersion');
const currentVersion = '1.7'; // Replace with the current version of the JSON data

if (!storedVersion) {
    console.log('No data found.');
}
else if (storedData && storedVersion !== currentVersion) {
    console.log('Current data version: ' + storedVersion);
}

if (storedData && storedVersion === currentVersion) {
  // If the data is already present in localStorage and has the same version, parse and assign it to the data variable
  data = JSON.parse(storedData);
  console.log("Current data version: " + currentVersion + ".");
  // Retrieve selectedCards from localStorage
  const storedSelectedCards = localStorage.getItem('selectedCards');
  selectedCards = storedSelectedCards ? JSON.parse(storedSelectedCards) : [];

  // Update filter checkboxes from URL
  updateFiltersFromUrl();
  filterCards();
  console.log("No new data to load.");
} else {
  // If the data is not present in localStorage or has a different version, fetch it from the JSON file
  $.getJSON('../data/lands.json')
    .done(function(responseData) {
      // Assign the data to the data variable
      data = responseData;
      console.log("Newest data version: " + currentVersion + ".");
      console.log("Loading new data...");
      // Store the fetched data and the version in localStorage
      localStorage.setItem('landsData', JSON.stringify(data));
      localStorage.setItem('landsDataVersion', currentVersion);

      // Retrieve selectedCards from localStorage
      const storedSelectedCards = localStorage.getItem('selectedCards');
      selectedCards = storedSelectedCards ? JSON.parse(storedSelectedCards) : [];

      // Update filter checkboxes from URL
      updateFiltersFromUrl();
      filterCards();
      console.log("Data loaded correctly.");
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
  updateBasicCardsCount();
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
   updateBasicCardsCount();
});

$('.reset-filters').on('click', function() {

    $('.color, .property, #isAdded').each(function() {
        const checkbox = $(this);
        const value = checkbox.val();
        checkbox.prop('checked', false);
      });
    $('#search').val('');
    filterCards();
    updateBasicCardsCount(); 
});

