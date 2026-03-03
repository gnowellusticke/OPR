/**
 * rules/opr-rules-alien-hives.js
 * Alien Hives faction rules from v3.5.2
 */
import { HOOKS } from '../RuleRegistry.js';

export const ALIEN_HIVES_RULES = {
  // ── Army-Wide: Hive Bond ──────────────────────────────────────────────────
  'Hive Bond': {
    description: 'Units where all models have this rule get +1 to morale test rolls.',
    hooks: {
      [HOOKS.ON_MORALE_TEST]: ({ roll, specialRulesApplied }) => {
        specialRulesApplied.push({ rule: 'Hive Bond', value: 1, effect: '+1 to morale roll' });
        return { roll: roll + 1 };
      },
    },
  },

  'Hive Bond Boost': {
    description: 'If all models have Hive Bond, get +2 to morale instead of +1.',
    hooks: {
      [HOOKS.ON_MORALE_TEST]: ({ roll, specialRulesApplied }) => {
        specialRulesApplied.push({ rule: 'Hive Bond Boost', value: 2, effect: '+2 to morale roll (Hive Bond Boost)' });
        return { roll: roll + 2 };
      },
    },
  },

  'Hive Bond Boost Aura': {
    description: 'This model and its unit get Hive Bond Boost.',
    hooks: {},
  },

  // ── Agile ─────────────────────────────────────────────────────────────────
  Agile: {
    description: 'Moves +1" on Advance, +2" on Rush/Charge.',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ action, speedDelta, specialRulesApplied }) => {
        const delta = action === 'Advance' ? 1 : 2;
        specialRulesApplied.push({ rule: 'Agile', value: delta, effect: `+${delta}" movement` });
        return { speedDelta: (speedDelta ?? 0) + delta };
      },
    },
  },

  // ── Rapid Charge / Aura ───────────────────────────────────────────────────
  'Rapid Charge': {
    description: 'Moves +4" when using Charge actions.',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ action, speedDelta, specialRulesApplied }) => {
        if (action !== 'Charge') return {};
        specialRulesApplied.push({ rule: 'Rapid Charge', value: 4, effect: '+4" charge distance' });
        return { speedDelta: (speedDelta ?? 0) + 4 };
      },
    },
  },

  'Rapid Charge Aura': {
    description: 'This model and its unit get Rapid Charge.',
    hooks: {},
  },

  // ── Precise ───────────────────────────────────────────────────────────────
  Precise: {
    description: 'Gets +1 to hit when attacking.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ quality, specialRulesApplied }) => {
        specialRulesApplied.push({ rule: 'Precise', value: 1, effect: '+1 to hit' });
        return { quality: Math.max(2, quality - 1) };
      },
    },
  },

  // ── Rupture ───────────────────────────────────────────────────────────────
  Rupture: {
    description: 'Ignores Regeneration. Unmodified 6 to hit that aren\'t blocked deal 1 extra wound.',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ hitRolls, specialRulesApplied }) => {
        const sixes = (hitRolls ?? []).filter(r => r === 6).length;
        if (sixes === 0) return {};
        specialRulesApplied.push({ rule: 'Rupture', value: sixes, effect: `${sixes} hit(s) on 6 — +1 wound if not blocked` });
        return { ruptureHits: sixes };
      },
      [HOOKS.ON_INCOMING_WOUNDS]: ({ isRupture, specialRulesApplied }) => {
        if (!isRupture) return {};
        specialRulesApplied.push({ rule: 'Rupture', value: null, effect: 'Regeneration suppressed' });
        return { suppressRegeneration: true };
      },
    },
  },

  // ── Ravage(X) ─────────────────────────────────────────────────────────────
  Ravage: {
    description: 'When it\'s this model\'s turn to attack in melee, roll X dice. Each 6+ deals 1 wound on the target.',
    hooks: {
      [HOOKS.BEFORE_MELEE_ATTACK]: ({ unit, dice, specialRulesApplied }) => {
        const x = unit._ruleParamValue ?? 0;
        if (x <= 0) return {};
        let wounds = 0;
        for (let i = 0; i < x; i++) { if (dice.roll() >= 6) wounds++; }
        if (wounds > 0) {
          specialRulesApplied.push({ rule: 'Ravage', value: wounds, effect: `Ravage(${x}): ${wounds} free wound(s)` });
        }
        return { ravageWounds: wounds };
      },
    },
  },

  // ── Retaliate(X) ──────────────────────────────────────────────────────────
  Retaliate: {
    description: 'When this model takes a wound in melee, the attacker takes X hits.',
    hooks: {
      [HOOKS.ON_INCOMING_WOUNDS]: ({ wounds, unit, specialRulesApplied }) => {
        if ((wounds ?? 0) <= 0) return {};
        const x = unit._ruleParamValue ?? 1;
        specialRulesApplied.push({ rule: 'Retaliate', value: x, effect: `took wound → attacker takes ${x} hit(s)` });
        return { retaliateHits: x * wounds };
      },
    },
  },

  // ── Predator Fighter ──────────────────────────────────────────────────────
  'Predator Fighter': {
    description: 'Each unmodified 6 to hit in melee generates +1 attack with that weapon (no chain).',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ hitRolls, isMelee, specialRulesApplied }) => {
        if (!isMelee) return {};
        const sixes = (hitRolls ?? []).filter(r => r === 6).length;
        if (sixes === 0) return {};
        specialRulesApplied.push({ rule: 'Predator Fighter', value: sixes, effect: `${sixes} extra attack(s) from 6s (no chain)` });
        return { extraAttacks: sixes, noChainExtraAttacks: true };
      },
    },
  },

  // ── No Retreat ────────────────────────────────────────────────────────────
  'No Retreat': {
    description: 'When this unit fails a morale test causing Shaken/Routed, count as passed instead. Then roll dice equal to wounds needed to destroy it — each 1-3 deals 1 wound (can\'t be ignored).',
    hooks: {
      [HOOKS.ON_MORALE_TEST]: ({ testResult, unit, dice, specialRulesApplied }) => {
        if (testResult !== 'failed') return {};
        const remainingWounds = unit.tough_remaining ?? 1;
        let selfWounds = 0;
        for (let i = 0; i < remainingWounds; i++) {
          if (dice.roll() <= 3) selfWounds++;
        }
        specialRulesApplied.push({ rule: 'No Retreat', value: selfWounds, effect: `morale failed → test passed, ${selfWounds} self-wound(s) (can't be ignored)` });
        return { overrideResult: 'passed', selfWounds, selfWoundsIgnorable: false };
      },
    },
  },

  // ── Piercing Growth ───────────────────────────────────────────────────────
  'Piercing Growth': {
    description: 'Gain one marker each round end while on table. Each marker gives AP(+1) (max +2). Lose all markers if Shaken.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, ap, specialRulesApplied }) => {
        const markers = Math.min(2, unit.piercing_growth_markers ?? 0);
        if (markers <= 0) return {};
        specialRulesApplied.push({ rule: 'Piercing Growth', value: markers, effect: `AP+${markers} (${markers} growth marker(s))` });
        return { ap: (ap ?? 0) + markers };
      },
    },
  },

  // ── Piercing Tag(X) ───────────────────────────────────────────────────────
  'Piercing Tag': {
    description: 'Once per game, place X markers on one enemy within 36" LOS. Friendlies remove markers for +AP(Y) where Y = markers removed.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, specialRulesApplied }) => {
        const markers = target?.piercing_tag_markers ?? 0;
        if (markers <= 0) return {};
        target.piercing_tag_markers = 0;
        specialRulesApplied.push({ rule: 'Piercing Tag', value: markers, effect: `removed ${markers} tag marker(s) → AP+${markers}` });
        return { ap: (ap ?? 0) + markers };
      },
    },
  },

  // ── Precision Debuff ──────────────────────────────────────────────────────
  'Precision Debuff': {
    description: 'Once per activation, pick one enemy within 18" — it gets -1 to hit once.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, specialRulesApplied }) => {
        if (!unit.precision_debuffed) return {};
        specialRulesApplied.push({ rule: 'Precision Debuff', value: -1, effect: '-1 to hit (debuffed)' });
        unit.precision_debuffed = false;
        return { quality: Math.min(6, quality + 1) };
      },
    },
  },

  // ── Self-Destruct(X) ──────────────────────────────────────────────────────
  'Self-Destruct': {
    description: 'If killed in melee, attacker takes X hits. If it survives melee, it dies anyway and attacker takes X hits.',
    hooks: {},
  },

  // ── Breath Attack ─────────────────────────────────────────────────────────
  'Breath Attack': {
    description: 'Once per activation before attacking, roll one die. On 2+, one enemy within 6" LOS takes 1 hit with Blast(3) and AP(1).',
    hooks: {},
  },

  // ── Furious Buff ──────────────────────────────────────────────────────────
  'Furious Buff': {
    description: 'Once per activation, before attacking, pick one friendly unit within 12" — it gets Furious once.',
    hooks: {},
  },

  // ── Stealth Buff ──────────────────────────────────────────────────────────
  'Stealth Buff': {
    description: 'Once per activation, before attacking, pick one friendly unit within 12" — it gets Stealth once.',
    hooks: {},
  },

  // ── Unpredictable Fighter Mark ────────────────────────────────────────────
  'Unpredictable Fighter Mark': {
    description: 'Once per activation, pick one enemy within 18" — friendlies get Unpredictable Fighter against it once.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ target, unit, quality, specialRulesApplied }) => {
        if (!target?.unpredictable_fighter_marked) return {};
        const roll = unit._unpredictableFighterMarkRoll;
        if (roll == null || roll < 4) return {};
        specialRulesApplied.push({ rule: 'Unpredictable Fighter Mark', value: null, effect: `rolled ${roll}: +1 to hit vs marked target` });
        return { quality: Math.max(2, quality - 1) };
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, unit, ap, isMelee, specialRulesApplied }) => {
        if (!target?.unpredictable_fighter_marked) return {};
        const roll = unit._unpredictableFighterMarkRoll;
        if (roll == null || roll >= 4) return {};
        specialRulesApplied.push({ rule: 'Unpredictable Fighter Mark', value: null, effect: `rolled ${roll}: AP+1 vs marked target` });
        return { ap: (ap ?? 0) + 1 };
      },
    },
  },

  // ── Hit & Run Fighter ─────────────────────────────────────────────────────
  'Hit & Run Fighter': {
    description: 'Once per round, may move up to 3" after being in melee.',
    hooks: {
      [HOOKS.AFTER_COMBAT]: ({ isMelee, specialRulesApplied }) => {
        if (!isMelee) return {};
        specialRulesApplied.push({ rule: 'Hit & Run Fighter', value: 3, effect: '3" move after melee' });
        return { hitAndRunMove: 3 };
      },
    },
  },

  // ── Shielded Aura ─────────────────────────────────────────────────────────
  'Shielded Aura': {
    description: 'This model and its unit get Shielded.',
    hooks: {},
  },

  // ── Takedown Strike ───────────────────────────────────────────────────────
  'Takedown Strike': {
    description: 'Once per game in melee, make one attack at Quality 2+, AP(2), Deadly(3) targeting one model, resolved as unit of 1.',
    hooks: {},
  },

  // ── Spawn ─────────────────────────────────────────────────────────────────
  Spawn: {
    description: 'Once per game when activated, place a new unit of X fully within 6".',
    hooks: {},
  },

  // ── Surprise Attack(X) ────────────────────────────────────────────────────
  'Surprise Attack': {
    description: 'Counts as Infiltrate. On deployment, roll X dice — each 4+ deals 2 hits AP(1) to one enemy within 3".',
    hooks: {},
  },
};
