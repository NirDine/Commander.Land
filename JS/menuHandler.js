const $menuToggle = $('.toggle');
const $menuChild = $('.menu ul li a');
const $menuLastChild = $('.lastMenuOption');
const $menuEscape = $('.lightsOff');
const $showcase = $('body');
let isOpen = false;

$(document).ready(() => {
    // Define function to toggle/escape menu
    function toggleMenu(shouldEscape) {
        if (shouldEscape) {
            $menuEscape.removeClass('active');
            isOpen = false;
        } else {
            $menuEscape.toggleClass('active');
            isOpen = true;
        }
        $menuToggle.toggleClass('active');
        $showcase.toggleClass('active');
    }

    // Add click event listener to menu toggle button
    $menuToggle.on('click', () => {
        toggleMenu(false);
    });

    // Make sure that the menu closes when you click otuside
    $menuEscape.on('click', () => {
        toggleMenu(true);
    });

    // Make it so keyboard navigation is possible
    $menuChild.on('focus', () => {
        if (!isOpen) {
            toggleMenu(false);
        }
    });

    // Add focusout event listener to last menu child
    $menuLastChild.on('focusout', () => {
        toggleMenu(true);
    });

    // Click event handler that closes other .dropdown-subs when one is selected
    $(document).on('click', '.dropdown-sub', function() {
        $('.dropdown-sub').not(this).prop('checked', false);
    });
});