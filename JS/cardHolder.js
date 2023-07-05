
const cards = document.querySelectorAll('.card');
const dfcs = document.querySelectorAll('.card:has(.dfc)');


$(document).on('click', '.flip-button', function() {
  const card = $(this).closest('.card');
  card.toggleClass('flipped');
});


cards.forEach(card => {
  const flipButton = card.querySelector('.flip-button');
  
  const handleClick = event => {
    // Check if the clicked element is the flip button or its descendant
    if (!flipButton || !flipButton.contains(event.target)) {
      addCard(card);
    }
  };
  
  card.addEventListener('click', handleClick);
  card.addEventListener('keydown', event => (event.code === 'Enter' || event.code === 'Space') && handleClick(event));
});


dfcs.forEach(dfc => {
  const dfcButton = dfc.querySelector('.flip-button');
  dfcButton.addEventListener('click', () => flipCard(dfc));
});




