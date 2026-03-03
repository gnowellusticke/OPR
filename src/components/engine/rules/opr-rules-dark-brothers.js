/**
 * rules/opr-rules-dark-brothers.js
 * Dark Brothers faction rules from v3.5.2
 */
import { HOOKS } from '../RuleRegistry.js';

export const DARK_BROTHERS_RULES = {
  // Army-wide
  Darkborn: {
    description: '+3" range when shooting and +3" when charging.',
    hooks: {
      [HOOKS.ON_RANGE_CHECK]: ({ unit, range, specialRulesApplied }) => {
        if (unit.rules.includes('Darkborn')) {
          specialRulesApplied.push({ rule: 'Darkborn', effect: '+3" range' });
          return { range: range + 3 };
        }
        return {};
      },
      [HOOKS.MODIFY_SPEED]: ({ unit, action, speedDelta, specialRulesApplied }) => {
        if (action === 'Charge' && unit.rules.includes('Darkborn')) {
          specialRulesApplied.push({ rule: 'Darkborn', effect: '+3" charge' });
          return { speedDelta: (speedDelta ?? 0) + 3 };
        }
        return {};
      },
    },
  },

  // Special rules
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
      // This rule reduces the charger's speed. We can hook into MODIFY_SPEED when action is Charge,
      // but we need to know the target. We'll use a separate hook ON_CHARGE_DISTANCE if available.
      // For now, we assume the engine checks this rule in charge movement and reduces speed by 3.
      // We'll just add a marker.
      [HOOKS.MODIFY_SPEED]: ({ unit, action, speedDelta, specialRulesApplied }) => {
        if (action === 'Charge') {
          // Check if the target (the unit being charged) has this rule. Not available here.
          // So we'll rely on the engine to handle it via a dedicated charge distance hook.
          // We'll return a flag that the engine can use.
          return { chargePenalty: 3 }; // This would need to be processed by the engine.
        }
        return {};
      },
    },
  },

  Mend: {
    description: 'Once per activation, remove D3 wounds from a friendly Tough model within 3".',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, dice, specialRulesApplied }) => {
        if (unit._mendUsed) return {};
        const targets = gameState.units.filter(u => u.owner === unit.owner && u.distanceTo(unit) <= 3 && u.tough > 1 && u.current_models < u.total_models);
        if (targets.length === 0 && unit.tough > 1 && unit.current_models < unit.total_models) {
          targets.push(unit);
        }
        if (targets.length > 0) {
          const target = targets[0];
          const heal = dice.roll() % 3 + 1; // D3
          target.current_models = Math.min(target.total_models, target.current_models + heal);
          unit._mendUsed = true;
          specialRulesApplied.push({ rule: 'Mend', effect: `healed ${heal} wound(s) on ${target.name}` });
        }
        return {};
      },
    },
  },

  'Rapid Ambush': {
    description: 'Counts as Ambush, but may be deployed at the start of any round, including the first.',
    hooks: {
      [HOOKS.ON_DEPLOY]: () => ({ isReserve: true, reserveType: 'RapidAmbush' }),
      [HOOKS.ON_RESERVE_ENTRY]: ({ unit, gameState }) => {
        // Standard Ambush placement (≥9" from enemies)
        const enemies = gameState.units.filter(u => u.owner !== unit.owner && u.current_models > 0);
        for (let attempts = 0; attempts < 100; attempts++) {
          const x = Math.random() * 50 + 5;
          const y = Math.random() * 36 + 12;
          if (!enemies.some(e => Math.hypot(e.x - x, e.y - y) < 9)) {
            return { x, y };
          }
        }
        return { x: 30, y: 30 };
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
        const eligibleUnits = gameState.units.filter(u => u.owner === gameState.currentPlayer && !u.is_in_reserve);
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
        const artillery = gameState.units.find(u => u.owner === unit.owner && u !== unit && u.distanceTo(unit) <= 6 && u.rules.includes('Artillery'));
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

  'Stealth Buff': {
    description: 'Once per activation, give a friendly unit Stealth once.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._stealthBuffUsed) return {};
        const friendly = gameState.units.find(u => u.owner === unit.owner && u !== unit && u.distanceTo(unit) <= 12);
        if (friendly) {
          friendly._tempStealth = true;
          unit._stealthBuffUsed = true;
          specialRulesApplied.push({ rule: 'Stealth Buff', effect: `gave Stealth to ${friendly.name}` });
        }
        return {};
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ target, quality, specialRulesApplied }) => {
        if (target._tempStealth) {
          delete target._tempStealth;
          specialRulesApplied.push({ rule: 'Stealth Buff', effect: '-1 to hit' });
          return { quality: Math.min(6, quality + 1) };
        }
        return {};
      },
    },
  },

  Strafing: {
    description: 'Once per activation, when moving through enemies, attack with this weapon.',
    hooks: {
      [HOOKS.ON_MOVE_THROUGH_ENEMY]: ({ unit, enemyUnit, weapon, specialRulesApplied }) => {
        if (unit._strafingUsed) return {};
        unit._strafingUsed = true;
        specialRulesApplied.push({ rule: 'Strafing', effect: `attacking ${enemyUnit.name}` });
        return { strafingAttack: { target: enemyUnit, weapon } };
      },
    },
  },

  'Unstoppable Shooting Mark': {
    description: 'Once per activation, mark an enemy; friendlies get Unstoppable when shooting against it.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._unstoppableMarkUsed) return {};
        const target = gameState.units.find(u => u.owner !== unit.owner && u.distanceTo(unit) <= 18);
        if (target) {
          target.unstoppable_marked = true;
          unit._unstoppableMarkUsed = true;
          specialRulesApplied.push({ rule: 'Unstoppable Shooting Mark', effect: `marked ${target.name}` });
        }
        return {};
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, specialRulesApplied }) => {
        if (target?.unstoppable_marked) {
          delete target.unstoppable_marked;
          specialRulesApplied.push({ rule: 'Unstoppable Shooting Mark', effect: 'AP ignored' });
          return { ap: Math.max(0, ap ?? 0) };
        }
        return {};
      },
    },
  },

  VersatileAttack: {
    description: 'When activated, choose AP+1 or +1 to hit.',
    hooks: {
      [HOOKS.BEFORE_ACTIVATION]: ({ unit, specialRulesApplied }) => {
        // AI sets unit._versatileMode
      },
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
      [HOOKS.BEFORE_ACTIVATION]: ({ unit, specialRulesApplied }) => {
        // AI sets unit._versatileReachMode = 'range' or 'charge'
      },
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
  'Bane in Melee Aura': {
    description: 'This model and its unit get Bane in melee.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.rules.includes('Bane in Melee Aura')) {
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
        if (unit.rules.includes('Bane when Shooting Aura')) {
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
        if (unit.rules.includes('Courage Aura')) {
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
        if (unit.rules.includes('Melee Shrouding Aura')) {
          return { additionalRules: ['Melee Shrouding'] };
        }
        return {};
      },
    },
  },
  'Rapid Rush Aura': {
    description: 'This model and its unit get Rapid Rush.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.rules.includes('Rapid Rush Aura')) {
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
        if (unit.rules.includes('Regeneration Aura')) {
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
        if (unit.rules.includes('Versatile Reach Aura')) {
          return { additionalRules: ['Versatile Reach'] };
        }
        return {};
      },
    },
  },

  // Army spells
  'Dark Sight': {
    description: 'Pick one enemy unit within 18" which gets Unstoppable mark once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          target.unstoppable_marked = true;
          specialRulesApplied.push({ rule: 'Dark Sight', effect: `marked ${target.name}` });
        }
      },
    },
  },
  'Dark Trauma': {
    description: 'Pick one enemy unit within 18" which takes 1 hit with Smash.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Dark Trauma', effect: `1 hit with Smash on ${target.name}` });
          return { extraHits: [{ target, count: 1, ap: 0, smash: true }] };
        }
      },
    },
  },
  'Blessed Ammo': {
    description: 'Pick up to two friendly units within 12" which get Shred when shooting once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u => u.owner === caster.owner && u.distanceTo(caster) <= 12).slice(0, 2);
        friendlies.forEach(u => u._tempShredShooting = true);
        specialRulesApplied.push({ rule: 'Blessed Ammo', effect: `gave Shred to ${friendlies.length} units` });
      },
    },
  },
  'Lightning Fog': {
    description: 'Pick up to two enemy units within 9" which take 4 hits each.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const enemies = gameState.units.filter(u => u.owner !== caster.owner && u.distanceTo(caster) <= 9).slice(0, 2);
        const extraHits = enemies.map(e => ({ target: e, count: 4, ap: 0 }));
        specialRulesApplied.push({ rule: 'Lightning Fog', effect: `4 hits on ${enemies.length} units` });
        return { extraHits };
      },
    },
  },
  'Dark Dome': {
    description: 'Pick up to three friendly units within 12" which get Evasive once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u => u.owner === caster.owner && u.distanceTo(caster) <= 12).slice(0, 3);
        friendlies.forEach(u => u._tempEvasive = true);
        specialRulesApplied.push({ rule: 'Dark Dome', effect: `gave Evasive to ${friendlies.length} units` });
      },
    },
  },
  'Psychic Terror': {
    description: 'Pick one enemy unit within 6" which takes 9 hits with Bane.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Psychic Terror', effect: `9 hits with Bane on ${target.name}` });
          return { extraHits: [{ target, count: 9, ap: 0, bane: true }] };
        }
      },
    },
  },
};
