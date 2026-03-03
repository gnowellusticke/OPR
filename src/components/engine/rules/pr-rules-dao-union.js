/**
 * rules/opr-rules-dao-union.js
 * DAO Union faction rules from v3.5.2
 */
import { HOOKS } from '../RuleRegistry.js';

export const DAO_UNION_RULES = {
  // ── Army-Wide: Targeting Visor ────────────────────────────────────────────
  'Targeting Visor': {
    description: 'When shooting at enemies over 9" away, gets +1 to hit rolls.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, target, weapon, quality, specialRulesApplied, calculateDistance }) => {
        if (!target || !calculateDistance || (weapon?.range ?? 0) <= 2) return {};
        const dist = calculateDistance(unit, target);
        if (dist <= 9) return {};
        specialRulesApplied.push({ rule: 'Targeting Visor', value: null, effect: '+1 to hit at 9"+ range (quality -1)' });
        return { quality: Math.max(2, quality - 1) };
      },
    },
  },

  'Targeting Visor Boost': {
    description: 'Always gets +1 to hit rolls when shooting (not just over 9").',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ weapon, quality, specialRulesApplied }) => {
        if ((weapon?.range ?? 0) <= 2) return {};
        specialRulesApplied.push({ rule: 'Targeting Visor Boost', value: null, effect: '+1 to hit when shooting' });
        return { quality: Math.max(2, quality - 1) };
      },
    },
  },

  'Targeting Visor Boost Aura': {
    description: 'This model and its unit get Targeting Visor Boost.',
    hooks: {},
  },

  // ── Good Shot ─────────────────────────────────────────────────────────────
  'Good Shot': {
    description: 'This model gets +1 to hit rolls when shooting.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ weapon, quality, specialRulesApplied }) => {
        if ((weapon?.range ?? 0) <= 2) return {};
        specialRulesApplied.push({ rule: 'Good Shot', value: null, effect: '+1 to hit when shooting' });
        return { quality: Math.max(2, quality - 1) };
      },
    },
  },

  // ── Evasive ───────────────────────────────────────────────────────────────
  Evasive: {
    description: 'Enemies get -1 to hit rolls when attacking this unit.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ quality, specialRulesApplied }) => {
        specialRulesApplied.push({ rule: 'Evasive', value: null, effect: 'enemy -1 to hit (quality +1)' });
        return { quality: Math.min(6, quality + 1) };
      },
    },
  },

  // ── Fortified ─────────────────────────────────────────────────────────────
  Fortified: {
    description: 'Hits against this unit count as AP(-1), min AP(0).',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ ap, specialRulesApplied }) => {
        const currentAp = ap ?? 0;
        if (currentAp <= 0) return {};
        const reducedAp = Math.max(0, currentAp - 1);
        specialRulesApplied.push({ rule: 'Fortified', value: null, effect: `AP ${currentAp}→${reducedAp}` });
        return { ap: reducedAp };
      },
    },
  },

  'Fortified Aura': {
    description: 'This model and its unit get Fortified.',
    hooks: {},
  },

  // ── Decimate ──────────────────────────────────────────────────────────────
  Decimate: {
    description: 'Ignores cover. Against Defense 2+-3+ targets, gains AP(+2).',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, specialRulesApplied }) => {
        if (!target) return {};
        const defense = target.defense ?? 4;
        if (defense <= 3) {
          const newAp = (ap ?? 0) + 2;
          specialRulesApplied.push({ rule: 'Decimate', value: null, effect: `+AP(2) vs Defense ${defense}+ target → AP(${newAp})` });
          return { ap: newAp, ignoresCover: true };
        }
        return { ignoresCover: true };
      },
    },
  },

  // ── Slayer variants ───────────────────────────────────────────────────────
  Slayer: {
    description: 'This model\'s weapons get AP(+2) against units where most models have Tough(3) or higher.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, specialRulesApplied }) => {
        if (!target) return {};
        const sr = Array.isArray(target.special_rules)
          ? target.special_rules.join(' ')
          : (target.special_rules || '');
        const m = sr.match(/Tough\((\d+)\)/);
        if (!m || parseInt(m[1]) < 3) return {};
        const newAp = (ap ?? 0) + 2;
        specialRulesApplied.push({ rule: 'Slayer', value: null, effect: `+AP(2) vs Tough(${m[1]}) target → AP(${newAp})` });
        return { ap: newAp };
      },
    },
  },

  'Ranged Slayer': {
    description: 'This model\'s ranged weapons get AP(+2) against units where most models have Tough(3) or higher.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, isMelee, specialRulesApplied }) => {
        if (isMelee || !target) return {};
        const sr = Array.isArray(target.special_rules)
          ? target.special_rules.join(' ')
          : (target.special_rules || '');
        const m = sr.match(/Tough\((\d+)\)/);
        if (!m || parseInt(m[1]) < 3) return {};
        const newAp = (ap ?? 0) + 2;
        specialRulesApplied.push({ rule: 'Ranged Slayer', value: null, effect: `+AP(2) vs Tough(${m[1]}) target (ranged) → AP(${newAp})` });
        return { ap: newAp };
      },
    },
  },

  'Ranged Slayer Aura': {
    description: 'This model and its unit get Ranged Slayer.',
    hooks: {},
  },

  // ── Counter-Attack ────────────────────────────────────────────────────────
  'Counter-Attack': {
    description: 'Strikes first when charged.',
    hooks: {},
  },

  'Counter-Attack Aura': {
    description: 'This model and its unit get Counter-Attack.',
    hooks: {},
  },

  // ── Melee Shrouding ───────────────────────────────────────────────────────
  'Melee Shrouding': {
    description: 'Enemies get -3" movement when trying to charge this unit.',
    hooks: {},
  },

  'Melee Shrouding Aura': {
    description: 'This model and its unit get Melee Shrouding.',
    hooks: {},
  },

  // ── Strafing ──────────────────────────────────────────────────────────────
  Strafing: {
    description: 'Once per activation, when this model moves through enemy units, attack one with this weapon as if shooting.',
    hooks: {},
  },

  // ── Precision Spotter ─────────────────────────────────────────────────────
  'Precision Spotter': {
    description: 'Once per activation, pick one enemy within 36" LOS and roll one die — on 4+ place a marker. Friendlies remove markers before rolling to hit for +X to hit.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, target, quality, specialRulesApplied }) => {
        if (!target || !unit._precisionTarget) return {};
        const markers = target.precision_markers ?? 0;
        if (markers <= 0 || unit._precisionTarget !== target.id) return {};
        target.precision_markers = 0;
        specialRulesApplied.push({ rule: 'Precision Spotter', value: markers, effect: `removed ${markers} marker(s) → quality -${markers}` });
        return { quality: Math.max(2, quality - markers) };
      },
    },
  },

  // ── Piercing Shooting Mark ────────────────────────────────────────────────
  'Piercing Shooting Mark': {
    description: 'Once per activation, pick one enemy within 18" — friendlies get AP(+1) when shooting against it.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, isMelee, specialRulesApplied }) => {
        if (isMelee || !target) return {};
        const bonus = target?.piercing_shooting_ap_bonus ?? 0;
        if (bonus <= 0) return {};
        const newAp = (ap ?? 0) + bonus;
        specialRulesApplied.push({ rule: 'Piercing Shooting Mark', value: bonus, effect: `+AP(${bonus}) from mark (shooting) → AP(${newAp})` });
        return { ap: newAp };
      },
    },
  },

  // ── Ambush Beacon ─────────────────────────────────────────────────────────
  'Ambush Beacon': {
    description: 'Friendly units using Ambush may ignore distance restrictions from enemies if deployed within 6" of this model.',
    hooks: {},
  },

  // ── Increased Shooting Range ──────────────────────────────────────────────
  'Increased Shooting Range': {
    description: '+6" to weapon range when shooting.',
    hooks: {
      [HOOKS.BEFORE_RANGE_CHECK]: ({ specialRulesApplied }) => {
        specialRulesApplied.push({ rule: 'Increased Shooting Range', value: 6, effect: '+6" weapon range' });
        return { effectiveRangeBonus: 6 };
      },
    },
  },

  'Increased Shooting Range Aura': {
    description: 'This model and its unit get +6" range when shooting.',
    hooks: {},
  },
};
