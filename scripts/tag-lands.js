const fs = require('fs');
const path = require('path');

const LANDS_JSON_PATH = path.join(__dirname, '../data/lands.json');
const POPULATOR_JS_PATH = path.join(__dirname, '../js/populator.js');

// Basic land type names used for dual/tri counting.
const BASIC_TYPES = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'];

function countBasicTypes(typeLine) {
  if (!typeLine) return 0;
  return BASIC_TYPES.filter(t => typeLine.includes(t)).length;
}

/**
 * Each rule: { id, label, test(card) => bool }
 * Rules run in order. More specific "enters tapped unless..." variants are
 * tested before the generic "check land" rule so they don't get double-tagged.
 * A card can receive multiple tags (e.g. "dual" + "shock").
 */
const RULES = [
  {
    id: 'true-dual',
    label: 'Original Dual Land',
    test: (c) => {
      if (c.is_basic) return false;
      const text = (c.oracle_text || '').trim();
      return countBasicTypes(c.type_line) === 2 &&
        /^\(\{T\}: Add \{[WUBRG]\}( or \{[WUBRG]\})?\.\)$/.test(text);
    }
  },
  {
    id: 'shock-land',
    label: 'Shock Land',
    test: (c) => /pay 2 life\.\s*if you don'?t,[^.]*enters tapped/i.test(c.oracle_text || '') &&
      !/choose a basic land type/i.test(c.oracle_text || '')
  },
  {
    id: 'choose-type-shock-land',
    label: 'Choose-a-Type Shock Land',
    test: (c) => /choose a basic land type/i.test(c.oracle_text || '') &&
      /pay 2 life\.\s*if you don'?t,[^.]*enters tapped/i.test(c.oracle_text || '')
  },
  {
    id: 'battle-land',
    label: 'Battle Land',
    test: (c) => /enters tapped unless you control two or more basic lands/i.test(c.oracle_text || '')
  },
  {
    id: 'fast-land',
    label: 'Fast Land',
    test: (c) => /enters tapped unless you control two or fewer other lands/i.test(c.oracle_text || '')
  },
  {
    id: 'slow-land',
    label: 'Slow Land',
    test: (c) => /enters tapped unless you control two or more other lands/i.test(c.oracle_text || '')
  },
  {
    id: 'check-land',
    label: 'Check Land',
    test: (c) => /enters tapped unless you control (a|an) [a-z]+ or (a|an) [a-z]+/i.test(c.oracle_text || '')
  },
  {
    id: 'pain-land',
    label: 'Pain Land',
    test: (c) => /this land deals 1 damage to you/i.test(c.oracle_text || '')
  },
  {
    id: 'filter-land',
    label: 'Filter Land',
    test: (c) => /\{[wubrg]\/[wubrg]\},?\s*\{t\}:\s*add/i.test(c.oracle_text || '')
  },
  {
    id: 'fetch-land',
    label: 'Fetch Land',
    test: (c) => /sacrifice this land:\s*search your library for a[^.]*card, put it onto the battlefield/i.test(c.oracle_text || '')
  },
  {
    id: 'horizon-land',
    label: 'Horizon / Canopy Land',
    test: (c) => /sacrifice this land:\s*draw a card/i.test(c.oracle_text || '')
  },
  {
    id: 'bounce-land',
    label: 'Bounce Land',
    test: (c) => /return a land you control to its owner'?s hand/i.test(c.oracle_text || '')
  },
  {
    id: 'surveil-land',
    label: 'Surveil Land',
    test: (c) => /when this land enters, surveil/i.test(c.oracle_text || '')
  },
  {
    id: 'gain-land',
    label: 'Gain Land',
    test: (c) => /when this land enters, you gain 1 life/i.test(c.oracle_text || '')
  },
  {
    id: 'man-land',
    label: 'Creature Land (Man-land)',
    test: (c) => /becomes a[^.]*creature/i.test(c.oracle_text || '')
  },
  {
    id: 'triome',
    label: 'Triome',
    test: (c) => countBasicTypes(c.type_line) === 3
  },
  {
    id: 'gate',
    label: 'Gate',
    test: (c) => /\bGate\b/.test(c.type_line || '')
  },
  {
    id: 'snow',
    label: 'Snow Land',
    test: (c) => /\bSnow\b/.test(c.type_line || '')
  },
  {
    id: 'cycling-land',
    label: 'Cycling Land',
    test: (c) => Array.isArray(c.keywords) && c.keywords.includes('Cycling')
  },
  {
    id: 'command-tower-style',
    label: 'Any-Color Land',
    test: (c) => /add one mana of any color/i.test(c.oracle_text || '')
  },
];

const AUTO_TAG_IDS = new Set(RULES.map(r => r.id));

function main() {
  console.log('Starting land tagging script...');

  const originalJson = JSON.parse(fs.readFileSync(LANDS_JSON_PATH, 'utf8'));
  const cards = originalJson.data;

  const counts = {};
  RULES.forEach(r => (counts[r.id] = 0));

  let changedCards = 0;

  cards.forEach(card => {
    const existingProperties = Array.isArray(card.properties) ? card.properties : [];
    // Strip any previously auto-generated tags, keep manual/unknown ones untouched.
    const manualProperties = existingProperties.filter(p => !AUTO_TAG_IDS.has(p));

    const newAutoTags = [];
    RULES.forEach(rule => {
      if (rule.test(card)) {
        newAutoTags.push(rule.id);
        counts[rule.id]++;
      }
    });

    const newProperties = [...manualProperties, ...newAutoTags];
    const before = JSON.stringify(existingProperties);
    const after = JSON.stringify(newProperties);
    if (before !== after) {
      changedCards++;
      card.properties = newProperties;
    }
  });

  console.log('\nTag counts:');
  RULES.forEach(r => console.log(`  ${r.id.padEnd(22)} ${counts[r.id]}`));
  console.log(`\n${changedCards} card(s) had their properties updated.`);

  if (changedCards === 0) {
    console.log('No changes to write.');
    return;
  }

  // Bump version so cached client copies (keyed on landsDataVersion) refresh,
  // same convention as scripts/update-lands.js.
  const currentVersion = originalJson.version || '0';
  const newVersion = (parseFloat(currentVersion) + 0.01).toFixed(2);
  originalJson.version = newVersion;
  console.log(`New version: ${newVersion}`);

  fs.writeFileSync(LANDS_JSON_PATH, JSON.stringify(originalJson, null, 2));
  console.log('Updated data/lands.json');

  let populatorJs = fs.readFileSync(POPULATOR_JS_PATH, 'utf8');
  populatorJs = populatorJs.replace(/const currentVersion = '.*'; \/\/ \[VERSION\]/, `const currentVersion = '${newVersion}'; // [VERSION]`);
  fs.writeFileSync(POPULATOR_JS_PATH, populatorJs);
  console.log('Updated js/populator.js version.');
}

main();
