$(function() {
    var availableCards = [
        "Plains",
        "Island",
        "Swamp",
        "Mountain",
        "Forest",
        "Wastes",
        // ...
    ];

    // This function formats the card name to ignore punctuation marks, making it easier to match user input
    function formatCardName(cardName) {
        return cardName.replace(/[^\w\s]|_/g, "").toLowerCase();
    }

    // This function matches the input against the available cards
    function matchCards(request, response) {
        var term = formatCardName(request.term);
        var matches = availableCards.filter(function(card) {
            var cardName = formatCardName(card);
            return cardName.indexOf(term) !== -1;
        });
        response(matches.slice(0, 6));
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

    // Listen to the "input" event on the search input field
    $('#search').on('input', debounce(function() {
        var searchValue = $(this).val();
        var filteredCards = $('.card').filter(function() {
            var cardName = $(this).data('card-name');
            var formattedCardName = formatCardName(cardName);
            var formattedSearchValue = formatCardName(searchValue);
            return formattedCardName.includes(formattedSearchValue);
        });
        $('.card').hide();
        $(filteredCards).slice(0, 100).show();
    }, 300));
});