// Cache jQuery objects for improved performance
const $backdrop = $('.backdrop');
const $textarea = $('#deckList');
const $analyze = $('#analyze');
const $analyzeLabel = $analyze.find('.analyze-label');
const $highlights = $('.highlights');

// ---------------------------------------------------------------------------
// #analyze progress feedback
//
// Drives a lighter "fill" (see #analyze::before / --analyze-progress in
// structure.css) that sweeps across the button while we check the deck
// against Scryfall, plus status text on the button label. The button's own
// box size never changes: the label has a fixed min-width/ellipsis and the
// fill is a pseudo-element, not a resize.
// ---------------------------------------------------------------------------

const defaultAnalyzeLabel = ($analyzeLabel.text() || $analyze.text() || '').trim();
const BATCH_PROGRESS_WEIGHT = 0.85; // portion of the bar spent on the bulk Scryfall lookup
const FALLBACK_PROGRESS_WEIGHT = 1 - BATCH_PROGRESS_WEIGHT; // reserved for fuzzy/flavor-name fallback lookups

function setAnalyzeProgress(fraction) {
  const clamped = Math.max(0, Math.min(1, fraction));
  $analyze.css('--analyze-progress', clamped);
}

function setAnalyzeText(text) {
  if ($analyzeLabel.length) {
    $analyzeLabel.text(text);
  } else {
    $analyze.text(text);
  }
}

function resetAnalyzeButton() {
  setAnalyzeProgress(0);
  setAnalyzeText(defaultAnalyzeLabel);
}

// Detect the user agent to handle different browsers
const ua = window.navigator.userAgent.toLowerCase();
const isIE = !!ua.match(/msie|trident\/7|edge/);
const isWinPhone = ua.indexOf('windows phone') !== -1;
const isIOS = !isWinPhone && !!ua.match(/ipad|iphone|ipod/);

let nameErrors = []; // Initialize nameErrors as an empty
let responseData; // To be populated by Scryfall API
let userList; // Not currently used, but was in original HTML

// ---------------------------------------------------------------------------
// Decklist line parsing
//
// Supports plain "1 Card Name" / "1x Card Name" lines as well as common
// export formats from other deckbuilding sites pasted directly in:
//   Archidekt: "1x Card Name (SET) 123 *F* [Category] ^Label,#000000^"
//   Moxfield:  "1 Card Name" or "1 Card Name #Tag, Other Tag"
//   TappedOut/MTGO: "1 Card Name"
// It also skips category/section header lines (e.g. "Creature (20)",
// "Sideboard") that some exports include, so they don't get parsed as cards.
// ---------------------------------------------------------------------------

