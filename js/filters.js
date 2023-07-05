// Event handler for color checkboxes
$('.color').on('change', applyFilters);
$('.colorless').on('change', applyFilters);
// Event handler for property checkboxes
$('.property').on('change', applyFilters);

function applyFilters() {
  // Get the selected color checkboxes
  const selectedColors = $('.color:checked').map(function () {
      console.log($(this).val());
    return $(this).val();
  
  }).get();
    
  // Get the selected colorless checkbox
  const selectedColorless = $('.colorless:checked').map(function () {
    console.log($(this).val());
    return $(this).val();
  
  }).get();
  // Get the selected property checkboxes
  const selectedProperties = $('.property:checked').map(function () {
    console.log($(this).val());
    return $(this).val();
      
  }).get();

  // Filter the cards based on the selected checkboxes
  const filteredCards = data.data.filter(function (card) {
    const colors = card.color_identity || []; // Handle cases where color_identity is undefined
    const properties = card.properties || []; // Handle cases where properties is undefined

    // Check if the card's color_identity contains any of the selected colors
    const colorMatch = selectedColors.some(function (color) {
      return colors.includes(color);
    });

    // Check if the card's properties contain any of the selected properties
    const propertyMatch = selectedProperties.some(function (property) {
      return properties.includes(property);
    });

    // Return true if both color and property matches
    return colorMatch && propertyMatch;
  });

  // Clear the existing cards
  $('#cardSuggestions').empty();

  // Reset pagination variables
  startIndex = 0;
  endIndex = cardsPerPage;
  currentPage = 1;

  // Load the filtered cards
  loadCards(startIndex, endIndex);
}