$(document).ready(function() {
  const manaCombinations = {
    "w": "White",
    "u": "Blue",
    "b": "Black",
    "r": "Red",
    "g": "Green",
    "c": "Colorless",
    "w,u": "Azorius",
    "u,b": "Dimir",
    "b,r": "Rakdos",
    "r,g": "Gruul",
    "w,g": "Selesnya",
    "w,b": "Orzhov",
    "u,r": "Izzet",
    "b,g": "Golgari",
    "w,r": "Boros",
    "u,g": "Simic",
    "w,u,b": "Esper",
    "u,b,r": "Grixis",
    "b,r,g": "Jund",
    "w,r,g": "Naya",
    "w,u,g": "Bant",
    "w,b,g": "Abzan",
    "w,u,r": "Jeskai",
    "u,b,g": "Sultai",
    "w,b,r": "Mardu",
    "u,r,g": "Temur",
    "w,u,b,r": "Yore-Tiller",
    "u,b,r,g": "Glint-Eye",
    "w,b,r,g": "Dune-Brood",
    "w,u,r,g": "Ink-Treader",
    "w,u,b,g": "Witch-Maw",
    "w,u,b,r,g": "All colors"
  };

  // Cache commonly used DOM elements
  const $colorless = $('.colorless');
  const $colors = $('.color');
  const $combinationName = $('#combination-name');
  const $explore = $('#explore');
  let manaList = '';

  // Click event handler for colorless checkbox
  $colorless.on('click', function() {
    $colors.prop('checked', false);
  });

  // Click event handler for color checkboxes
  $colors.on('click', function() {
    $colorless.prop('checked', false);
  });

  // Click event handler for mana checkboxes
  $('.mana input[type=checkbox]').on('click', function() {
    let $checked = $colors.filter(':checked');

    // If colorless checkbox is checked, set manaList to 'c'
    if ($colorless.prop('checked')) {
      manaList = 'c';
    } else if ($checked.length) {
      // Build manaList from checked colored checkboxes
      manaList = '';
      $checked.each(function(index) {
        if (index > 0) {
          manaList += ',';
        }
        manaList += this.value;
      });
    }

    // Enable or disable explore button based on whether manaList is empty
    $explore.prop('disabled', manaList === '');
      
    // Set combination name based on manaList
    $combinationName.html(manaCombinations[manaList]);
      console.log(manaList);
  });

  // Click event handler for explore button
  $explore.on('click', function() {
    window.location.href = 'buffet.html?colors=' + manaList;
  });
});