const SECTION_HEADER_PATTERN = /^(commander|companion|deck|decklist|mainboard|main\s*deck|main|sideboard|maybeboard|maybe\s*board|considering|tokens?|other|instant|sorcery|creature|artifact|enchantment|planeswalker|battle|land)s?\s*:?\s*(\(\d+\))?\s*$/i;
const CATEGORY_COUNT_LINE_PATTERN = /^[A-Za-z][A-Za-z0-9 '\-]*\(\d+\)$/;

// Strips trailing decorations (set/collector info, foil markers, category
// brackets, color labels, tags) that Archidekt/Moxfield/etc. can append.
// Runs repeatedly since a line can carry several of these in any order.
function stripTrailingDecorations(str) {
  let previous;
  do {
    previous = str;
    str = str.replace(/\s*\(([A-Za-z0-9]{2,6})\)\s*[A-Za-z0-9★\-]*$/, ''); // (SET) 123
    str = str.replace(/\s*\*[fF]\*$/, ''); // *F*
    str = str.replace(/\s*\((foil|etched|showcase|extended|borderless)\)$/i, '');
    str = str.replace(/\s*\[[^\[\]]*\]$/, ''); // [Category]
    str = str.replace(/\s*\^[^^]*\^$/, ''); // ^Label,#000000^
    str = str.replace(/\s*\{[^{}]*\}$/, ''); // {Tag}
    str = str.replace(/\s+#.*$/, ''); // #Tag, Other Tag
  } while (str !== previous && str.length > 0);
  return str.trim();
}

// Parses a single decklist line into { quantity, name }, or null if the line
// isn't a card entry (blank, section header, category count line, etc.)
function parseDecklistLine(rawLine) {
  let line = (rawLine || '').replace(/^SB:\s*/i, '').trim();
  if (!line) return null;
  if (line.startsWith('//')) return null; // comment / section divider, not a DFC card
  if (SECTION_HEADER_PATTERN.test(line)) return null;
  if (CATEGORY_COUNT_LINE_PATTERN.test(line)) return null;

  const match = line.match(/^(\d+)?\s*x?\s*(.*)$/i);
  if (!match) return null;

  const quantity = match[1] ? parseInt(match[1], 10) : 1;
  const name = stripTrailingDecorations((match[2] || '').trim());
  if (!name) return null;

  return { quantity, name };
}

// Helper function to get a Scryfall API comparable name.
// Normalizes any single- or double-slash DFC separator, with any amount of
// surrounding whitespace, to Scryfall's canonical " // ". Moxfield's plain
// text export uses a single "/" ("Clearwater Pathway / Murkwater Pathway"),
// while Scryfall, Archidekt, and most others use "//". No real card name
// contains a bare "/" outside of this separator, so this is safe to treat
// as DFC syntax whenever it shows up.
function getScryfallComparableName(nameKey) { // nameKey is assumed lowercased
  return nameKey.includes('/') ? nameKey.replace(/\s*\/{1,2}\s*/g, ' // ').trim() : nameKey;
}

// Normalizes text for loose comparisons (punctuation/case-insensitive),
// mirroring populator.js's formatCardName so "Kefkas Tower" == "Kefka's Tower".
function normalizeForComparison(str) {
  return String(str || '').toLowerCase().replace(/[^\w\s]|_/g, '').replace(/\s+/g, ' ').trim();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Scryfall API endpoint
const scryfallEndpoint = 'https://api.scryfall.com/cards/collection';

// Flag to track whether a request is in progress
let requestInProgress = false;

// Disable analyze button to prevent further requests initially
$analyze.prop('disabled', true);

// ---------------------------------------------------------------------------
// Fallback resolution for names the bulk /cards/collection lookup missed.
//
// The collection endpoint only matches a card's exact primary name. Two
// common cases slip through it:
//   1. Double-faced cards entered as just their front face
//      (e.g. "Barkchannel Pathway" instead of "Barkchannel Pathway //
//      Tidechannel Pathway").
//   2. Cards with an alternate/flavor name from crossover sets
//      (e.g. "Kefka's Tower", the Final Fantasy flavor name for
//      "Bolas's Citadel").
// For each still-missing name we try Scryfall's fuzzy single-card lookup
// (which resolves front-face and near-miss names), then fall back to a
// full-text search that also covers flavor names.
// ---------------------------------------------------------------------------

function cardNameMatchesQuery(card, queryName) {
  const target = normalizeForComparison(queryName);
  const candidates = [card.name, card.flavor_name];
  if (Array.isArray(card.card_faces)) {
    card.card_faces.forEach(face => {
      candidates.push(face.name, face.flavor_name);
    });
  }
  return candidates.some(c => c && normalizeForComparison(c) === target);
}

function fetchJson(url) {
  return fetch(url, { headers: { Accept: 'application/json' } })
    .then(res => (res.ok ? res.json() : null))
    .catch(() => null);
}

function resolveNameFallback(originalName) {
  const fuzzyUrl = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(originalName)}`;
  return fetchJson(fuzzyUrl).then(card => {
    if (card && card.object === 'card') return card;

    const searchUrl = `https://api.scryfall.com/cards/search?q=${encodeURIComponent('"' + originalName + '"')}&unique=cards`;
    return fetchJson(searchUrl).then(result => {
      if (!result || !Array.isArray(result.data)) return null;
      return result.data.find(c => cardNameMatchesQuery(c, originalName)) || null;
    });
  });
}

// Sequentially attempts fallback resolution for a list of not-found names,
// respecting Scryfall's rate-limit guidance (~100ms between requests).
// Returns a Promise resolving to a Map of originalName -> card.
// onProgress(completedCount, totalCount) is called after each name resolves.
function resolveFallbacks(namesToResolve, onProgress) {
  const resolved = new Map();
  let chain = Promise.resolve();
  let completed = 0;
  const total = namesToResolve.length;

  namesToResolve.forEach(name => {
    chain = chain
      .then(() => new Promise(resolve => setTimeout(resolve, 100)))
      .then(() => resolveNameFallback(name))
      .then(card => {
        if (card) resolved.set(name, card);
        completed++;
        if (onProgress) onProgress(completed, total);
      });
  });

  return chain.then(() => resolved);
}

