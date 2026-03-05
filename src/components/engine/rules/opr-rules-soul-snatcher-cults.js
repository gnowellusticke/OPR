/**
 * rules/opr-rules-soul-snatcher-cults.js
 * Soul-Snatcher Cults faction rules from v3.5.2 (page 3)
 * Uses the enhanced RulesEngine with generic weapon info.
 */

import { HOOKS } from '../RuleRegistry.js';
import { Dice } from '../Dice.js';

export const SOUL_SNATCHER_CULTS_RULES = {
  // -------------------------------------------------------------------------
  // Army‑wide rule
  // -------------------------------------------------------------------------
  Fanatic: {
    description: 'After this model is deployed, it may be placed anywhere fully within 9" of its position.',
    hooks: {
      [HOOKS.ON_DEPLOY]: ({ unit, specialRulesApplied }) => {
        if (!unit.special_rules.includes('Fanatic')) return {};
        // This hook is called after initial deployment. Allow reposition.
        specialRulesApplied.push({ rule: 'Fanatic', effect: 'may redeploy within 9"' });
        return { fanaticRedeploy: { distance: 9 } };
      },
    },
  },

  // -------------------------------------------------------------------------
  // Special rules
  // -------------------------------------------------------------------------
  Bounding: {
    description: 'When this unit is activated, you may place all models with this rule in it anywhere fully within D3+1" of their position.',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, dice, specialRulesApplied }) => {
        if (unit._boundingUsed) return {};
        const distance = dice.roll('D3') + 1;
        unit._boundingUsed = true;
        specialRulesApplied.push({ rule: 'Bounding', effect: `may reposition up to ${distance}"` });
        return { boundingMove: { distance } };
      },
      [HOOKS.ON_ACTIVATION_END]: ({ unit }) => {
        delete unit._boundingUsed;
      },
    },
  },

  'Grounded Precision': {
    description: 'If a unit where all models have this rule has most of them within 1" of terrain, they get +1 to hit rolls when attacking.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, specialRulesApplied, gameState }) => {
        if (!unit.special_rules.includes('Grounded Precision')) return {};
        // Check if most models are within 1" of any terrain
        const modelsNearTerrain = unit.models.filter(m => 
          gameState.terrain.some(t => Math.hypot(m.x - t.x, m.y - t.y) <= 1)
        ).length;
        if (modelsNearTerrain > unit.models.length / 2) {
          specialRulesApplied.push({ rule: 'Grounded Precision', effect: '+1 to hit' });
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
    },
  },

  'Grounded Reinforcement': {
    description: 'If a unit where all models have this rule has most of them within 1" of terrain, they get +1 to defense rolls.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, defense, specialRulesApplied, gameState }) => {
        if (!target?.rules?.includes('Grounded Reinforcement')) return {};
        const modelsNearTerrain = target.models.filter(m => 
          gameState.terrain.some(t => Math.hypot(m.x - t.x, m.y - t.y) <= 1)
        ).length;
        if (modelsNearTerrain > target.models.length / 2) {
          specialRulesApplied.push({ rule: 'Grounded Reinforcement', effect: '+1 defense' });
          return { defense: Math.min(6, defense - 1) };
        }
        return {};
      },
    },
  },

  'Increased Shooting Range Buff': {
    description: 'Once per activation, before attacking, pick one friendly unit within 12" which gets +6" range when shooting once.',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._rangeBuffUsed) return {};
        const target = gameState.units.find(u =>
          u.owner === unit.owner &&
          u !== unit &&
          Math.hypot(u.x - unit.x, u.y - unit.y) <= 12
        );
        if (target) {
          target._tempRangeBonus = 6;
          unit._rangeBuffUsed = true;
          specialRulesApplied.push({ rule: 'Increased Shooting Range Buff', effect: `+6" range for ${target.name}` });
        }
        return {};
      },
      [HOOKS.BEFORE_ATTACK]: ({ unit, weapon, specialRulesApplied }) => {
        if (unit._tempRangeBonus) {
          // This hook is called per attack; we apply the range bonus to the weapon for this attack.
          // The engine should add this bonus to weapon range when checking.
          specialRulesApplied.push({ rule: 'Increased Shooting Range Buff', effect: '+6" range' });
          return { weaponRangeBonus: unit._tempRangeBonus };
        }
        return {};
      },
      [HOOKS.AFTER_ATTACK]: ({ unit }) => {
        delete unit._tempRangeBonus;
      },
      [HOOKS.ON_ACTIVATION_END]: ({ unit }) => {
        delete unit._rangeBuffUsed;
      },
    },
  },

  'Melee Slayer': {
    description: 'This model\'s melee weapons get AP(+2) against units where most models have Tough(3) or higher.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, target, ap, isMelee, specialRulesApplied }) => {
        if (!isMelee || !unit.special_rules.includes('Melee Slayer')) return {};
        if (target && target.tough >= 3) {
          specialRulesApplied.push({ rule: 'Melee Slayer', effect: 'AP+2' });
          return { ap: (ap ?? 0) + 2 };
        }
        return {};
      },
    },
  },

  'Mind Control': {
    description: 'Once per activation, before attacking, pick one enemy unit within 18" which must take a morale test. If failed you may move it by up to 6" in a straight line in any direction.',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, gameState, dice, specialRulesApplied }) => {
        if (unit._mindControlUsed) return {};
        const target = gameState.units.find(u => u.owner !== unit.owner && Math.hypot(u.x - unit.x, u.y - unit.y) <= 18);
        if (target) {
          // Perform morale test (use unit's quality as morale? In OPR, morale is based on quality)
          const moraleRoll = dice.roll();
          const passed = moraleRoll >= target.quality;
          if (!passed) {
            unit._mindControlUsed = true;
            specialRulesApplied.push({ rule: 'Mind Control', effect: `move ${target.name} up to 6"` });
            return {
              forcedMove: {
                target,
                distance: 6,
                // Direction to be chosen by player
              }
            };
          }
        }
        return {};
      },
      [HOOKS.ON_ACTIVATION_END]: ({ unit }) => {
        delete unit._mindControlUsed;
      },
    },
  },

  'Precision Shooting Mark': {
    description: 'Once per activation, before attacking, pick one enemy unit within 18" which friendly units get +1 to hit rolls when shooting against once.',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._precisionMarkUsed) return {};
        const target = gameState.units.find(u => u.owner !== unit.owner && Math.hypot(u.x - unit.x, u.y - unit.y) <= 18);
        if (target) {
          target._precisionMarked = true;
          unit._precisionMarkUsed = true;
          specialRulesApplied.push({ rule: 'Precision Shooting Mark', effect: `${target.name} marked +1 to hit` });
        }
        return {};
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ attacker, target, quality, isMelee, specialRulesApplied }) => {
        if (!isMelee && target?._precisionMarked && attacker.owner === unit.owner) {
          delete target._precisionMarked;
          specialRulesApplied.push({ rule: 'Precision Shooting Mark', effect: '+1 to hit' });
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
      [HOOKS.ON_ACTIVATION_END]: ({ unit }) => {
        delete unit._precisionMarkUsed;
      },
    },
  },

  Quick: {
    description: 'Moves +2" when using Advance, and +2" when using Rush/Charge.',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ action, speedDelta, specialRulesApplied }) => {
        if (action === 'Advance' || action === 'Rush' || action === 'Charge') {
          specialRulesApplied.push({ rule: 'Quick', effect: '+2"' });
          return { speedDelta: (speedDelta ?? 0) + 2 };
        }
        return {};
      },
    },
  },

  'Quick Shot': {
    description: 'This model may shoot after using Rush actions.',
    hooks: {
      // This rule modifies the normal restriction. We need a hook that checks if shooting is allowed.
      // Assuming the engine has a hook CAN_SHOOT_AFTER_MOVE.
      [HOOKS.CAN_SHOOT_AFTER_MOVE]: ({ unit, action, specialRulesApplied }) => {
        if (unit.special_rules.includes('Quick Shot') && action === 'Rush') {
          specialRulesApplied.push({ rule: 'Quick Shot', effect: 'may shoot after Rush' });
          return { canShoot: true };
        }
        return {};
      },
    },
  },

  'Re-Deployment': {
    description: 'After all other units are deployed, you may remove up to two friendly units from the table and deploy them again. Players alternate in placing Re-Deployment units, starting with the player that activates next.',
    hooks: {
      [HOOKS.AFTER_DEPLOYMENT]: ({ gameState, specialRulesApplied }) => {
        // This hook is called after all initial deployment. We need to allow the player to select units.
        // The engine should handle the UI. We'll just mark eligible units.
        const eligibleUnits = gameState.units.filter(u => u.owner === gameState.currentPlayer && !u.is_in_reserve);
        if (eligibleUnits.length > 0) {
          specialRulesApplied.push({ rule: 'Re-Deployment', effect: 'may redeploy up to 2 units' });
          return { redeployUnits: eligibleUnits.slice(0, 2) };
        }
        return {};
      },
    },
  },

  Reap: {
    description: 'Against units where most models have Defense 2+ to 3+, this weapon gets AP(+2).',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, specialRulesApplied }) => {
        if (!target) return {};
        if (target.defense >= 2 && target.defense <= 3) {
          specialRulesApplied.push({ rule: 'Reap', effect: 'AP+2' });
          return { ap: (ap ?? 0) + 2 };
        }
        return {};
      },
    },
  },

  Reinforcement: {
    description: 'When a unit where all models have this rule is Shaken or fully destroyed, you may remove it and place a new copy at the beginning of the next round after Ambushes.',
    hooks: {
      [HOOKS.ON_MODEL_KILLED]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit.special_rules.includes('Reinforcement') && !unit._reinforcementMarked) {
          unit._reinforcementMarked = true;
          specialRulesApplied.push({ rule: 'Reinforcement', effect: 'will return next round' });
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
            // Spawn new unit within 12" of any table edge, cannot contest objectives this round
            specialRulesApplied.push({ rule: 'Reinforcement', effect: 'spawning unit (cannot contest objectives)' });
            // The engine would create a new unit and mark it as unable to contest this round.
          });
          delete gameState._reinforcementQueue;
        }
        return {};
      },
    },
  },

  'Repel Ambushes': {
    description: 'Enemy units using Ambush must be set up over 12" away from this model\'s unit.',
    hooks: {
      [HOOKS.ON_RESERVE_ENTRY]: ({ unit, gameState, specialRulesApplied }) => {
        const repellers = gameState.units.filter(u =>
          u.owner !== unit.owner &&
          (u.special_rules || '').includes('Repel Ambushes') &&
          u.current_models > 0
        );
        for (const repeller of repellers) {
          if (Math.hypot(unit.x - repeller.x, unit.y - repeller.y) <= 12) {
            specialRulesApplied.push({ rule: 'Repel Ambushes', effect: 'cannot deploy within 12"' });
            return { minDistance: 12, source: repeller };
          }
        }
        return {};
      },
    },
  },

  Slayer: {
    description: 'This model\'s weapons get AP(+2) against units where most models have Tough(3) or higher.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, target, ap, specialRulesApplied }) => {
        if (!unit.special_rules.includes('Slayer')) return {};
        if (target && target.tough >= 3) {
          specialRulesApplied.push({ rule: 'Slayer', effect: 'AP+2' });
          return { ap: (ap ?? 0) + 2 };
        }
        return {};
      },
    },
  },

  'Speed Buff': {
    description: 'Once per activation, before attacking, pick one friendly unit within 12" which moves +2" when using Advance and +4" when using Rush/Charge once.',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._speedBuffUsed) return {};
        const target = gameState.units.find(u =>
          u.owner === unit.owner &&
          u !== unit &&
          Math.hypot(u.x - unit.x, u.y - unit.y) <= 12
        );
        if (target) {
          target._speedBuff = true;
          unit._speedBuffUsed = true;
          specialRulesApplied.push({ rule: 'Speed Buff', effect: `+2"/+4" speed for ${target.name}` });
        }
        return {};
      },
      [HOOKS.MODIFY_SPEED]: ({ unit, action, speedDelta, specialRulesApplied }) => {
        if (unit._speedBuff) {
          if (action === 'Advance') {
            specialRulesApplied.push({ rule: 'Speed Buff', effect: '+2"' });
            return { speedDelta: (speedDelta ?? 0) + 2 };
          }
          if (action === 'Rush' || action === 'Charge') {
            specialRulesApplied.push({ rule: 'Speed Buff', effect: '+4"' });
            return { speedDelta: (speedDelta ?? 0) + 4 };
          }
        }
        return {};
      },
      [HOOKS.ON_ACTIVATION_END]: ({ unit }) => {
        delete unit._speedBuff;
        delete unit._speedBuffUsed;
      },
    },
  },

  'Spell Conduit': {
    description: 'Casters within 12" that are from other friendly units may cast spells as if they were in this model\'s position, and get +1 to casting rolls when doing so.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const conduit = gameState.units.find(u =>
          u.owner === caster.owner &&
          u !== caster &&
          (u.special_rules || '').includes('Spell Conduit') &&
          Math.hypot(u.x - caster.x, u.y - caster.y) <= 12
        );
        if (conduit) {
          specialRulesApplied.push({ rule: 'Spell Conduit', effect: 'casting from conduit, +1' });
          return {
            castPosition: conduit,
            friendlyBonus: 1,
          };
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
    description: 'Once per game, when it\'s this model\'s turn to attack in melee, you may pick one model in the unit as its target, and make one attack at Quality 2+ with AP(2) and Deadly(3).',
    hooks: {
      [HOOKS.BEFORE_MELEE_ATTACK]: ({ unit, target, specialRulesApplied }) => {
        if (unit._takedownUsed) return {};
        unit._takedownUsed = true;
        specialRulesApplied.push({ rule: 'Takedown Strike', effect: 'one special attack' });
        return {
          extraHits: [{
            target,
            count: 1,
            ap: 2,
            deadly: 3,
            qualityOverride: 2,
          }]
        };
      },
    },
  },

  Teleport: {
    description: 'Once per activation, before attacking, place this model anywhere fully within 6" of its position.',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, specialRulesApplied }) => {
        if (unit._teleportUsed) return {};
        unit._teleportUsed = true;
        specialRulesApplied.push({ rule: 'Teleport', effect: 'may teleport up to 6"' });
        return { teleport: { distance: 6 } };
      },
      [HOOKS.ON_ACTIVATION_END]: ({ unit }) => {
        delete unit._teleportUsed;
      },
    },
  },

  // -------------------------------------------------------------------------
  // Auras
  // -------------------------------------------------------------------------
  'Grounded Precision Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Grounded Precision'] }) },
  },
  'Grounded Reinforcement Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Grounded Reinforcement'] }) },
  },
  'Melee Slayer Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Melee Slayer'] }) },
  },
  'Quick Shot Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Quick Shot'] }) },
  },
  'Regeneration Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Regeneration'] }) },
  },
  'Regeneration': {
    // Basic Regeneration rule (if not already defined elsewhere)
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

  // -------------------------------------------------------------------------
  // Army spells
  // -------------------------------------------------------------------------
  'Insidious Protection': {
    description: 'Pick one friendly unit within 12" which gets Grounded Reinforcement once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const target = gameState.units.find(u => u.owner === caster.owner && Math.hypot(u.x - caster.x, u.y - caster.y) <= 12);
        if (target) {
          target._tempGroundedReinforcement = true;
          specialRulesApplied.push({ rule: 'Insidious Protection', effect: `gave Grounded Reinforcement to ${target.name}` });
        }
        return {};
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, defense, specialRulesApplied, gameState }) => {
        if (target?._tempGroundedReinforcement) {
          delete target._tempGroundedReinforcement;
          // Apply the same logic as Grounded Reinforcement but without terrain check (it's a buff)
          specialRulesApplied.push({ rule: 'Insidious Protection', effect: '+1 defense' });
          return { defense: Math.min(6, defense - 1) };
        }
        return {};
      },
    },
  },

  'Mind Corruption': {
    description: 'Pick one enemy unit within 12" which takes 2 hits with AP(1) and Surge.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (!target) return {};
        specialRulesApplied.push({ rule: 'Mind Corruption', effect: `2 hits (AP1, Surge) on ${target.name}` });
        return {
          extraHits: [{ target, count: 2, ap: 1, surge: true }]
        };
      },
    },
  },

  'Deep Hypnosis': {
    description: 'Pick up to two enemy units within 18" which must take a morale test. If failed you may move it by up to 6" in a straight line.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, dice, specialRulesApplied }) => {
        const enemies = gameState.units.filter(u => u.owner !== caster.owner && Math.hypot(u.x - caster.x, u.y - caster.y) <= 18).slice(0, 2);
        const moves = [];
        enemies.forEach(target => {
          const moraleRoll = dice.roll();
          const passed = moraleRoll >= target.quality;
          if (!passed) {
            moves.push({ target, distance: 6 });
          }
        });
        if (moves.length > 0) {
          specialRulesApplied.push({ rule: 'Deep Hypnosis', effect: `moving ${moves.length} units` });
          return { forcedMoves: moves };
        }
        return {};
      },
    },
  },

  'Psychic Onslaught': {
    description: 'Pick one enemy unit within 12" which takes 4 hits with Reap.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (!target) return {};
        specialRulesApplied.push({ rule: 'Psychic Onslaught', effect: `4 hits (Reap) on ${target.name}` });
        return {
          extraHits: [{ target, count: 4, ap: 0, reap: true }]
        };
      },
    },
  },

  'Bio-Displacer': {
    description: 'Pick up to three friendly units within 12" which get Teleport once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u => u.owner === caster.owner && Math.hypot(u.x - caster.x, u.y - caster.y) <= 12).slice(0, 3);
        friendlies.forEach(u => u._tempTeleport = true);
        specialRulesApplied.push({ rule: 'Bio-Displacer', effect: `gave Teleport to ${friendlies.length} units` });
        return {};
      },
      [HOOKS.ON_ACTIVATION_START]: ({ unit, specialRulesApplied }) => {
        if (unit._tempTeleport) {
          delete unit._tempTeleport;
          specialRulesApplied.push({ rule: 'Bio-Displacer', effect: 'may teleport' });
          return { teleport: { distance: 6 } };
        }
        return {};
      },
    },
  },

  'Brain Burst': {
    description: 'Pick one enemy unit within 6" which takes 3 hits with AP(2) and Deadly(3).',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (!target) return {};
        specialRulesApplied.push({ rule: 'Brain Burst', effect: `3 hits (AP2, Deadly3) on ${target.name}` });
        return {
          extraHits: [{ target, count: 3, ap: 2, deadly: 3 }]
        };
      },
    },
  },
};
