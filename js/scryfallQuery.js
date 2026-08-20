/**
 * scryfallQuery.js
 *
 * A Scryfall-grammar-ish query engine for the land database.
 * parseQuery(str) returns a predicate function: (card) => boolean
 *
 * Supported syntax:
 *   plain words / "quoted phrases"   -> match name, type, oracle text, set, properties
 *   field:value   field=value   field!=value   field>value   field>=value
 *   field<value   field<=value
 *   -term / -field:value             -> negation
 *   AND (default between terms), OR, parentheses for grouping
 *
 * Fields:
 *   o:, oracle:      oracle text contains
 *   t:, type:        type line contains
 *   name:            name contains
 *   c:, color:       card colors (subset by default, empty for nearly all lands)
 *   id:, identity:   color identity (subset by default) - accepts wubrg letters,
 *                    guild/shard/wedge names (azorius, bant, jeskai...), 'c'/'colorless', 'm'/'multi'
 *   produces:        produced_mana (superset by default - "makes at least these colors")
 *   is:              boolean tags: basic, nonbasic, dfc/transform/mdfc, snow,
 *                    plus any auto-generated land-cycle tag id (shock-land,
 *                    choose-type-shock-land, fetch-land, check-land, fast-land,
 *                    slow-land, battle-land, pain-land, filter-land, horizon-land,
 *                    bounce-land, surveil-land, gain-land, man-land, triome,
 *                    true-dual, gate, cycling-land, command-tower-style, mdfc)
 *   kw:, keyword:    keywords array contains
 *   r:, rarity:      common/uncommon/rare/mythic (ordinal compare supported)
 *   cmc:             mana value, numeric compare
 *   usd:             price in USD, numeric compare
 *   edhrec:          edhrec_rank, numeric compare (lower = more popular)
 *   e:, s:, set:     set code or set name contains
 *   date:, year:     released_at, string/date compare
 */

