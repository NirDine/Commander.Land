(function() {
  // Load userList and landsData from localStorage
  const storedUserList = localStorage.getItem('userList');
  const storedLandsData = localStorage.getItem('landsData');

  if (storedUserList) {
    const userList = JSON.parse(storedUserList);
    const landsData = JSON.parse(storedLandsData);

    // Check if userList is empty
    if (userList.length === 0) {
      // No need to update selectedCards if userList is empty
      // Clear the userList once cards are added
      localStorage.removeItem('userList');
      return;
    }

    // Retrieve selectedCards from localStorage
    const storedSelectedCards = localStorage.getItem('selectedCards');
    let selectedCards = storedSelectedCards ? JSON.parse(storedSelectedCards) : [];

    // Track the processed non-basic lands
    const processedNonBasicLands = [];

    // Iterate over each entry in userList
    userList.forEach(userCard => {
      const cardId = userCard.cardId;
      const quantity = userCard.quantity;

      // Find the corresponding card in landsData based on card ID
      const matchedCard = landsData.data.find(card => card.id === cardId);

      // Check if a match is found and the card is a basic land
      if (matchedCard && matchedCard.is_basic) {
        // Add the card ID to selectedCards multiple times based on quantity
        for (let i = 0; i < quantity; i++) {
          selectedCards.push(cardId);
        }
      } else if (matchedCard && !matchedCard.is_basic && !processedNonBasicLands.includes(cardId)) {
        // Add non-basic land card only once
        selectedCards.push(cardId);
        processedNonBasicLands.push(cardId);
      }
        
      for (let i = 0; i < quantity; i++) {
            
        // Check if the card is already selected in the UI
            const cardElement = cardSuggestions.find(`[data-card-id="${cardId}"]`);
            if (cardElement && !cardElement.hasClass('selected')) {
            cardElement.addClass('selected');
          }
        } 
    });

    // Clear the userList once cards are added
    localStorage.removeItem('userList');

    // Store updated selectedCards in localStorage
    localStorage.setItem('selectedCards', JSON.stringify(selectedCards));

  }
})();
