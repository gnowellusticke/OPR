// ─── Faction Spell Books ─────────────────────────────────────────────────────
// Each entry: { faction, aliases, spells[] }
// Add new factions here. aliases are matched case-insensitively against army faction names.

const ALL_SPELL_BOOKS = [

  {
  faction: "Titan Lords",
  aliases: ["Titan", "Titans", "Titan Lord"],
  spells: [
    // Psy-Injected Courage (1): buff — one friendly unit within 12" gets +1 to morale test rolls once
    { name: "Psy-Injected Courage", spell_cost: 1, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "One friendly unit within 12\" gets +1 to morale test rolls once.", special_rules: "" },
    // Electric Tempest (1): 2 hits with AP(1) and Surge on one enemy unit within 12"
    { name: "Electric Tempest",     spell_cost: 1, range: 12, attacks: 2, ap: 1, effect: "damage",  description: "Target enemy unit within 12\" takes 2 hits with AP(1) and Surge.", special_rules: "AP(1), Surge" },
    // Calculated Foresight (2): debuff — friendly units get Relentless against up to two enemy units within 18" once
    { name: "Calculated Foresight", spell_cost: 2, range: 18, attacks: 0, ap: 0, effect: "debuff",  description: "Up to two enemy units within 18\" have friendly units get Relentless against them once.", special_rules: "" },
    // Searing Burst (2): 6 hits on one enemy unit within 12"
    { name: "Searing Burst",        spell_cost: 2, range: 12, attacks: 6, ap: 0, effect: "damage",  description: "Target enemy unit within 12\" takes 6 hits.", special_rules: "" },
    // Shock Speed (3): buff — up to three friendly units within 12" move +2" on Advance and +4" on Rush/Charge once
    { name: "Shock Speed",          spell_cost: 3, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "Up to three friendly units within 12\" move +2\" on Advance and +4\" on Rush/Charge actions once.", special_rules: "" },
    // Expel Threat (3): 6 hits with AP(1) on one enemy model within 18"
    { name: "Expel Threat",         spell_cost: 3, range: 18, attacks: 6, ap: 1, effect: "damage",  description: "One enemy model within 18\" takes 6 hits with AP(1).", special_rules: "AP(1)" }
  ]
},
  {
  faction: "Soul Snatcher Cult",
  aliases: ["Soul Snatcher", "Soul Snatchers", "Cult"],
  spells: [
    // Insidious Protection (1): buff — one friendly unit within 12" gets Grounded Reinforcement once
    { name: "Insidious Protection", spell_cost: 1, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "One friendly unit within 12\" gets Grounded Reinforcement once.", special_rules: "" },
    // Mind Corruption (1): 2 hits with AP(1) and Surge on one enemy unit within 12"
    { name: "Mind Corruption",      spell_cost: 1, range: 12, attacks: 2, ap: 1, effect: "damage",  description: "Target enemy unit within 12\" takes 2 hits with AP(1) and Surge.", special_rules: "AP(1), Surge" },
    // Deep Hypnosis (2): debuff — up to two enemy units within 18" must take a morale test; if failed move up to 6" in any direction
    { name: "Deep Hypnosis",        spell_cost: 2, range: 18, attacks: 0, ap: 0, effect: "debuff",  description: "Up to two enemy units within 18\" must take a morale test; if failed move them up to 6\" in a straight line in any direction.", special_rules: "" },
    // Psychic Onslaught (2): 4 hits with Reap on one enemy unit within 12"
    { name: "Psychic Onslaught",    spell_cost: 2, range: 12, attacks: 4, ap: 0, effect: "damage",  description: "Target enemy unit within 12\" takes 4 hits with Reap.", special_rules: "Reap" },
    // Bio-Displacer (3): buff — up to three friendly units within 12" get Teleport once
    { name: "Bio-Displacer",        spell_cost: 3, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "Up to three friendly units within 12\" get Teleport once.", special_rules: "" },
    // Brain Burst (3): 3 hits with AP(2) and Deadly(3) on one enemy unit within 6"
    { name: "Brain Burst",          spell_cost: 3, range: 6,  attacks: 3, ap: 2, effect: "damage",  description: "Target enemy unit within 6\" takes 3 hits with AP(2) and Deadly(3).", special_rules: "AP(2), Deadly(3)" }
  ]
},
  {
  faction: "Saurian Star Host",
  aliases: ["Saurian", "Saurians", "Star Host", "Lizardmen"],
  spells: [
    // Toxin Mist (1): debuff — friendly units get Bane when attacking against one enemy unit within 18" once
    { name: "Toxin Mist",        spell_cost: 1, range: 18, attacks: 0, ap: 0, effect: "debuff",  description: "One enemy unit within 18\" has friendly units get Bane when attacking against it once.", special_rules: "" },
    // Serpent Comet (1): 2 hits with Disintegrate on one enemy unit within 12"
    { name: "Serpent Comet",     spell_cost: 1, range: 12, attacks: 2, ap: 0, effect: "damage",  description: "Target enemy unit within 12\" takes 2 hits with Disintegrate.", special_rules: "Disintegrate" },
    // Fateful Guidance (2): buff — up to two friendly units within 12" get Furious once
    { name: "Fateful Guidance",  spell_cost: 2, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "Up to two friendly units within 12\" get Furious once.", special_rules: "" },
    // Piranha Curse (2): 4 hits each on up to two enemy units within 9"
    { name: "Piranha Curse",     spell_cost: 2, range: 9,  attacks: 4, ap: 0, effect: "damage",  description: "Up to two enemy units within 9\" each take 4 hits.", special_rules: "" },
    // Celestial Roar (3): buff — up to three friendly units within 12" get Primal Boost once
    { name: "Celestial Roar",    spell_cost: 3, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "Up to three friendly units within 12\" get Primal Boost once.", special_rules: "" },
    // Jaguar Blaze (3): 6 hits with AP(1) and Shred on one enemy unit within 12"
    { name: "Jaguar Blaze",      spell_cost: 3, range: 12, attacks: 6, ap: 1, effect: "damage",  description: "Target enemy unit within 12\" takes 6 hits with AP(1) and Shred.", special_rules: "AP(1), Shred" }
  ]
},
  {
  faction: "Robot Legions",
  aliases: ["Robot", "Robots", "Legion", "Legions"],
  spells: [
    // Triangulation Bots (1): debuff — friendly units get Indirect when shooting against one enemy unit within 18" once
    { name: "Triangulation Bots", spell_cost: 1, range: 18, attacks: 0, ap: 0, effect: "debuff",  description: "One enemy unit within 18\" has friendly units get Indirect when shooting against it once.", special_rules: "" },
    // Piercing Bots (1): 2 hits with AP(2) on one enemy unit within 12"
    { name: "Piercing Bots",      spell_cost: 1, range: 12, attacks: 2, ap: 2, effect: "damage",  description: "Target enemy unit within 12\" takes 2 hits with AP(2).", special_rules: "AP(2)" },
    // Inspiring Bots (2): buff — up to two friendly units within 12" get Rapid Advance once
    { name: "Inspiring Bots",     spell_cost: 2, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "Up to two friendly units within 12\" get Rapid Advance once.", special_rules: "" },
    // Flame Bots (2): 4 hits each on up to two enemy units within 9"
    { name: "Flame Bots",         spell_cost: 2, range: 9,  attacks: 4, ap: 0, effect: "damage",  description: "Up to two enemy units within 9\" each take 4 hits.", special_rules: "" },
    // Mending Bots (3): buff — up to three friendly units within 12" get Self-Repair Boost once
    { name: "Mending Bots",       spell_cost: 3, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "Up to three friendly units within 12\" get Self-Repair Boost once.", special_rules: "" },
    // Gauss Bots (3): 9 hits with Destructive on one enemy unit within 6"
    { name: "Gauss Bots",         spell_cost: 3, range: 6,  attacks: 9, ap: 0, effect: "damage",  description: "Target enemy unit within 6\" takes 9 hits with Destructive.", special_rules: "Destructive" }
  ]
},
  {
  faction: "Rebel Guerrillas",
  aliases: ["Rebel", "Rebels", "Guerrilla", "Guerrillas"],
  spells: [
    // Aura of Peace (1): buff — one friendly unit within 12" gets +1 to morale test rolls once
    { name: "Aura of Peace",     spell_cost: 1, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "One friendly unit within 12\" gets +1 to morale test rolls once.", special_rules: "" },
    // Mind Breaker (1): 2 hits with AP(1) and Surge on one enemy unit within 12"
    { name: "Mind Breaker",      spell_cost: 1, range: 12, attacks: 2, ap: 1, effect: "damage",  description: "Target enemy unit within 12\" takes 2 hits with AP(1) and Surge.", special_rules: "AP(1), Surge" },
    // Bad Omen (2): debuff — friendly units get Furious against up to two enemy units within 18" once
    { name: "Bad Omen",          spell_cost: 2, range: 18, attacks: 0, ap: 0, effect: "debuff",  description: "Up to two enemy units within 18\" have friendly units get Furious against them once.", special_rules: "" },
    // Wave of Discord (2): 2 hits with Thrash on one enemy unit within 18"
    { name: "Wave of Discord",   spell_cost: 2, range: 18, attacks: 2, ap: 0, effect: "damage",  description: "Target enemy unit within 18\" takes 2 hits with Thrash.", special_rules: "Thrash" },
    // Deep Meditation (3): buff — up to three friendly units within 12" get +1 to hit rolls when shooting once
    { name: "Deep Meditation",   spell_cost: 3, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "Up to three friendly units within 12\" get +1 to hit rolls when shooting once.", special_rules: "" },
    // Piercing Pulse (3): 3 hits with AP(4) on one enemy model within 24"
    { name: "Piercing Pulse",    spell_cost: 3, range: 24, attacks: 3, ap: 4, effect: "damage",  description: "One enemy model within 24\" takes 3 hits with AP(4).", special_rules: "AP(4)" }
  ]
},
  {
  faction: "Ratmen Clans",
  aliases: ["Ratmen", "Rats", "Rat", "Clan", "Clans"],
  spells: [
    // Weapon Booster (1): buff — one friendly unit within 12" gets Scurry Boost once
    { name: "Weapon Booster",   spell_cost: 1, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "One friendly unit within 12\" gets Scurry Boost once.", special_rules: "" },
    // Focused Shock (1): 2 hits with AP(1) and Shred on one enemy unit within 12"
    { name: "Focused Shock",    spell_cost: 1, range: 12, attacks: 2, ap: 1, effect: "damage",  description: "Target enemy unit within 12\" takes 2 hits with AP(1) and Shred.", special_rules: "AP(1), Shred" },
    // Tech-Sickness (2): debuff — up to two enemy units within 18" get -1 to defense rolls once
    { name: "Tech-Sickness",    spell_cost: 2, range: 18, attacks: 0, ap: 0, effect: "debuff",  description: "Up to two enemy units within 18\" get -1 to defense rolls once.", special_rules: "" },
    // System Takeover (2): 6 hits on one enemy unit within 12"
    { name: "System Takeover",  spell_cost: 2, range: 12, attacks: 6, ap: 0, effect: "damage",  description: "Target enemy unit within 12\" takes 6 hits.", special_rules: "" },
    // Enhance Serum (3): buff — up to three friendly units within 12" get Regeneration once
    { name: "Enhance Serum",    spell_cost: 3, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "Up to three friendly units within 12\" get Regeneration once.", special_rules: "" },
    // Power Surge (3): 6 hits with Hazardous on one enemy model within 12"
    { name: "Power Surge",      spell_cost: 3, range: 12, attacks: 6, ap: 0, effect: "damage",  description: "One enemy model within 12\" takes 6 hits with Hazardous.", special_rules: "Hazardous" }
  ]
},
  {
  faction: "Orc Marauders",
  aliases: ["Orc", "Orcs", "Marauder", "Marauders"],
  spells: [
    // Elder Protection (1): buff — one friendly unit within 12" gets Resistance once
    { name: "Elder Protection", spell_cost: 1, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "One friendly unit within 12\" gets Resistance once.", special_rules: "" },
    // Death Bolt (1): 1 hit with AP(2) and Impale on one enemy unit within 6"
    { name: "Death Bolt",       spell_cost: 1, range: 6,  attacks: 1, ap: 2, effect: "damage",  description: "Target enemy unit within 6\" takes 1 hit with AP(2) and Impale.", special_rules: "AP(2), Impale" },
    // Path of War (2): buff — up to two friendly units within 12" get Ferocious Boost once
    { name: "Path of War",      spell_cost: 2, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "Up to two friendly units within 12\" get Ferocious Boost once.", special_rules: "" },
    // Psychic Vomit (2): 6 hits with Bane on one enemy unit within 6"
    { name: "Psychic Vomit",    spell_cost: 2, range: 6,  attacks: 6, ap: 0, effect: "damage",  description: "Target enemy unit within 6\" takes 6 hits with Bane.", special_rules: "Bane" },
    // Head Bang (3): debuff — friendly units get Rending in melee against up to three enemy units within 18" once
    { name: "Head Bang",        spell_cost: 3, range: 18, attacks: 0, ap: 0, effect: "debuff",  description: "Up to three enemy units within 18\" have friendly units get Rending in melee against them once.", special_rules: "" },
    // Crackling Bolt (3): 3 hits with Blast(3) on one enemy unit within 18"
    { name: "Crackling Bolt",   spell_cost: 3, range: 18, attacks: 3, ap: 0, effect: "damage",  description: "Target enemy unit within 18\" takes 3 hits with Blast(3).", special_rules: "Blast(3)" }
  ]
},
  {
  faction: "Machine Cult",
  aliases: ["Machine", "Cult", "Mechanicus"],
  spells: [
    // Cyborg Assault (1): buff — one friendly unit within 12" gets Hit & Run Shooter once
    { name: "Cyborg Assault",     spell_cost: 1, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "One friendly unit within 12\" gets Hit & Run Shooter once.", special_rules: "" },
    // Power Beam (1): 2 hits with AP(1) on one enemy model within 18"
    { name: "Power Beam",         spell_cost: 1, range: 18, attacks: 2, ap: 1, effect: "damage",  description: "One enemy model within 18\" takes 2 hits with AP(1).", special_rules: "AP(1)" },
    // Shrouding Incense (2): buff — up to two friendly units within 12" get Machine-Fog Boost once
    { name: "Shrouding Incense",  spell_cost: 2, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "Up to two friendly units within 12\" get Machine-Fog Boost once.", special_rules: "" },
    // Searing Shrapnel (2): 4 hits with AP(1) and Wreck on one enemy unit within 12"
    { name: "Searing Shrapnel",   spell_cost: 2, range: 12, attacks: 4, ap: 1, effect: "damage",  description: "Target enemy unit within 12\" takes 4 hits with AP(1) and Wreck.", special_rules: "AP(1), Wreck" },
    // Corrode Weapons (3): debuff — up to three enemy units within 18" lose AP(1) when shooting once
    { name: "Corrode Weapons",    spell_cost: 3, range: 18, attacks: 0, ap: 0, effect: "debuff",  description: "Up to three enemy units within 18\" lose AP(1) when shooting once.", special_rules: "" },
    // Crushing Force (3): 6 hits with AP(2) on one enemy unit within 12"
    { name: "Crushing Force",     spell_cost: 3, range: 12, attacks: 6, ap: 2, effect: "damage",  description: "Target enemy unit within 12\" takes 6 hits with AP(2).", special_rules: "AP(2)" }
  ]
},
  {
  faction: "Jackals",
  aliases: ["Jackal"],
  spells: [
    // Psy-Hunter (1): buff — one friendly unit within 12" gets Scrapper Boost once
    { name: "Psy-Hunter",   spell_cost: 1, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "One friendly unit within 12\" gets Scrapper Boost once.", special_rules: "" },
    // Power Maw (1): 1 hit with AP(2) each on up to two enemy units within 12"
    { name: "Power Maw",    spell_cost: 1, range: 12, attacks: 1, ap: 2, effect: "damage",  description: "Up to two enemy units within 12\" each take 1 hit with AP(2).", special_rules: "AP(2)" },
    // Mind Shaper (2): debuff — up to two enemy units within 18" get -1 to morale test rolls once
    { name: "Mind Shaper",  spell_cost: 2, range: 18, attacks: 0, ap: 0, effect: "debuff",  description: "Up to two enemy units within 18\" get -1 to morale test rolls once.", special_rules: "" },
    // Quill Blast (2): 4 hits with Scratch on one enemy unit within 12"
    { name: "Quill Blast",  spell_cost: 2, range: 12, attacks: 4, ap: 0, effect: "damage",  description: "Target enemy unit within 12\" takes 4 hits with Scratch.", special_rules: "Scratch" },
    // Power Field (3): buff — up to three friendly units within 12" get Shielded once
    { name: "Power Field",  spell_cost: 3, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "Up to three friendly units within 12\" get Shielded once.", special_rules: "" },
    // Feral Strike (3): 3 hits with AP(2) and Deadly(3) on one enemy unit within 6"
    { name: "Feral Strike", spell_cost: 3, range: 6,  attacks: 3, ap: 2, effect: "damage",  description: "Target enemy unit within 6\" takes 3 hits with AP(2) and Deadly(3).", special_rules: "AP(2), Deadly(3)" }
  ]
},
  {
  faction: "Infected Colonies",
  aliases: ["Infected", "Colony", "Colonies"],
  spells: [
    // Violent Onslaught (1): buff — one friendly unit within 12" gets Infected Boost once
    { name: "Violent Onslaught",   spell_cost: 1, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "One friendly unit within 12\" gets Infected Boost once.", special_rules: "" },
    // Bio-Horror (1): 2 hits with AP(1) and Surge on one enemy unit within 12"
    { name: "Bio-Horror",          spell_cost: 1, range: 12, attacks: 2, ap: 1, effect: "damage",  description: "Target enemy unit within 12\" takes 2 hits with AP(1) and Surge.", special_rules: "AP(1), Surge" },
    // Brain Infestation (2): debuff — up to two enemy units within 18" get -1 to hit rolls when attacking once
    { name: "Brain Infestation",   spell_cost: 2, range: 18, attacks: 0, ap: 0, effect: "debuff",  description: "Up to two enemy units within 18\" get -1 to hit rolls when attacking once.", special_rules: "" },
    // Spread Plague (2): 2 hits with Bash on one enemy unit within 18"
    { name: "Spread Plague",       spell_cost: 2, range: 18, attacks: 2, ap: 0, effect: "damage",  description: "Target enemy unit within 18\" takes 2 hits with Bash.", special_rules: "Bash" },
    // Rapid Mutation (3): buff — up to three friendly units within 12" get Regeneration once
    { name: "Rapid Mutation",      spell_cost: 3, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "Up to three friendly units within 12\" get Regeneration once.", special_rules: "" },
    // Volatile Infection (3): 3 hits with AP(2) and Deadly(3) on one enemy unit within 6"
    { name: "Volatile Infection",  spell_cost: 3, range: 6,  attacks: 3, ap: 2, effect: "damage",  description: "Target enemy unit within 6\" takes 3 hits with AP(2) and Deadly(3).", special_rules: "AP(2), Deadly(3)" }
  ]
},
  {
  faction: "Human Inquisition",
  aliases: ["Inquisition", "Inquisitor", "Inquisitors"],
  spells: [
    // Psy-Injected Courage (1): buff — one friendly unit within 12" gets +1 to morale test rolls once
    { name: "Psy-Injected Courage", spell_cost: 1, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "One friendly unit within 12\" gets +1 to morale test rolls once.", special_rules: "" },
    // Electric Tempest (1): 2 hits with AP(1) and Surge on one enemy unit within 12"
    { name: "Electric Tempest",     spell_cost: 1, range: 12, attacks: 2, ap: 1, effect: "damage",  description: "Target enemy unit within 12\" takes 2 hits with AP(1) and Surge.", special_rules: "AP(1), Surge" },
    // Calculated Foresight (2): debuff — friendly units get Relentless against up to two enemy units within 18" once
    { name: "Calculated Foresight", spell_cost: 2, range: 18, attacks: 0, ap: 0, effect: "debuff",  description: "Up to two enemy units within 18\" have friendly units get Relentless against them once.", special_rules: "" },
    // Searing Burst (2): 6 hits on one enemy unit within 12"
    { name: "Searing Burst",        spell_cost: 2, range: 12, attacks: 6, ap: 0, effect: "damage",  description: "Target enemy unit within 12\" takes 6 hits.", special_rules: "" },
    // Shock Speed (3): buff — up to three friendly units within 12" move +2" on Advance and +4" on Rush/Charge once
    { name: "Shock Speed",          spell_cost: 3, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "Up to three friendly units within 12\" move +2\" on Advance and +4\" on Rush/Charge actions once.", special_rules: "" },
    // Expel Threat (3): 6 hits with AP(1) on one enemy model within 18"
    { name: "Expel Threat",         spell_cost: 3, range: 18, attacks: 6, ap: 1, effect: "damage",  description: "One enemy model within 18\" takes 6 hits with AP(1).", special_rules: "AP(1)" }
  ]
},
  {
  faction: "Human Defence Force",
  aliases: ["Human", "Humans", "HDF", "Defence Force"],
  spells: [
    // Psy-Injected Courage (1): buff — one friendly unit within 12" gets Hold the Line Boost once
    { name: "Psy-Injected Courage", spell_cost: 1, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "One friendly unit within 12\" gets Hold the Line Boost once.", special_rules: "" },
    // Electric Tempest (1): 2 hits with AP(1) and Fracture on one enemy unit within 12"
    { name: "Electric Tempest",     spell_cost: 1, range: 12, attacks: 2, ap: 1, effect: "damage",  description: "Target enemy unit within 12\" takes 2 hits with AP(1) and Fracture.", special_rules: "AP(1), Fracture" },
    // Calculated Foresight (2): debuff — friendly units get Relentless against up to two enemy units within 18" once
    { name: "Calculated Foresight", spell_cost: 2, range: 18, attacks: 0, ap: 0, effect: "debuff",  description: "Up to two enemy units within 18\" have friendly units get Relentless against them once.", special_rules: "" },
    // Searing Burst (2): 6 hits on one enemy unit within 12"
    { name: "Searing Burst",        spell_cost: 2, range: 12, attacks: 6, ap: 0, effect: "damage",  description: "Target enemy unit within 12\" takes 6 hits.", special_rules: "" },
    // Shock Speed (3): buff — up to three friendly units within 12" move +2" on Advance and +4" on Rush/Charge once
    { name: "Shock Speed",          spell_cost: 3, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "Up to three friendly units within 12\" move +2\" on Advance and +4\" on Rush/Charge actions once.", special_rules: "" },
    // Expel Threat (3): 6 hits with AP(1) on one enemy model within 18"
    { name: "Expel Threat",         spell_cost: 3, range: 18, attacks: 6, ap: 1, effect: "damage",  description: "One enemy model within 18\" takes 6 hits with AP(1).", special_rules: "AP(1)" }
  ]
},
  {
  faction: "Goblin Reclaimers",
  aliases: ["Goblin", "Goblins", "Reclaimer", "Reclaimers"],
  spells: [
    // Ammo Boost (1): buff — one friendly unit within 12" gets Mischievous Boost once
    { name: "Ammo Boost",   spell_cost: 1, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "One friendly unit within 12\" gets Mischievous Boost once.", special_rules: "" },
    // Zap! (1): 2 hits with AP(1) and Surge on one enemy unit within 12"
    { name: "Zap!",         spell_cost: 1, range: 12, attacks: 2, ap: 1, effect: "damage",  description: "Target enemy unit within 12\" takes 2 hits with AP(1) and Surge.", special_rules: "AP(1), Surge" },
    // Mob Frenzy (2): debuff — friendly units get AP(1) when shooting against up to two enemy units within 18" once
    { name: "Mob Frenzy",   spell_cost: 2, range: 18, attacks: 0, ap: 0, effect: "debuff",  description: "Up to two enemy units within 18\" have friendly units get AP(1) when shooting against them once.", special_rules: "" },
    // Boom! (2): 2 hits with Blast(3) on one enemy unit within 18"
    { name: "Boom!",        spell_cost: 2, range: 18, attacks: 2, ap: 0, effect: "damage",  description: "Target enemy unit within 18\" takes 2 hits with Blast(3).", special_rules: "Blast(3)" },
    // Shroud Field (3): buff — up to three friendly units within 12" get +1 to defense rolls once
    { name: "Shroud Field", spell_cost: 3, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "Up to three friendly units within 12\" get +1 to defense rolls once.", special_rules: "" },
    // Pow! (3): 3 hits with AP(2) and Skewer on one enemy unit within 6"
    { name: "Pow!",         spell_cost: 3, range: 6,  attacks: 3, ap: 2, effect: "damage",  description: "Target enemy unit within 6\" takes 3 hits with AP(2) and Skewer.", special_rules: "AP(2), Skewer" }
  ]
},
  {
  faction: "Eternal Dynasty",
  aliases: ["Eternal", "Dynasty"],
  spells: [
    // Spirit Power (1): buff — one friendly unit within 12" gets Flying once
    { name: "Spirit Power",       spell_cost: 1, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "One friendly unit within 12\" gets Flying once.", special_rules: "" },
    // Soul Spear (1): 1 hit with Puncture on one enemy model within 24"
    { name: "Soul Spear",         spell_cost: 1, range: 24, attacks: 1, ap: 0, effect: "damage",  description: "One enemy model within 24\" takes 1 hit with Puncture.", special_rules: "Puncture" },
    // Spirit Resolve (2): buff — up to two friendly units within 12" get Clan Warrior Boost once
    { name: "Spirit Resolve",     spell_cost: 2, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "Up to two friendly units within 12\" get Clan Warrior Boost once.", special_rules: "" },
    // Mind Vortex (2): 2 hits with AP(2) each on up to two enemy units within 12"
    { name: "Mind Vortex",        spell_cost: 2, range: 12, attacks: 2, ap: 2, effect: "damage",  description: "Up to two enemy units within 12\" each take 2 hits with AP(2).", special_rules: "AP(2)" },
    // Eternal Guidance (3): debuff — friendly units get +6" range when shooting against up to three enemy units within 18" once
    { name: "Eternal Guidance",   spell_cost: 3, range: 18, attacks: 0, ap: 0, effect: "debuff",  description: "Up to three enemy units within 18\" have friendly units get +6\" range when shooting against them once.", special_rules: "" },
    // Dragon Breath (3): 9 hits on one enemy unit within 12"
    { name: "Dragon Breath",      spell_cost: 3, range: 12, attacks: 9, ap: 0, effect: "damage",  description: "Target enemy unit within 12\" takes 9 hits.", special_rules: "" }
  ]
},
  {
  faction: "Elven Jesters",
  aliases: ["Jester", "Jesters", "Elven Jester"],
  spells: [
    // Asphyxiating Fog (1): buff — one friendly unit within 12" gets Counter-Attack once
    { name: "Asphyxiating Fog",  spell_cost: 1, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "One friendly unit within 12\" gets Counter-Attack once.", special_rules: "" },
    // Blades of Discord (1): 1 hit with AP(2) and Deadly(3) on one enemy unit within 6"
    { name: "Blades of Discord", spell_cost: 1, range: 6,  attacks: 1, ap: 2, effect: "damage",  description: "Target enemy unit within 6\" takes 1 hit with AP(2) and Deadly(3).", special_rules: "AP(2), Deadly(3)" },
    // Shadow Dance (2): buff — up to two friendly units within 12" get Rapid Blink Boost once
    { name: "Shadow Dance",      spell_cost: 2, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "Up to two friendly units within 12\" get Rapid Blink Boost once.", special_rules: "" },
    // Light Fragments (2): 4 hits with AP(1) and Fragment on one enemy unit within 12"
    { name: "Light Fragments",   spell_cost: 2, range: 12, attacks: 4, ap: 1, effect: "damage",  description: "Target enemy unit within 12\" takes 4 hits with AP(1) and Fragment.", special_rules: "AP(1), Fragment" },
    // Veil of Madness (3): debuff — friendly units get Slayer against up to three enemy units within 18" once
    { name: "Veil of Madness",   spell_cost: 3, range: 18, attacks: 0, ap: 0, effect: "debuff",  description: "Up to three enemy units within 18\" have friendly units get Slayer against them once.", special_rules: "" },
    // Fatal Sorrow (3): 6 hits on one enemy unit within 18"
    { name: "Fatal Sorrow",      spell_cost: 3, range: 18, attacks: 6, ap: 0, effect: "damage",  description: "Target enemy unit within 18\" takes 6 hits.", special_rules: "" }
  ]
},
  {
  faction: "Dwarf Guilds",
  aliases: ["Dwarf", "Dwarfs", "Dwarves", "Guild", "Guilds"],
  spells: [
    // Battle Rune (1): buff — one friendly unit within 12" gets +6" range when shooting once
    { name: "Battle Rune",        spell_cost: 1, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "One friendly unit within 12\" gets +6\" range when shooting once.", special_rules: "" },
    // Breaking Rune (1): 1 hit with AP(4) on one enemy model within 24"
    { name: "Breaking Rune",      spell_cost: 1, range: 24, attacks: 1, ap: 4, effect: "damage",  description: "One enemy model within 24\" takes 1 hit with AP(4).", special_rules: "AP(4)" },
    // Armor Rune (2): buff — up to two friendly units within 12" get Sturdy Boost once
    { name: "Armor Rune",         spell_cost: 2, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "Up to two friendly units within 12\" get Sturdy Boost once.", special_rules: "" },
    // Smiting Rune (2): 4 hits with AP(1) and Quake on one enemy unit within 12"
    { name: "Smiting Rune",       spell_cost: 2, range: 12, attacks: 4, ap: 1, effect: "damage",  description: "Target enemy unit within 12\" takes 4 hits with AP(1) and Quake.", special_rules: "AP(1), Quake" },
    // Deceleration Rune (3): debuff — up to three enemy units within 18" move -2" on Advance and -4" on Rush/Charge once
    { name: "Deceleration Rune",  spell_cost: 3, range: 18, attacks: 0, ap: 0, effect: "debuff",  description: "Up to three enemy units within 18\" move -2\" on Advance and -4\" on Rush/Charge actions once.", special_rules: "" },
    // Cleaving Rune (3): 3 hits with Blast(3) on one enemy unit within 18"
    { name: "Cleaving Rune",      spell_cost: 3, range: 18, attacks: 3, ap: 0, effect: "damage",  description: "Target enemy unit within 18\" takes 3 hits with Blast(3).", special_rules: "Blast(3)" }
  ]
},
{
  faction: "Dark Elf Raiders",
  aliases: ["Dark Elf", "Dark Elves", "Raiders"],
  spells: [
    // Psy-Adrenaline (1): buff — one friendly unit within 12" gets Harassing Boost once
    { name: "Psy-Adrenaline",      spell_cost: 1, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "One friendly unit within 12\" gets Harassing Boost once.", special_rules: "" },
    // Snake Bite (1): 2 hits with AP(1) and Lacerate on one enemy unit within 12"
    { name: "Snake Bite",          spell_cost: 1, range: 12, attacks: 2, ap: 1, effect: "damage",  description: "Target enemy unit within 12\" takes 2 hits with AP(1) and Lacerate.", special_rules: "AP(1), Lacerate" },
    // Raiding Drugs (2): debuff — friendly units get +1 to hit in melee against up to two enemy units within 18" once
    { name: "Raiding Drugs",       spell_cost: 2, range: 18, attacks: 0, ap: 0, effect: "debuff",  description: "Up to two enemy units within 18\" have friendly units get +1 to hit rolls in melee against them once.", special_rules: "" },
    // Art of Pain (2): 2 hits with AP(2) and Deadly(3) on one enemy unit within 6"
    { name: "Art of Pain",         spell_cost: 2, range: 6,  attacks: 2, ap: 2, effect: "damage",  description: "Target enemy unit within 6\" takes 2 hits with AP(2) and Deadly(3).", special_rules: "AP(2), Deadly(3)" },
    // Fade in the Dark (3): buff — up to three friendly units within 12" get Stealth once
    { name: "Fade in the Dark",    spell_cost: 3, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "Up to three friendly units within 12\" get Stealth once.", special_rules: "" },
    // Holistic Suffering (3): 9 hits on one enemy unit within 12"
    { name: "Holistic Suffering",  spell_cost: 3, range: 12, attacks: 9, ap: 0, effect: "damage",  description: "Target enemy unit within 12\" takes 9 hits.", special_rules: "" }
  ]
},
  {
    faction: "DAO Union",
    aliases: ["DAO", "Union"],
    spells: [
      // Aura of Peace (1): buff — one friendly unit within 12" gets Fearless once
      { name: "Aura of Peace",            spell_cost: 1, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "One friendly unit within 12\" gets Fearless once.", special_rules: "" },
      // Killing Blow (1): 2 hits with AP(1) on one enemy model within 18"
      { name: "Killing Blow",             spell_cost: 1, range: 18, attacks: 2, ap: 1, effect: "damage",  description: "One enemy model within 18\" takes 2 hits with AP(1).", special_rules: "AP(1)" },
      // Psychic Stabilization (2): buff — up to two friendly units within 12" get Targeting Visor Boost once
      { name: "Psychic Stabilization",    spell_cost: 2, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "Up to two friendly units within 12\" get Targeting Visor Boost once.", special_rules: "" },
      // Deadly Surge (2): 6 hits with Bane on one enemy unit within 6"
      { name: "Deadly Surge",             spell_cost: 2, range: 6,  attacks: 6, ap: 0, effect: "damage",  description: "Target enemy unit within 6\" takes 6 hits with Bane.", special_rules: "Bane" },
      // Coordinated Aggression (3): debuff — friendly units get AP(1) when shooting against up to three enemy units within 18" once
      { name: "Coordinated Aggression",   spell_cost: 3, range: 18, attacks: 0, ap: 0, effect: "debuff",  description: "Up to three enemy units within 18\" have friendly units get AP(1) when shooting against them once.", special_rules: "" },
      // Devastating Strike (3): 6 hits with Decimate on one enemy unit within 12"
      { name: "Devastating Strike",       spell_cost: 3, range: 12, attacks: 6, ap: 0, effect: "damage",  description: "Target enemy unit within 12\" takes 6 hits with Decimate.", special_rules: "Decimate" }
    ]
  },
  {
  faction: "Custodian Brothers",
  aliases: ["Custodian", "Custodians", "Custodian Brother"],
  spells: [
    // The Founder's Curse (1): debuff — friendly units get Shred when attacking target enemy unit within 18" once
    { name: "The Founder's Curse",  spell_cost: 1, range: 18, attacks: 0, ap: 0, effect: "debuff",  description: "Target enemy unit within 18\" has friendly units get Shred when attacking it once.", special_rules: "" },
    // Thunderous Mist (1): 2 hits on one enemy unit within 18"
    { name: "Thunderous Mist",      spell_cost: 1, range: 18, attacks: 2, ap: 0, effect: "damage",  description: "Target enemy unit within 18\" takes 2 hits.", special_rules: "" },
    // Focused Defender (2): buff — up to two friendly units within 12" get Unpredictable Fighter once
    { name: "Focused Defender",     spell_cost: 2, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "Up to two friendly units within 12\" get Unpredictable Fighter once.", special_rules: "" },
    // Dread Strike (2): 2 hits with Tear on one enemy model within 24"
    { name: "Dread Strike",         spell_cost: 2, range: 24, attacks: 2, ap: 0, effect: "damage",  description: "One enemy model within 24\" takes 2 hits with Tear.", special_rules: "Tear" },
    // Guardian Protection (3): buff — up to three friendly units within 12" get Guardian Boost once
    { name: "Guardian Protection",  spell_cost: 3, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "Up to three friendly units within 12\" get Guardian Boost once.", special_rules: "" },
    // Mind Gash (3): 6 hits with AP(1) and Shred on one enemy unit within 12"
    { name: "Mind Gash",            spell_cost: 3, range: 12, attacks: 6, ap: 1, effect: "damage",  description: "Target enemy unit within 12\" takes 6 hits with AP(1) and Shred.", special_rules: "AP(1), Shred" }
  ]
},
  {
  faction: "Blessed Sisters",
  aliases: ["Sisters", "Blessed Sister"],
  spells: [
    // Burn the Heretic (1): debuff — enemy unit within 18" gets -3 to casting rolls once
    { name: "Burn the Heretic",     spell_cost: 1, range: 18, attacks: 0, ap: 0, effect: "debuff",  description: "Target enemy unit within 18\" gets -3 to casting rolls once.", special_rules: "" },
    // Righteous Wrath (1): 1 hit with AP(4) on one enemy model within 24"
    { name: "Righteous Wrath",      spell_cost: 1, range: 24, attacks: 1, ap: 4, effect: "damage",  description: "One enemy model within 24\" takes 1 hit with AP(4).", special_rules: "AP(4)" },
    // Holy Rage (2): buff — up to two friendly units within 12" get Piercing Hunter once
    { name: "Holy Rage",            spell_cost: 2, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "Up to two friendly units within 12\" get Piercing Hunter once.", special_rules: "" },
    // Eternal Flame (2): 6 hits with Purge on one enemy unit within 6"
    { name: "Eternal Flame",        spell_cost: 2, range: 6,  attacks: 6, ap: 0, effect: "damage",  description: "Target enemy unit within 6\" takes 6 hits with Purge.", special_rules: "Purge" },
    // Litanies of War (3): buff — up to three friendly units within 12" get Devout Boost once
    { name: "Litanies of War",      spell_cost: 3, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "Up to three friendly units within 12\" get Devout Boost once.", special_rules: "" },
    // Searing Admonition (3): 3 hits with Blast(3) on one enemy unit within 18"
    { name: "Searing Admonition",   spell_cost: 3, range: 18, attacks: 3, ap: 0, effect: "damage",  description: "Target enemy unit within 18\" takes 3 hits with Blast(3).", special_rules: "Blast(3)" }
  ]
},
  {
  faction: "Alien Hives",
  aliases: ["Alien Hive", "Hive"],
  spells: [
    // Animate Spirit (1): buff — friendly unit within 12" gets Hit & Run Fighter once
    { name: "Animate Spirit",     spell_cost: 1, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "One friendly unit within 12\" gets Hit & Run Fighter once.", special_rules: "" },
    // Overwhelming Strike (1): 2 hits with AP(1) and Rupture on target within 12"
    { name: "Overwhelming Strike", spell_cost: 1, range: 12, attacks: 2, ap: 1, effect: "damage",  description: "Target enemy unit within 12\" takes 2 hits with AP(1) and Rupture.", special_rules: "AP(1), Rupture" },
    // Infuse Bloodthirst (2): buff — up to two friendly units within 12" get Hive Bond Boost once
    { name: "Infuse Bloodthirst", spell_cost: 2, range: 12, attacks: 0, ap: 0, effect: "buff",    description: "Up to two friendly units within 12\" get Hive Bond Boost once.", special_rules: "" },
    // Psychic Blast (2): 4 hits with AP(2) on one enemy unit within 12"
    { name: "Psychic Blast",      spell_cost: 2, range: 12, attacks: 4, ap: 2, effect: "damage",  description: "Target enemy unit within 12\" takes 4 hits with AP(2).", special_rules: "AP(2)" },
    // Terror Seeker (3): debuff — up to three enemy units within 18" get Unpredictable Fighter applied against them once
    { name: "Terror Seeker",      spell_cost: 3, range: 18, attacks: 0, ap: 0, effect: "debuff",  description: "Up to three enemy units within 18\" get Unpredictable Fighter used against them once.", special_rules: "" },
    // Hive Shriek (3): 6 hits with AP(1) on one enemy model within 18"
    { name: "Hive Shriek",        spell_cost: 3, range: 18, attacks: 6, ap: 1, effect: "damage",  description: "One enemy model within 18\" takes 6 hits with AP(1).", special_rules: "AP(1)" }
  ]
},
  {
    faction: "High Elf Fleets",
    aliases: ["High Elf", "Elves", "Elven", "High Elves", "Elf", "Elven Fleets"],
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
