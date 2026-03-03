/**
 * rules/opr-rules-orc-marauders.js
 * Orc Marauders faction rules from v3.5.2
 */
import { HOOKS } from '../RuleRegistry.js';

export const ORC_MARAUDERS_RULES = {
  // Army-wide
  Ferocious: {
    description: 'Unmodified 6s to hit deal 1 extra hit.',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ rolls, successes, specialRulesApplied }) => {
        const sixes = rolls.filter(r => r.value === 6 && r.success && !r.auto).length;
        if (sixes === 0) return {};
        specialRulesApplied.push({ rule: 'Ferocious', value: sixes, effect: `${sixes} extra hits from natural 6s` });
        return { successes: successes + sixes };
      },
    },
  },

  // Special rules
  'Bad Shot': {
    description: '-1 to hit when shooting.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ weapon, quality, specialRulesApplied }) => {
        if ((weapon?.range ?? 0) <= 2) return {}; // melee unaffected
        specialRulesApplied.push({ rule: 'Bad Shot', effect: '-1 to hit' });
        return { quality: Math.min(6, quality + 1) };
      },
    },
  },

  Bounding: {
    description: 'When activated, place all models anywhere within D3+1" of their position.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, dice, specialRulesApplied }) => {
        if (unit._boundingUsed) return {};
        const dist = dice.roll() + 1; // D3+1
        unit._boundingUsed = true;
        specialRulesApplied.push({ rule: 'Bounding', effect: `may move up to ${dist}"` });
        // The engine should handle the actual repositioning.
        return { boundingMove: dist };
      },
    },
  },

  'Crossing Barrage': {
    description: 'Once per activation, when moving through enemies, pick one and roll X dice; each 4+ deals 3 hits AP(1).',
    hooks: {
      [HOOKS.ON_MOVE_THROUGH_ENEMY]: ({ unit, enemyUnit, dice, specialRulesApplied }) => {
        if (unit._crossingBarrageUsed) return {};
        const x = unit._ruleParamValue ?? 1; // X from unit data
        let hits = 0;
        for (let i = 0; i < x; i++) {
          if (dice.roll() >= 4) hits++;
        }
        if (hits > 0) {
          unit._crossingBarrageUsed = true;
          specialRulesApplied.push({ rule: 'Crossing Barrage', effect: `${hits} groups of 3 hits on ${enemyUnit.name}` });
          // Return extra hits to be resolved (3 hits each)
          return { extraHits: [{ target: enemyUnit, count: hits * 3, ap: 1 }] };
        }
        return {};
      },
    },
  },

  'Ferocious Boost': {
    description: 'Ferocious triggers on 5-6 instead of only 6.',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ rolls, successes, specialRulesApplied }) => {
        // This rule modifies Ferocious; it should be checked together.
        // For simplicity, we let Ferocious itself check for this rule.
        // Alternatively, we can override the threshold here.
        // We'll handle it in Ferocious by checking if unit has Ferocious Boost.
        // So this rule is just a marker.
        return {};
      },
    },
  },

  'Hit & Run': {
    description: 'Once per round, move up to 3" after shooting or melee.',
    hooks: {
      [HOOKS.AFTER_SHOOTING]: ({ unit, specialRulesApplied }) => {
        if (unit._hitAndRunUsed) return {};
        unit._hitAndRunUsed = true;
        specialRulesApplied.push({ rule: 'Hit & Run', effect: 'may move 3" after shooting' });
        return { hitAndRunMove: 3 };
      },
      [HOOKS.AFTER_MELEE]: ({ unit, specialRulesApplied }) => {
        if (unit._hitAndRunUsed) return {};
        unit._hitAndRunUsed = true;
        specialRulesApplied.push({ rule: 'Hit & Run', effect: 'may move 3" after melee' });
        return { hitAndRunMove: 3 };
      },
    },
  },

  'Hit & Run Fighter': {
    description: 'Once per round, move up to 3" after melee.',
    hooks: {
      [HOOKS.AFTER_MELEE]: ({ unit, specialRulesApplied }) => {
        if (unit._hitAndRunFighterUsed) return {};
        unit._hitAndRunFighterUsed = true;
        specialRulesApplied.push({ rule: 'Hit & Run Fighter', effect: 'may move 3" after melee' });
        return { hitAndRunMove: 3 };
      },
    },
  },

  Impale: {
    description: 'Against Tough(3-9), weapon gets Deadly(+3).',
    hooks: {
      [HOOKS.ON_WOUND_CALC]: ({ target, weapon, wounds, toughPerModel, specialRulesApplied }) => {
        const sr = Array.isArray(target.special_rules)
          ? target.special_rules.join(' ')
          : (target.special_rules || '');
        const m = sr.match(/Tough\((\d+)\)/);
        if (!m) return {};
        const toughVal = parseInt(m[1]);
        if (toughVal >= 3 && toughVal <= 9) {
          const extra = 3;
          const newWounds = Math.min(wounds + extra, toughPerModel);
          specialRulesApplied.push({ rule: 'Impale', effect: `+${extra} wounds (Deadly boost)` });
          return { wounds: newWounds };
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
        // Find a friendly Tough model within 3" (simplest: the unit itself if Tough)
        if (unit.tough > 1 && unit.current_models < unit.total_models) {
          const heal = dice.roll() % 3 + 1; // D3
          unit.current_models = Math.min(unit.total_models, unit.current_models + heal);
          unit._mendUsed = true;
          specialRulesApplied.push({ rule: 'Mend', effect: `healed ${heal} wound(s)` });
        }
        return {};
      },
    },
  },

  'Piercing Assault': {
    description: 'AP(+1) when charging.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ isCharging, ap, specialRulesApplied }) => {
        if (!isCharging) return {};
        specialRulesApplied.push({ rule: 'Piercing Assault', effect: 'AP+1 on charge' });
        return { ap: (ap ?? 0) + 1 };
      },
    },
  },

  Protected: {
    description: 'On a 6+, ignore a wound.',
    hooks: {
      [HOOKS.ON_INCOMING_WOUNDS]: ({ wounds, dice, specialRulesApplied }) => {
        let ignored = 0;
        for (let i = 0; i < wounds; i++) {
          if (dice.roll() >= 6) ignored++;
        }
        if (ignored > 0) {
          specialRulesApplied.push({ rule: 'Protected', effect: `${ignored}/${wounds} ignored` });
          return { wounds: wounds - ignored };
        }
        return {};
      },
    },
  },

  'Ranged Shrouding': {
    description: 'Enemies get -6" range when shooting this unit.',
    hooks: {
      [HOOKS.ON_RANGE_CHECK]: ({ target, range, specialRulesApplied }) => {
        if (target?.rules?.includes('Ranged Shrouding')) {
          specialRulesApplied.push({ rule: 'Ranged Shrouding', effect: '-6" range' });
          return { range: range - 6 };
        }
        return {};
      },
    },
  },

  Ravage: {
    description: 'In melee, roll X dice; each 6+ deals 1 wound.',
    hooks: {
      [HOOKS.BEFORE_MELEE_ATTACK]: ({ unit, dice, specialRulesApplied }) => {
        const x = unit._ruleParamValue ?? 1;
        let wounds = 0;
        for (let i = 0; i < x; i++) {
          if (dice.roll() >= 6) wounds++;
        }
        if (wounds > 0) {
          specialRulesApplied.push({ rule: 'Ravage', effect: `${wounds} extra wounds` });
          return { extraWounds: wounds };
        }
        return {};
      },
    },
  },

  'Rending in Melee Mark': {
    description: 'Once per activation, mark an enemy; friendlies get Rending in melee against it.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._rendingMarkUsed) return {};
        const target = gameState.units.find(u => u.owner !== unit.owner && u.distanceTo(unit) <= 18);
        if (target) {
          target._rendingMarked = true;
          unit._rendingMarkUsed = true;
          specialRulesApplied.push({ rule: 'Rending in Melee Mark', effect: `marked ${target.name}` });
        }
        return {};
      },
      [HOOKS.ON_PER_HIT]: ({ hitRoll, target, isMelee, specialRulesApplied }) => {
        if (isMelee && target?._rendingMarked && hitRoll.value === 6 && hitRoll.success) {
          delete target._rendingMarked; // consume
          specialRulesApplied.push({ rule: 'Rending in Melee Mark', effect: 'AP+4 from mark' });
          return { apBonus: 4 };
        }
        return {};
      },
    },
  },

  'Repel Ambushers': {
    description: 'Enemy Ambush must be >12" from this unit.',
    hooks: {
      [HOOKS.ON_RESERVE_ENTRY]: ({ unit, gameState }) => {
        // This hook is called for the enemy unit. We need to check if any unit with Repel Ambushers is nearby.
        // This is tricky because the hook is called on the unit being deployed.
        // We'll assume the engine passes all units in gameState.
        const repellors = gameState.units.filter(u => u.rules.includes('Repel Ambushers') && u.owner !== unit.owner);
        for (let rep of repellors) {
          // We need to ensure the deployment point is >12" from rep.
          // This hook returns { x, y } for the deployment. We can modify it.
          // But we don't have access to the candidate x,y here. Instead, the engine should enforce this rule.
          // We'll leave it as a note.
        }
        return {};
      },
    },
  },

  Resistance: {
    description: 'On 6+ ignore wound (2+ vs spells).',
    hooks: {
      [HOOKS.ON_INCOMING_WOUNDS]: ({ wounds, isSpell, dice, specialRulesApplied }) => {
        let ignored = 0;
        const threshold = isSpell ? 2 : 6;
        for (let i = 0; i < wounds; i++) {
          if (dice.roll() >= threshold) ignored++;
        }
        if (ignored > 0) {
          specialRulesApplied.push({ rule: 'Resistance', effect: `${ignored}/${wounds} ignored` });
          return { wounds: wounds - ignored };
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

  'Speed Feat': {
    description: 'Once per game, +3" Advance, +6" Rush/Charge.',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ unit, action, speedDelta, specialRulesApplied }) => {
        if (unit._speedFeatUsed) return {};
        unit._speedFeatUsed = true;
        const delta = action === 'Advance' ? 3 : 6;
        specialRulesApplied.push({ rule: 'Speed Feat', effect: `+${delta}"` });
        return { speedDelta: (speedDelta ?? 0) + delta };
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
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, weapon, quality, specialRulesApplied }) => {
        if ((weapon?.range ?? 0) <= 2) return {};
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

  // Aura rules
  'Ferocious Boost Aura': {
    description: 'This model and its unit get Ferocious Boost.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.rules.includes('Ferocious Boost Aura')) {
          return { additionalRules: ['Ferocious Boost'] };
        }
      },
    },
  },
  'Hit & Run Fighter Aura': {
    description: 'This model and its unit get Hit & Run Fighter.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.rules.includes('Hit & Run Fighter Aura')) {
          return { additionalRules: ['Hit & Run Fighter'] };
        }
      },
    },
  },
  'Piercing Fighter Aura': {
    description: 'This model and its unit get AP(+1) in melee.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.rules.includes('Piercing Fighter Aura')) {
          // This is not a rule but a bonus; we could add a flag or directly apply in melee.
          // For simplicity, we'll add a temporary rule.
          return { additionalRules: ['Piercing Fighter'] }; // need to define Piercing Fighter rule?
        }
        return {};
      },
    },
  },
  'Precision Charge Aura': {
    description: 'This model and its unit get +1 to hit when charging.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.rules.includes('Precision Charge Aura')) {
          return { additionalRules: ['Precision Charge'] };
        }
      },
    },
  },
  'Ranged Shrouding Aura': {
    description: 'This model and its unit get Ranged Shrouding.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.rules.includes('Ranged Shrouding Aura')) {
          return { additionalRules: ['Ranged Shrouding'] };
        }
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
      },
    },
  },
  'Speed Feat Aura': {
    description: 'This model and its unit get Speed Feat.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.rules.includes('Speed Feat Aura')) {
          return { additionalRules: ['Speed Feat'] };
        }
      },
    },
  },
  'Unpredictable Shooter Aura': {
    description: 'This model and its unit get Unpredictable Shooter.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.rules.includes('Unpredictable Shooter Aura')) {
          return { additionalRules: ['Unpredictable Shooter'] };
        }
      },
    },
  },

  // Army spells
  'Elder Protection': {
    description: 'Friendly unit gets Resistance once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          target._tempResistance = true;
          specialRulesApplied.push({ rule: 'Elder Protection', effect: `gave Resistance to ${target.name}` });
        }
      },
    },
  },
  'Death Bolt': {
    description: 'Enemy within 6" takes 1 hit AP(2) with Impale.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Death Bolt', effect: `1 hit on ${target.name}` });
          return { extraHits: [{ target, count: 1, ap: 2, impale: true }] };
        }
      },
    },
  },
  'Path of War': {
    description: 'Two friendlies get Ferocious Boost once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u => u.owner === caster.owner && u.distanceTo(caster) <= 12).slice(0, 2);
        friendlies.forEach(u => u._tempFerociousBoost = true);
        specialRulesApplied.push({ rule: 'Path of War', effect: `gave Ferocious Boost to ${friendlies.length} units` });
      },
    },
  },
  'Psychic Vomit': {
    description: 'Enemy within 6" takes 6 hits with Bane.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Psychic Vomit', effect: `6 hits on ${target.name}` });
          return { extraHits: [{ target, count: 6, bane: true }] };
        }
      },
    },
  },
  'Head Bang': {
    description: 'Up to three enemies get Rending in melee mark.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const enemies = gameState.units.filter(u => u.owner !== caster.owner && u.distanceTo(caster) <= 18).slice(0, 3);
        enemies.forEach(u => u._rendingMarked = true);
        specialRulesApplied.push({ rule: 'Head Bang', effect: `marked ${enemies.length} units` });
      },
    },
  },
  'Crackling Bolt': {
    description: 'Enemy within 18" takes 3 hits with Blast(3).',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Crackling Bolt', effect: `3 hits with Blast(3) on ${target.name}` });
          return { extraHits: [{ target, count: 3, blast: 3 }] };
        }
      },
    },
  },
};
