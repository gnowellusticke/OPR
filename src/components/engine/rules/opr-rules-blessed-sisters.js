/**
 * rules/opr-rules-blessed-sisters.js
 * Blessed Sisters faction rules from v3.5.2
 */
import { HOOKS } from '../RuleRegistry.js';

export const BLESSED_SISTERS_RULES = {
  // ── Army-Wide: Devout ─────────────────────────────────────────────────────
  Devout: {
    description: 'When attacking, unmodified 6 to hit deals 1 extra hit (original only counts as a 6 for special rules).',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ hitRolls, unit, specialRulesApplied }) => {
        const threshold = unit.hasRule?.('Devout Boost') ? 5 : 6;
        const extraHits = (hitRolls ?? []).filter(r => r >= threshold).length;
        if (extraHits === 0) return {};
        specialRulesApplied.push({ rule: 'Devout', value: extraHits, effect: `${extraHits} extra hit(s) from unmodified ${threshold}+` });
        return { extraHits, extraHitsCountAsSix: false };
      },
    },
  },

  'Devout Boost': {
    description: 'If this model has Devout, extra hits trigger on 5-6 instead of only 6.',
    hooks: {},
  },

  'Devout Boost Aura': {
    description: 'This model and its unit get Devout Boost.',
    hooks: {},
  },

  // ── Guarded ───────────────────────────────────────────────────────────────
  Guarded: {
    description: 'When shot or charged from over 9" away, get +1 to defense rolls.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ attackDistance, isMelee, defense, specialRulesApplied }) => {
        if ((attackDistance ?? 0) <= 9) return {};
        specialRulesApplied.push({ rule: 'Guarded', value: 1, effect: `attacker from ${attackDistance}" (>9") → +1 defense` });
        return { defense: Math.max(2, (defense ?? 6) - 1) };
      },
    },
  },

  'Guarded Buff': {
    description: 'Once per activation, before attacking, pick one friendly unit within 12" — it gets Guarded once.',
    hooks: {},
  },

  // ── Piercing Assault ──────────────────────────────────────────────────────
  'Piercing Assault': {
    description: 'Gets AP(+1) when charging.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ isCharging, ap, isMelee, specialRulesApplied }) => {
        if (!isMelee || !isCharging) return {};
        specialRulesApplied.push({ rule: 'Piercing Assault', value: 1, effect: 'AP+1 when charging' });
        return { ap: (ap ?? 0) + 1 };
      },
    },
  },

  // ── Piercing Hunter ───────────────────────────────────────────────────────
  'Piercing Hunter': {
    description: 'When shooting at enemies over 9" away, weapons get AP(+1).',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ attackDistance, isMelee, ap, specialRulesApplied }) => {
        if (isMelee || (attackDistance ?? 0) <= 9) return {};
        specialRulesApplied.push({ rule: 'Piercing Hunter', value: 1, effect: `AP+1 shooting target at ${attackDistance}" (>9")` });
        return { ap: (ap ?? 0) + 1 };
      },
    },
  },

  // ── Point-Blank Piercing / Aura ───────────────────────────────────────────
  'Point-Blank Piercing': {
    description: 'Gets AP(+1) when shooting enemies within 12".',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ attackDistance, isMelee, ap, specialRulesApplied }) => {
        if (isMelee || (attackDistance ?? Infinity) > 12) return {};
        specialRulesApplied.push({ rule: 'Point-Blank Piercing', value: 1, effect: `AP+1 shooting within 12" (${attackDistance}")` });
        return { ap: (ap ?? 0) + 1 };
      },
    },
  },

  'Point-Blank Piercing Aura': {
    description: 'This model and its unit get Point-Blank Piercing.',
    hooks: {},
  },

  // ── Point-Blank Surge ─────────────────────────────────────────────────────
  'Point-Blank Surge': {
    description: 'When shooting at enemies within 12", unmodified 6 to hit deals 1 extra hit (no chain).',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ hitRolls, attackDistance, isMelee, specialRulesApplied }) => {
        if (isMelee || (attackDistance ?? Infinity) > 12) return {};
        const extraHits = (hitRolls ?? []).filter(r => r === 6).length;
        if (extraHits === 0) return {};
        specialRulesApplied.push({ rule: 'Point-Blank Surge', value: extraHits, effect: `${extraHits} extra hit(s) from 6s within 12"` });
        return { extraHits, extraHitsCountAsSix: false };
      },
    },
  },

  // ── Casting Debuff ────────────────────────────────────────────────────────
  'Casting Debuff': {
    description: 'Once per activation, pick one enemy Caster within 18" — it gets -1 to casting rolls once.',
    hooks: {},
  },

  // ── Courage Buff / Aura ───────────────────────────────────────────────────
  'Courage Buff': {
    description: 'Once per activation, pick one friendly unit within 12" — it gets +1 to morale rolls once.',
    hooks: {},
  },

  'Courage Aura': {
    description: 'This model and its unit get +1 to morale test rolls permanently.',
    hooks: {
      [HOOKS.ON_MORALE_TEST]: ({ roll, specialRulesApplied }) => {
        specialRulesApplied.push({ rule: 'Courage Aura', value: 1, effect: '+1 to morale roll (aura)' });
        return { roll: roll + 1 };
      },
    },
  },

  // ── Precision Shooter Buff ────────────────────────────────────────────────
  'Precision Shooter Buff': {
    description: 'Once per activation, pick one friendly unit within 12" — it gets +1 to hit when shooting once.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, isMelee, specialRulesApplied }) => {
        if (isMelee || !unit.precision_shooter_buff_active) return {};
        unit.precision_shooter_buff_active = false;
        specialRulesApplied.push({ rule: 'Precision Shooter Buff', value: 1, effect: '+1 to hit (shooting, buffed)' });
        return { quality: Math.max(2, quality - 1) };
      },
    },
  },

  // ── Precision Fighter Buff ────────────────────────────────────────────────
  'Precision Fighter Buff': {
    description: 'Once per activation, pick one friendly unit within 12" — it gets +1 to hit in melee once.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, isMelee, specialRulesApplied }) => {
        if (!isMelee || !unit.precision_fighter_buff_active) return {};
        unit.precision_fighter_buff_active = false;
        specialRulesApplied.push({ rule: 'Precision Fighter Buff', value: 1, effect: '+1 to hit (melee, buffed)' });
        return { quality: Math.max(2, quality - 1) };
      },
    },
  },

  // ── Precision Target(X) ───────────────────────────────────────────────────
  'Precision Target': {
    description: 'Once per game, place X markers on an enemy within 36" LOS. Friendlies get +X to hit rolls when attacking it.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ target, quality, specialRulesApplied }) => {
        const markers = target?.precision_target_markers ?? 0;
        if (markers <= 0) return {};
        target.precision_target_markers = 0;
        specialRulesApplied.push({ rule: 'Precision Target', value: markers, effect: `+${markers} to hit (precision target markers)` });
        return { quality: Math.max(2, quality - markers) };
      },
    },
  },

  // ── Purge ─────────────────────────────────────────────────────────────────
  Purge: {
    description: 'Ignores Regeneration. Against units where most models have Defense 2+ to 4+, gets AP(+1).',
    hooks: {
      [HOOKS.ON_INCOMING_WOUNDS]: ({ specialRulesApplied }) => {
        specialRulesApplied.push({ rule: 'Purge', value: null, effect: 'Regeneration suppressed' });
        return { suppressRegeneration: true };
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ targetDefense, ap, specialRulesApplied }) => {
        if ((targetDefense ?? 7) < 2 || (targetDefense ?? 7) > 4) return {};
        specialRulesApplied.push({ rule: 'Purge', value: 1, effect: `AP+1 vs Defense ${targetDefense}+ target` });
        return { ap: (ap ?? 0) + 1 };
      },
    },
  },

  // ── Fast Aura ─────────────────────────────────────────────────────────────
  'Fast Aura': {
    description: 'This model and its unit move +2" on Advance and +4" on Rush/Charge.',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ action, speedDelta, specialRulesApplied }) => {
        const delta = action === 'Advance' ? 2 : 4;
        specialRulesApplied.push({ rule: 'Fast Aura', value: delta, effect: `+${delta}" movement (Fast Aura)` });
        return { speedDelta: (speedDelta ?? 0) + delta };
      },
    },
  },

  // ── Fortified / Aura ──────────────────────────────────────────────────────
  Fortified: {
    description: 'Incoming hits count as AP(-1), minimum AP(0).',
    hooks: {
      [HOOKS.ON_INCOMING_WOUNDS]: ({ ap, specialRulesApplied }) => {
        const newAp = Math.max(0, (ap ?? 0) - 1);
        specialRulesApplied.push({ rule: 'Fortified', value: -1, effect: `AP reduced from ${ap} to ${newAp}` });
        return { ap: newAp };
      },
    },
  },

  'Fortified Aura': {
    description: 'This model and its unit get Fortified.',
    hooks: {},
  },
};
