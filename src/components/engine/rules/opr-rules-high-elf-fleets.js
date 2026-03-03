/**
 * rules/opr-rules-high-elf-fleets.js
 * High Elf Fleets faction rules from v3.5.2
 */
import { HOOKS } from '../RuleRegistry.js';

export const HIGH_ELF_FLEETS_RULES = {
  // ── Army-Wide: Highborn ───────────────────────────────────────────────────
  Highborn: {
    description: 'Moves +2" when using Advance, and +2" when using Rush/Charge.',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ action, speedDelta, specialRulesApplied }) => {
        const delta = action === 'Advance' ? 2 : 2;
        specialRulesApplied.push({ rule: 'Highborn', value: delta, effect: `+${delta}" movement` });
        return { speedDelta: (speedDelta ?? 0) + delta };
      },
    },
  },

  'Highborn Boost': {
    description: 'If this model has Highborn, it moves +4" on Advance and +4" on Rush/Charge instead of +2".',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ action, speedDelta, specialRulesApplied }) => {
        const delta = 4;
        specialRulesApplied.push({ rule: 'Highborn Boost', value: delta, effect: `+${delta}" movement (Highborn Boost)` });
        return { speedDelta: (speedDelta ?? 0) + delta };
      },
    },
  },

  'Highborn Boost Aura': {
    description: 'This model and its unit get Highborn Boost.',
    hooks: {},
  },

  // ── Crack ─────────────────────────────────────────────────────────────────
  Crack: {
    description: 'On unmodified results of 6 to hit, those hits get AP(+2).',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ hitRolls, ap, specialRulesApplied }) => {
        const crackedHits = (hitRolls ?? []).filter(r => r === 6).length;
        if (crackedHits === 0) return {};
        specialRulesApplied.push({ rule: 'Crack', value: crackedHits, effect: `${crackedHits} hit(s) on 6 gain AP(+2)` });
        return { crackHits: crackedHits, crackApBonus: 2 };
      },
    },
  },

  // ── Resistance ────────────────────────────────────────────────────────────
  Resistance: {
    description: 'Roll one die per wound: 6+ ignores it. Wounds from spells are ignored on 2+ instead.',
    hooks: {
      [HOOKS.ON_INCOMING_WOUNDS]: ({ wounds, isSpell, dice, specialRulesApplied }) => {
        let ignored = 0;
        const threshold = isSpell ? 2 : 6;
        for (let i = 0; i < (wounds ?? 0); i++) {
          if (dice.roll() >= threshold) ignored++;
        }
        if (ignored > 0) {
          specialRulesApplied.push({ rule: 'Resistance', value: ignored, effect: `${ignored} wound(s) ignored (${isSpell ? '2+' : '6+'} vs ${isSpell ? 'spell' : 'normal'})` });
        }
        return { ignoredWounds: ignored };
      },
    },
  },

  'Resistance Aura': {
    description: 'This model and its unit get Resistance.',
    hooks: {},
  },

  // ── Shred in Melee ────────────────────────────────────────────────────────
  'Shred in Melee': {
    description: 'On unmodified results of 1 to block hits in melee, this weapon deals 1 extra wound.',
    hooks: {
      [HOOKS.ON_PER_HIT]: ({ saveRoll, isMelee, specialRulesApplied }) => {
        if (!isMelee || saveRoll !== 1) return {};
        specialRulesApplied.push({ rule: 'Shred in Melee', value: null, effect: 'unmodified 1 to save in melee — +1 extra wound' });
        return { extraWounds: 1 };
      },
    },
  },

  'Shred in Melee Aura': {
    description: 'This model and its unit get Shred in melee.',
    hooks: {},
  },

  // ── Scout Aura ────────────────────────────────────────────────────────────
  'Scout Aura': {
    description: 'This model and its unit get Scout.',
    hooks: {},
  },

  // ── Unpredictable Shooter ─────────────────────────────────────────────────
  'Unpredictable Shooter': {
    description: 'When shooting, roll one die: 1-3 get AP(+1), 4-6 get +1 to hit.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, weapon, quality, specialRulesApplied }) => {
        if ((weapon?.range ?? 0) <= 2) return {};
        const roll = unit._unpredictableShooterRoll;
        if (roll == null || roll < 4) return {};
        specialRulesApplied.push({ rule: 'Unpredictable Shooter', value: null, effect: `rolled ${roll}: +1 to hit (shooting)` });
        return { quality: Math.max(2, quality - 1) };
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, weapon, ap, isMelee, specialRulesApplied }) => {
        if (isMelee) return {};
        const roll = unit._unpredictableShooterRoll;
        if (roll == null || roll >= 4) return {};
        specialRulesApplied.push({ rule: 'Unpredictable Shooter', value: null, effect: `rolled ${roll}: AP+1 (shooting)` });
        return { ap: (ap ?? 0) + 1 };
      },
    },
  },

  // ── Unwieldy ──────────────────────────────────────────────────────────────
  Unwieldy: {
    description: 'Strikes last when charging.',
    hooks: {},
  },

  'Unwieldy Debuff': {
    description: 'Once per activation, pick one enemy within 18" — it gets Unwieldy in melee once.',
    hooks: {},
  },

  // ── Piercing Spotter ──────────────────────────────────────────────────────
  'Piercing Spotter': {
    description: 'Once per activation, pick one enemy within 36" LOS, roll one die — on 4+ place a marker. Friendlies remove markers before rolling to block to get +AP(X) where X is markers removed.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, specialRulesApplied }) => {
        const markers = target?.piercing_spotter_markers ?? 0;
        if (markers <= 0) return {};
        target.piercing_spotter_markers = 0;
        const newAp = (ap ?? 0) + markers;
        specialRulesApplied.push({ rule: 'Piercing Spotter', value: markers, effect: `removed ${markers} marker(s) → +AP(${markers}) → AP(${newAp})` });
        return { ap: newAp };
      },
    },
  },

  // ── Crossing Attack ────────────────────────────────────────────────────────
  'Crossing Attack': {
    description: 'Once per activation, when this model moves through enemy units, pick one and roll X dice — each 6+ deals 1 hit.',
    hooks: {},
  },

  // ── Caster Group ─────────────────────────────────────────────────────────
  'Caster Group': {
    description: 'Pick one model in the unit to have Caster(X) where X equals the total number of models with this rule. On death, transfer spell tokens to another model.',
    hooks: {},
  },

  // ── Spell Conduit ─────────────────────────────────────────────────────────
  'Spell Conduit': {
    description: 'Friendly casters within 12" may cast as if from this model\'s position and get +1 to casting rolls.',
    hooks: {},
  },
};
