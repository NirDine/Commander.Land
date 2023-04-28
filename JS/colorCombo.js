$(document).ready(function() {
  const manaCombinations = {
    w: "White",
    u: "Blue",
    b: "Black",
    r: "Red",
    g: "Green",
    c: "Colorless",
    wu: "Azorius",
    ub: "Dimir",
    br: "Rakdos",
    rg: "Gruul",
    wg: "Selesnya",
    wb: "Orzhov",
    ur: "Izzet",
    bg: "Golgari",
    wr: "Boros",
    ug: "Simic",
    wub: "Esper",
    ubr: "Grixis",
    brg: "Jund",
    wrg: "Naya",
    wug: "Bant",
    wbg: "Abzan",
    wur: "Jeskai",
    ubg: "Sultai",
    wbr: "Mardu",
    urg: "Temur",
    wubr: "Yore-Tiller",
    ubrg: "Glint-Eye",
    wbrg: "Dune-Brood",
    wurg: "Ink-Treader",
    wubg: "Witch-Maw",
    wubrg: "All colors"
  };

  // Cache commonly used DOM elements
    const $colorless = $('.colorless');
    const $colors = $('.color');
    const $combinationName = $('#combination-name');
    const $textarea = $('#deckList')
    const $explore = $('#explore');
    const $analyze = $('#analyze');
    

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
    let manaList = '';
    let $checked = $colors.filter(':checked');

    // If colorless checkbox is checked, set manaList to 'c'
    if ($colorless.prop('checked')) {
      manaList = 'c';
    } else if ($checked.length) {
      // Build manaList from checked colored checkboxes
      $checked.each(function() {
        manaList += this.value;
      });
    }

    // Enable or disable explore button based on whether manaList is empty
    $explore.prop('disabled', manaList === '');
      
    // Set combination name based on manaList
    $combinationName.html(manaCombinations[manaList]);

    console.log(manaList);
  });
    
});
