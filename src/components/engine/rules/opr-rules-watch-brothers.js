/**
 * rules/opr-rules-watch-brothers.js
 * Watch Brothers faction rules from v3.5.2 (page 3)
 * Uses the enhanced RulesEngine with generic weapon info.
 */

import { HOOKS } from '../RuleRegistry.js';
import { Dice } from './Dice.js';

export const WATCH_BROTHERS_RULES = {
  // -------------------------------------------------------------------------
  // Army‑wide rule
  // -------------------------------------------------------------------------
  Watchborn: {
    description: 'When this unit is activated, pick one effect: until the end of the activation all models with this rule in it either get AP(+1) when attacking, or get +1 to hit rolls when attacking.',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, specialRulesApplied }) => {
        // In a real game, player chooses. We'll default to 'hit' for demo.
        const mode = 'hit';
        unit._watchbornMode = mode;
        specialRulesApplied.push({ rule: 'Watchborn', effect: `mode = ${mode}` });
        return { setVersatileMode: mode }; // reuse versatile mode handling
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, specialRulesApplied }) => {
        if (unit._watchbornMode === 'hit') {
          specialRulesApplied.push({ rule: 'Watchborn', effect: '+1 to hit' });
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, ap, specialRulesApplied }) => {
        if (unit._watchbornMode === 'ap') {
          specialRulesApplied.push({ rule: 'Watchborn', effect: 'AP+1' });
          return { ap: (ap ?? 0) + 1 };
        }
        return {};
      },
      [HOOKS.ON_ACTIVATION_END]: ({ unit }) => {
        delete unit._watchbornMode;
      },
    },
  },

  // -------------------------------------------------------------------------
  // Special rules
  // -------------------------------------------------------------------------
  Evasive: {
    description: 'Enemies get -1 to hit rolls when attacking units where all models have this rule.',
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
    description: 'Enemies get -3" movement when trying to charge units where all models have this rule.',
    hooks: {
      // This hook modifies the charging unit's speed. We assume ctx.target is the unit being charged.
      [HOOKS.MODIFY_SPEED]: ({ action, target, speedDelta, specialRulesApplied }) => {
        if (action === 'Charge' && target?.rules?.includes('Melee Shrouding')) {
          specialRulesApplied.push({ rule: 'Melee Shrouding', effect: '-3" charge' });
          return { speedDelta: (speedDelta ?? 0) - 3 };
        }
        return {};
      },
    },
  },

  Mend: {
    description: 'Once per activation, before attacking, pick one friendly model within 3" with Tough, and remove D3 wounds from it.',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, gameState, dice, specialRulesApplied }) => {
        if (unit._mendUsed) return {};
        const target = gameState.units.find(u =>
          u.owner === unit.owner &&
          u.distanceTo(unit) <= 3 &&
          u.tough > 1 &&
          u.current_models < u.total_models
        );
        if (target) {
          const heal = dice.roll() % 3 + 1; // D3
          unit._mendUsed = true;
          specialRulesApplied.push({ rule: 'Mend', effect: `healed ${heal} on ${target.name}` });
          return { mend: { target, healAmount: heal } };
        }
        return {};
      },
      [HOOKS.ON_ACTIVATION_END]: ({ unit }) => {
        delete unit._mendUsed;
      },
    },
  },

  'Rapid Rush': {
    description: 'This model moves +6" when using Rush actions.',
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
    description: 'Once per activation, pick one friendly model within 6" with Artillery, which may immediately move by up to 9".',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._repositionUsed) return {};
        const artillery = gameState.units.find(u =>
          u.owner === unit.owner &&
          u !== unit &&
          u.distanceTo(unit) <= 6 &&
          u.rules.includes('Artillery')
        );
        if (artillery) {
          unit._repositionUsed = true;
          specialRulesApplied.push({ rule: 'Re-Position Artillery', effect: `${artillery.name} may move 9"` });
          return { repositionUnit: artillery, distance: 9 };
        }
        return {};
      },
      [HOOKS.ON_ACTIVATION_END]: ({ unit }) => {
        delete unit._repositionUsed;
      },
    },
  },

  Shielded: {
    description: 'Units where all models have this rule get +1 to defense rolls against hits that are not from spells.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, defense, fromSpell, specialRulesApplied }) => {
        if (!fromSpell && target?.rules?.includes('Shielded')) {
          specialRulesApplied.push({ rule: 'Shielded', effect: '+1 defense' });
          return { defense: Math.min(6, defense - 1) };
        }
        return {};
      },
    },
  },

  Shred: {
    description: 'On unmodified results of 1 to block hits, this weapon deals 1 extra wound.',
    hooks: {
      [HOOKS.ON_PER_HIT]: ({ weaponRules, saveRoll, specialRulesApplied }) => {
        if (!weaponRules.includes('Shred')) return {};
        if (saveRoll === 1) {
          specialRulesApplied.push({ rule: 'Shred', effect: 'extra wound' });
          return { extraWounds: 1 };
        }
        return {};
      },
    },
  },

  Smash: {
    description: 'Ignores Regeneration, and against units where most models have Defense 5+ to 6+ this weapon gets Blast(+3).',
    hooks: {
      [HOOKS.ON_INCOMING_WOUNDS]: ({ specialRulesApplied }) => {
        specialRulesApplied.push({ rule: 'Smash', effect: 'suppress Regeneration' });
        return { suppressRegeneration: true };
      },
      [HOOKS.AFTER_HIT_ROLLS]: ({ weaponRules, target, successes, specialRulesApplied }) => {
        if (!weaponRules.includes('Smash')) return {};
        if (!target) return {};
        if (target.defense >= 5 && target.defense <= 6) {
          const extra = 3;
          specialRulesApplied.push({ rule: 'Smash', effect: `+${extra} hits (Blast)` });
          return { successes: successes + extra };
        }
        return {};
      },
    },
  },

  Strafing: {
    description: 'Once per activation, when this model moves through enemy units, pick one of them and attack it with this weapon as if it was shooting. This weapon may only be used in this way.',
    hooks: {
      [HOOKS.ON_MOVE_THROUGH_ENEMY]: ({ unit, enemyUnit, gameState, specialRulesApplied }) => {
        if (unit._strafingUsed) return {};
        // Find a weapon with the Strafing rule
        const strafingWeapon = unit.weapons.find(w => w.rules.includes('Strafing'));
        if (strafingWeapon) {
          unit._strafingUsed = true;
          specialRulesApplied.push({ rule: 'Strafing', effect: `shooting at ${enemyUnit.name}` });
          // Resolve a shooting attack with this weapon against the enemy unit
          // The engine should handle this; we return a special action.
          return { strafingAttack: { target: enemyUnit, weapon: strafingWeapon } };
        }
        return {};
      },
      [HOOKS.ON_ACTIVATION_END]: ({ unit }) => {
        delete unit._strafingUsed;
      },
    },
  },

  'Unstoppable Shooting Mark': {
    description: 'Once per activation, before attacking, pick one enemy unit within 18", which friendly units gets Unstoppable when shooting against once.',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._unstoppableMarkUsed) return {};
        const target = gameState.units.find(u => u.owner !== unit.owner && u.distanceTo(unit) <= 18);
        if (target) {
          target._unstoppableMarked = true;
          unit._unstoppableMarkUsed = true;
          specialRulesApplied.push({ rule: 'Unstoppable Shooting Mark', effect: `marked ${target.name}` });
        }
        return {};
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, specialRulesApplied }) => {
        if (target?._unstoppableMarked) {
          delete target._unstoppableMarked;
          // Unstoppable: negative AP modifiers don't apply. Set ap to at least 0.
          specialRulesApplied.push({ rule: 'Unstoppable Shooting Mark', effect: 'AP ignored' });
          return { ap: Math.max(0, ap ?? 0) };
        }
        return {};
      },
      [HOOKS.ON_ACTIVATION_END]: ({ unit }) => {
        delete unit._unstoppableMarkUsed;
      },
    },
  },

  'Versatile Reach': {
    description: 'When activated, pick +4" range when shooting, or +2" when charging.',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, specialRulesApplied }) => {
        // Player chooses mode; default 'range'
        const mode = 'range';
        unit._versatileReachMode = mode;
        specialRulesApplied.push({ rule: 'Versatile Reach', effect: `mode = ${mode}` });
        return { setVersatileReach: mode };
      },
      [HOOKS.BEFORE_ATTACK]: ({ unit, weapon, specialRulesApplied }) => {
        if (unit._versatileReachMode === 'range' && (weapon?.range ?? 0) > 2) {
          specialRulesApplied.push({ rule: 'Versatile Reach', effect: '+4" range' });
          return { weaponRangeBonus: 4 };
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
      [HOOKS.ON_ACTIVATION_END]: ({ unit }) => {
        delete unit._versatileReachMode;
      },
    },
  },

  // -------------------------------------------------------------------------
  // Auras
  // -------------------------------------------------------------------------
  'Bane in Melee Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Bane in Melee'] }) },
  },
  'Bane in Melee': {
    // Bane: on 6+ to wound, +1 wound. We'll implement in ON_WOUND_CALC for melee.
    hooks: {
      [HOOKS.ON_WOUND_CALC]: ({ unit, isMelee, unsavedHit, toughPerModel, wounds, specialRulesApplied }) => {
        if (isMelee && unit.special_rules.includes('Bane in Melee') && unsavedHit.value >= 6) {
          specialRulesApplied.push({ rule: 'Bane in Melee', effect: '+1 wound' });
          return { wounds: wounds + 1 };
        }
        return {};
      },
    },
  },

  'Bane when Shooting Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Bane when Shooting'] }) },
  },
  'Bane when Shooting': {
    hooks: {
      [HOOKS.ON_WOUND_CALC]: ({ unit, isMelee, unsavedHit, toughPerModel, wounds, specialRulesApplied }) => {
        if (!isMelee && unit.special_rules.includes('Bane when Shooting') && unsavedHit.value >= 6) {
          specialRulesApplied.push({ rule: 'Bane when Shooting', effect: '+1 wound' });
          return { wounds: wounds + 1 };
        }
        return {};
      },
    },
  },

  'Courage Aura': {
    description: '+1 to morale test rolls.',
    hooks: {
      [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Courage'] }),
    },
  },
  Courage: {
    hooks: {
      [HOOKS.ON_MORALE_TEST]: ({ unit, roll, specialRulesApplied }) => {
        if (unit.special_rules.includes('Courage')) {
          specialRulesApplied.push({ rule: 'Courage', effect: '+1 morale' });
          return { roll: roll + 1 };
        }
        return {};
      },
    },
  },

  'Melee Shrouding Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Melee Shrouding'] }) },
  },

  'Rapid Rush Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Rapid Rush'] }) },
  },

  'Regeneration Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Regeneration'] }) },
  },
  Regeneration: {
    hooks: {
      [HOOKS.ON_INCOMING_WOUNDS]: ({ unit, wounds, specialRulesApplied }) => {
        if (!unit.special_rules.includes('Regeneration')) return {};
        let ignored = 0;
        for (let i = 0; i < wounds; i++) {
          const roll = Dice.roll();
          if (roll >= 5) ignored++;
        }
        specialRulesApplied.push({ rule: 'Regeneration', effect: `ignored ${ignored} wounds` });
        return { wounds: wounds - ignored };
      },
    },
  },

  'Shred when Shooting Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Shred when Shooting'] }) },
  },
  'Shred when Shooting': {
    hooks: {
      [HOOKS.ON_PER_HIT]: ({ unit, isMelee, saveRoll, specialRulesApplied }) => {
        if (!isMelee && unit.special_rules.includes('Shred when Shooting') && saveRoll === 1) {
          specialRulesApplied.push({ rule: 'Shred when Shooting', effect: 'extra wound' });
          return { extraWounds: 1 };
        }
        return {};
      },
    },
  },

  'Versatile Reach Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Versatile Reach'] }) },
  },

  // -------------------------------------------------------------------------
  // Army spells
  // -------------------------------------------------------------------------
  'Watch Sight': {
    description: 'Pick one enemy unit within 18", which friendly units gets Unstoppable when shooting against once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (!target) return {};
        target._unstoppableMarked = true;
        specialRulesApplied.push({ rule: 'Watch Sight', effect: `marked ${target.name}` });
        return {};
      },
    },
  },

  'Watch Trauma': {
    description: 'Pick one enemy unit within 18", which takes 1 hit with Smash.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (!target) return {};
        specialRulesApplied.push({ rule: 'Watch Trauma', effect: `1 hit (Smash) on ${target.name}` });
        return {
          extraHits: [{ target, count: 1, ap: 0, smash: true }]
        };
      },
    },
  },

  'Blessed Ammo': {
    description: 'Pick up to two friendly units within 12", which get Shred when shooting once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u => u.owner === caster.owner && u.distanceTo(caster) <= 12).slice(0, 2);
        friendlies.forEach(u => u._tempShredShooting = true);
        specialRulesApplied.push({ rule: 'Blessed Ammo', effect: `gave Shred to ${friendlies.length}` });
        return {};
      },
      [HOOKS.ON_PER_HIT]: ({ unit, isMelee, saveRoll, specialRulesApplied }) => {
        if (!isMelee && unit._tempShredShooting && saveRoll === 1) {
          delete unit._tempShredShooting;
          specialRulesApplied.push({ rule: 'Blessed Ammo', effect: 'extra wound' });
          return { extraWounds: 1 };
        }
        return {};
      },
    },
  },

  'Lightning Fog': {
    description: 'Pick up to two enemy units within 9", which take 4 hits each.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const enemies = gameState.units.filter(u => u.owner !== caster.owner && u.distanceTo(caster) <= 9).slice(0, 2);
        const extraHits = enemies.map(e => ({ target: e, count: 4, ap: 0 }));
        specialRulesApplied.push({ rule: 'Lightning Fog', effect: `4 hits on ${enemies.length} units` });
        return { extraHits };
      },
    },
  },

  'Watch Dome': {
    description: 'Pick up to three friendly units within 12", which get Evasive once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u => u.owner === caster.owner && u.distanceTo(caster) <= 12).slice(0, 3);
        friendlies.forEach(u => u._tempEvasive = true);
        specialRulesApplied.push({ rule: 'Watch Dome', effect: `gave Evasive to ${friendlies.length}` });
        return {};
      },
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit._tempEvasive) {
          return { additionalRules: ['Evasive'] };
        }
        return {};
      },
    },
  },

  'Psychic Terror': {
    description: 'Pick one enemy unit within 6", which takes 9 hits with Bane.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (!target) return {};
        specialRulesApplied.push({ rule: 'Psychic Terror', effect: `9 hits (Bane) on ${target.name}` });
        return {
          extraHits: [{ target, count: 9, ap: 0, bane: true }]
        };
      },
    },
  },
};
