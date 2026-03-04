/**
 * rules/opr-rules-infected-colonies.js
 * Infected Colonies faction rules from v3.5.2
 */
import { HOOKS } from '../RuleRegistry.js';

export const INFECTED_COLONIES_RULES = {
  // Army-wide
  Infected: {
    description: 'Enemies that roll to block hits take 1 extra wound for each unmodified result of 1.',
    hooks: {
      [HOOKS.ON_PER_HIT]: ({ saveRoll, specialRulesApplied }) => {
        if (saveRoll === 1) {
          specialRulesApplied.push({ rule: 'Infected', effect: 'extra wound from save 1' });
          return { extraWounds: 1 };
        }
        return {};
      },
    },
  },

  // Special rules
  Bash: {
    description: 'Ignores cover. Against Defense 5+ to 6+, gets Blast(+3).',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ specialRulesApplied }) => {
        return { ignoresCover: true };
      },
      [HOOKS.ON_WOUND_CALC]: ({ target, wounds, specialRulesApplied }) => {
        if (!target) return {};
        const defense = target.defense ?? 6;
        if (defense >= 5 && defense <= 6) {
          const extra = 3;
          specialRulesApplied.push({ rule: 'Bash', effect: `+${extra} wounds (Blast)` });
          return { wounds: wounds + extra };
        }
        return {};
      },
    },
  },

  Deathstrike: {
    description: 'If killed in melee, attacker takes X hits.',
    hooks: {
      [HOOKS.ON_MODEL_KILLED]: ({ unit, killer, specialRulesApplied }) => {
        if (unit.special_rules.includes('Deathstrike') && killer) {
          const x = unit._ruleParamValue ?? 3; // from Boomers: Deathstrike(3)
          specialRulesApplied.push({ rule: 'Deathstrike', effect: `${x} hits on killer` });
          return { retaliateHits: { target: killer, hits: x } };
        }
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

  'Infected Boost': {
    description: 'Extra wounds on defense rolls of 1-2 instead of only 1.',
    hooks: {
      // Modifies Infected; we'll let Infected check for this rule.
    },
  },

  'No Retreat': {
    description: 'On failed morale causing Shaken/Routed, pass instead, then roll wounds to destroy it; each 1-3 deals 1 wound.',
    hooks: {
      [HOOKS.ON_MORALE_TEST]: ({ unit, passed, dice, specialRulesApplied }) => {
        if (passed || !unit.special_rules.includes('No Retreat')) return {};
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

  'Precision Debuff': {
    description: 'Once per activation, give an enemy -1 to hit once.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._precisionDebuffUsed) return {};
        const target = gameState.units.find(u => u.owner !== unit.owner && u.distanceTo(unit) <= 18);
        if (target) {
          target.precision_debuffed = true;
          unit._precisionDebuffUsed = true;
          specialRulesApplied.push({ rule: 'Precision Debuff', effect: `gave -1 to hit to ${target.name}` });
        }
        return {};
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, specialRulesApplied }) => {
        if (unit.precision_debuffed) {
          delete unit.precision_debuffed;
          specialRulesApplied.push({ rule: 'Precision Debuff', effect: '-1 to hit' });
          return { quality: Math.min(6, quality + 1) };
        }
        return {};
      },
    },
  },

  'Precision Growth': {
    description: 'Gain one marker each round on table; each gives +1 to hit (max +2). Lose all if Shaken.',
    hooks: {
      [HOOKS.ON_ROUND_END]: ({ unit }) => {
        if (unit.special_rules.includes('Precision Growth') && !unit.reserve && unit.current_models > 0) {
          unit.precision_growth_markers = Math.min(2, (unit.precision_growth_markers || 0) + 1);
        }
      },
      [HOOKS.ON_MORALE_TEST]: ({ unit, passed }) => {
        if (unit.special_rules.includes('Precision Growth') && !passed) {
          unit.precision_growth_markers = 0;
        }
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, specialRulesApplied }) => {
        const markers = Math.min(2, unit.precision_growth_markers ?? 0);
        if (markers <= 0) return {};
        specialRulesApplied.push({ rule: 'Precision Growth', value: markers, effect: `+${markers} to hit` });
        return { quality: Math.max(2, quality - markers) };
      },
    },
  },

  Surge: {
    description: 'Unmodified 6 to hit deal 1 extra hit.',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ rolls, successes, specialRulesApplied }) => {
        const sixes = rolls.filter(r => r.value === 6 && r.success && !r.auto).length;
        if (sixes === 0) return {};
        specialRulesApplied.push({ rule: 'Surge', effect: `${sixes} extra hits` });
        return { successes: successes + sixes };
      },
    },
  },

  Unpredictable: {
    description: 'When attacking, roll die: 1-3 AP+1, 4-6 +1 to hit.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, dice, specialRulesApplied }) => {
        if (!unit._unpredictableRolled) {
          unit._unpredictableRoll = dice.roll();
          unit._unpredictableRolled = true;
          const effect = unit._unpredictableRoll <= 3 ? 'AP+1' : '+1 to hit';
          specialRulesApplied.push({ rule: 'Unpredictable', effect: `rolled ${unit._unpredictableRoll}: ${effect}` });
        }
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, specialRulesApplied }) => {
        if (unit._unpredictableRoll && unit._unpredictableRoll >= 4) {
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, ap, specialRulesApplied }) => {
        if (unit._unpredictableRoll && unit._unpredictableRoll <= 3) {
          return { ap: (ap ?? 0) + 1 };
        }
        return {};
      },
      [HOOKS.AFTER_ATTACK]: ({ unit }) => {
        delete unit._unpredictableRolled;
        delete unit._unpredictableRoll;
      },
    },
  },

  'Unpredictable Shooter': {
    description: 'When shooting, roll die: 1-3 AP+1, 4-6 +1 to hit.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, dice, specialRulesApplied }) => {
        if (!unit._unpredictableShooterRolled) {
          unit._unpredictableShooterRoll = dice.roll();
          unit._unpredictableShooterRolled = true;
          const effect = unit._unpredictableShooterRoll <= 3 ? 'AP+1' : '+1 to hit';
          specialRulesApplied.push({ rule: 'Unpredictable Shooter', effect: `rolled ${unit._unpredictableShooterRoll}: ${effect}` });
        }
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, weapon, quality, isMelee, specialRulesApplied }) => {
        if (isMelee) return {};
        if (unit._unpredictableShooterRoll && unit._unpredictableShooterRoll >= 4) {
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, weapon, ap, isMelee, specialRulesApplied }) => {
        if (isMelee) return {};
        if (unit._unpredictableShooterRoll && unit._unpredictableShooterRoll <= 3) {
          return { ap: (ap ?? 0) + 1 };
        }
        return {};
      },
      [HOOKS.AFTER_ATTACK]: ({ unit }) => {
        delete unit._unpredictableShooterRolled;
        delete unit._unpredictableShooterRoll;
      },
    },
  },

  // Auras
  'Fast Aura': {
    description: '+2" Advance, +4" Rush/Charge.',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ unit, action, speedDelta, specialRulesApplied }) => {
        if (unit.special_rules.includes('Fast Aura')) {
          const delta = action === 'Advance' ? 2 : 4;
          specialRulesApplied.push({ rule: 'Fast Aura', value: delta, effect: `+${delta}"` });
          return { speedDelta: (speedDelta ?? 0) + delta };
        }
        return {};
      },
    },
  },
  'Fortified Aura': {
    description: 'This model and its unit get Fortified.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Fortified Aura')) {
          return { additionalRules: ['Fortified'] };
        }
        return {};
      },
    },
  },
  'Infected Boost Aura': {
    description: 'This model and its unit get Infected Boost.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Infected Boost Aura')) {
          return { additionalRules: ['Infected Boost'] };
        }
        return {};
      },
    },
  },
  'No Retreat Aura': {
    description: 'This model and its unit get No Retreat.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('No Retreat Aura')) {
          return { additionalRules: ['No Retreat'] };
        }
        return {};
      },
    },
  },
  'Thrust in Melee Aura': {
    description: 'This model and its unit get Thrust in melee.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Thrust in Melee Aura')) {
          return { additionalRules: ['Thrust'] };
        }
        return {};
      },
    },
  },
  'Unpredictable Shooter Aura': {
    description: 'This model and its unit get Unpredictable Shooter.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Unpredictable Shooter Aura')) {
          return { additionalRules: ['Unpredictable Shooter'] };
        }
        return {};
      },
    },
  },

  // Army spells
  'Violent Onslaught': {
    description: 'Pick one friendly unit within 12" which gets Infected Boost once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          target._tempInfectedBoost = true;
          specialRulesApplied.push({ rule: 'Violent Onslaught', effect: `gave Infected Boost to ${target.name}` });
        }
      },
      [HOOKS.ON_PER_HIT]: ({ saveRoll, specialRulesApplied }) => {
        // Infected Boost modifies Infected; we'll let Infected check for this flag on the attacker.
        // We'll need to pass it to the attacker. We'll set a flag on the unit.
        return {};
      },
    },
  },
  'Bio-Horror': {
    description: 'Pick one enemy unit within 12" which takes 2 hits with AP(1) and Surge.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Bio-Horror', effect: `2 hits AP1 Surge on ${target.name}` });
          return { extraHits: [{ target, count: 2, ap: 1, surge: true }] };
        }
      },
    },
  },
  'Brain Infestation': {
    description: 'Pick up to two enemy units within 18" which get -1 to hit once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const enemies = gameState.units.filter(u => u.owner !== caster.owner && u.distanceTo(caster) <= 18).slice(0, 2);
        enemies.forEach(u => u.precision_debuffed = true);
        specialRulesApplied.push({ rule: 'Brain Infestation', effect: `gave -1 to hit to ${enemies.length} units` });
      },
    },
  },
  'Spread Plague': {
    description: 'Pick one enemy unit within 18" which takes 2 hits with Bash.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Spread Plague', effect: `2 hits with Bash on ${target.name}` });
          return { extraHits: [{ target, count: 2, ap: 0, bash: true }] };
        }
      },
    },
  },
  'Rapid Mutation': {
    description: 'Pick up to three friendly units within 12" which get Regeneration once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u => u.owner === caster.owner && u.distanceTo(caster) <= 12).slice(0, 3);
        friendlies.forEach(u => u._tempRegeneration = true);
        specialRulesApplied.push({ rule: 'Rapid Mutation', effect: `gave Regeneration to ${friendlies.length} units` });
      },
      [HOOKS.ON_INCOMING_WOUNDS]: ({ unit, wounds, dice, specialRulesApplied }) => {
        if (unit._tempRegeneration) {
          delete unit._tempRegeneration;
          let ignored = 0;
          for (let i = 0; i < wounds; i++) {
            if (dice.roll() >= 5) ignored++;
          }
          if (ignored > 0) {
            specialRulesApplied.push({ rule: 'Regeneration', effect: `ignored ${ignored}/${wounds}` });
            return { wounds: wounds - ignored };
          }
        }
        return {};
      },
    },
  },
  'Volatile Infection': {
    description: 'Pick one enemy unit within 6" which takes 3 hits with AP(2) and Deadly(3).',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Volatile Infection', effect: `3 hits AP2 Deadly3 on ${target.name}` });
          return { extraHits: [{ target, count: 3, ap: 2, deadly: 3 }] };
        }
      },
    },
  },
};
