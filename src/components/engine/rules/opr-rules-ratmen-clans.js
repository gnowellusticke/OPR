/**
 * rules/opr-rules-ratmen-clans.js
 * Ratmen Clans faction rules from v3.5.2 (page 3)
 * Uses the enhanced RulesEngine with generic weapon info.
 */

import { HOOKS } from '../RuleRegistry.js';
import { Dice } from '../../Dice.js';

export const RATMEN_CLANS_RULES = {
  // -------------------------------------------------------------------------
  // Army‑wide rule
  // -------------------------------------------------------------------------
  Scurry: {
    description: 'Moves +2" when using Advance, and +2" when using Rush/Charge.',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ action, speedDelta, specialRulesApplied }) => {
        if (action === 'Advance') {
          specialRulesApplied.push({ rule: 'Scurry', effect: '+2"' });
          return { speedDelta: (speedDelta ?? 0) + 2 };
        }
        if (action === 'Rush' || action === 'Charge') {
          specialRulesApplied.push({ rule: 'Scurry', effect: '+2"' });
          return { speedDelta: (speedDelta ?? 0) + 2 };
        }
        return {};
      },
    },
  },

  // -------------------------------------------------------------------------
  // Special rules
  // -------------------------------------------------------------------------
  Crush: {
    description: 'When it\'s this model\'s turn to attack in melee, roll X dice. For each 6+ the target takes one hit with AP(2).',
    hooks: {
      [HOOKS.BEFORE_MELEE_ATTACK]: ({ unit, target, _ruleParamValue, specialRulesApplied }) => {
        const diceCount = _ruleParamValue || 1; // default to 1 if no param
        const hits = [];
        for (let i = 0; i < diceCount; i++) {
          const roll = Dice.roll();
          if (roll >= 6) {
            hits.push({ target, count: 1, ap: 2 });
          }
        }
        if (hits.length > 0) {
          specialRulesApplied.push({ rule: 'Crush', effect: `${hits.length} extra hits` });
          return { extraHits: hits };
        }
        return {};
      },
    },
  },

  'Defense Debuff': {
    description: 'Once per activation, before attacking, pick one enemy unit within 18", which gets -1 to defense rolls once.',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._defenseDebuffUsed) return {};
        const target = gameState.units.find(u => u.owner !== unit.owner && Math.hypot(unit.x - u.x, unit.y - u.y) <= 18);
        if (target) {
          target._defenseDebuff = true;
          unit._defenseDebuffUsed = true;
          specialRulesApplied.push({ rule: 'Defense Debuff', effect: `${target.name} -1 defense next` });
        }
        return {};
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, defense, specialRulesApplied }) => {
        if (target?._defenseDebuff) {
          delete target._defenseDebuff;
          specialRulesApplied.push({ rule: 'Defense Debuff', effect: '-1 defense' });
          return { defense: Math.min(6, defense + 1) }; // +1 because defense is higher = worse
        }
        return {};
      },
      [HOOKS.ON_ACTIVATION_END]: ({ unit }) => {
        delete unit._defenseDebuffUsed;
      },
    },
  },

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

  Hazardous: {
    description: 'Gets AP(4), but this model\'s unit takes one wound on unmodified rolls of 1 to hit.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ weaponRules, ap, specialRulesApplied }) => {
        if (!weaponRules.includes('Hazardous')) return {};
        specialRulesApplied.push({ rule: 'Hazardous', effect: 'AP(4)' });
        return { ap: 4 };
      },
      [HOOKS.AFTER_HIT_ROLLS]: ({ unit, weaponRules, rolls, specialRulesApplied }) => {
        if (!weaponRules.includes('Hazardous')) return {};
        const ones = rolls.filter(r => r.value === 1 && !r.auto).length;
        if (ones > 0) {
          specialRulesApplied.push({ rule: 'Hazardous', effect: `self-wound from ${ones} ones` });
          // We need to apply wounds to the unit. Return a selfWound field for engine to process.
          return { selfWounds: ones };
        }
        return {};
      },
    },
  },

  'Heavy Impact': {
    description: 'Counts as having Impact(X) with hits that have AP(1).',
    hooks: {
      // This modifies the Impact rule. In OPR, Impact gives extra hits on charge.
      // We need to know when Impact would normally be applied. The engine might have an ON_CHARGE hook.
      // For now, we assume Impact is handled elsewhere and we just add AP(1) to those hits.
      // Alternatively, we can hook into the melee resolution after Impact is calculated.
      // Let's use a custom approach: when a unit with Heavy Impact charges, we add extra hits with AP(1).
      [HOOKS.BEFORE_MELEE_ATTACK]: ({ unit, target, _ruleParamValue, specialRulesApplied, gameState }) => {
        // Only if the unit charged this activation
        if (!unit._charged) return {};
        const impactValue = _ruleParamValue || 1;
        // Generate Impact hits with AP(1)
        const hits = [];
        for (let i = 0; i < impactValue; i++) {
          hits.push({ target, count: 1, ap: 1 });
        }
        specialRulesApplied.push({ rule: 'Heavy Impact', effect: `${impactValue} extra hits AP(1)` });
        return { extraHits: hits };
      },
    },
  },

  'Melee Evasion': {
    description: 'Enemies get -1 to hit rolls in melee when attacking units where all models have this rule.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ target, quality, isMelee, specialRulesApplied }) => {
        if (isMelee && target?.rules?.includes('Melee Evasion')) {
          specialRulesApplied.push({ rule: 'Melee Evasion', effect: '-1 to hit' });
          return { quality: Math.min(6, quality + 1) };
        }
        return {};
      },
    },
  },

  'No Retreat': {
    description: 'When a unit where most models have this rule fails a morale test that causes it to be Shaken or Routed, the test counts as passed instead. Then, roll as many dice as the number of wounds it would take to fully destroy it, and for each result of 1-3 the unit takes one wound, which can\'t be ignored.',
    hooks: {
      [HOOKS.ON_MORALE_TEST]: ({ unit, passed, reason, specialRulesApplied }) => {
        if (!unit.special_rules.includes('No Retreat')) return {};
        if (!passed) {
          // Override to passed
          specialRulesApplied.push({ rule: 'No Retreat', effect: 'morale test passed instead' });
          // Then inflict wounds based on total wounds to destroy
          const totalWounds = unit.total_models * (unit.tough || 1);
          let wounds = 0;
          for (let i = 0; i < totalWounds; i++) {
            const roll = Dice.roll();
            if (roll <= 3) wounds++;
          }
          specialRulesApplied.push({ rule: 'No Retreat', effect: `took ${wounds} wounds` });
          // Return both passed true and extra wounds
          return { passed: true, extraWounds: wounds };
        }
        return {};
      },
    },
  },

  'Piercing Assault': {
    description: 'This model gets AP(+1) when charging.',
    hooks: {
      [HOOKS.BEFORE_MELEE_ATTACK]: ({ unit, specialRulesApplied }) => {
        if (unit._charged && unit.special_rules.includes('Piercing Assault')) {
          unit._piercingAssault = true;
          specialRulesApplied.push({ rule: 'Piercing Assault', effect: 'AP+1 on charge' });
        }
        return {};
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, ap, isMelee, specialRulesApplied }) => {
        if (isMelee && unit._piercingAssault) {
          delete unit._piercingAssault;
          return { ap: (ap ?? 0) + 1 };
        }
        return {};
      },
    },
  },

  'Quick Readjustment': {
    description: 'This model ignores penalties from shooting after moving when using Indirect weapons.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, weaponRules, quality, specialRulesApplied }) => {
        if (unit._moved && weaponRules.includes('Indirect') && unit.special_rules.includes('Quick Readjustment')) {
          specialRulesApplied.push({ rule: 'Quick Readjustment', effect: 'no move penalty' });
          // Assuming move penalty is a quality modifier; we just don't apply penalty.
          // The engine might have a separate penalty system; here we just note it.
          // For simplicity, we assume the engine applies a penalty and we override.
          // But we need to know the original quality. We'll just return no change.
          return {};
        }
        return {};
      },
    },
  },

  Ravage: {
    description: 'When it\'s this model\'s turn to attack in melee, roll X dice. For each 6+ the target takes one wound.',
    hooks: {
      [HOOKS.BEFORE_MELEE_ATTACK]: ({ unit, target, _ruleParamValue, specialRulesApplied }) => {
        const diceCount = _ruleParamValue || 1;
        let wounds = 0;
        for (let i = 0; i < diceCount; i++) {
          const roll = Dice.roll();
          if (roll >= 6) wounds++;
        }
        if (wounds > 0) {
          specialRulesApplied.push({ rule: 'Ravage', effect: `${wounds} extra wounds` });
          return { extraWounds: wounds };
        }
        return {};
      },
    },
  },

  Reinforcement: {
    description: 'When a unit where all models have this rule is Shaken or fully destroyed, you may remove it and place a new copy at the beginning of the next round after Ambushes.',
    hooks: {
      [HOOKS.ON_MODEL_KILLED]: ({ unit, gameState, specialRulesApplied }) => {
        // This is complex because we need to delay the resurrection until next round.
        // We'll mark the unit for reinforcement and let the round-end handler process it.
        if (unit.special_rules.includes('Reinforcement') && !unit._reinforcementMarked) {
          unit._reinforcementMarked = true;
          specialRulesApplied.push({ rule: 'Reinforcement', effect: 'will return next round' });
          // Store the unit data needed to respawn
          gameState._reinforcementQueue = gameState._reinforcementQueue || [];
          gameState._reinforcementQueue.push({
            unitType: unit.type,
            owner: unit.owner,
            count: unit.total_models,
            // any other data
          });
        }
        return {};
      },
      [HOOKS.ON_ROUND_START]: ({ gameState, specialRulesApplied }) => {
        if (gameState._reinforcementQueue) {
          gameState._reinforcementQueue.forEach(data => {
            // Spawn new unit within 12" of any table edge
            // For simplicity, we just log
            specialRulesApplied.push({ rule: 'Reinforcement', effect: 'spawning unit' });
            // The engine would need to create a new unit and place it.
          });
          delete gameState._reinforcementQueue;
        }
        return {};
      },
    },
  },

  'Scurry Boost': {
    description: 'If this model has Scurry, it moves +4" on Advance and +4" on Rush/Charge (instead of +2").',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ unit, action, speedDelta, specialRulesApplied }) => {
        if (!unit.special_rules.includes('Scurry') || !unit.special_rules.includes('Scurry Boost')) return {};
        if (action === 'Advance') {
          specialRulesApplied.push({ rule: 'Scurry Boost', effect: '+4"' });
          return { speedDelta: (speedDelta ?? 0) + 4 };
        }
        if (action === 'Rush' || action === 'Charge') {
          specialRulesApplied.push({ rule: 'Scurry Boost', effect: '+4"' });
          return { speedDelta: (speedDelta ?? 0) + 4 };
        }
        return {};
      },
    },
  },

  'Self-Destruct': {
    description: 'If this model is killed in melee, the attacking unit takes X hits. If it survives melee, after both sides have finished attacking, it is immediately killed, and the enemy unit takes X hits.',
    hooks: {
      [HOOKS.ON_MODEL_KILLED]: ({ unit, killer, _ruleParamValue, specialRulesApplied, gameState }) => {
        if (unit.special_rules.includes('Self-Destruct') && killer) {
          const hits = _ruleParamValue || 1;
          specialRulesApplied.push({ rule: 'Self-Destruct', effect: `${hits} hits on killer` });
          // Apply hits to killer (simplified: wounds)
          killer.current_models = Math.max(0, killer.current_models - hits);
          if (killer.current_models <= 0) killer.status = 'destroyed';
        }
        return {};
      },
      [HOOKS.AFTER_MELEE]: ({ attacker, defender, gameState, specialRulesApplied }) => {
        // Check if a unit with Self-Destruct survived
        [attacker, defender].forEach(unit => {
          if (unit.special_rules.includes('Self-Destruct') && unit.current_models > 0) {
            const hits = unit._ruleParamValue || 1;
            const enemy = unit === attacker ? defender : attacker;
            specialRulesApplied.push({ rule: 'Self-Destruct', effect: `unit self-destructs, ${hits} hits on enemy` });
            unit.current_models = 0;
            unit.status = 'destroyed';
            enemy.current_models = Math.max(0, enemy.current_models - hits);
            if (enemy.current_models <= 0) enemy.status = 'destroyed';
          }
        });
        return {};
      },
    },
  },

  Shielded: {
    description: 'Units where all models have this rule get +1 to defense rolls against hits that are not from spells.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, defense, fromSpell, specialRulesApplied }) => {
        if (!fromSpell && target?.rules?.includes('Shielded')) {
          specialRulesApplied.push({ rule: 'Shielded', effect: '+1 defense' });
          return { defense: Math.min(6, defense - 1) }; // defense is lower = better
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

  Spawn: {
    description: 'Once per game, when this model is activated, you may place a new unit of X fully within 6" of it.',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, gameState, _ruleParams, specialRulesApplied }) => {
        if (unit._spawnUsed) return {};
        // _ruleParams is the string inside parentheses, e.g., "Mine-Drones [5]"
        const spawnUnitType = _ruleParams;
        if (spawnUnitType) {
          unit._spawnUsed = true;
          specialRulesApplied.push({ rule: 'Spawn', effect: `spawn ${spawnUnitType}` });
          // The engine would need to create a new unit of that type
          return { spawnUnit: { type: spawnUnitType, count: 1, position: unit } };
        }
        return {};
      },
    },
  },

  Surge: {
    description: 'On unmodified results of 6 to hit, this weapon deals 1 extra hits (only the original hit counts as a 6 for special rules).',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ weaponRules, rolls, successes, specialRulesApplied }) => {
        if (!weaponRules.includes('Surge')) return {};
        const sixes = rolls.filter(r => r.value === 6 && !r.auto).length;
        const extraHits = sixes;
        specialRulesApplied.push({ rule: 'Surge', effect: `+${extraHits} hits from sixes` });
        return { successes: successes + extraHits };
      },
    },
  },

  'Takedown Strike': {
    description: 'Once per game, when it\'s this model\'s turn to attack in melee, you may pick one model in the unit as its target, and make one attack at Quality 2+ with AP(2) and Deadly(3), which is resolved as if it\'s a unit of 1.',
    hooks: {
      [HOOKS.BEFORE_MELEE_ATTACK]: ({ unit, target, specialRulesApplied }) => {
        if (unit._takedownUsed) return {};
        // In a real game, player chooses a specific model. We'll simulate.
        unit._takedownUsed = true;
        specialRulesApplied.push({ rule: 'Takedown Strike', effect: 'one special attack' });
        // Return an extra hit with special properties
        return {
          extraHits: [{
            target,
            count: 1,
            ap: 2,
            deadly: 3,
            qualityOverride: 2, // hits on 2+
          }]
        };
      },
    },
  },

  'Unpredictable Fighter': {
    description: 'When in melee, roll one die and apply one effect to all models with this rule: on a 1‑3 they get AP(+1), and on a 4‑6 they get +1 to hit rolls instead.',
    hooks: {
      [HOOKS.BEFORE_MELEE_ATTACK]: ({ unit, dice, specialRulesApplied }) => {
        if (!unit.special_rules.includes('Unpredictable Fighter')) return {};
        const roll = dice.roll();
        const mode = roll <= 3 ? 'ap' : 'hit';
        unit._unpredictableFighterMode = mode;
        specialRulesApplied.push({ rule: 'Unpredictable Fighter', effect: `mode = ${mode}` });
        return {};
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, isMelee, specialRulesApplied }) => {
        if (isMelee && unit._unpredictableFighterMode === 'hit') {
          specialRulesApplied.push({ rule: 'Unpredictable Fighter', effect: '+1 to hit' });
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, ap, isMelee, specialRulesApplied }) => {
        if (isMelee && unit._unpredictableFighterMode === 'ap') {
          specialRulesApplied.push({ rule: 'Unpredictable Fighter', effect: 'AP+1' });
          return { ap: (ap ?? 0) + 1 };
        }
        return {};
      },
      [HOOKS.AFTER_MELEE_ATTACK]: ({ unit }) => {
        delete unit._unpredictableFighterMode;
      },
    },
  },

  // -------------------------------------------------------------------------
  // Aura special rules
  // -------------------------------------------------------------------------
  'Ambush Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Ambush'] }) },
  },
  'Evasive Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Evasive'] }) },
  },
  'Melee Evasion Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Melee Evasion'] }) },
  },
  'Piercing Assault Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Piercing Assault'] }) },
  },
  'Precision Shooter Aura': {
    description: '+1 to hit rolls when shooting.',
    hooks: {
      [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Precision Shooter'] }),
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, isMelee, specialRulesApplied }) => {
        if (!isMelee && unit.special_rules.includes('Precision Shooter')) {
          specialRulesApplied.push({ rule: 'Precision Shooter', effect: '+1 to hit' });
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
    },
  },
  'Scurry Boost Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Scurry Boost'] }) },
  },

  // -------------------------------------------------------------------------
  // Army spells
  // -------------------------------------------------------------------------
  'Weapon Booster': {
    description: 'Pick one friendly unit within 12", which gets Scurry Boost once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const target = gameState.units.find(u => u.owner === caster.owner && Math.hypot(u.x - caster.x, u.y - caster.y) <= 12);
        if (target) {
          target._tempScurryBoost = true;
          specialRulesApplied.push({ rule: 'Weapon Booster', effect: `gave Scurry Boost to ${target.name}` });
        }
        return {};
      },
      [HOOKS.MODIFY_SPEED]: ({ unit, action, speedDelta, specialRulesApplied }) => {
        if (unit._tempScurryBoost && unit.special_rules.includes('Scurry')) {
          delete unit._tempScurryBoost;
          if (action === 'Advance') {
            specialRulesApplied.push({ rule: 'Weapon Booster', effect: '+4"' });
            return { speedDelta: (speedDelta ?? 0) + 4 };
          }
          if (action === 'Rush' || action === 'Charge') {
            specialRulesApplied.push({ rule: 'Weapon Booster', effect: '+4"' });
            return { speedDelta: (speedDelta ?? 0) + 4 };
          }
        }
        return {};
      },
    },
  },

  'Focused Shock': {
    description: 'Pick one enemy unit within 12" which takes 2 hits with AP(1) and Shred.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (!target) return {};
        specialRulesApplied.push({ rule: 'Focused Shock', effect: `2 hits (AP1, Shred) on ${target.name}` });
        return {
          extraHits: [{ target, count: 2, ap: 1, shred: true }]
        };
      },
    },
  },

  'Tech-Sickness': {
    description: 'Pick up to two enemy units within 18", which get -1 to defense rolls once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const enemies = gameState.units.filter(u => u.owner !== caster.owner && Math.hypot(u.x - caster.x, u.y - caster.y) <= 18).slice(0, 2);
        enemies.forEach(e => e._defenseDebuff = true);
        specialRulesApplied.push({ rule: 'Tech-Sickness', effect: `-1 defense on ${enemies.length} units` });
        return {};
      },
      // Defense debuff handled by same mechanism as Defense Debuff rule
    },
  },

  'System Takeover': {
    description: 'Pick one enemy unit within 12", which takes 6 hits.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (!target) return {};
        specialRulesApplied.push({ rule: 'System Takeover', effect: `6 hits on ${target.name}` });
        return {
          extraHits: [{ target, count: 6, ap: 0 }]
        };
      },
    },
  },

  'Enhance Serum': {
    description: 'Pick up to three friendly units within 12", which get Regeneration once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u => u.owner === caster.owner && Math.hypot(u.x - caster.x, u.y - caster.y) <= 12).slice(0, 3);
        friendlies.forEach(u => u._tempRegeneration = true);
        specialRulesApplied.push({ rule: 'Enhance Serum', effect: `gave Regeneration to ${friendlies.length} units` });
        return {};
      },
      [HOOKS.ON_INCOMING_WOUNDS]: ({ unit, wounds, specialRulesApplied }) => {
        if (unit._tempRegeneration) {
          delete unit._tempRegeneration;
          // Apply Regeneration (5+ ignore)
          let ignored = 0;
          for (let i = 0; i < wounds; i++) {
            const roll = Dice.roll();
            if (roll >= 5) ignored++;
          }
          specialRulesApplied.push({ rule: 'Enhance Serum', effect: `ignored ${ignored} wounds` });
          return { wounds: wounds - ignored };
        }
        return {};
      },
    },
  },

  'Power Surge': {
    description: 'Pick one enemy model within 12", which takes 6 hits with Hazardous. Roll as many dice as hits to see if "on rolls of 1" effects trigger.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (!target) return {};
        specialRulesApplied.push({ rule: 'Power Surge', effect: `6 hits with Hazardous on ${target.name}` });
        return {
          extraHits: [{ target, count: 6, ap: 0, hazardous: true }]
        };
      },
      // Hazardous effect will be handled by the Hazardous rule on the weapon
    },
  },
};
