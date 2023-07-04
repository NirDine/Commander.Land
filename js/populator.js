$.getJSON("../lands/lands.json", function(data) {
  // Accessing the required information
  var totalCards = data.total_cards;
  var cardName = data.data[0].name;
  var imageUrl = data.data[0].image_uris.normal;

  // You can use the retrieved information as per your requirements
  const cardSuggestions = $('#cardSuggestions');
  const cardsPerPage = 40;
  let currentPage = 1;
  let startIndex = 0;
  let endIndex = cardsPerPage;
  const offset = 100; // Offset in pixels from the bottom of the container

  function createCardElement(card) {
    // Create a new <div> element with the class "card"
    const cardElement = $(`
      <!-- Card -->
      <div class="card" data-card-name="${card.name}" data-colors="${card.color_identity}" data-adds="${card.produced_mana}" data-properties="${card.properties}" data-rank="${card.edhrec_rank}" tabindex="0"> </div>
      <!-- End Card -->
    `);
    // Check if the card is double-faced and then set the inner HTML of the card element
    if (card.card_faces) {
      cardElement.html(`
        <div class="cardContent dfc">
          <div class="artContainer">
            <img class="back" loading="eager" src="${card.card_faces[1].image_uris.normal}" alt="${card.card_faces[1].name}">
            <img class="front" loading="eager" src="${card.card_faces[0].image_uris.normal}" alt="${card.card_faces[0].name}">
          </div>
        </div>
        <span class="cardName">${card.name}</span>
        <button type="button" title="Transform" tabindex="-1" class="flip-button"></button>
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

function loadCards(start, end) {
  const sortedData = data.data.sort((a, b) => a.edhrec_rank - b.edhrec_rank);

  for (let i = start; i < end; i++) {
    if (i >= totalCards) {
      break;
    }
    const cardElement = createCardElement(sortedData[i]);
    cardSuggestions.append(cardElement);
  }
}


  // Load initial set of cards
  loadCards(startIndex, endIndex);

  // Pagination click event handler
  $('#paginationNext').on('click', function() {
    if (endIndex < totalCards) {
      startIndex += cardsPerPage;
      endIndex += cardsPerPage;
      currentPage++;
      loadCards(startIndex, endIndex);
    }
  });

  $('#paginationPrev').on('click', function() {
    if (startIndex > 0) {
      startIndex -= cardsPerPage;
      endIndex -= cardsPerPage;
      currentPage--;
      loadCards(startIndex, endIndex);
    }
  });

  // Infinite scrolling - Load next page when reaching the end of the card suggestions
  $(window).on('scroll', function() {
    const cardSuggestionsOffset = cardSuggestions.offset().top + cardSuggestions.height();
    const windowOffset = $(window).scrollTop() + $(window).height();
    if (windowOffset >= cardSuggestionsOffset - offset) {
      startIndex += cardsPerPage;
      endIndex += cardsPerPage;
      if (endIndex <= totalCards) {
        loadCards(startIndex, endIndex);
      }
    }
  });

}).fail(function(error) {
  console.error('Error:', error);
});
