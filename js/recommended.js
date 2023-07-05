const cards = document.querySelectorAll('.card');
const dfcs = document.querySelectorAll('.card:has(.dfc)');

function setTrackerTotals() {
  const trackerTotals = document.querySelectorAll('[class^="tracker tracker-"] .total');
  trackerTotals.forEach(total => {
    const recommendedCount = total.dataset.recommended;
    if (recommendedCount) {
      total.classList.add('recommended');
      total.textContent = recommendedCount;
    } else {
     total.style.display = 'none';
    }
  });
}

window.addEventListener('load', setTrackerTotals);