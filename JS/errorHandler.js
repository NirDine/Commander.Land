// Cache jQuery objects for improved performance
const $backdrop = $('.backdrop');
const $highlights = $('.highlights');
const $textarea = $('#deckList');
const $analyze = $('#analyze');

// Define errors in an object for easier interaction
const nameErrors = {
    string1: 'Error 1',
    string2: 'Error 2',
    string3: 'Error 3'
};

// Define correct names in an object for easier interaction
const namesCorrect = {
    string1: 'Correct 1',
    string2: 'Correct 2',
    string3: 'Correct 3'
}

// Detect the user agent to handle different browsers
const ua = window.navigator.userAgent.toLowerCase();
const isIE = !!ua.match(/msie|trident\/7|edge/);
const isWinPhone = ua.indexOf('windows phone') !== -1;
const isIOS = !isWinPhone && !!ua.match(/ipad|iphone|ipod/);

// Highlight the specified cards that weren't found in the text
function applyHighlights(text, cardsNotFound) {
    // Use a regular expression to match the cardsNotFound regardless of case
    const regex = new RegExp(`(${cardsNotFound.join('|')})`, 'ig');

    // Add the mark tag around each match
    text = text.replace(regex, '<mark>$&</mark>');

    // Add a line break to the end of the text
    text = text.replace(/\n$/g, '\n\n');

    // Add word breaks for Internet Explorer
    if (isIE) {
        text = text.replace(/ /g, ' <wbr>');
    }

    return text;
}

function handleInput() {
    const text = $textarea.val();
    const cardsNotFound = Object.values(nameErrors); // cardsNotFound to highlight

    const highlightedText = applyHighlights(text, cardsNotFound);
    $highlights.html(highlightedText);

    // Check if there are any highlights
    const highlightsExist = $highlights.find('mark').length > 0;

    // Apply or remove error class based on highlightsExist
    if (highlightsExist) {
        if (!$backdrop.hasClass('error')) {
            $backdrop.addClass('error');
        }
        $analyze.prop('disabled', true);
    } else {
        $backdrop.removeClass('error');
        $analyze.prop('disabled', $($textarea).val() === '');
    }
}


// Synchronize the scroll position between the textarea and backdrop
function handleScroll() {
    const scrollTop = $textarea.scrollTop();
    $backdrop.scrollTop(scrollTop);

    const scrollLeft = $textarea.scrollLeft();
    $backdrop.scrollLeft(scrollLeft);
}

// Fix padding issues on iOS devices
function fixIOS() {
    $highlights.css({
        'padding-left': '+=3px',
        'padding-right': '+=3px'
    });
}

// Bind input and scroll event handlers to the textarea
function bindEvents() {
    $textarea.on({
        'input': handleInput,
        'scroll': handleScroll
    });
}

// Fix iOS padding issues if applicable
if (isIOS) {
    fixIOS();
}

// Bind event handlers to the textarea
bindEvents();

// Highlight text on initial load
handleInput();

// Update textarea and highlights when analyze button is clicked
$analyze.on('click', function() {
    const text = $textarea.val().trim();

    if ($.isEmptyObject(nameErrors) || text === '') {
        return;
    }

    const errorText = Object.values(nameErrors).join('\n');
    const correctText = Object.values(namesCorrect).join('\n');

    $textarea.val(errorText + '\n' + correctText);
    handleInput();
});

// Enable or disable analyze button based on whether textarea is filled
$textarea.on('input', function() {
    $analyze.prop('disabled', $(this).val() === '' || $highlights.find('mark').length > 0);
});