/**
 * rules/opr-rules-goblin-reclaimers.js
 * Goblin Reclaimers faction rules from v3.5.2
 */
import { HOOKS } from '../RuleRegistry.js';

export const GOBLIN_RECLAIMERS_RULES = {
  // Army-wide
  Mischievous: {
    description: 'Targets must re-roll unmodified Defense results of 6 when blocking hits.',
    hooks: {
      [HOOKS.ON_PER_HIT]: ({ saveRoll, dice, modifiedDefense, specialRulesApplied }) => {
        if (saveRoll === 6) {
          const reroll = dice.roll();
          specialRulesApplied.push({ rule: 'Mischievous', effect: `save 6 re-rolled (${saveRoll}→${reroll})` });
          return { rerollResult: reroll, saveSuccess: reroll >= modifiedDefense };
        }
        return {};
      },
    },
  },

  // Special rules
  Bounding: {
    description: 'When activated, place all models anywhere within D3+1" of their position.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, dice, specialRulesApplied }) => {
        if (unit._boundingUsed) return {};
        const dist = dice.roll() + 1; // D3+1
        unit._boundingUsed = true;
        specialRulesApplied.push({ rule: 'Bounding', effect: `may move up to ${dist}"` });
        return { boundingMove: dist };
      },
    },
  },

  'Dangerous Terrain Debuff': {
    description: 'Once per activation, pick an enemy unit within 18" which must take a Dangerous Terrain test.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, dice, specialRulesApplied }) => {
        if (unit._dangerousDebuffUsed) return {};
        const target = gameState.units.find(u => u.owner !== unit.owner && u.distanceTo(unit) <= 18);
        if (target) {
          unit._dangerousDebuffUsed = true;
          specialRulesApplied.push({ rule: 'Dangerous Terrain Debuff', effect: `forcing test on ${target.name}` });
          // The engine should apply a dangerous terrain test to the target.
          return { dangerousTerrainTest: target };
        }
        return {};
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

  Instinctive: {
    description: 'When activated, if able to shoot/charge an enemy, must attack the closest valid target and gets +1 to hit.',
    hooks: {
      [HOOKS.BEFORE_ACTIVATION]: ({ unit, gameState, specialRulesApplied }) => {
        // This rule modifies AI decision-making. The engine should enforce the "must attack closest" constraint.
        // We'll add a flag that the AI can check.
        unit._instinctiveActive = true;
        specialRulesApplied.push({ rule: 'Instinctive', effect: 'must attack closest target, +1 to hit' });
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, target, quality, specialRulesApplied }) => {
        if (unit._instinctiveActive) {
          // The AI should have already selected the closest target; we just apply +1 to hit.
          specialRulesApplied.push({ rule: 'Instinctive', effect: '+1 to hit' });
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
      [HOOKS.AFTER_ACTIVATION]: ({ unit }) => {
        delete unit._instinctiveActive;
      },
    },
  },

  'Melee Evasion': {
    description: 'Enemies get -1 to hit in melee when attacking this unit.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ isMelee, target, quality, specialRulesApplied }) => {
        if (isMelee && target?.rules?.includes('Melee Evasion')) {
          specialRulesApplied.push({ rule: 'Melee Evasion', effect: '-1 to hit in melee' });
          return { quality: Math.min(6, quality + 1) };
        }
        return {};
      },
    },
  },

  'Mischievous Boost': {
    description: 'Mischievous forces re-roll on defense 5-6 instead of only 6.',
    hooks: {
      [HOOKS.ON_PER_HIT]: ({ saveRoll, dice, modifiedDefense, specialRulesApplied }) => {
        // This rule modifies Mischievous; we'll let Mischievous check for this rule.
        // So this rule is just a marker.
        return {};
      },
    },
  },

  'Piercing Shooting Mark': {
    description: 'Once per activation, mark an enemy; friendlies get AP(+1) when shooting against it.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._piercingShootingMarkUsed) return {};
        const target = gameState.units.find(u => u.owner !== unit.owner && u.distanceTo(unit) <= 18);
        if (target) {
          target.piercing_shooting_mark = true;
          unit._piercingShootingMarkUsed = true;
          specialRulesApplied.push({ rule: 'Piercing Shooting Mark', effect: `marked ${target.name}` });
        }
        return {};
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, isMelee, specialRulesApplied }) => {
        if (!isMelee && target?.piercing_shooting_mark) {
          delete target.piercing_shooting_mark;
          specialRulesApplied.push({ rule: 'Piercing Shooting Mark', effect: 'AP+1' });
          return { ap: (ap ?? 0) + 1 };
        }
        return {};
      },
    },
  },

  Quick: {
    description: '+2" on Advance and Rush/Charge.',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ action, speedDelta, specialRulesApplied }) => {
        const delta = 2;
        specialRulesApplied.push({ rule: 'Quick', value: delta, effect: `+${delta}"` });
        return { speedDelta: (speedDelta ?? 0) + delta };
      },
    },
  },

  'Quick Shot': {
    description: 'May shoot after using Rush actions.',
    hooks: {
      [HOOKS.AFTER_MOVEMENT]: ({ unit, action, gameState, specialRulesApplied }) => {
        if (action === 'Rush') {
          specialRulesApplied.push({ rule: 'Quick Shot', effect: 'may shoot after Rush' });
          return { allowShootAfterRush: true };
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

  Retaliate: {
    description: 'When this model takes a wound in melee, attacker takes X hits.',
    hooks: {
      [HOOKS.ON_WOUND_ALLOCATION]: ({ unit, wounds, sourceUnit, specialRulesApplied }) => {
        if (unit.rules.includes('Retaliate') && wounds > 0 && sourceUnit) {
          const x = unit._ruleParamValue ?? 1;
          specialRulesApplied.push({ rule: 'Retaliate', effect: `${x} hits on attacker` });
          return { retaliateHits: { target: sourceUnit, hits: x * wounds } };
        }
        return {};
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

  Skewer: {
    description: 'Ignores cover. Against Tough(3-9), gets Deadly(+3).',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ specialRulesApplied }) => {
        return { ignoresCover: true };
      },
      [HOOKS.ON_WOUND_CALC]: ({ target, wounds, toughPerModel, specialRulesApplied }) => {
        if (!target) return {};
        const sr = Array.isArray(target.special_rules)
          ? target.special_rules.join(' ')
          : (target.special_rules || '');
        const m = sr.match(/Tough\((\d+)\)/);
        if (!m) return {};
        const toughVal = parseInt(m[1]);
        if (toughVal >= 3 && toughVal <= 9) {
          const extra = 3;
          const newWounds = Math.min(wounds + extra, toughPerModel);
          specialRulesApplied.push({ rule: 'Skewer', effect: `+${extra} wounds (Deadly boost)` });
          return { wounds: newWounds };
        }
        return {};
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

  'Unpredictable Fighter': {
    description: 'In melee, roll die: 1-3 AP+1, 4-6 +1 to hit.',
    hooks: {
      [HOOKS.BEFORE_MELEE_ATTACK]: ({ unit, dice, specialRulesApplied }) => {
        if (!unit._unpredictableRolled) {
          unit._unpredictableRoll = dice.roll();
          unit._unpredictableRolled = true;
          const effect = unit._unpredictableRoll <= 3 ? 'AP+1' : '+1 to hit';
          specialRulesApplied.push({ rule: 'Unpredictable Fighter', effect: `rolled ${unit._unpredictableRoll}: ${effect}` });
        }
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, isMelee, specialRulesApplied }) => {
        if (!isMelee) return {};
        if (unit._unpredictableRoll && unit._unpredictableRoll >= 4) {
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, ap, isMelee, specialRulesApplied }) => {
        if (!isMelee) return {};
        if (unit._unpredictableRoll && unit._unpredictableRoll <= 3) {
          return { ap: (ap ?? 0) + 1 };
        }
        return {};
      },
      [HOOKS.AFTER_MELEE_ATTACK]: ({ unit }) => {
        delete unit._unpredictableRolled;
        delete unit._unpredictableRoll;
      },
    },
  },

  // Auras
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
  'Melee Evasion Aura': {
    description: 'This model and its unit get Melee Evasion.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.rules.includes('Melee Evasion Aura')) {
          return { additionalRules: ['Melee Evasion'] };
        }
        return {};
      },
    },
  },
  'Mischievous Boost Aura': {
    description: 'This model and its unit get Mischievous Boost.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.rules.includes('Mischievous Boost Aura')) {
          return { additionalRules: ['Mischievous Boost'] };
        }
        return {};
      },
    },
  },
  'Precision Fighter Aura': {
    description: '+1 to hit in melee.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, isMelee, quality, specialRulesApplied }) => {
        if (isMelee && unit.rules.includes('Precision Fighter Aura')) {
          specialRulesApplied.push({ rule: 'Precision Fighter Aura', effect: '+1 to hit' });
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
    },
  },
  'Quick Shot Aura': {
    description: 'This model and its unit get Quick Shot.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.rules.includes('Quick Shot Aura')) {
          return { additionalRules: ['Quick Shot'] };
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
  'Ammo Boost': {
    description: 'Pick one friendly unit within 12" which gets Mischievous Boost once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          target._tempMischievousBoost = true;
          specialRulesApplied.push({ rule: 'Ammo Boost', effect: `gave Mischievous Boost to ${target.name}` });
        }
      },
      [HOOKS.ON_PER_HIT]: ({ saveRoll, dice, modifiedDefense, specialRulesApplied }) => {
        // Mischievous Boost modifies Mischievous; we'll let Mischievous check for this flag.
        // For simplicity, we'll assume the engine checks for _tempMischievousBoost in the attacker.
        // But here the flag is on the target? Actually it's on the friendly unit that gets the boost.
        // So when that unit attacks, it should have the boost.
        // We'll need to handle it in Mischievous hook.
        return {};
      },
    },
  },
  'Zap!': {
    description: 'Pick one enemy unit within 12" which takes 2 hits with AP(1) and Surge.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Zap!', effect: `2 hits AP1 Surge on ${target.name}` });
          return { extraHits: [{ target, count: 2, ap: 1, surge: true }] };
        }
      },
    },
  },
  'Mob Frenzy': {
    description: 'Pick up to two enemy units within 18" which get AP(1) when shooting against them once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const enemies = gameState.units.filter(u => u.owner !== caster.owner && u.distanceTo(caster) <= 18).slice(0, 2);
        enemies.forEach(u => u._tempMobFrenzy = true);
        specialRulesApplied.push({ rule: 'Mob Frenzy', effect: `marked ${enemies.length} units` });
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, specialRulesApplied }) => {
        if (target?._tempMobFrenzy) {
          delete target._tempMobFrenzy;
          specialRulesApplied.push({ rule: 'Mob Frenzy', effect: '+AP(1)' });
          return { ap: (ap ?? 0) + 1 };
        }
        return {};
      },
    },
  },
  'Boom!': {
    description: 'Pick one enemy unit within 18" which takes 2 hits with Blast(3).',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Boom!', effect: `2 hits Blast(3) on ${target.name}` });
          return { extraHits: [{ target, count: 2, blast: 3, ap: 0 }] };
        }
      },
    },
  },
  'Shroud Field': {
    description: 'Pick up to three friendly units within 12" which get +1 to defense rolls once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u => u.owner === caster.owner && u.distanceTo(caster) <= 12).slice(0, 3);
        friendlies.forEach(u => u._tempDefenseBonus = true);
        specialRulesApplied.push({ rule: 'Shroud Field', effect: `gave +1 defense to ${friendlies.length} units` });
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, defense, specialRulesApplied }) => {
        if (unit._tempDefenseBonus) {
          delete unit._tempDefenseBonus;
          specialRulesApplied.push({ rule: 'Shroud Field', effect: '+1 defense' });
          return { defense: Math.max(2, defense - 1) };
        }
        return {};
      },
    },
  },
  'Pow!': {
    description: 'Pick one enemy unit within 6" which takes 3 hits with AP(2) and Skewer.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Pow!', effect: `3 hits AP2 Skewer on ${target.name}` });
          return { extraHits: [{ target, count: 3, ap: 2, skewer: true }] };
        }
      },
    },
  },
};
