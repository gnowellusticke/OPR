/**
 * rules/opr-rules-dwarf-guilds.js
 * Dwarf Guilds faction rules from v3.5.2
 */
import { HOOKS } from '../RuleRegistry.js';

export const DWARF_GUILDS_RULES = {
  // ── Army-Wide: Sturdy ─────────────────────────────────────────────────────
  Sturdy: {
    description: 'When shot or charged from over 9" away, get +1 to defense rolls.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ attackDistance, defense, specialRulesApplied }) => {
        if (attackDistance == null || attackDistance <= 9) return {};
        specialRulesApplied.push({ rule: 'Sturdy', value: null, effect: `defense +1 (attacked from ${attackDistance.toFixed(1)}")` });
        return { defense: Math.max(2, (defense ?? 6) - 1) };
      },
    },
  },

  'Sturdy Boost': {
    description: 'Always get +1 to defense rolls from Sturdy, regardless of distance.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ defense, specialRulesApplied }) => {
        specialRulesApplied.push({ rule: 'Sturdy Boost', value: null, effect: 'defense +1 (always)' });
        return { defense: Math.max(2, (defense ?? 6) - 1) };
      },
    },
  },

  'Sturdy Boost Aura': {
    description: 'This model and its unit get Sturdy Boost.',
    hooks: {},
  },

  // ── Quake ─────────────────────────────────────────────────────────────────
  Quake: {
    description: 'Ignores Regeneration. On unmodified 1s to block hits, deals 1 extra wound.',
    hooks: {
      [HOOKS.ON_PER_HIT]: ({ saveRoll, specialRulesApplied }) => {
        if (saveRoll !== 1) return {};
        specialRulesApplied.push({ rule: 'Quake', value: null, effect: 'unmodified 1 to save — +1 extra wound' });
        return { extraWounds: 1 };
      },
      [HOOKS.ON_INCOMING_WOUNDS]: ({ specialRulesApplied }) => {
        specialRulesApplied.push({ rule: 'Quake', value: null, effect: 'Regeneration suppressed' });
        return { suppressRegeneration: true };
      },
    },
  },

  'Quake when Shooting': {
    description: 'This model gets Quake when shooting.',
    hooks: {
      [HOOKS.ON_PER_HIT]: ({ saveRoll, isMelee, specialRulesApplied }) => {
        if (isMelee || saveRoll !== 1) return {};
        specialRulesApplied.push({ rule: 'Quake when Shooting', value: null, effect: 'unmodified 1 to save — +1 extra wound (shooting)' });
        return { extraWounds: 1, suppressRegeneration: true };
      },
    },
  },

  // ── Swift ─────────────────────────────────────────────────────────────────
  Swift: {
    description: 'This model may ignore the Slow rule.',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ unit, speedDelta, specialRulesApplied }) => {
        const hasSlow = (unit.special_rules || '').includes('Slow');
        if (!hasSlow || (speedDelta ?? 0) >= 0) return {};
        specialRulesApplied.push({ rule: 'Swift', value: null, effect: 'Slow penalty cancelled' });
        return { speedDelta: 0 };
      },
    },
  },

  'Swift Aura': {
    description: 'This model and its unit get Swift.',
    hooks: {},
  },

  // ── Unpredictable (all attacks, not just melee) ───────────────────────────
  Unpredictable: {
    description: 'When attacking, roll one die: 1-3 get AP(+1), 4-6 get +1 to hit.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, specialRulesApplied }) => {
        const roll = unit._unpredictableRoll;
        if (roll == null || roll < 4) return {};
        specialRulesApplied.push({ rule: 'Unpredictable', value: null, effect: `rolled ${roll}: +1 to hit` });
        return { quality: Math.max(2, quality - 1) };
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, ap, specialRulesApplied }) => {
        const roll = unit._unpredictableRoll;
        if (roll == null || roll >= 4) return {};
        specialRulesApplied.push({ rule: 'Unpredictable', value: null, effect: `rolled ${roll}: AP+1` });
        return { ap: (ap ?? 0) + 1 };
      },
    },
  },

  'Unpredictable Fighter Aura': {
    description: 'This model and its unit get Unpredictable Fighter.',
    hooks: {},
  },

  // ── Devastating Frenzy ────────────────────────────────────────────────────
  'Devastating Frenzy': {
    description: 'Gain one marker when fully destroying an enemy unit. Each marker gives AP(+1) and +1 defense (max +2).',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, ap, defense, specialRulesApplied }) => {
        const markers = Math.min(2, unit.devastating_frenzy_markers ?? 0);
        if (markers <= 0) return {};
        const newAp = (ap ?? 0) + markers;
        const newDef = Math.max(2, (defense ?? 6) - markers);
        specialRulesApplied.push({ rule: 'Devastating Frenzy', value: markers, effect: `AP+${markers}, defense+${markers} (${markers} kill marker(s))` });
        return { ap: newAp, defense: newDef };
      },
    },
  },

  // ── Ignores Cover ─────────────────────────────────────────────────────────
  'Ignores Cover when Shooting': {
    description: 'Ranged attacks ignore cover bonuses.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ isMelee, specialRulesApplied }) => {
        if (isMelee) return {};
        specialRulesApplied.push({ rule: 'Ignores Cover when Shooting', value: null, effect: 'cover ignored' });
        return { ignoresCover: true };
      },
    },
  },

  'Ignores Cover when Shooting Aura': {
    description: 'This model and its unit get Ignores Cover when shooting.',
    hooks: {},
  },

  // ── Mend ──────────────────────────────────────────────────────────────────
  Mend: {
    description: 'Once per activation, pick one friendly Tough model within 3" and remove D3 wounds from it.',
    hooks: {},
  },

  // ── Re-Position Artillery ─────────────────────────────────────────────────
  'Re-Position Artillery': {
    description: 'Once per activation, pick one friendly Artillery model within 6" — it may immediately move up to 9".',
    hooks: {},
  },

  // ── Speed Debuff ──────────────────────────────────────────────────────────
  'Speed Debuff': {
    description: 'Once per activation, pick one enemy within 18" — it moves -2" on Advance and -4" on Rush/Charge until next activation.',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ unit, action, speedDelta, specialRulesApplied }) => {
        if (!unit.speed_debuff) return {};
        const penalty = action === 'Advance' ? -2 : -4;
        specialRulesApplied.push({ rule: 'Speed Debuff', value: penalty, effect: `${penalty}" movement penalty` });
        return { speedDelta: (speedDelta ?? 0) + penalty };
      },
    },
  },

  // ── Infiltrate Aura ───────────────────────────────────────────────────────
  'Infiltrate Aura': {
    description: 'This model and its unit get Infiltrate.',
    hooks: {},
  },
};
