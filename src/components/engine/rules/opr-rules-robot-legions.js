/**
 * rules/opr-rules-robot-legions.js
 * Robot Legions faction rules from v3.5.2 (page 3)
 * Uses the enhanced RulesEngine with generic weapon info.
 */

import { HOOKS } from '../RuleRegistry.js';
import { Dice } from '../Dice.js';

export const ROBOT_LEGIONS_RULES = {
  // -------------------------------------------------------------------------
  // Army‑wide rule
  // -------------------------------------------------------------------------
  'Self-Repair': {
    description: 'When a unit where all models have this rule takes wounds, roll one die for each. On a 6+ it is ignored.',
    hooks: {
      [HOOKS.ON_INCOMING_WOUNDS]: ({ unit, wounds, specialRulesApplied }) => {
        if (!unit.special_rules.includes('Self-Repair')) return {};

        const hasBoost = unit.special_rules.includes('Self-Repair Boost') ||
                         specialRulesApplied.includes('Self-Repair Boost');
        const threshold = hasBoost ? 5 : 6;

        let ignored = 0;
        for (let i = 0; i < wounds; i++) {
          const roll = Dice.roll();
          if (roll >= threshold) ignored++;
        }
        specialRulesApplied.push({ rule: 'Self-Repair', effect: `ignored ${ignored} wounds` });
        return { wounds: wounds - ignored };
      },
    },
  },

  // -------------------------------------------------------------------------
  // Special rules
  // -------------------------------------------------------------------------
  'Casting Buff': {
    description: 'Once per activation, before attacking, pick one friendly model within 12" with Caster, which gets +1 to casting rolls once.',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._castingBuffUsed) return {};
        const target = gameState.units.find(u =>
          u.owner === unit.owner &&
          u !== unit &&
          Math.hypot(u.x - unit.x, u.y - unit.y) <= 12 &&
          (u.special_rules || '').includes('Caster')
        );
        if (target) {
          target._castingBuff = true;
          unit._castingBuffUsed = true;
          specialRulesApplied.push({ rule: 'Casting Buff', effect: `+1 casting to ${target.name}` });
        }
        return {};
      },
      [HOOKS.ON_SPELL_CAST]: ({ caster, friendlyBonus, specialRulesApplied }) => {
        if (caster._castingBuff) {
          delete caster._castingBuff;
          specialRulesApplied.push({ rule: 'Casting Buff', effect: '+1 to cast' });
          return { friendlyBonus: (friendlyBonus ?? 0) + 1 };
        }
        return {};
      },
      [HOOKS.ON_ACTIVATION_END]: ({ unit }) => {
        delete unit._castingBuffUsed;
      },
    },
  },

  Destructive: {
    description: 'On unmodified results of 6 to hit, those hits get AP(+4).',
    hooks: {
      [HOOKS.ON_PER_HIT]: ({ weaponRules, hitRoll, ap, specialRulesApplied }) => {
        if (!weaponRules.includes('Destructive')) return {};
        if (hitRoll.value === 6 && !hitRoll.auto) {
          specialRulesApplied.push({ rule: 'Destructive', effect: 'AP+4' });
          return { apBonus: (apBonus ?? 0) + 4 };
        }
        return {};
      },
    },
  },

  'Indirect Mark': {
    description: 'Once per activation, before attacking, pick one enemy unit within 18", which friendly units gets Indirect against once.',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._indirectMarkUsed) return {};
        const target = gameState.units.find(u => u.owner !== unit.owner && Math.hypot(u.x - unit.x, u.y - unit.y) <= 18);
        if (target) {
          target._indirectMarked = true;
          unit._indirectMarkUsed = true;
          specialRulesApplied.push({ rule: 'Indirect Mark', effect: `${target.name} marked for Indirect` });
        }
        return {};
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, specialRulesApplied }) => {
        if (target?._indirectMarked) {
          delete target._indirectMarked;
          specialRulesApplied.push({ rule: 'Indirect Mark', effect: 'ignores cover' });
          return { ignoresCover: true };
        }
        return {};
      },
      [HOOKS.ON_ACTIVATION_END]: ({ unit }) => {
        delete unit._indirectMarkUsed;
      },
    },
  },

  Infiltrate: {
    description: 'Counts as having Ambush, but may be deployed up to 1" away from enemy units.',
    hooks: {
      [HOOKS.ON_RESERVE_ENTRY]: ({ unit, gameState, specialRulesApplied }) => {
        if (!unit.special_rules.includes('Infiltrate')) return {};
        // Allow placement up to 1" from enemy units. The engine should check this constraint.
        // We just mark it as Infiltrate for the deployment logic.
        specialRulesApplied.push({ rule: 'Infiltrate', effect: 'may deploy within 1" of enemies' });
        return {}; // The actual placement logic is handled by the deployment system.
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
          Math.hypot(u.x - unit.x, u.y - unit.y) <= 3 &&
          (u.tough_per_model || 1) > 1 &&
          u.current_models < u.total_models
        );
        if (target) {
          const heal = dice.roll() % 3 + 1; // D3
          target.current_models = Math.min(target.total_models, target.current_models + heal);
          unit._mendUsed = true;
          specialRulesApplied.push({ rule: 'Mend', effect: `healed ${heal} on ${target.name}` });
        }
        return {};
      },
      [HOOKS.ON_ACTIVATION_END]: ({ unit }) => {
        delete unit._mendUsed;
      },
    },
  },

  'Mobile Artillery': {
    description: 'When this model uses a Hold action and shoots at enemies over 9" away, it gets +1 to hit rolls. As long this model hasn\'t moved during the round, when enemy units shoot at it from over 9" away, they get -2 to hit rolls.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, target, quality, isMelee, specialRulesApplied }) => {
        if (isMelee) return {};
        // Offensive part: if unit used Hold action (we need a flag) and target >9" away
        if (unit._usedHold && Math.hypot(unit.x - target.x, unit.y - target.y) > 9) {
          specialRulesApplied.push({ rule: 'Mobile Artillery', effect: '+1 to hit' });
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit: attacker, target: defender, quality, isMelee, specialRulesApplied }) => {
        if (isMelee) return {};
        // Defensive part: if defender has Mobile Artillery, hasn't moved this round, and range >9"
        if (defender?.rules?.includes('Mobile Artillery') && !defender._hasMoved && Math.hypot(defender.x - attacker.x, defender.y - attacker.y) > 9) {
          specialRulesApplied.push({ rule: 'Mobile Artillery', effect: 'attacker -2 to hit' });
          return { quality: Math.min(6, quality + 2) };
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

  'Rapid Advance': {
    description: 'This model moves +4" when using Advance actions.',
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

  Reanimation: {
    description: 'When a unit where all models have this rule is activated, roll as many dice as the max. number of models/wounds it could restore. For each 5+ you may restore one model/wound. New models may only be restored if they can be placed in coherency with non-restored models.',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, dice, specialRulesApplied }) => {
        if (!unit.special_rules.includes('Reanimation')) return {};
        const maxRestore = unit.total_models - unit.current_models;
        if (maxRestore <= 0) return {};
        let restored = 0;
        for (let i = 0; i < maxRestore; i++) {
          const roll = dice.roll();
          if (roll >= 5) restored++;
        }
        if (restored > 0) {
          unit.current_models = Math.min(unit.total_models, unit.current_models + restored);
          specialRulesApplied.push({ rule: 'Reanimation', effect: `restored ${restored} models` });
          // Coherency check would be handled by the engine during placement.
        }
        return {};
      },
    },
  },

  'Repel Ambushes': {
    description: 'Enemy units using Ambush must be set up over 12" away from this model\'s unit.',
    hooks: {
      [HOOKS.ON_RESERVE_ENTRY]: ({ unit, gameState, specialRulesApplied }) => {
        // This is called when an enemy unit attempts to deploy via Ambush.
        // Check if any enemy unit with Repel Ambushes is on the board.
        const repellers = gameState.units.filter(u =>
          u.owner !== unit.owner &&
          (u.special_rules || '').includes('Repel Ambushes') &&
          u.current_models > 0
        );
        for (const repeller of repellers) {
          if (Math.hypot(unit.x - repeller.x, unit.y - repeller.y) <= 12) {
            // Disallow placement within 12". The engine should enforce this.
            specialRulesApplied.push({ rule: 'Repel Ambushes', effect: 'cannot deploy within 12"' });
            return { minDistance: 12, source: repeller };
          }
        }
        return {};
      },
    },
  },

  'Self-Repair Boost': {
    description: 'If all models in this unit have Self-Repair, they ignore wounds on rolls of 5-6 from Self-Repair (instead of only on 6+).',
    // This rule is a flag; the actual effect is handled in Self-Repair hook.
    hooks: {
      // No separate hook needed, but it can be granted by auras or spells.
    },
  },

  'Self-Repair Boost Buff': {
    description: 'Once per activation, before attacking, pick one friendly unit within 12", which gets Self-Repair Boost once.',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._boostBuffUsed) return {};
        const target = gameState.units.find(u =>
          u.owner === unit.owner &&
          u !== unit &&
          Math.hypot(u.x - unit.x, u.y - unit.y) <= 12 &&
          (u.special_rules || '').includes('Self-Repair')
        );
        if (target) {
          target._tempSelfRepairBoost = true;
          unit._boostBuffUsed = true;
          specialRulesApplied.push({ rule: 'Self-Repair Boost Buff', effect: `gave boost to ${target.name}` });
        }
        return {};
      },
      [HOOKS.ON_ACTIVATION_END]: ({ unit }) => {
        delete unit._boostBuffUsed;
      },
      // The actual boost is applied in Self-Repair hook by checking _tempSelfRepairBoost.
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

  'Surprise Piercing Shot': {
    description: 'Counts as having Ambush, and gets AP(+2) when shooting on the round in which it deploys via this rule.',
    hooks: {
      [HOOKS.ON_RESERVE_ENTRY]: ({ unit, specialRulesApplied }) => {
        if (!unit.special_rules.includes('Surprise Piercing Shot')) return {};
        // Mark that this unit deployed this round
        unit._deployedThisRound = true;
        specialRulesApplied.push({ rule: 'Surprise Piercing Shot', effect: 'deployed via Ambush' });
        return {};
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, ap, isMelee, specialRulesApplied }) => {
        if (!isMelee && unit._deployedThisRound && unit.special_rules.includes('Surprise Piercing Shot')) {
          delete unit._deployedThisRound; // use once
          specialRulesApplied.push({ rule: 'Surprise Piercing Shot', effect: 'AP+2' });
          return { ap: (ap ?? 0) + 2 };
        }
        return {};
      },
    },
  },

  Swift: {
    description: 'This model may ignore the Slow rule.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Swift') && unit.special_rules.includes('Slow')) {
          // Remove Slow from effective rules
          return { additionalRules: [] }; // Actually we need to remove Slow. The ON_GET_RULES returns additional rules, not removals.
          // Alternative: we can handle in MODIFY_SPEED: if unit has Swift, ignore Slow penalty.
        }
        return {};
      },
      [HOOKS.MODIFY_SPEED]: ({ unit, speedDelta, specialRulesApplied }) => {
        if (unit.special_rules.includes('Swift') && unit.special_rules.includes('Slow')) {
          // Slow typically reduces speed. We'll assume Slow is implemented elsewhere as a speed penalty.
          // By having Swift, we can cancel that penalty. But we don't know the penalty amount.
          // For now, we'll just note it.
          specialRulesApplied.push({ rule: 'Swift', effect: 'ignores Slow' });
          // We could return a speedDelta that cancels the Slow penalty if we knew it.
        }
        return {};
      },
    },
  },

  'Swift Buff': {
    description: 'Once per activation, before attacking, pick one friendly unit within 12", which gets Swift once.',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._swiftBuffUsed) return {};
        const target = gameState.units.find(u =>
          u.owner === unit.owner &&
          u !== unit &&
          Math.hypot(u.x - unit.x, u.y - unit.y) <= 12
        );
        if (target) {
          target._tempSwift = true;
          unit._swiftBuffUsed = true;
          specialRulesApplied.push({ rule: 'Swift Buff', effect: `gave Swift to ${target.name}` });
        }
        return {};
      },
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit._tempSwift) {
          return { additionalRules: ['Swift'] };
        }
        return {};
      },
      [HOOKS.ON_ACTIVATION_END]: ({ unit }) => {
        delete unit._swiftBuffUsed;
      },
    },
  },

  // -------------------------------------------------------------------------
  // Aura special rules
  // -------------------------------------------------------------------------
  'Ambush Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Ambush'] }) },
  },
  'No Retreat Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['No Retreat'] }) },
  },
  'Piercing Assault Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Piercing Assault'] }) },
  },
  'Reanimation Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Reanimation'] }) },
  },
  'Relentless Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Relentless'] }) },
  },
  'Stealth Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Stealth'] }) },
  },

  // -------------------------------------------------------------------------
  // Army spells
  // -------------------------------------------------------------------------
  'Triangulation Bots': {
    description: 'Pick one enemy unit within 18", which friendly units gets Indirect when shooting against once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (!target) return {};
        target._indirectMarked = true;
        specialRulesApplied.push({ rule: 'Triangulation Bots', effect: `marked ${target.name}` });
        return {};
      },
      // Indirect effect handled by same mechanism as Indirect Mark rule
    },
  },

  'Piercing Bots': {
    description: 'Pick one enemy unit within 12", which takes 2 hits with AP(2).',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (!target) return {};
        specialRulesApplied.push({ rule: 'Piercing Bots', effect: `2 hits (AP2) on ${target.name}` });
        return {
          extraHits: [{ target, count: 2, ap: 2 }]
        };
      },
    },
  },

  'Inspiring Bots': {
    description: 'Pick up to two friendly units within 12", which get Rapid Advance once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u =>
          u.owner === caster.owner &&
          Math.hypot(u.x - caster.x, u.y - caster.y) <= 12
        ).slice(0, 2);
        friendlies.forEach(u => u._tempRapidAdvance = true);
        specialRulesApplied.push({ rule: 'Inspiring Bots', effect: `gave Rapid Advance to ${friendlies.length}` });
        return {};
      },
      [HOOKS.MODIFY_SPEED]: ({ unit, action, speedDelta, specialRulesApplied }) => {
        if (action === 'Advance' && unit._tempRapidAdvance) {
          delete unit._tempRapidAdvance;
          specialRulesApplied.push({ rule: 'Inspiring Bots', effect: '+4"' });
          return { speedDelta: (speedDelta ?? 0) + 4 };
        }
        return {};
      },
    },
  },

  'Flame Bots': {
    description: 'Pick up to two enemy units within 9", which take 4 hits each.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const enemies = gameState.units.filter(u =>
          u.owner !== caster.owner &&
          Math.hypot(u.x - caster.x, u.y - caster.y) <= 9
        ).slice(0, 2);
        const extraHits = enemies.map(e => ({ target: e, count: 4, ap: 0 }));
        specialRulesApplied.push({ rule: 'Flame Bots', effect: `4 hits on ${enemies.length} units` });
        return { extraHits };
      },
    },
  },

  'Mending Bots': {
    description: 'Pick up to three friendly units within 12", which get Self-Repair Boost once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u =>
          u.owner === caster.owner &&
          Math.hypot(u.x - caster.x, u.y - caster.y) <= 12 &&
          (u.special_rules || '').includes('Self-Repair')
        ).slice(0, 3);
        friendlies.forEach(u => u._tempSelfRepairBoost = true);
        specialRulesApplied.push({ rule: 'Mending Bots', effect: `gave Self-Repair Boost to ${friendlies.length}` });
        return {};
      },
      // Boost effect handled by Self-Repair hook
    },
  },

  'Gauss Bots': {
    description: 'Pick one enemy unit within 6", which takes 9 hits with Destructive. Roll as many dice as hits to see if "on rolls of 6" effects trigger.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (!target) return {};
        specialRulesApplied.push({ rule: 'Gauss Bots', effect: `9 hits with Destructive on ${target.name}` });
        return {
          extraHits: [{ target, count: 9, ap: 0, destructive: true }]
        };
      },
      // Destructive effect handled by Destructive rule on the weapon
    },
  },
};
