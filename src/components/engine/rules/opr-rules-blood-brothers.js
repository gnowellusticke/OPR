/**
 * rules/opr-rules-blood-brothers.js
 * Blood Brothers faction rules from v3.5.2
 */
import { HOOKS } from '../RuleRegistry.js';

export const BLOOD_BROTHERS_RULES = {
  // Army-wide
  Bloodborn: {
    description: 'Each unmodified 6 to hit generates +1 attack (no chain).',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ rolls, successes, isMelee, specialRulesApplied }) => {
        // This rule applies to all attacks, not just melee.
        const sixes = rolls.filter(r => r.value === 6 && r.success && !r.auto).length;
        if (sixes === 0) return {};
        specialRulesApplied.push({ rule: 'Bloodborn', value: sixes, effect: `${sixes} extra attacks` });
        return { extraAttacks: sixes, noChainExtraAttacks: true };
      },
    },
  },

  // Special rules (shared with Battle Brothers, but we'll redefine with same implementations)
  Evasive: {
    description: 'Enemies get -1 to hit when attacking this unit.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ target, quality, specialRulesApplied }) => {
        if (target?.rules?.includes('Evasive')) {
          specialRulesApplied.push({ rule: 'Evasive', effect: '-1 to hit' });
          return { quality: Math.min(6, quality + 1) };
        }
        return {};
      },
    },
  },

  'Melee Shrouding': {
    description: 'Enemies get -3" movement when trying to charge this unit.',
    hooks: {
      // Same comment as Battle Brothers; requires engine support.
    },
  },

  Mend: {
      description: 'Once per activation, remove D3 wounds from a friendly Tough model within 3".',
      hooks: {
        [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, dice, specialRulesApplied }) => {
          if (unit._mendUsed) return {};
          const targets = gameState.units.filter(u => u.owner === unit.owner && Math.hypot(u.x - unit.x, u.y - unit.y) <= 3 && (u.tough_per_model || 1) > 1 && u.current_models < u.total_models);
          if (targets.length === 0 && (unit.tough_per_model || 1) > 1 && unit.current_models < unit.total_models) {
            targets.push(unit);
          }
          if (targets.length > 0) {
            const target = targets[0];
            const heal = dice.roll() % 3 + 1;
            target.current_models = Math.min(target.total_models, target.current_models + heal);
            unit._mendUsed = true;
            specialRulesApplied.push({ rule: 'Mend', effect: `healed ${heal} wound(s) on ${target.name}` });
          }
          return {};
        },
      },
    },

  'Piercing Assault': {
    description: 'AP+1 when charging.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ isCharging, ap, specialRulesApplied }) => {
        if (!isCharging) return {};
        specialRulesApplied.push({ rule: 'Piercing Assault', effect: 'AP+1' });
        return { ap: (ap ?? 0) + 1 };
      },
    },
  },

  'Rapid Rush': {
    description: '+6" when using Rush actions.',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ action, speedDelta, specialRulesApplied }) => {
        if (action === 'Rush') {
          specialRulesApplied.push({ rule: 'Rapid Rush', effect: '+6"' });
          return { speedDelta: (speedDelta ?? 0) + 6 };
        }
        return {};
      },
    },
  },

'Re-Deployment': {
    description: 'After all other units are deployed, you may remove up to two friendly units and deploy them again.',
    hooks: {
      [HOOKS.AFTER_DEPLOYMENT]: ({ gameState, specialRulesApplied }) => {
        const currentPlayer = gameState.active_agent || gameState.currentPlayer;
        const eligibleUnits = gameState.units.filter(u => u.owner === currentPlayer && !u.is_in_reserve);
        if (eligibleUnits.length > 0) {
          specialRulesApplied.push({ rule: 'Re-Deployment', effect: 'may redeploy up to 2 units' });
          return { redeployUnits: eligibleUnits.slice(0, 2) };
        }
        return {};
      },
    },
  },
  
