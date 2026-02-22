// ─── Faction Spell Books ─────────────────────────────────────────────────────
// Each entry: { faction, aliases, spells[] }
// Add new factions here. aliases are matched case-insensitively against army faction names.

const ALL_SPELL_BOOKS = [
  {
    faction: "Human",
    aliases: ["Human Brotherhood", "Brotherhood", "Humans"],
    spells: [
      { name: "Battle Hymn",  spell_cost: 1, range: 12, attacks: 0, ap: 0, effect: "buff",   description: "Friendly unit within 12\" gets +1 to Quality rolls until end of round.", special_rules: "" },
      { name: "Divine Smite", spell_cost: 2, range: 18, attacks: 3, ap: 1, effect: "damage", description: "Calls holy fire on an enemy unit.", special_rules: "AP(1)" },
      { name: "Sacred Ward",  spell_cost: 2, range: 6,  attacks: 0, ap: 0, effect: "buff",   description: "Friendly unit within 6\" gains a 5+ ward save until end of round.", special_rules: "" },
      { name: "Holy Nova",    spell_cost: 3, range: 12, attacks: 4, ap: 0, effect: "damage", description: "Radiant explosion hits all enemies within 12\".", special_rules: "Blast(4)" }
    ]
  },
  {
    faction: "Orc",
    aliases: ["Orc Marauders", "Marauders", "Orcs"],
    spells: [
      { name: "Waaagh!",      spell_cost: 1, range: 6,  attacks: 0, ap: 0, effect: "buff",   description: "Nearby Orc unit gets Furious until end of round.", special_rules: "" },
      { name: "Gut Bash",     spell_cost: 2, range: 12, attacks: 3, ap: 2, effect: "damage", description: "Channels brutal force into a crushing blow.", special_rules: "AP(2)" },
      { name: "Blood Frenzy", spell_cost: 3, range: 9,  attacks: 4, ap: 1, effect: "damage", description: "Unleashes a torrent of savage strikes.", special_rules: "AP(1), Rending" }
    ]
  },
  {
    faction: "Elf",
    aliases: ["High Elf", "Elves", "Elven", "High Elves", "High Elf Fleets", "Elven Fleets"],
    spells: [
      // Creator of Illusions (1): debuff — modelled as a low-damage hit to represent the Unwieldy debuff
      { name: "Creator of Illusions", spell_cost: 1, range: 18, attacks: 1, ap: 0, effect: "debuff",  description: "Target enemy unit gets Unwieldy in melee once.", special_rules: "" },
      // Elemental Seeker (1): 1 hit with Blast(3) on target within 18"
      { name: "Elemental Seeker",     spell_cost: 1, range: 18, attacks: 1, ap: 0, effect: "damage",  description: "Target enemy unit takes 1 hit with Blast(3).", special_rules: "Blast(3)" },
      // Hidden Spirits (2): buff — no direct damage
      { name: "Hidden Spirits",       spell_cost: 2, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "Up to two friendly units within 12\" get Unpredictable Shooter once.", special_rules: "" },
      // Psy-Destruction (2): 2 hits with AP(4) on one enemy model within 24"
      { name: "Psy-Destruction",      spell_cost: 2, range: 24, attacks: 2, ap: 4, effect: "damage",  description: "One enemy model within 24\" takes 2 hits with AP(4).", special_rules: "AP(4)" },
      // Blessing of Souls (3): buff — no direct damage
      { name: "Blessing of Souls",    spell_cost: 3, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "Up to three friendly units within 12\" get Highborn Boost once.", special_rules: "" },
      // Shattering Curse (3): 6 hits with AP(1) and Crack on target within 12"
      { name: "Shattering Curse",     spell_cost: 3, range: 12, attacks: 6, ap: 1, effect: "damage",  description: "Target enemy unit within 12\" takes 6 hits with AP(1) and Crack.", special_rules: "AP(1), Crack" }
    ]
  },
  {
    faction: "Undead",
    aliases: ["Undead Legions", "Legions", "Necromancer", "Skeleton"],
    spells: [
      { name: "Soul Drain",  spell_cost: 1, range: 12, attacks: 2, ap: 0, effect: "damage", description: "Drains the life force from a nearby enemy.", special_rules: "Bane" },
      { name: "Raise Dead",  spell_cost: 2, range: 6,  attacks: 0, ap: 0, effect: "buff",   description: "Restores lost models to a friendly undead unit.", special_rules: "" },
      { name: "Deathbolt",   spell_cost: 2, range: 18, attacks: 3, ap: 2, effect: "damage", description: "A bolt of necrotic energy tears through armor.", special_rules: "AP(2)" },
      { name: "Plague Wind", spell_cost: 3, range: 12, attacks: 4, ap: 1, effect: "damage", description: "A virulent cloud ravages enemy ranks.", special_rules: "AP(1), Blast(4), Bane" }
    ]
  },
  {
    faction: "Demonic",
    aliases: ["Demon", "Daemons", "Demonic Legions", "Chaos", "Cultists"],
    spells: [
      { name: "Hellfire",        spell_cost: 1, range: 18, attacks: 3, ap: 1, effect: "damage", description: "Unleashes a gout of infernal flame.", special_rules: "AP(1)" },
      { name: "Dark Pact",       spell_cost: 2, range: 6,  attacks: 0, ap: 0, effect: "buff",   description: "Empowers a friendly unit with demonic strength.", special_rules: "" },
      { name: "Warp Rift",       spell_cost: 3, range: 24, attacks: 4, ap: 3, effect: "damage", description: "Tears a rift through reality.", special_rules: "AP(3), Deadly(2)" },
      { name: "Curse of Frailty",spell_cost: 2, range: 18, attacks: 2, ap: 0, effect: "debuff", description: "Weakens the target, making their armor brittle.", special_rules: "Bane" }
    ]
  }
];

// Default fallback for factions without a spell book
const DEFAULT_SPELLS = [
  { name: "Arcane Bolt", spell_cost: 1, range: 18, attacks: 2, ap: 0, effect: "damage", description: "A generic bolt of arcane energy.", special_rules: "" }
];

/**
 * Returns the spell list for a given faction name.
 * Matches against faction primary name and aliases (case-insensitive).
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
 * Only units with Caster(X) receive spells.
 * Existing weapon-based spells (spell_cost field) are preserved and take priority.
 */
export function attachFactionSpells(units, factionName) {
  const spells = getSpellsForFaction(factionName);
  return units.map(unit => {
    const rulesStr = Array.isArray(unit.special_rules)
      ? unit.special_rules.join(' ')
      : (unit.special_rules || '');
    if (!/\bCaster\(\d+\)/.test(rulesStr)) return unit;
    const existingSpellWeapons = (unit.weapons || []).filter(w => w.spell_cost != null);
    const existingNonSpellWeapons = (unit.weapons || []).filter(w => w.spell_cost == null);
    const spellWeapons = existingSpellWeapons.length > 0 ? existingSpellWeapons : spells.map(s => ({ ...s }));
    return { ...unit, weapons: [...existingNonSpellWeapons, ...spellWeapons] };
  });
}

export { ALL_SPELL_BOOKS };