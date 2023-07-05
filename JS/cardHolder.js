let selectedCards = []; // Declare selectedCards as an empty array

// Retrieve selectedCards from localStorage
const storedSelectedCards = localStorage.getItem('selectedCards');
selectedCards = storedSelectedCards ? JSON.parse(storedSelectedCards) : [];



function handleCardInteraction(card) {
  const cardId = card.data('card-id');
  const isSelected = card.hasClass('selected');

  if (!isSelected) {
    card.addClass('selected');
    selectedCards.push(cardId);
  } else {
    card.removeClass('selected');
    const index = selectedCards.indexOf(cardId);
    if (index !== -1) {
      selectedCards.splice(index, 1);
    }
  }
  // Update ms-0 class of .added-cards i
    $(".added-cards i").removeClass(function(index, className) {
      return (className.match(/(^|\s)ms-\S+/g) || []).join(' ');
    }).addClass(`ms-${selectedCards.length}`);
 // Check and hide/show the #isAdded checkbox
    if (selectedCards.length > 0) {
        $("#isAdded").show();
      
    } else {
      $("#isAdded").prop("checked", false).hide();
    }
  // Save selectedCards to localStorage 
  localStorage.setItem('selectedCards', JSON.stringify(selectedCards));
  console.log(selectedCards);
}

    // Event handler for card click
    function handleCardClick(event) {
      const card = $(event.currentTarget);
      const flipButton = card.find('.flip-button');

      // Check if the clicked element is the flip button or its descendant
      if (!flipButton || !flipButton.is(event.target) && !flipButton.has(event.target).length) {
        handleCardInteraction(card);
      }
    }


  // Event handler for key press (Space or Enter)
  function handleKeyPress(event) {
    if (event.keyCode === 32 || event.keyCode === 13) {
      const card = $(event.currentTarget);
      handleCardInteraction(card);
    }
  }

  // Attach event listeners to the cards
  $(document).on('click', '.card', handleCardClick);
  $(document).on('keypress', '.card', handleKeyPress);