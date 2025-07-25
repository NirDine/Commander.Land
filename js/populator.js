const cardSuggestions = $('#cardSuggestions');
const cardsPerPage = 40;
let currentPage = 1;
let startIndex = 0;
let endIndex = cardsPerPage;
let cardsToLoad = cardsPerPage;
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

  if (card.is_basic) {
      cardElement.html(`
        <div class="cardContent basic">
          <div class="artContainer">
            <img loading="eager" src="${card.image_uris.normal}" alt="${card.name}" aria-oracle="${card.name}. It reads: ${card.oracle_text || ''}">
          </div>
        </div>
        <span class="cardName">${card.name}</span>
        <button type="button hidden" title="Remove  ${card.name}" tabindex="-1" class="remove-basic-button" style="--hiddenCount: 12;">—</button>
        <span class="totalBasics"></span>
      `);
  } 
  else if (card.card_faces && card.card_faces[0].image_uris && card.card_faces[1] && card.card_faces[1].image_uris) {
      const frontFace = card.card_faces[0];
      const backFace = card.card_faces[1];
      const frontImageSrc = frontFace.image_uris.normal;
      const frontImageAlt = frontFace.name || card.name;
      const frontAriaOracle = `${frontImageAlt}. It reads: ${frontFace.oracle_text || card.oracle_text || ''}`;
      const backImageSrc = backFace.image_uris.normal;
      const backImageAlt = backFace.name || card.name; // backFace.name should exist for true DFC
      const backAriaOracle = `${backImageAlt}. It reads: ${backFace.oracle_text || card.oracle_text || ''}`;

      cardElement.html(`
        <div class="cardContent dfc">
          <div class="artContainer">
            <img class="back" loading="eager" src="${backImageSrc}" alt="${backImageAlt}" aria-oracle="${backAriaOracle}">
            <img class="front" loading="eager" src="${frontImageSrc}" alt="${frontImageAlt}" aria-oracle="${frontAriaOracle}">
          </div>
        </div>
        <span class="cardName">${card.name}</span>
        <button type="button hidden" title="Transform" tabindex="-1" class="flip-button" style="--hiddenCount: 12;"></button>
      `);
  } 
  else {
      // Single-faced card or DFC without distinct face images (e.g., Adventures)
      const mainImageSrc = card.image_uris ? card.image_uris.normal : '';
      const mainImageAlt = card.name;
      let ariaOracleText = card.oracle_text || '';
      if (card.card_faces && card.card_faces[0] && card.card_faces[0].oracle_text) {
          ariaOracleText = card.card_faces[0].oracle_text;
      }
      const mainAriaOracle = `${mainImageAlt}. It reads: ${ariaOracleText || ''}`; // Ensure final fallback for ariaOracleText

      cardElement.html(`
        <div class="cardContent">
          <div class="artContainer">
            <img loading="eager" src="${mainImageSrc}" alt="${mainImageAlt}" aria-oracle="${mainAriaOracle}">
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

// Automatically focus search input when typing starts with letters, ignoring Ctrl/Cmd combinations
$(document).on('keydown', function(event) {
  const searchInput = $('#search');
  const key = event.key;

  // Check if Ctrl or Cmd key is pressed
  if (event.ctrlKey || event.metaKey) {
    // Do not focus if Ctrl or Cmd is part of the keypress (e.g., Ctrl+C, Cmd+C)
    return;
  }

  // Check if the key is an alphabetic character and the event target is not an input/textarea
  if (/^[a-zA-Z]$/.test(key) && !$(event.target).is('input, textarea, [contenteditable="true"]')) {
    // Only focus if the user isn't already typing in an input/textarea or contenteditable element
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
    // Filter relevantSelectedCards based on selectedCards and filteredData
    let relevantSelectedCards = selectedCards
      .map(cardName => filteredData.find(card => card.name === cardName))
      .filter(card => card !== undefined); // Exclude undefined values

    const sortingKey = $('.sorting:checked').val();
    const rarityOrder = ['common', 'uncommon', 'rare', 'mythic'];

    relevantSelectedCards.sort((a, b) => {
      let comparison = 0;
      let compA, compB;
      const valA_name = String(a.name || '').toLowerCase();
      const valB_name = String(b.name || '').toLowerCase();

      if (sortingKey === 'released_at') {
        const dateA_val = a[sortingKey];
        const dateB_val = b[sortingKey];
        compA = dateA_val ? new Date(dateA_val).getTime() : null;
        compB = dateB_val ? new Date(dateB_val).getTime() : null;
        if (isNaN(compA)) compA = null;
        if (isNaN(compB)) compB = null;
        if (compA === null && compB === null) comparison = 0;
        else if (compA === null) comparison = 1;
        else if (compB === null) comparison = -1;
        else comparison = compB - compA; // Descending
      } else if (sortingKey === 'rarity') {
        const rarityA = a[sortingKey] ? String(a[sortingKey]).toLowerCase() : 'zzzz';
        const rarityB = b[sortingKey] ? String(b[sortingKey]).toLowerCase() : 'zzzz';
        const aRarityIndex = rarityOrder.indexOf(rarityA) !== -1 ? rarityOrder.indexOf(rarityA) : rarityOrder.length;
        const bRarityIndex = rarityOrder.indexOf(rarityB) !== -1 ? rarityOrder.indexOf(rarityB) : rarityOrder.length;
        comparison = aRarityIndex - bRarityIndex;
      } else if (sortingKey === 'name') {
        compA = valA_name;
        compB = valB_name;
        comparison = compA.localeCompare(compB);
      } else if (sortingKey === 'edhrec_rank') {
        compA = (typeof a.edhrec_rank === 'number' && !isNaN(a.edhrec_rank)) ? a.edhrec_rank : Number.MAX_SAFE_INTEGER;
        compB = (typeof b.edhrec_rank === 'number' && !isNaN(b.edhrec_rank)) ? b.edhrec_rank : Number.MAX_SAFE_INTEGER;
        comparison = compA - compB;
      } else { 
        compA = String(a[sortingKey] || '').toLowerCase();
        compB = String(b[sortingKey] || '').toLowerCase();
        comparison = compA.localeCompare(compB);
      }

      if (comparison === 0) {
        return valA_name.localeCompare(valB_name);
      }
      return comparison;
    });
    cardsToAdd = relevantSelectedCards.slice(startIndex, endIndex);

  } else {
    const sortingKey = $('.sorting:checked').val();
    const rarityOrder = ['common', 'uncommon', 'rare', 'mythic'];

    const sortedData = [...filteredData].sort((a, b) => {
      let comparison = 0;
      let compA, compB;
      const valA_name = String(a.name || '').toLowerCase();
      const valB_name = String(b.name || '').toLowerCase();

      if (sortingKey === 'released_at') {
        const dateA_val = a[sortingKey];
        const dateB_val = b[sortingKey];
        compA = dateA_val ? new Date(dateA_val).getTime() : null;
        compB = dateB_val ? new Date(dateB_val).getTime() : null;
        if (isNaN(compA)) compA = null;
        if (isNaN(compB)) compB = null;
        if (compA === null && compB === null) comparison = 0;
        else if (compA === null) comparison = 1;
        else if (compB === null) comparison = -1;
        else comparison = compB - compA; // Descending
      } else if (sortingKey === 'rarity') {
        const rarityA = a[sortingKey] ? String(a[sortingKey]).toLowerCase() : 'zzzz';
        const rarityB = b[sortingKey] ? String(b[sortingKey]).toLowerCase() : 'zzzz';
        const aRarityIndex = rarityOrder.indexOf(rarityA) !== -1 ? rarityOrder.indexOf(rarityA) : rarityOrder.length;
        const bRarityIndex = rarityOrder.indexOf(rarityB) !== -1 ? rarityOrder.indexOf(rarityB) : rarityOrder.length;
        comparison = aRarityIndex - bRarityIndex;
      } else if (sortingKey === 'name') {
        compA = valA_name; 
        compB = valB_name; 
        comparison = compA.localeCompare(compB);
      } else if (sortingKey === 'edhrec_rank') {
        compA = (typeof a.edhrec_rank === 'number' && !isNaN(a.edhrec_rank)) ? a.edhrec_rank : Number.MAX_SAFE_INTEGER;
        compB = (typeof b.edhrec_rank === 'number' && !isNaN(b.edhrec_rank)) ? b.edhrec_rank : Number.MAX_SAFE_INTEGER;
        comparison = compA - compB;
      } else { 
        compA = String(a[sortingKey] || '').toLowerCase();
        compB = String(b[sortingKey] || '').toLowerCase();
        comparison = compA.localeCompare(compB);
      }

      if (comparison === 0) {
        return valA_name.localeCompare(valB_name);
      }
      return comparison;
    });
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


  filteredData = data?.data.filter(function(card) {
    let matchesSearch = false;

    if (card.card_faces && card.card_faces.length > 0) {
        for (const face of card.card_faces) {
            if ((formatCardName(face.name)).includes(formattedSearchValue) ||
                (formatCardName(face.type_line)).includes(formattedSearchValue) ||
                (formatCardName(face.oracle_text)).includes(formattedSearchValue)) {
                matchesSearch = true;
                break; 
            }
        }
    } else {
        // Single-faced card
        const formattedCardName = formatCardName(card.name);
        const formattedCardType = formatCardName(card.type_line);
        const formattedCardSetName = formatCardName(card.set_name);
        const formattedCardSet = formatCardName(card.set);
        const formattedCardText = formatCardName(card.oracle_text);
        const cardProperties = Array.isArray(card.properties) ? card.properties : [];

        matchesSearch = formattedCardName.includes(formattedSearchValue) ||
                        formattedCardType.includes(formattedSearchValue) ||
                        formattedCardSet.includes(formattedSearchValue) ||
                        formattedCardSetName.includes(formattedSearchValue) ||
                        formattedCardText.includes(formattedSearchValue) ||
                        cardProperties.some(function(property) {
                          return formatCardName(property).includes(formattedSearchValue);
                        });
    }

    const cardColors = card.color_identity?.map(function(color) {
      return color.toLowerCase(); // Convert to lowercase
    }) || [];

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

  const selectedColorsCount = selectedColors.length;
  cardsToLoad = selectedColorsCount > 0 ? cardsPerPage * selectedColorsCount : cardsPerPage;

  startIndex = 0;
  endIndex = cardsToLoad;
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
  if (typeof cardName === 'string') {
    let str = cardName.toLowerCase(); // Initial toLowerCase
    str = str.replace(/[^\w\s]|_/g, ""); // Remove punctuation (keeps alphanumeric and whitespace)
    str = str.replace(/\s+/g, ' ').trim(); // Normalize whitespace (multiple spaces to one, then trim ends)
    // Ensure return '' if the string becomes empty after processing
    return str.length > 0 ? str : ''; 
  }
  return ''; // Return empty string for non-string inputs or if original string was null/undefined
}

// Function to update filters based on URL parameters
const updateFiltersFromUrl = () => {
  const queryParams = new URLSearchParams(window.location.search);
  const searchTerms = queryParams.get('q') || ''; // Get the search terms from the URL query parameter 'q'
  const selectedColors = queryParams.get('colors')?.split(',') ?? [];

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
const currentVersion = '3.2'; // Replace with the current version of the JSON data

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
  $.getJSON('data/lands.json')
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
    endIndex = startIndex + cardsToLoad;

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
$('.color, .property, .sorting').on('change', function() {
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

    $('.color, .property, #isAdded, .sorting').each(function() {
        const checkbox = $(this);
        const value = checkbox.val();
        checkbox.prop('checked', false);
      });
    $('#search').val('');
    filterCards();
    updateBasicCardsCount(); 
});

