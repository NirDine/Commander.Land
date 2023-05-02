// Check if IntersectionObserver API is supported
if ('IntersectionObserver' in window) {
    // Declare intersection observer options
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.5 // Trigger callback when 50% of the element is visible
    };

    // Declare intersection observer callback function
    const observerCallback = entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                $(entry.target).addClass('show');
            } else {
                $(entry.target).removeClass('show');
            }
        });
    };

    // Create intersection observer instance
    const observer = new IntersectionObserver(observerCallback, observerOptions);

    // Select hidden elements
    const hiddenElements = $('.hidden');

    // Observe hidden elements
    hiddenElements.each((index, element) => {
        observer.observe(element);
    });
}