/**
 * UnitFactory.js
 *
 * Normalizes parsed army data (from ArmyTextParser or ArmyForgeParser)
 * into engine-ready unit objects.
 *
 * Parsers are responsible for extracting data from their source formats.
 * This factory is responsible for producing objects the RulesEngine can consume.
 */

let _nextId = 1;

function generateId(name) {
  return `unit_${_nextId++}_${name.replace(/\s+/g, '_').toLowerCase()}`;
}

/**
 * Normalize a single weapon from parsed data into engine format.
 * @param {Object} w - raw weapon from parser
 * @returns {Object} engine-ready weapon
 */
function normalizeWeapon(w) {
  return {
    name:          w.name ?? 'Unknown Weapon',
    range:         w.range  ?? 2,
    attacks:       w.attacks ?? 1,
    // Parsers may use negative AP (GW convention) or positive (OPR convention).
    // Engine always uses positive AP — a value of 2 means defense -2.
    ap:            Math.abs(w.ap ?? 0),
    special_rules: w.special_rules ?? '',
  };
}

/**
 * Normalize a single parsed unit into an engine-ready unit object.
 *
 * Parsed unit shape (from either parser):
 * {
 *   name, models, quality, defense, points,
 *   special_rules, weapons, joined_squad?
 * }
 *
 * Engine unit shape:
 * {
 *   id, name, owner, x, y,
 *   quality, defense, points,
 *   current_models, total_models,
 *   special_rules, weapons,
 *   status, wounds_accumulated,
 *   just_charged, fatigued, _moved,
 *   spell_tokens, non_hero_models_remaining
 * }
 *
 * @param {Object} parsed  - unit from parser
 * @param {string} owner   - 'player1' | 'player2'
 * @param {Object} [pos]   - starting position { x, y }
 * @returns {Object} engine-ready unit
 */

/**
 * @typedef {Object} Weapon
 * @property {string} name
 * @property {number} range
 * @property {number} attacks
 * @property {number} ap
 * @property {string} special_rules
 */

/**
 * @typedef {Object} Unit
 * @property {string} id
 * @property {string} name
 * @property {string} owner
 * @property {number} x
 * @property {number} y
 * @property {number} quality
 * @property {number} defense
 * @property {number} points
 * @property {number} current_models
 * @property {number} total_models
 * @property {string} special_rules
 * @property {Weapon[]} weapons
 * @property {string} status
 * @property {number} wounds_accumulated
 * @property {number} non_hero_models_remaining
 * @property {number} spell_tokens
 * @property {boolean} just_charged
 * @property {boolean} fatigued
 * @property {boolean} _moved
 */

export function createUnit(parsed, owner, pos = { x: 0, y: 0 }) {
  const models = parsed.models ?? parsed.current_models ?? 1;
  const weapons = (parsed.weapons ?? []).map(normalizeWeapon);

  // Determine if any model in the unit has Tough — needed for wound pool init.
  const sr = Array.isArray(parsed.special_rules)
    ? parsed.special_rules.join(' ')
    : (parsed.special_rules ?? '');

  // Count non-hero models for Hero wound-assignment logic.
  const isHero = sr.includes('Hero');
  const nonHeroModels = isHero ? Math.max(0, models - 1) : models;

  return {
    // Identity
    id:     generateId(parsed.name ?? 'unit'),
    name:   parsed.name ?? 'Unknown Unit',
    owner,

    // Position (set properly by Battle before first round)
    x: pos.x,
    y: pos.y,

    // Stats
    quality:  parsed.quality  ?? 4,
    defense:  parsed.defense  ?? 4,
    points:   parsed.points   ?? 0,

    // Model count
    current_models: models,
    total_models:   models,

    // Rules
    special_rules: sr,
    weapons,

    // Engine state — all start clean
    status:                   'normal',
    wounds_accumulated:       0,       // for Tough wound tracking
    non_hero_models_remaining: nonHeroModels,
    spell_tokens:             0,       // Caster rule populates this on round start
    just_charged:             false,
    fatigued:                 false,
    _moved:                   false,
  };
}

/**
 * Normalize a full parsed army into an array of engine-ready units.
 *
 * @param {Object} parsedArmy  - output from ArmyTextParser or ArmyForgeParser
 * @param {string} owner       - 'player1' | 'player2'
 * @param {Function} [placeFn] - (unit, index) => { x, y } — layout strategy
 * @returns {Object[]} array of engine-ready units
 */
export function createArmy(parsedArmy, owner, placeFn) {
  // Reset ID counter per army so IDs stay readable during development.
  // In production you'd use UUIDs instead.
  const units = parsedArmy.units ?? [];

  return units.map((parsed, i) => {
    const pos = placeFn ? placeFn(parsed, i) : defaultPlacement(owner, i, units.length);
    return createUnit(parsed, owner, pos);
  });
}

/**
 * Default deployment placement — lines units up in their deployment zone.
 * Player 1 deploys in the south (low Y), Player 2 in the north (high Y).
 *
 * @param {string} owner
 * @param {number} index
 * @param {number} total
 * @returns {{ x: number, y: number }}
 */
function defaultPlacement(owner, index, total) {
  const spacing = 48 / (total + 1);
  const x = spacing * (index + 1);
  const y = owner === 'player1' ? 8 : 40;
  return { x, y };
}