'Re-Position Artillery': {
    description: 'Once per activation, pick one friendly Artillery model within 6" — it may immediately move up to 9".',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._repositionUsed) return {};
        const artillery = gameState.units.find(u => u.owner === unit.owner && u !== unit && Math.hypot(u.x - unit.x, u.y - unit.y) <= 6 && (u.special_rules || '').includes('Artillery'));
        if (artillery) {
          unit._repositionUsed = true;
          specialRulesApplied.push({ rule: 'Re-Position Artillery', effect: `${artillery.name} may move up to 9"` });
          return { repositionUnit: artillery, distance: 9 };
        }
        return {};
      },
    },
  },

  Shielded: {
    description: '+1 defense against non-spell hits.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ isSpell, defense, specialRulesApplied }) => {
        if (isSpell) return {};
        specialRulesApplied.push({ rule: 'Shielded', effect: '+1 defense' });
        return { defense: Math.max(2, defense - 1) };
      },
    },
  },

  Shred: {
    description: 'On unmodified 1 to save, +1 wound.',
    hooks: {
      [HOOKS.ON_PER_HIT]: ({ saveRoll, specialRulesApplied }) => {
        if (saveRoll === 1) {
          specialRulesApplied.push({ rule: 'Shred', effect: 'extra wound' });
          return { extraWounds: 1 };
        }
        return {};
      },
    },
  },

  Smash: {
    description: 'Ignores Regeneration. Against Defense 5+ to 6+, gets Blast(+3).',
    hooks: {
      [HOOKS.ON_INCOMING_WOUNDS]: ({ specialRulesApplied }) => {
        return { suppressRegeneration: true };
      },
      [HOOKS.ON_WOUND_CALC]: ({ target, wounds, specialRulesApplied }) => {
        if (!target) return {};
        const defense = target.defense ?? 6;
        if (defense >= 5 && defense <= 6) {
          const extra = 3;
          specialRulesApplied.push({ rule: 'Smash', effect: `+${extra} wounds (Blast)` });
          return { wounds: wounds + extra };
        }
        return {};
      },
    },
  },

