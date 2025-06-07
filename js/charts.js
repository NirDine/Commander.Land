let myPolarAreaChart; // Store the chart instance globally

function createChart() {
  // Read checkbox state from localStorage
  const includeAllRamp = localStorage.getItem('includeNonLandsPreference') === 'true'; // Renamed variable

  // Retrieve and parse mana color counts from localStorage
  const storedManaColorCounts = localStorage.getItem('manaColorCounts');
  const manaColorCounts = storedManaColorCounts ? JSON.parse(storedManaColorCounts) : {};

  // Retrieve and parse colorRecommendations from localStorage
  const storedColorRecommendations = localStorage.getItem('colorRecommendations');
  const colorRecommendations = storedColorRecommendations ? JSON.parse(storedColorRecommendations) : [];

  // Create a set of recommended colors for quick lookup
  const recommendedColorsSet = new Set(
    (Array.isArray(colorRecommendations) ? colorRecommendations : [])
      .filter(rec => rec && rec.result > 0) // Ensure rec and rec.result are valid and result > 0
      .map(rec => rec.color)
  );

  // Prepare data for the charts
  const labels = Object.keys(manaColorCounts).filter(color => recommendedColorsSet.has(color));
  const dataValues = labels.map(color => {
    return manaColorCounts[color] || 0; // Directly use the count from deck
  });

  // Prepare filtered data for the first Polar Area chart (foreground chart)
  const data1 = {
    label: 'Mana sources in deck',
    data: dataValues, // dataValues is now simplified
    backgroundColor: labels.map(color => {
      switch(color) {
        case 'W': return '#e7deb5'; // White
        case 'U': return '#b7cae8'; // Blue
        case 'B': return '#b4abb0'; // Black
        case 'R': return '#d8917d'; // Red
        case 'G': return '#bacbc1'; // Green
        case 'C': return '#cac5c0'; // Colorless
        default: return '#000000'; // Fallback color
      }
    }),
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 2
  };

  // Prepare filtered data for the second Polar Area chart (background chart)
  const data2 = {
    label: 'Mana sources required',
    data: labels.map(color => {
      const recommendation = colorRecommendations.find(rec => rec.color === color);
      // return recommendation ? recommendation.result : 0; // Original line (result was originalResult)
      let requiredPips = 0;
      if (recommendation) {
        if (includeAllRamp) { // Checkbox checked
          requiredPips = recommendation.finalResult || 0;
        } else { // Checkbox unchecked
          requiredPips = recommendation.originalResult || 0;
        }
        requiredPips = Math.max(0, requiredPips); // Ensure not negative
      }
      return requiredPips;
    }),
    // The backgroundColor logic remains the same
    backgroundColor: labels.map(color => {
      switch(color) {
        case 'W': return 'rgba(231, 222, 181, 0.5)'; // Semi-transparent White
        case 'U': return 'rgba(183, 202, 232, 0.5)'; // Semi-transparent Blue
        case 'B': return 'rgba(180, 171, 176, 0.5)'; // Semi-transparent Black
        case 'R': return 'rgba(216, 145, 125, 0.5)'; // Semi-transparent Red
        case 'G': return 'rgba(186, 203, 193, 0.5)'; // Semi-transparent Green
        case 'C': return 'rgba(202, 197, 192, 0.5)'; // Semi-transparent Colorless
        default: return 'rgba(0, 0, 0, 0.5)'; // Fallback color
      }
    }),
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderWidth: 2,
    borderDash: [10, 5] // Dashed border
  };

  // Chart configuration
  const config = {
    type: 'polarArea',
    data: {
      labels: labels, // Ensure labels are consistent with filtered data
      datasets: [data2, data1] // The background dataset is first
    },
    options: {
      responsive: true,
      animation: {
        duration: 0 // Disable animation
      },
      scales: {
        r: {
          angleLines: { display: false }, // Hide angle lines
          grid: {
            display: false // Hide the grid lines
          },
          ticks: {
            display: false // Hide the numbers (tick labels) on the grid
          },
          suggestedMin: 0 // Set minimum value for the radial scale
        }
      }
    }
  };

  // Get the canvas context
  const canvas = document.getElementById('myChart');
  if (!canvas) {
    return; // Exit the function if the canvas is not found
  }

  const ctx = canvas.getContext('2d');
  if (myPolarAreaChart) {
    myPolarAreaChart.destroy(); // Destroy the old chart instance if it exists
  }
  myPolarAreaChart = new Chart(ctx, config); // Create a new chart instance
}

function updateChart() {
  const storedResponseData = localStorage.getItem('responseData');
    
    if (storedResponseData) {
        createChart(); // Recreate the chart with the latest data
        }
}