// Update textarea and highlights when analyze button is clicked
$analyze.on('click', function() {
  if (requestInProgress) {
    return;
  }
  requestInProgress = true;
  $analyze.prop('disabled', true);
  setAnalyzeProgress(0);
  setAnalyzeText('Checking your deck…');

  const cardList = $textarea.val().trim();
  const lines = cardList.split('\n');

  const cardNames = {}; // Object to store card names and quantities
  lines.forEach(line => {
    const parsed = parseDecklistLine(line);
    if (!parsed) return;
    const normalizedCardName = parsed.name.toLowerCase();
    if (cardNames[normalizedCardName]) {
      cardNames[normalizedCardName].quantity += parsed.quantity;
    } else {
      cardNames[normalizedCardName] = { name: parsed.name, quantity: parsed.quantity };
    }
  });

  // Prepare the payload with unique card names (keys of cardNames are already normalized)
  const identifiers = Object.keys(cardNames).map(key => ({ name: getScryfallComparableName(key) }));
  const payload = { identifiers };
  const totalBatches = Math.max(1, Math.ceil(payload.identifiers.length / 70));

  console.log('Sending request to Scryfall API...');

  let currentOffset = 0;
  let requestsMade = 0;
  responseData = []; // Reset responseData for new analysis
  let accumulatedNotFound = []; // Reset accumulatedNotFound

  // Shared finalize step used by both the success and error completion paths.
  // Attempts fallback resolution on whatever is still unresolved, then
  // updates the textarea, highlights, and redirects (or re-enables the
  // button) accordingly.
  function finalizeAnalysis() {
    nameErrors = [...new Set(accumulatedNotFound)]; // Finalize nameErrors

    const stillUnresolved = Object.entries(cardNames)
      .filter(([normalizedKey]) => nameErrors.includes(getScryfallComparableName(normalizedKey)))
      .map(([, details]) => details.name);

    if (stillUnresolved.length > 0) {
      setAnalyzeText(`Double-checking ${stillUnresolved.length} card name${stillUnresolved.length > 1 ? 's' : ''}…`);
    }

    resolveFallbacks(stillUnresolved, (done, total) => {
      setAnalyzeProgress(BATCH_PROGRESS_WEIGHT + (done / total) * FALLBACK_PROGRESS_WEIGHT);
    }).then(resolvedMap => {
      resolvedMap.forEach((card, originalName) => {
        responseData.push(card);
        const normalizedKey = originalName.toLowerCase();
        const scryfallComparableKey = getScryfallComparableName(normalizedKey);
        nameErrors = nameErrors.filter(err => err !== scryfallComparableKey);
      });

      const errorCards = [];
      const validCards = [];
      Object.entries(cardNames).forEach(([normalizedKey, originalCardDetails]) => {
        const scryfallComparableKey = getScryfallComparableName(normalizedKey);
        if (nameErrors.includes(scryfallComparableKey)) {
          errorCards.push({ ...originalCardDetails, card: null });
        } else {
          const matchingCardData = responseData.find(rd => getScryfallComparableName(rd.name.toLowerCase()) === scryfallComparableKey);
          validCards.push({
            name: matchingCardData ? matchingCardData.name : originalCardDetails.name,
            quantity: originalCardDetails.quantity,
            card: matchingCardData
          });
        }
      });
      const orderedCardNames = [...errorCards, ...validCards];

      const orderedHighlights = applyHighlights(
        orderedCardNames.map(card => ({ name: card.name, quantity: card.quantity })),
        nameErrors
      );

      // This update will trigger 'handleInput'
      $textarea.val(orderedCardNames.map(
        card => (card.quantity > 1 ? `${card.quantity} ${card.name}` : `1 ${card.name}`)
      ).join('\n'));

      $highlights.html(orderedHighlights);

      const hasErrors = nameErrors.length > 0;

      if (!hasErrors) {
        console.log('All card names found!');
        setAnalyzeProgress(1);
        setAnalyzeText('Building your mana base…');
        const updatedUserList = orderedCardNames.map(card => ({
          quantity: card.quantity,
          name: card.card ? card.card.name : card.name // Use Scryfall's name if available
        }));
        localStorage.setItem('userList', JSON.stringify(updatedUserList));
        localStorage.setItem('responseData', JSON.stringify(responseData));
        localStorage.removeItem('selectedCards');
        const colorIdentity = determineColorIdentity(responseData);
        window.location.href = `buffet.html?colors=${colorIdentity.toLowerCase()}`;
      } else {
        console.log('Card names not found or other errors occurred.');
        resetAnalyzeButton();
        $analyze.prop('disabled', false);
      }

      requestInProgress = false;
    });
  }

  function makeRequest() {
    const requestPayload = {
      identifiers: payload.identifiers.slice(currentOffset, currentOffset + 70)
    };

    $.ajax({
      url: scryfallEndpoint,
      type: 'POST',
      dataType: 'json',
      contentType: 'application/json',
      data: JSON.stringify(requestPayload),
      success: function(response) {
        console.log('Request successful!', response);
        responseData = responseData.concat(response.data);

        const currentBatchNotFoundNames = response.not_found.map(card => card.name.toLowerCase());
        accumulatedNotFound = accumulatedNotFound.concat(currentBatchNotFoundNames);

        console.log('Batch Errors:', currentBatchNotFoundNames);
        console.log('Matches:', response.data.map(cardData => cardData.name));

        requestsMade++;
        setAnalyzeProgress((requestsMade / totalBatches) * BATCH_PROGRESS_WEIGHT);
        if (requestsMade < totalBatches) {
          currentOffset += 70;
          setTimeout(makeRequest, 100); // Scryfall API rate limit recommendation
        } else {
          console.log('All requests completed!');
          finalizeAnalysis();
        }
      },
      error: function(xhr, status, error) {
        console.error('Error retrieving card data:', error);
        const failedBatchIdentifiers = requestPayload.identifiers.map(id => id.name.toLowerCase());
        accumulatedNotFound = accumulatedNotFound.concat(failedBatchIdentifiers);

        requestsMade++;
        setAnalyzeProgress((requestsMade / totalBatches) * BATCH_PROGRESS_WEIGHT);
        if (requestsMade < totalBatches) {
          currentOffset += 70;
          setTimeout(makeRequest, 100);
        } else {
          console.log('All requests completed, with some batch errors!');
          finalizeAnalysis();
        }
      }
    });
  }

  makeRequest(); // Initial call
});

