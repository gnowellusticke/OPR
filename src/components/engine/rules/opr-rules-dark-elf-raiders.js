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
      [HOOKS.AFTER_MELEE]: ({ unit, specialRulesApplied }) => {
        if (unit._harassingUsed) return {};
        unit._harassingUsed = true;
        specialRulesApplied.push({ rule: 'Harassing', effect: 'may move up to 3" after melee' });
        return { hitAndRunMove: 3 };
      },
      [HOOKS.AFTER_SHOOTING]: ({ unit, specialRulesApplied }) => {
        if (unit._harassingUsed) return {};
        unit._harassingUsed = true;
        specialRulesApplied.push({ rule: 'Harassing', effect: 'may move up to 3" after shooting' });
        return { hitAndRunMove: 3 };
      },
    },
  },

  'Harassing Boost': {
    description: 'May move up to 6" from Harassing instead of 3".',
    hooks: {
      [HOOKS.AFTER_MELEE]: ({ unit, specialRulesApplied }) => {
        if (unit._harassingUsed) return {};
        unit._harassingUsed = true;
        specialRulesApplied.push({ rule: 'Harassing Boost', effect: 'may move up to 6" after melee' });
        return { hitAndRunMove: 6 };
      },
      [HOOKS.AFTER_SHOOTING]: ({ unit, specialRulesApplied }) => {
        if (unit._harassingUsed) return {};
        unit._harassingUsed = true;
        specialRulesApplied.push({ rule: 'Harassing Boost', effect: 'may move up to 6" after shooting' });
        return { hitAndRunMove: 6 };
      },
    },
  },

  'Harassing Boost Aura': {
    description: 'This model and its unit get Harassing Boost.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.rules.includes('Harassing Boost Aura')) {
          return { additionalRules: ['Harassing Boost'] };
        }
        return {};
      },
    },
  },

  // ── Lacerate ──────────────────────────────────────────────────────────────
  Lacerate: {
    description: 'When attacking, target must re-roll unmodified defense results of 6.',
    hooks: {
      [HOOKS.ON_PER_HIT]: ({ saveRoll, dice, modifiedDefense, specialRulesApplied }) => {
        if (saveRoll !== 6) return {};
        const reroll = dice.roll();
        specialRulesApplied.push({ rule: 'Lacerate', effect: `defense 6 re-rolled (${saveRoll}→${reroll})` });
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
        specialRulesApplied.push({ rule: 'Melee Evasion', effect: 'enemy -1 to hit in melee' });
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
        specialRulesApplied.push({ rule: 'Melee Slayer', effect: `+AP(2) vs Tough(${m[1]}) target → AP(${newAp})` });
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
        specialRulesApplied.push({ rule: 'Piercing Hunter', effect: `+AP(1) at ${dist.toFixed(1)}" range → AP(${newAp})` });
        return { ap: newAp };
      },
    },
  },

  'Piercing Hunter Aura': {
    description: 'This model and its unit get Piercing Hunter.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.rules.includes('Piercing Hunter Aura')) {
          return { additionalRules: ['Piercing Hunter'] };
        }
        return {};
      },
    },
  },

  // ── Courage Aura ──────────────────────────────────────────────────────────
  'Courage Aura': {
    description: '+1 to morale test rolls for this model and its unit.',
    hooks: {
      [HOOKS.ON_MORALE_TEST]: ({ roll, specialRulesApplied }) => {
        specialRulesApplied.push({ rule: 'Courage Aura', effect: '+1 to morale roll' });
        return { roll: (roll ?? 0) + 1 };
      },
    },
  },

  'Furious Aura': {
    description: 'This model and its unit get Furious.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.rules.includes('Furious Aura')) {
          return { additionalRules: ['Furious'] };
        }
        return {};
      },
    },
  },

  // ── Martial Prowess ───────────────────────────────────────────────────────
  'Martial Prowess': {
    description: 'Once per game, may activate again even if already activated this round. Only up to half the army\'s units with this rule may use it in a single round.',
    hooks: {
      // This rule requires tracking at the game level. The engine should have a way to allow re-activation.
      // We'll add a flag to the unit and check a global counter.
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._martialProwessUsed) return {};
        // Check if unit has already activated this round
        if (!gameState.units_activated.includes(unit.id)) return {};
        // Check global counter
        const totalWithRule = gameState.units.filter(u => u.owner === unit.owner && u.rules.includes('Martial Prowess')).length;
        const usedThisRound = gameState._martialProwessCount || 0;
        if (usedThisRound >= Math.floor(totalWithRule / 2)) return {};
        // Allow reactivation
        unit._martialProwessUsed = true;
        gameState._martialProwessCount = (gameState._martialProwessCount || 0) + 1;
        // Remove unit from activated set so scheduler picks it again
        gameState.units_activated = gameState.units_activated.filter(id => id !== unit.id);
        specialRulesApplied.push({ rule: 'Martial Prowess', effect: 'reactivates this round' });
        return {}; // No direct modification, but we changed gameState
      },
    },
  },

  // ── Ruinous Frenzy ────────────────────────────────────────────────────────
  'Ruinous Frenzy': {
    description: 'Gain one marker when fully destroying an enemy unit. Each marker gives +1 to hit and +1 defense (max +2).',
    hooks: {
      [HOOKS.ON_MODEL_KILLED]: ({ unit, killer, gameState }) => {
        if (killer && killer.rules.includes('Ruinous Frenzy')) {
          killer.ruinous_frenzy_markers = Math.min(2, (killer.ruinous_frenzy_markers || 0) + 1);
        }
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, specialRulesApplied }) => {
        const markers = Math.min(2, unit.ruinous_frenzy_markers ?? 0);
        if (markers <= 0) return {};
        specialRulesApplied.push({ rule: 'Ruinous Frenzy', value: markers, effect: `+${markers} to hit` });
        return { quality: Math.max(2, quality - markers) };
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, defense, specialRulesApplied }) => {
        const markers = Math.min(2, unit.ruinous_frenzy_markers ?? 0);
        if (markers <= 0) return {};
        specialRulesApplied.push({ rule: 'Ruinous Frenzy', value: markers, effect: `+${markers} defense` });
        return { defense: Math.max(2, (defense ?? 6) - markers) };
      },
    },
  },

  // ── Regeneration Buff ─────────────────────────────────────────────────────
  'Regeneration Buff': {
    description: 'Once per activation, pick one friendly unit within 12" — it gets Regeneration once.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._regenerationBuffUsed) return {};
        // Find a friendly unit (simplest: the nearest)
        const friendly = gameState.units.find(u => u.owner === unit.owner && u !== unit && u.distanceTo(unit) <= 12);
        if (friendly) {
          friendly._tempRegeneration = true;
          unit._regenerationBuffUsed = true;
          specialRulesApplied.push({ rule: 'Regeneration Buff', effect: `gave Regeneration to ${friendly.name}` });
        }
        return {};
      },
      [HOOKS.ON_INCOMING_WOUNDS]: ({ unit, wounds, dice, specialRulesApplied }) => {
        if (!unit._tempRegeneration) return {};
        delete unit._tempRegeneration;
        let ignored = 0;
        for (let i = 0; i < wounds; i++) {
          if (dice.roll() >= 5) ignored++;
        }
        if (ignored > 0) {
          specialRulesApplied.push({ rule: 'Regeneration Buff (applied)', effect: `ignored ${ignored}/${wounds} wounds` });
          return { wounds: wounds - ignored };
        }
        return {};
      },
    },
  },

  // ── Regenerative Strength ─────────────────────────────────────────────────
  'Regenerative Strength': {
    description: 'Gain one marker each time a wound is ignored. In melee, one weapon gets +X attacks where X is marker count.',
    hooks: {
      [HOOKS.ON_INCOMING_WOUNDS]: ({ unit, wounds, ignored }) => {
        if (unit.rules.includes('Regenerative Strength') && ignored > 0) {
          unit.regenerative_strength_markers = (unit.regenerative_strength_markers || 0) + ignored;
        }
      },
      [HOOKS.BEFORE_MELEE_ATTACK]: ({ unit, specialRulesApplied }) => {
        if (unit.rules.includes('Regenerative Strength') && unit.regenerative_strength_markers > 0) {
          const markers = unit.regenerative_strength_markers;
          // Apply extra attacks to the first melee weapon (simplified)
          specialRulesApplied.push({ rule: 'Regenerative Strength', value: markers, effect: `+${markers} attacks` });
          return { extraAttacks: markers };
        }
        return {};
      },
    },
  },

  // ── Precision Fighting Mark ───────────────────────────────────────────────
  'Precision Fighting Mark': {
    description: 'Once per activation, pick one enemy within 18" — friendlies get +1 to hit in melee against it.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._precisionFightingMarkUsed) return {};
        const target = gameState.units.find(u => u.owner !== unit.owner && u.distanceTo(unit) <= 18);
        if (target) {
          target.precision_fighting_marked = true;
          unit._precisionFightingMarkUsed = true;
          specialRulesApplied.push({ rule: 'Precision Fighting Mark', effect: `marked ${target.name}` });
        }
        return {};
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ target, isMelee, quality, specialRulesApplied }) => {
        if (isMelee && target?.precision_fighting_marked) {
          delete target.precision_fighting_marked;
          specialRulesApplied.push({ rule: 'Precision Fighting Mark', effect: '+1 to hit' });
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
    },
  },

  // ── Speed Boost ───────────────────────────────────────────────────────────
  'Speed Boost': {
    description: '+2" on Advance, +4" on Rush/Charge.',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ action, specialRulesApplied }) => {
        const delta = action === 'Advance' ? 2 : 4;
        specialRulesApplied.push({ rule: 'Speed Boost', value: delta, effect: `+${delta}"` });
        return { speedDelta: delta };
      },
    },
  },
};