'Unstoppable Shooting Mark': {
    description: 'Once per activation, mark an enemy; friendlies get Unstoppable when shooting against it.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._unstoppableMarkUsed) return {};
        const target = gameState.units.find(u => u.owner !== unit.owner && Math.hypot(u.x - unit.x, u.y - unit.y) <= 18);
        if (target) {
          target.unstoppable_marked = true;
          unit._unstoppableMarkUsed = true;
          specialRulesApplied.push({ rule: 'Unstoppable Shooting Mark', effect: `marked ${target.name}` });
        }
        return {};
      },

  VersatileAttack: {
    description: 'When activated, choose AP+1 or +1 to hit.',
    hooks: {
      [HOOKS.BEFORE_ACTIVATION]: ({ unit, specialRulesApplied }) => {},
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, specialRulesApplied }) => {
        if (unit._versatileMode === 'quality') {
          specialRulesApplied.push({ rule: 'Versatile Attack', effect: '+1 to hit' });
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, ap, specialRulesApplied }) => {
        if (unit._versatileMode === 'ap') {
          specialRulesApplied.push({ rule: 'Versatile Attack', effect: 'AP+1' });
          return { ap: (ap ?? 0) + 1 };
        }
        return {};
      },
      [HOOKS.AFTER_ACTIVATION]: ({ unit }) => {
        delete unit._versatileMode;
      },
    },
  },

  VersatileReach: {
    description: 'When activated, choose +4" range or +2" charge.',
    hooks: {
      [HOOKS.BEFORE_ACTIVATION]: ({ unit, specialRulesApplied }) => {},
      [HOOKS.ON_RANGE_CHECK]: ({ unit, weapon, range, specialRulesApplied }) => {
        if (unit._versatileReachMode === 'range' && (weapon?.range ?? 0) > 2) {
          specialRulesApplied.push({ rule: 'Versatile Reach', effect: '+4" range' });
          return { range: range + 4 };
        }
        return {};
      },
      [HOOKS.MODIFY_SPEED]: ({ unit, action, speedDelta, specialRulesApplied }) => {
        if (unit._versatileReachMode === 'charge' && action === 'Charge') {
          specialRulesApplied.push({ rule: 'Versatile Reach', effect: '+2" charge' });
          return { speedDelta: (speedDelta ?? 0) + 2 };
        }
        return {};
      },
      [HOOKS.AFTER_ACTIVATION]: ({ unit }) => {
        delete unit._versatileReachMode;
      },
    },
  },

  // Auras
  ''Bane in Melee Aura': {
    description: 'This model and its unit get Bane in melee.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if ((unit.special_rules || '').includes('Bane in Melee Aura')) {
          return { additionalRules: ['Bane'] };
        }
        return {};
      },
    },
  },
  'Bane when Shooting Aura': {
    description: 'This model and its unit get Bane when shooting.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if ((unit.special_rules || '').includes('Bane when Shooting Aura')) {
          return { additionalRules: ['Bane'] };
        }
        return {};
      },
    },
  },
  'Courage Aura': {
    description: '+1 to morale test rolls.',
    hooks: {
      [HOOKS.ON_MORALE_TEST]: ({ unit, roll, specialRulesApplied }) => {
        if ((unit.special_rules || '').includes('Courage Aura')) {
          specialRulesApplied.push({ rule: 'Courage Aura', effect: '+1 to morale' });
          return { roll: roll + 1 };
        }
        return {};
      },
    },
  },
  'Melee Shrouding Aura': {
    description: 'This model and its unit get Melee Shrouding.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if ((unit.special_rules || '').includes('Melee Shrouding Aura')) {
          return { additionalRules: ['Melee Shrouding'] };
        }
        return {};
      },
    },
  },
  'Piercing Assault Aura': {
    description: 'This model and its unit get Piercing Assault.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if ((unit.special_rules || '').includes('Piercing Assault Aura')) {
          return { additionalRules: ['Piercing Assault'] };
        }
        return {};
      },
    },
  },
  'Rapid Rush Aura': {
    description: 'This model and its unit get Rapid Rush.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if ((unit.special_rules || '').includes('Rapid Rush Aura')) {
          return { additionalRules: ['Rapid Rush'] };
        }
        return {};
      },
    },
  },
  'Regeneration Aura': {
    description: 'This model and its unit get Regeneration.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if ((unit.special_rules || '').includes('Regeneration Aura')) {
          return { additionalRules: ['Regeneration'] };
        }
        return {};
      },
    },
  },
  'Versatile Reach Aura': {
    description: 'This model and its unit get Versatile Reach.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if ((unit.special_rules || '').includes('Versatile Reach Aura')) {
          return { additionalRules: ['Versatile Reach'] };
        }
        return {};
      },
    },
  },

  // Army spells
  'Blood Sight': {
    description: 'Pick one enemy unit within 18" which gets Unstoppable mark once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          target.unstoppable_marked = true;
          specialRulesApplied.push({ rule: 'Blood Sight', effect: `marked ${target.name}` });
        }
      },
    },
  },
  'Blood Trauma': {
    description: 'Pick one enemy unit within 18" which takes 1 hit with Smash.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Blood Trauma', effect: `1 hit with Smash on ${target.name}` });
          return { extraHits: [{ target, count: 1, ap: 0, smash: true }] };
        }
      },
    },
  },
'Burst of Rage': {
    description: 'Pick up to two friendly units within 12" which get Furious once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u => u.owner === caster.owner && Math.hypot(u.x - caster.x, u.y - caster.y) <= 12).slice(0, 2);
        friendlies.forEach(u => u._tempFurious = true);
        specialRulesApplied.push({ rule: 'Burst of Rage', effect: `gave Furious to ${friendlies.length} units` });
      },
    },
  },
  'Heavenly Lance': {
    description: 'Pick one enemy model within 18" which takes 4 hits with AP(1).',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Heavenly Lance', effect: `4 hits AP1 on ${target.name}` });
          return { extraHits: [{ target, count: 4, ap: 1 }] };
        }
      },
    },
  },
'Blood Dome': {
    description: 'Pick up to three friendly units within 12" which get Evasive once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u => u.owner === caster.owner && Math.hypot(u.x - caster.x, u.y - caster.y) <= 12).slice(0, 3);
        friendlies.forEach(u => u._tempEvasive = true);
        specialRulesApplied.push({ rule: 'Blood Dome', effect: `gave Evasive to ${friendlies.length} units` });
      },
    },
  },
  'Shield Breaker': {
    description: 'Pick one enemy unit within 12" which takes 6 hits with AP(1) and Shred.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Shield Breaker', effect: `6 hits AP1 Shred on ${target.name}` });
          return { extraHits: [{ target, count: 6, ap: 1, shred: true }] };
        }
      },
    },
  },
};