// Function to determine the colorIdentity from the response data
function determineColorIdentity(responseData) {
  const colors = new Set();
  responseData.forEach(cardData => {
    if (cardData.color_identity) {
      cardData.color_identity.forEach(color => {
        colors.add(color);
      });
    }
  });
  colors.add('c'); // Add "c" to the set of colors
  const colorIdentity = Array.from(colors).join(',');
  return colorIdentity;
}

// Function to apply highlights
function applyHighlights(cardInfoArray, nameErrors) {
  let highlightedText = '';
  if (!Array.isArray(cardInfoArray) || !Array.isArray(nameErrors)) {
    console.error("Invalid input: cardInfoArray or nameErrors is not an array");
    return highlightedText;
  }
  cardInfoArray.forEach(cardInfo => {
    if (cardInfo && cardInfo.name && typeof cardInfo.quantity !== 'undefined') {
      const originalName = cardInfo.name; // Original casing for display
      const quantity = cardInfo.quantity;
      const scryfallComparableKey = getScryfallComparableName(originalName.toLowerCase());
      const safeName = escapeHtml(originalName);

      if (nameErrors.includes(scryfallComparableKey)) {
        // Use originalName for display and data-card-name to maintain original input casing
        highlightedText += `<mark class="error" data-card-name="${safeName}">${quantity} ${safeName}</mark>\n`;
      } else {
        highlightedText += `${quantity} ${safeName}\n`;
      }
    } else {
      console.error("Invalid cardInfo object:", cardInfo);
    }
  });
  return highlightedText.replace(/\n$/g, '\n\n');
}

// Function to handle input changes in the textarea
function handleInput() {
  if (!requestInProgress) {
    resetAnalyzeButton();
  }

  const text = $textarea.val().trim();
  const lines = text.split('\n');
  const currentCardNamesFromText = new Set();

  lines.forEach(line => {
    const parsed = parseDecklistLine(line);
    if (parsed) {
      currentCardNamesFromText.add(parsed.name.toLowerCase());
    }
  });

  nameErrors = nameErrors.filter(errorKey => currentCardNamesFromText.has(errorKey));

  const cardInfoArrayForHighlights = lines
    .map(line => parseDecklistLine(line))
    .filter(Boolean);

  const highlightedText = applyHighlights(cardInfoArrayForHighlights, nameErrors);
  $highlights.html(highlightedText);

  const highlightsExist = $highlights.find('mark').length > 0 || highlightedText.includes('<mark>');
  if (highlightsExist) {
    $highlights.addClass('error');
    $analyze.prop('disabled', true);
  } else {
    $highlights.removeClass('error');
    $analyze.prop('disabled', text === '');
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
    input: handleInput,
    scroll: handleScroll
  });
}

if (isIOS) {
  fixIOS();
}
bindEvents();

// Initial call to handleInput to set initial button state if textarea is empty/filled
handleInput();
