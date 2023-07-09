// Load userList and responseData from localStorage
const storedUserList = localStorage.getItem('userList');
const storedResponseData = localStorage.getItem('responseData');

if (storedUserList && storedResponseData) {
  const userList = JSON.parse(storedUserList);
  const responseData = JSON.parse(storedResponseData);

  // Load landsData from localStorage
  const storedLandsData = localStorage.getItem('landsData');
  const landsData = storedLandsData ? JSON.parse(storedLandsData) : {};

  // Retrieve selectedCards from localStorage
  const storedSelectedCards = localStorage.getItem('selectedCards');
  const selectedCards = storedSelectedCards ? JSON.parse(storedSelectedCards) : [];

  // Iterate over each card in userList
  userList.forEach(userCard => {
    // Find the corresponding card in responseData based on card name
    const matchedCard = responseData.data.find(card => card.name.toLowerCase() === userCard.name.toLowerCase());

    // Check if a match is found and the card's id is present in landsData
    if (matchedCard && landsData[matchedCard.id]) {
      // Add the card's id to selectedCards
      selectedCards.push(matchedCard.id);
    }
  });

  // Store selectedCards in localStorage
  localStorage.setItem('selectedCards', JSON.stringify(selectedCards));

}
