/**
 * rules/opr-rules-human-defense-force.js
 * Human Defense Force faction rules from v3.5.2
 */
import { HOOKS } from '../RuleRegistry.js';

export const HUMAN_DEFENSE_FORCE_RULES = {
  // Army-wide
  'Hold the Line': {
    description: '+1 to morale test rolls.',
    hooks: {
      [HOOKS.ON_MORALE_TEST]: ({ roll, specialRulesApplied }) => {
        specialRulesApplied.push({ rule: 'Hold the Line', effect: '+1 to morale' });
        return { roll: roll + 1 };
      },
    },
  },

  // Special rules
  'Bane in Melee Buff': {
    description: 'Once per activation, give one friendly unit Bane in melee once.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._baneMeleeBuffUsed) return {};
        const friendly = gameState.units.find(u => u.owner === unit.owner && u !== unit && u.distanceTo(unit) <= 12);
        if (friendly) {
          friendly._tempBaneMelee = true;
          unit._baneMeleeBuffUsed = true;
          specialRulesApplied.push({ rule: 'Bane in Melee Buff', effect: `gave Bane in melee to ${friendly.name}` });
        }
        return {};
      },
      [HOOKS.ON_PER_HIT]: ({ hitRoll, isMelee, target, saveRoll, dice, modifiedDefense, specialRulesApplied }) => {
        if (isMelee && target._tempBaneMelee && saveRoll === 6) {
          delete target._tempBaneMelee;
          const reroll = dice.roll();
          specialRulesApplied.push({ rule: 'Bane in Melee Buff', effect: `save 6 re-rolled (${saveRoll}→${reroll})` });
          return { rerollResult: reroll, saveSuccess: reroll >= modifiedDefense };
        }
        return {};
      },
    },
  },

  Coordinate: {
    description: 'After activation, another friendly unit within 12" that hasn\'t activated may activate immediately. Cannot be used if this unit was activated via Coordinate.',
    hooks: {
      [HOOKS.AFTER_ACTIVATION]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._activatedByCoordinate) return {};
        const eligible = gameState.units.filter(u => u.owner === unit.owner && !u.hasActivated && u.distanceTo(unit) <= 12);
        if (eligible.length > 0) {
          specialRulesApplied.push({ rule: 'Coordinate', effect: 'may activate another unit' });
          return { coordinate: eligible[0] }; // Engine should handle immediate activation
        }
        return {};
      },
    },
  },

  'Entrenched Buff': {
    description: 'Once per activation, give one friendly unit Entrenched once (assumed +1 defense next hit).',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._entrenchedBuffUsed) return {};
        const friendly = gameState.units.find(u => u.owner === unit.owner && u !== unit && u.distanceTo(unit) <= 12);
        if (friendly) {
          friendly._entrenched = true;
          unit._entrenchedBuffUsed = true;
          specialRulesApplied.push({ rule: 'Entrenched Buff', effect: `gave Entrenched to ${friendly.name}` });
        }
        return {};
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, defense, specialRulesApplied }) => {
        if (unit._entrenched) {
          delete unit._entrenched;
          specialRulesApplied.push({ rule: 'Entrenched', effect: '+1 defense' });
          return { defense: Math.max(2, defense - 1) };
        }
        return {};
      },
    },
  },

  'Extended Buff Range': {
    description: 'If within 24" of a friendly Hero with this rule, Hero may use buffs on this unit as if within 12".',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        // This rule modifies range for buffs. We'll need to check when a hero uses a buff.
        // We'll return a flag that the engine can use when checking range for buff abilities.
        // For now, we'll just mark that this unit has the rule, and the hero's buff hooks can check for it.
        return {};
      },
    },
  },

  Fortified: {
    description: 'Hits count as AP(-1), min AP(0).',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ defender, ap, specialRulesApplied }) => {
        if (defender.rules.includes('Fortified') && ap > 0) {
          const newAp = Math.max(0, ap - 1);
          specialRulesApplied.push({ rule: 'Fortified', effect: `AP ${ap}→${newAp}` });
          return { ap: newAp };
        }
        return {};
      },
    },
  },

  Fracture: {
    description: 'Ignores cover. Unmodified 6 to hit get AP(+2).',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ specialRulesApplied }) => {
        return { ignoresCover: true };
      },
      [HOOKS.AFTER_HIT_ROLLS]: ({ hitRolls, specialRulesApplied }) => {
        const sixes = (hitRolls ?? []).filter(r => r === 6).length;
        if (sixes === 0) return {};
        specialRulesApplied.push({ rule: 'Fracture', value: sixes, effect: `${sixes} hits gain AP+2` });
        return { crackHits: sixes, crackApBonus: 2 };
      },
    },
  },

  'Good Shot': {
    description: '+1 to hit when shooting.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ weapon, quality, specialRulesApplied }) => {
        if ((weapon?.range ?? 0) > 2) {
          specialRulesApplied.push({ rule: 'Good Shot', effect: '+1 to hit' });
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
    },
  },

  'Hold the Line Boost': {
    description: '+2 to morale instead of +1 if all models have Hold the Line.',
    hooks: {
      [HOOKS.ON_MORALE_TEST]: ({ unit, roll, specialRulesApplied }) => {
        if (unit.rules.includes('Hold the Line') && unit.rules.includes('Hold the Line Boost')) {
          specialRulesApplied.push({ rule: 'Hold the Line Boost', effect: '+2 to morale' });
          return { roll: roll + 2 };
        }
        return {};
      },
    },
  },

  'Mobile Artillery': {
    description: 'When using Hold action and shooting at >9", +1 to hit. If hasn\'t moved, enemies shooting it from >9" get -2 to hit.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, weapon, target, quality, action, specialRulesApplied, calculateDistance }) => {
        if (action === 'Hold' && weapon?.range > 2 && target) {
          const dist = calculateDistance(unit, target);
          if (dist > 9) {
            specialRulesApplied.push({ rule: 'Mobile Artillery', effect: '+1 to hit' });
            return { quality: Math.max(2, quality - 1) };
          }
        }
        return {};
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, target, quality, specialRulesApplied, calculateDistance }) => {
        // When an enemy shoots at this unit, we need to check if this unit has not moved and is >9" away.
        if (target && target.rules.includes('Mobile Artillery') && !target.hasMoved) {
          const dist = calculateDistance(unit, target);
          if (dist > 9) {
            specialRulesApplied.push({ rule: 'Mobile Artillery', effect: '-2 to hit' });
            return { quality: Math.min(6, quality + 2) };
          }
        }
        return {};
      },
    },
  },

  'Morale Debuff': {
    description: 'Once per activation, give an enemy -1 to morale tests once.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._moraleDebuffUsed) return {};
        const target = gameState.units.find(u => u.owner !== unit.owner && u.distanceTo(unit) <= 18);
        if (target) {
          target.morale_debuff = true;
          unit._moraleDebuffUsed = true;
          specialRulesApplied.push({ rule: 'Morale Debuff', effect: `gave -1 morale to ${target.name}` });
        }
        return {};
      },
      [HOOKS.ON_MORALE_TEST]: ({ unit, roll, specialRulesApplied }) => {
        if (unit.morale_debuff) {
          delete unit.morale_debuff;
          specialRulesApplied.push({ rule: 'Morale Debuff', effect: '-1 to morale' });
          return { roll: roll - 1 };
        }
        return {};
      },
    },
  },

  'No Retreat': {
    description: 'On failed morale causing Shaken/Routed, pass instead, then roll wounds to destroy it; each 1-3 deals 1 wound.',
    hooks: {
      [HOOKS.ON_MORALE_TEST]: ({ unit, passed, dice, specialRulesApplied }) => {
        if (passed || !unit.rules.includes('No Retreat')) return {};
        const woundsToKill = unit.current_models;
        let selfWounds = 0;
        for (let i = 0; i < woundsToKill; i++) {
          if (dice.roll() <= 3) selfWounds++;
        }
        specialRulesApplied.push({ rule: 'No Retreat', effect: `morale passed, but took ${selfWounds} wounds` });
        unit.current_models = Math.max(0, unit.current_models - selfWounds);
        if (unit.current_models <= 0) unit.status = 'destroyed';
        return { passed: true };
      },
    },
  },

  'No Retreat Buff': {
    description: 'Once per activation, give a friendly unit No Retreat once.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._noRetreatBuffUsed) return {};
        const friendly = gameState.units.find(u => u.owner === unit.owner && u !== unit && u.distanceTo(unit) <= 12);
        if (friendly) {
          friendly._tempNoRetreat = true;
          unit._noRetreatBuffUsed = true;
          specialRulesApplied.push({ rule: 'No Retreat Buff', effect: `gave No Retreat to ${friendly.name}` });
        }
        return {};
      },
      [HOOKS.ON_MORALE_TEST]: ({ unit, passed, dice, specialRulesApplied }) => {
        if (unit._tempNoRetreat && !passed) {
          delete unit._tempNoRetreat;
          const woundsToKill = unit.current_models;
          let selfWounds = 0;
          for (let i = 0; i < woundsToKill; i++) {
            if (dice.roll() <= 3) selfWounds++;
          }
          specialRulesApplied.push({ rule: 'No Retreat Buff', effect: `morale passed, but took ${selfWounds} wounds` });
          unit.current_models = Math.max(0, unit.current_models - selfWounds);
          if (unit.current_models <= 0) unit.status = 'destroyed';
          return { passed: true };
        }
        return {};
      },
    },
  },

  'Precision Shooter Buff': {
    description: 'Once per activation, give a friendly unit +1 to hit when shooting once.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._precisionShooterBuffUsed) return {};
        const friendly = gameState.units.find(u => u.owner === unit.owner && u !== unit && u.distanceTo(unit) <= 12);
        if (friendly) {
          friendly._tempPrecisionShooter = true;
          unit._precisionShooterBuffUsed = true;
          specialRulesApplied.push({ rule: 'Precision Shooter Buff', effect: `gave +1 shooting to ${friendly.name}` });
        }
        return {};
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, weapon, quality, specialRulesApplied }) => {
        if ((weapon?.range ?? 0) > 2 && unit._tempPrecisionShooter) {
          delete unit._tempPrecisionShooter;
          specialRulesApplied.push({ rule: 'Precision Shooter Buff', effect: '+1 to hit' });
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
    },
  },

  'Rapid Advance': {
    description: '+4" when using Advance actions.',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ action, speedDelta, specialRulesApplied }) => {
        if (action === 'Advance') {
          specialRulesApplied.push({ rule: 'Rapid Advance', effect: '+4"' });
          return { speedDelta: (speedDelta ?? 0) + 4 };
        }
        return {};
      },
    },
  },

  'Rapid Advance Buff': {
    description: 'Once per activation, give a friendly unit Rapid Advance once.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._rapidAdvanceBuffUsed) return {};
        const friendly = gameState.units.find(u => u.owner === unit.owner && u !== unit && u.distanceTo(unit) <= 12);
        if (friendly) {
          friendly._tempRapidAdvance = true;
          unit._rapidAdvanceBuffUsed = true;
          specialRulesApplied.push({ rule: 'Rapid Advance Buff', effect: `gave Rapid Advance to ${friendly.name}` });
        }
        return {};
      },
      [HOOKS.MODIFY_SPEED]: ({ unit, action, speedDelta, specialRulesApplied }) => {
        if (unit._tempRapidAdvance && action === 'Advance') {
          delete unit._tempRapidAdvance;
          specialRulesApplied.push({ rule: 'Rapid Advance Buff', effect: '+4"' });
          return { speedDelta: (speedDelta ?? 0) + 4 };
        }
        return {};
      },
    },
  },

  'Relentless Mark': {
    description: 'Once per activation, mark an enemy; friendlies get Relentless against it once.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._relentlessMarkUsed) return {};
        const target = gameState.units.find(u => u.owner !== unit.owner && u.distanceTo(unit) <= 18);
        if (target) {
          target.relentless_marked = true;
          unit._relentlessMarkUsed = true;
          specialRulesApplied.push({ rule: 'Relentless Mark', effect: `marked ${target.name}` });
        }
        return {};
      },
      [HOOKS.AFTER_HIT_ROLLS]: ({ unit, target, rolls, successes, specialRulesApplied, calculateDistance }) => {
        if (target?.relentless_marked) {
          delete target.relentless_marked;
          if (calculateDistance(unit, target) > 9) {
            const sixes = rolls.filter(r => r.value === 6 && r.success && !r.auto).length;
            if (sixes > 0) {
              specialRulesApplied.push({ rule: 'Relentless Mark', effect: `${sixes} extra hits from 6s` });
              return { successes: successes + sixes };
            }
          }
        }
        return {};
      },
    },
  },

  'Repel Ambushers': {
    description: 'Enemy Ambush must be >12" from this unit.',
    hooks: {
      [HOOKS.ON_RESERVE_ENTRY]: ({ unit, gameState }) => {
        const repellors = gameState.units.filter(u => u.owner !== unit.owner && u.rules.includes('Repel Ambushers'));
        if (repellors.length > 0) {
          return { minDistance: 12 };
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

  // Auras
  'Hold the Line Boost Aura': {
    description: 'This model and its unit get Hold the Line Boost.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.rules.includes('Hold the Line Boost Aura')) {
          return { additionalRules: ['Hold the Line Boost'] };
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

  // Army spells
  'Psy-Injected Courage': {
    description: 'Pick one friendly unit within 12" which gets Hold the Line Boost once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          target._tempHoldLineBoost = true;
          specialRulesApplied.push({ rule: 'Psy-Injected Courage', effect: `gave Hold the Line Boost to ${target.name}` });
        }
      },
    },
  },
  'Electric Tempest': {
    description: 'Pick one enemy unit within 12" which takes 2 hits with AP(1) and Fracture.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Electric Tempest', effect: `2 hits AP1 Fracture on ${target.name}` });
          return { extraHits: [{ target, count: 2, ap: 1, fracture: true }] };
        }
      },
    },
  },
  'Calculated Foresight': {
    description: 'Pick up to two enemy units within 18" which get Relentless mark once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const enemies = gameState.units.filter(u => u.owner !== caster.owner && u.distanceTo(caster) <= 18).slice(0, 2);
        enemies.forEach(u => u.relentless_marked = true);
        specialRulesApplied.push({ rule: 'Calculated Foresight', effect: `marked ${enemies.length} units` });
      },
    },
  },
  'Searing Burst': {
    description: 'Pick one enemy unit within 12" which takes 6 hits.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Searing Burst', effect: `6 hits on ${target.name}` });
          return { extraHits: [{ target, count: 6, ap: 0 }] };
        }
      },
    },
  },
  'Shock Speed': {
    description: 'Pick up to three friendly units within 12" which get +2" Advance and +4" Rush/Charge once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u => u.owner === caster.owner && u.distanceTo(caster) <= 12).slice(0, 3);
        friendlies.forEach(u => {
          u._tempAdvanceBonus = 2;
          u._tempRushChargeBonus = 4;
        });
        specialRulesApplied.push({ rule: 'Shock Speed', effect: `gave speed bonus to ${friendlies.length} units` });
      },
      [HOOKS.MODIFY_SPEED]: ({ unit, action, speedDelta, specialRulesApplied }) => {
        if (action === 'Advance' && unit._tempAdvanceBonus) {
          const bonus = unit._tempAdvanceBonus;
          delete unit._tempAdvanceBonus;
          specialRulesApplied.push({ rule: 'Shock Speed', effect: `+${bonus}"` });
          return { speedDelta: (speedDelta ?? 0) + bonus };
        }
        if ((action === 'Rush' || action === 'Charge') && unit._tempRushChargeBonus) {
          const bonus = unit._tempRushChargeBonus;
          delete unit._tempRushChargeBonus;
          specialRulesApplied.push({ rule: 'Shock Speed', effect: `+${bonus}"` });
          return { speedDelta: (speedDelta ?? 0) + bonus };
        }
        return {};
      },
    },
  },
  'Expel Threat': {
    description: 'Pick one enemy model within 18" which takes 6 hits with AP(1).',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Expel Threat', effect: `6 hits AP1 on ${target.name}` });
          return { extraHits: [{ target, count: 6, ap: 1 }] };
        }
      },
    },
  },
};
