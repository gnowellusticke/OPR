/**
 * rules/opr-rules-dark-elf-raiders.js
 * Dark Elf Raiders faction rules from v3.5.2
 */
import { HOOKS } from '../RuleRegistry.js';

export const DARK_ELF_RAIDERS_RULES = {
  // ── Army-Wide: Harassing ─────────────────────────────────────────────────
  Harassing: {
    description: 'Once per round, may move up to 3" after shooting or being in melee.',
    hooks: {
      [HOOKS.AFTER_COMBAT]: ({ unit, specialRulesApplied }) => {
        if (unit._harassingUsed) return {};
        specialRulesApplied.push({ rule: 'Harassing', value: null, effect: 'may move up to 3" (once per round)' });
        return { hitAndRunMove: 3 };
      },
      [HOOKS.AFTER_SHOOTING]: ({ unit, specialRulesApplied }) => {
        if (unit._harassingUsed) return {};
        specialRulesApplied.push({ rule: 'Harassing', value: null, effect: 'may move up to 3" after shooting (once per round)' });
        return { hitAndRunMove: 3 };
      },
    },
  },

  'Harassing Boost': {
    description: 'May move up to 6" from Harassing instead of 3".',
    hooks: {
      [HOOKS.AFTER_COMBAT]: ({ unit, specialRulesApplied }) => {
        if (unit._harassingUsed) return {};
        specialRulesApplied.push({ rule: 'Harassing Boost', value: null, effect: 'may move up to 6" (once per round)' });
        return { hitAndRunMove: 6 };
      },
      [HOOKS.AFTER_SHOOTING]: ({ unit, specialRulesApplied }) => {
        if (unit._harassingUsed) return {};
        specialRulesApplied.push({ rule: 'Harassing Boost', value: null, effect: 'may move up to 6" after shooting (once per round)' });
        return { hitAndRunMove: 6 };
      },
    },
  },

  'Harassing Boost Aura': {
    description: 'This model and its unit get Harassing Boost.',
    hooks: {},
  },

  // ── Lacerate ──────────────────────────────────────────────────────────────
  Lacerate: {
    description: 'When attacking, target must re-roll unmodified defense results of 6.',
    hooks: {
      [HOOKS.ON_PER_HIT]: ({ saveRoll, dice, modifiedDefense, specialRulesApplied }) => {
        if (saveRoll !== 6) return {};
        const reroll = dice.roll();
        specialRulesApplied.push({ rule: 'Lacerate', value: null, effect: `defense 6 re-rolled (${saveRoll}→${reroll})` });
        return { rerollResult: reroll, saveSuccess: reroll >= modifiedDefense };
      },
    },
  },

  // ── Melee Evasion ─────────────────────────────────────────────────────────
  'Melee Evasion': {
    description: 'Enemies get -1 to hit rolls in melee when attacking this unit.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ isMelee, quality, specialRulesApplied }) => {
        if (!isMelee) return {};
        specialRulesApplied.push({ rule: 'Melee Evasion', value: null, effect: 'enemy -1 to hit in melee (quality +1)' });
        return { quality: Math.min(6, quality + 1) };
      },
    },
  },

  // ── Melee Slayer ──────────────────────────────────────────────────────────
  'Melee Slayer': {
    description: 'Melee weapons get AP(+2) against units where most models have Tough(3) or higher.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, isMelee, specialRulesApplied }) => {
        if (!isMelee || !target) return {};
        const sr = Array.isArray(target.special_rules)
          ? target.special_rules.join(' ')
          : (target.special_rules || '');
        const m = sr.match(/Tough\((\d+)\)/);
        if (!m || parseInt(m[1]) < 3) return {};
        const newAp = (ap ?? 0) + 2;
        specialRulesApplied.push({ rule: 'Melee Slayer', value: null, effect: `+AP(2) vs Tough(${m[1]}) target (melee) → AP(${newAp})` });
        return { ap: newAp };
      },
    },
  },

  // ── Piercing Hunter ───────────────────────────────────────────────────────
  'Piercing Hunter': {
    description: 'When shooting at enemies over 9" away, weapons get AP(+1).',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, target, ap, isMelee, specialRulesApplied, calculateDistance }) => {
        if (isMelee || !target || !calculateDistance) return {};
        const dist = calculateDistance(unit, target);
        if (dist <= 9) return {};
        const newAp = (ap ?? 0) + 1;
        specialRulesApplied.push({ rule: 'Piercing Hunter', value: null, effect: `+AP(1) at ${dist.toFixed(1)}" range → AP(${newAp})` });
        return { ap: newAp };
      },
    },
  },

  'Piercing Hunter Aura': {
    description: 'This model and its unit get Piercing Hunter.',
    hooks: {},
  },

  // ── Courage Aura ──────────────────────────────────────────────────────────
  'Courage Aura': {
    description: '+1 to morale test rolls for this model and its unit.',
    hooks: {
      [HOOKS.ON_MORALE_TEST]: ({ roll, threshold, specialRulesApplied }) => {
        specialRulesApplied.push({ rule: 'Courage Aura', value: null, effect: '+1 to morale roll' });
        return { roll: (roll ?? 0) + 1 };
      },
    },
  },

  'Furious Aura': {
    description: 'This model and its unit get Furious.',
    hooks: {},
  },

  // ── Martial Prowess ───────────────────────────────────────────────────────
  'Martial Prowess': {
    description: 'Once per game, may activate again even if already activated this round. Only up to half the army\'s units with this rule may use it in a single round.',
    hooks: {},
  },

  // ── Ruinous Frenzy ────────────────────────────────────────────────────────
  'Ruinous Frenzy': {
    description: 'Gain one marker when fully destroying an enemy unit. Each marker gives +1 to hit and +1 defense (max +2).',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, specialRulesApplied }) => {
        const markers = Math.min(2, unit.ruinous_frenzy_markers ?? 0);
        if (markers <= 0) return {};
        specialRulesApplied.push({ rule: 'Ruinous Frenzy', value: markers, effect: `+${markers} to hit rolls` });
        return { quality: Math.max(2, quality - markers) };
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, defense, specialRulesApplied }) => {
        const markers = Math.min(2, unit.ruinous_frenzy_markers ?? 0);
        if (markers <= 0) return {};
        specialRulesApplied.push({ rule: 'Ruinous Frenzy', value: markers, effect: `+${markers} to defense rolls` });
        return { defense: Math.max(2, (defense ?? 6) - markers) };
      },
    },
  },

  // ── Regeneration Buff ─────────────────────────────────────────────────────
  'Regeneration Buff': {
    description: 'Once per activation, pick one friendly unit within 12" — it gets Regeneration once.',
    hooks: {},
  },

  // ── Regenerative Strength ─────────────────────────────────────────────────
  'Regenerative Strength': {
    description: 'Gain one marker each time a wound is ignored. In melee, one weapon gets +X attacks where X is marker count.',
    hooks: {},
  },

  // ── Precision Fighting Mark ───────────────────────────────────────────────
  'Precision Fighting Mark': {
    description: 'Once per activation, pick one enemy within 18" — friendlies get +1 to hit in melee against it.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ target, isMelee, quality, specialRulesApplied }) => {
        if (!isMelee || !target?.precision_fighting_marked) return {};
        specialRulesApplied.push({ rule: 'Precision Fighting Mark', value: null, effect: '+1 to hit in melee vs marked target' });
        return { quality: Math.max(2, quality - 1) };
      },
    },
  },

  // ── Speed Boost ───────────────────────────────────────────────────────────
  'Speed Boost': {
    description: '+2" on Advance, +4" on Rush/Charge.',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ action, specialRulesApplied }) => {
        const delta = action === 'Advance' ? 2 : 4;
        specialRulesApplied.push({ rule: 'Speed Boost', value: delta, effect: `+${delta}" movement` });
        return { speedDelta: delta };
      },
    },
  },
};
