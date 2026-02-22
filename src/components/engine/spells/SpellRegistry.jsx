import HumanSpells from './HumanSpells.json';
import OrcSpells from './OrcSpells.json';
import ElvenSpells from './ElvenSpells.json';
import UndeadSpells from './UndeadSpells.json';
import DemonicSpells from './DemonicSpells.json';

const ALL_SPELL_BOOKS = [
  HumanSpells,
  OrcSpells,
  ElvenSpells,
  UndeadSpells,
  DemonicSpells,
];

// Default fallback spells for factions without a spell book
const DEFAULT_SPELLS = [
  { name: 'Arcane Bolt', spell_cost: 1, range: 18, attacks: 2, ap: 0, effect: 'damage', description: 'A generic bolt of arcane energy.', special_rules: '' }
];

/**
 * Returns the spell list for a given faction name.
 * Matches against the faction's primary name and aliases (case-insensitive).
 * Falls back to DEFAULT_SPELLS if no matching spell book is found.
 */
export function getSpellsForFaction(factionName) {
  if (!factionName) return DEFAULT_SPELLS;

  const normalized = factionName.toLowerCase().trim();

  const book = ALL_SPELL_BOOKS.find(b => {
    if (b.faction.toLowerCase() === normalized) return true;
    return b.aliases?.some(a => normalized.includes(a.toLowerCase()) || a.toLowerCase().includes(normalized));
  });

  return book ? book.spells : DEFAULT_SPELLS;
}

/**
 * Attaches the faction's spells to any Caster unit in the army.
 * Only units with Caster(X) in their special_rules receive spells.
 * Existing weapon-based spells (spell_cost field) are preserved.
 */
export function attachFactionSpells(units, factionName) {
  const spells = getSpellsForFaction(factionName);

  return units.map(unit => {
    const rulesStr = Array.isArray(unit.special_rules)
      ? unit.special_rules.join(' ')
      : (unit.special_rules || '');

    if (!/\bCaster\(\d+\)/.test(rulesStr)) return unit;

    // Keep any existing weapons that already have spell_cost (manually defined)
    const existingSpellWeapons = (unit.weapons || []).filter(w => w.spell_cost != null);
    const existingNonSpellWeapons = (unit.weapons || []).filter(w => w.spell_cost == null);

    // Only inject faction spells if no manual spells were defined on the unit
    const spellWeapons = existingSpellWeapons.length > 0
      ? existingSpellWeapons
      : spells.map(s => ({ ...s }));

    return {
      ...unit,
      weapons: [...existingNonSpellWeapons, ...spellWeapons]
    };
  });
}

export { ALL_SPELL_BOOKS };