(function (root) {
  'use strict';

  const COLOR_LETTERS = ['w', 'u', 'b', 'r', 'g'];

  const COLOR_GROUPS = {
    w: ['w'], u: ['u'], b: ['b'], r: ['r'], g: ['g'],
    c: [], colorless: [],
    azorius: ['w', 'u'], dimir: ['u', 'b'], rakdos: ['b', 'r'], gruul: ['r', 'g'], selesnya: ['w', 'g'],
    orzhov: ['w', 'b'], izzet: ['u', 'r'], golgari: ['b', 'g'], boros: ['w', 'r'], simic: ['u', 'g'],
    bant: ['w', 'u', 'g'], esper: ['w', 'u', 'b'], grixis: ['u', 'b', 'r'], jund: ['b', 'r', 'g'], naya: ['w', 'r', 'g'],
    abzan: ['w', 'b', 'g'], jeskai: ['w', 'u', 'r'], sultai: ['u', 'b', 'g'], mardu: ['w', 'b', 'r'], temur: ['u', 'r', 'g'],
    wubrg: ['w', 'u', 'b', 'r', 'g'], five: ['w', 'u', 'b', 'r', 'g'], 'five-color': ['w', 'u', 'b', 'r', 'g'],
  };

  function resolveColorQuery(value) {
    const v = value.toLowerCase();
    if (COLOR_GROUPS[v]) return new Set(COLOR_GROUPS[v]);
    // Treat as a run of color letters, e.g. "wu", "bg"
    const letters = v.split('').filter(ch => COLOR_LETTERS.includes(ch));
    return new Set(letters);
  }

  const RARITY_ORDER = { common: 0, uncommon: 1, rare: 2, mythic: 3, special: 4, bonus: 5 };

  // Mirrors populator.js's formatCardName(): lowercase, strip punctuation, collapse whitespace.
  // Used for free-text comparisons (bare words and text fields) so "guildmages forum" still
  // matches "Guildmages' Forum" the way the plain search always has.
  function normalizeText(str) {
    if (typeof str !== 'string') return '';
    return str.toLowerCase().replace(/[^\w\s]|_/g, '').replace(/\s+/g, ' ').trim();
  }

  // ---------- Tokenizer ----------
  function tokenize(input) {
    const tokens = [];
    let i = 0;
    const n = input.length;

    function isSpace(ch) { return ch === ' ' || ch === '\t' || ch === '\n'; }

    while (i < n) {
      const ch = input[i];

      if (isSpace(ch)) { i++; continue; }

      if (ch === '(' || ch === ')') {
        tokens.push({ type: ch === '(' ? 'LPAREN' : 'RPAREN' });
        i++;
        continue;
      }

      if (ch === '-') {
        tokens.push({ type: 'NOT' });
        i++;
        continue;
      }

      // Quoted string (possibly after field:)
      if (ch === '"') {
        let j = i + 1;
        let str = '';
        while (j < n && input[j] !== '"') { str += input[j]; j++; }
        i = j + 1;
        tokens.push({ type: 'WORD', value: str, quoted: true });
        continue;
      }

      // Read a bare chunk up to whitespace or a parenthesis
      let j = i;
      let chunk = '';
      while (j < n && !isSpace(input[j]) && input[j] !== '(' && input[j] !== ')') {
        if (input[j] === '"') {
          // field:"quoted value" - consume the quoted part inline
          let k = j + 1;
          let inner = '';
          while (k < n && input[k] !== '"') { inner += input[k]; k++; }
          chunk += inner;
          j = k + 1;
          continue;
        }
        chunk += input[j];
        j++;
      }
      i = j;

      const upper = chunk.toUpperCase();
      if (upper === 'AND') { tokens.push({ type: 'AND' }); continue; }
      if (upper === 'OR') { tokens.push({ type: 'OR' }); continue; }
      if (upper === 'NOT') { tokens.push({ type: 'NOT' }); continue; }

      tokens.push({ type: 'WORD', value: chunk });
    }

    return tokens;
  }

  // Split a WORD chunk like "o:foo", "cmc>=2", "bareword" into a term descriptor.
  const OPERATORS = ['>=', '<=', '!=', ':', '=', '>', '<'];
  function parseTermChunk(chunk) {
    for (const op of OPERATORS) {
      const idx = chunk.indexOf(op);
      if (idx > 0) {
        const field = chunk.slice(0, idx).toLowerCase();
        const value = chunk.slice(idx + op.length);
        if (FIELD_ALIASES[field]) {
          return { field: FIELD_ALIASES[field], op, value };
        }
      }
    }
    return { field: null, op: null, value: chunk };
  }

  const FIELD_ALIASES = {
    o: 'oracle', oracle: 'oracle',
    t: 'type', type: 'type',
    name: 'name',
    c: 'color', color: 'color', colors: 'color',
    id: 'identity', identity: 'identity',
    produces: 'produces',
    is: 'is',
    kw: 'keyword', keyword: 'keyword',
    r: 'rarity', rarity: 'rarity',
    cmc: 'cmc',
    usd: 'usd',
    edhrec: 'edhrec',
    e: 'set', s: 'set', set: 'set',
    date: 'date', year: 'date',
  };

  // ---------- Parser (recursive descent) ----------
  function parse(tokens) {
    let pos = 0;
    function peek() { return tokens[pos]; }
    function next() { return tokens[pos++]; }

    function parseOr() {
      let node = parseAnd();
      while (peek() && peek().type === 'OR') {
        next();
        const right = parseAnd();
        node = { type: 'OR', left: node, right };
      }
      return node;
    }

    function parseAnd() {
      let node = parseNot();
      while (peek() && (peek().type === 'AND' || peek().type === 'WORD' || peek().type === 'NOT' || peek().type === 'LPAREN')) {
        if (peek().type === 'AND') next();
        const right = parseNot();
        if (!right) break;
        node = { type: 'AND', left: node, right };
      }
      return node;
    }

    function parseNot() {
      if (peek() && peek().type === 'NOT') {
        next();
        const operand = parseNot();
        return { type: 'NOT', operand };
      }
      return parseAtom();
    }

    function parseAtom() {
      const tok = peek();
      if (!tok) return null;

      if (tok.type === 'LPAREN') {
        next();
        const node = parseOr();
        if (peek() && peek().type === 'RPAREN') next();
        return node;
      }

      if (tok.type === 'WORD') {
        next();
        if (tok.quoted) {
          return { type: 'TERM', field: null, op: null, value: tok.value };
        }
        const parsed = parseTermChunk(tok.value);
        return { type: 'TERM', field: parsed.field, op: parsed.op, value: parsed.value };
      }

      // Stray AND/OR/RPAREN with nothing to bind to
      next();
      return null;
    }

    const root = parseOr();
    return root;
  }

  // ---------- Evaluation ----------
  function textOf(card, field) {
    if (field === 'oracle') {
      let text = card.oracle_text || '';
      if (card.card_faces) {
        text += ' ' + card.card_faces.map(f => f.oracle_text || '').join(' ');
      }
      return normalizeText(text);
    }
    if (field === 'type') {
      let text = card.type_line || '';
      if (card.card_faces) {
        text += ' ' + card.card_faces.map(f => f.type_line || '').join(' ');
      }
      return normalizeText(text);
    }
    if (field === 'name') return normalizeText(card.name || '');
    return '';
  }

  function compareNumeric(actual, op, targetStr) {
    const target = parseFloat(targetStr);
    if (isNaN(actual) || isNaN(target)) return false;
    switch (op) {
      case ':': case '=': return actual === target;
      case '!=': return actual !== target;
      case '>': return actual > target;
      case '>=': return actual >= target;
      case '<': return actual < target;
      case '<=': return actual <= target;
      default: return false;
    }
  }

  function compareOrdinal(actualStr, op, targetStr, order) {
    const a = order[String(actualStr || '').toLowerCase()];
    const b = order[String(targetStr || '').toLowerCase()];
    if (a === undefined || b === undefined) return false;
    switch (op) {
      case ':': case '=': return a === b;
      case '!=': return a !== b;
      case '>': return a > b;
      case '>=': return a >= b;
      case '<': return a < b;
      case '<=': return a <= b;
      default: return false;
    }
  }

  function compareString(actualStr, op, targetStr) {
    const a = String(actualStr || '').toLowerCase();
    const b = String(targetStr || '').toLowerCase();
    switch (op) {
      case ':': case '=': return a === b;
      case '!=': return a !== b;
      case '>': return a > b;
      case '>=': return a >= b;
      case '<': return a < b;
      case '<=': return a <= b;
      default: return false;
    }
  }

  function evalColorSet(actualSet, op, querySet) {
    // actualSet, querySet: Set of lowercase letters
    const isSubset = [...actualSet].every(c => querySet.has(c));
    const isSuperset = [...querySet].every(c => actualSet.has(c));
    const isEqual = isSubset && isSuperset && actualSet.size === querySet.size;

    switch (op) {
      case '=': return isEqual;
      case '!=': return !isEqual;
      case '<=': return isSubset;
      case '>=': return isSuperset;
      case '<': return isSubset && actualSet.size < querySet.size;
      case '>': return isSuperset && actualSet.size > querySet.size;
      case ':': default: return isSubset; // land-deckbuilding-friendly default
    }
  }

  function evalProducesSet(actualSet, op, querySet) {
    const isSubset = [...actualSet].every(c => querySet.has(c));
    const isSuperset = [...querySet].every(c => actualSet.has(c));
    const isEqual = isSubset && isSuperset && actualSet.size === querySet.size;

    switch (op) {
      case '=': return isEqual;
      case '!=': return !isEqual;
      case '<=': return isSubset;
      case '<': return isSubset && actualSet.size < querySet.size;
      case '>': return isSuperset && actualSet.size > querySet.size;
      case '>=': case ':': default: return isSuperset; // "produces at least these colors"
    }
  }

  const IS_TAGS = new Set([
    'basic', 'nonbasic', 'dfc', 'transform', 'snow',
    'shock-land', 'choose-type-shock-land', 'fetch-land', 'check-land', 'fast-land', 'slow-land',
    'battle-land', 'pain-land', 'filter-land', 'horizon-land', 'bounce-land',
    'surveil-land', 'gain-land', 'man-land', 'triome', 'true-dual', 'gate',
    'cycling-land', 'command-tower-style', 'mdfc',
  ]);

  function evalIs(card, value) {
    const v = value.toLowerCase();
    if (v === 'basic') return !!card.is_basic;
    if (v === 'nonbasic') return !card.is_basic;
    if (v === 'dfc' || v === 'transform' || v === 'mdfc') return !!(card.card_faces && card.card_faces.length > 1);
    if (v === 'snow') return /\bsnow\b/i.test(card.type_line || '');
    const properties = Array.isArray(card.properties) ? card.properties : [];
    return properties.includes(v);
  }

  function evalTerm(card, term) {
    const { field, op, value } = term;

    if (!field) {
      // Bare word / quoted phrase: match name, type, oracle text, set, set name, properties
      const v = normalizeText(value);
      const properties = Array.isArray(card.properties) ? card.properties : [];
      return textOf(card, 'name').includes(v) ||
        textOf(card, 'type').includes(v) ||
        textOf(card, 'oracle').includes(v) ||
        normalizeText(card.set || '').includes(v) ||
        normalizeText(card.set_name || '').includes(v) ||
        properties.some(p => normalizeText(p).includes(v));
    }

    switch (field) {
      case 'oracle': return textOf(card, 'oracle').includes(normalizeText(value));
      case 'type': return textOf(card, 'type').includes(normalizeText(value));
      case 'name': return textOf(card, 'name').includes(normalizeText(value));

      case 'color': {
        const cardColors = new Set((card.colors || []).map(c => c.toLowerCase()));
        const query = resolveColorQuery(value);
        return evalColorSet(cardColors, op || ':', query);
      }

      case 'identity': {
        const cardIdentity = new Set((card.color_identity || []).map(c => c.toLowerCase()));
        const query = resolveColorQuery(value);
        if (value.toLowerCase() === 'm' || value.toLowerCase() === 'multi') {
          return cardIdentity.size > 1;
        }
        return evalColorSet(cardIdentity, op || ':', query);
      }

      case 'produces': {
        const produced = new Set((card.produced_mana || []).map(c => c.toLowerCase()));
        const query = resolveColorQuery(value);
        return evalProducesSet(produced, op || ':', query);
      }

      case 'is': return evalIs(card, value);

      case 'keyword': {
        const kws = Array.isArray(card.keywords) ? card.keywords.map(k => k.toLowerCase()) : [];
        return kws.includes(value.toLowerCase());
      }

      case 'rarity': return compareOrdinal(card.rarity, op || ':', value, RARITY_ORDER);

      case 'cmc': return compareNumeric(card.cmc, op || ':', value);

      case 'usd': {
        const price = card.prices && card.prices.usd ? parseFloat(card.prices.usd) : NaN;
        return compareNumeric(price, op || ':', value);
      }

      case 'edhrec': return compareNumeric(card.edhrec_rank, op || ':', value);

      case 'set': {
        const v = value.toLowerCase();
        return String(card.set || '').toLowerCase() === v ||
          normalizeText(card.set_name || '').includes(normalizeText(value));
      }

      case 'date': {
        const opUsed = op || ':';
        if (opUsed === ':') return String(card.released_at || '').startsWith(value);
        return compareString(card.released_at, opUsed, value);
      }

      default: return false;
    }
  }

  function evalNode(card, node) {
    if (!node) return true;
    switch (node.type) {
      case 'AND': return evalNode(card, node.left) && evalNode(card, node.right);
      case 'OR': return evalNode(card, node.left) || evalNode(card, node.right);
      case 'NOT': return !evalNode(card, node.operand);
      case 'TERM': return evalTerm(card, node);
      default: return true;
    }
  }

  function parseQuery(input) {
    const trimmed = (input || '').trim();
    if (trimmed === '') {
      return function alwaysTrue() { return true; };
    }
    let ast;
    try {
      const tokens = tokenize(trimmed);
      ast = parse(tokens);
    } catch (e) {
      console.error('Query parse error:', e);
      return function alwaysTrue() { return true; };
    }
    return function predicate(card) {
      try {
        return evalNode(card, ast);
      } catch (e) {
        return false;
      }
    };
  }

  const api = { parseQuery };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.ScryfallQuery = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
