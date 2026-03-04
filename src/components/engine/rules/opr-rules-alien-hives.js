/**
 * rules/opr-rules-alien-hives.js
 * Alien Hives faction rules from v3.5.2
 */
import { HOOKS } from '../RuleRegistry.js';

export const ALIEN_HIVES_RULES = {
  // Army-wide
  'Hive Bond': {
    description: '+1 to morale test rolls.',
    hooks: {
      [HOOKS.ON_MORALE_TEST]: ({ roll, specialRulesApplied }) => {
        specialRulesApplied.push({ rule: 'Hive Bond', effect: '+1 to morale' });
        return { roll: roll + 1 };
      },
    },
  },

  // Special rules
  Agile: {
    description: '+1" Advance, +2" Rush/Charge.',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ action, speedDelta, specialRulesApplied }) => {
        const delta = action === 'Advance' ? 1 : 2;
        specialRulesApplied.push({ rule: 'Agile', value: delta, effect: `+${delta}"` });
        return { speedDelta: (speedDelta ?? 0) + delta };
      },
    },
  },

  'Breath Attack': {
    description: 'Once per activation before attacking, roll one die. On 2+, one enemy within 6" LOS takes 1 hit with Blast(3) and AP(1).',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, dice, specialRulesApplied }) => {
        if (unit._breathAttackUsed) return {};
        const roll = dice.roll();
        if (roll >= 2) {
          const target = gameState.units.find(u => u.owner !== unit.owner && u.distanceTo(unit) <= 6 && this._hasLineOfSight?.(unit, u));
          if (target) {
            unit._breathAttackUsed = true;
            specialRulesApplied.push({ rule: 'Breath Attack', effect: `hits ${target.name}` });
            return { extraHits: [{ target, count: 1, blast: 3, ap: 1 }] };
          }
        }
        unit._breathAttackUsed = true;
        return {};
      },
    },
  },

  'Caster Group': {
    description: 'Pick one model to have Caster(X) where X = total models with this rule. Transfer tokens on death.',
    hooks: {
      [HOOKS.ON_UNIT_CREATED]: ({ unit }) => {
        if (unit.special_rules.includes('Caster Group')) {
          unit.casterModel = 0;
          unit.casterTokens = unit.currentModels;
        }
      },
      [HOOKS.ON_MODEL_KILLED]: ({ unit, modelIndex }) => {
        if (unit.special_rules.includes('Caster Group') && modelIndex === unit.casterModel) {
          const newCaster = unit.models.findIndex((m, i) => i !== modelIndex);
          if (newCaster !== -1) {
            unit.casterModel = newCaster;
          }
        }
      },
      [HOOKS.ON_ROUND_END]: ({ unit }) => {
        if (unit.special_rules.includes('Caster Group')) {
          unit.casterTokens = 0;
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

  'Furious Buff': {
    description: 'Once per activation, give one friendly unit Furious once.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._furiousBuffUsed) return {};
        const friendly = gameState.units.find(u => u.owner === unit.owner && u !== unit && u.distanceTo(unit) <= 12);
        if (friendly) {
          friendly._tempFurious = true;
          unit._furiousBuffUsed = true;
          specialRulesApplied.push({ rule: 'Furious Buff', effect: `gave Furious to ${friendly.name}` });
        }
        return {};
      },
      [HOOKS.AFTER_HIT_ROLLS]: ({ unit, rolls, successes, specialRulesApplied }) => {
        if (unit._tempFurious) {
          delete unit._tempFurious;
          const sixes = rolls.filter(r => r.value === 6 && r.success && !r.auto).length;
          if (sixes > 0) {
            specialRulesApplied.push({ rule: 'Furious (from buff)', effect: `${sixes} extra hits` });
            return { successes: successes + sixes };
          }
        }
        return {};
      },
    },
  },

  'Hit & Run Fighter': {
    description: 'Once per round, move up to 3" after melee.',
    hooks: {
      [HOOKS.AFTER_MELEE]: ({ unit, specialRulesApplied }) => {
        if (!unit._hitAndRunUsed && unit.special_rules.includes('Hit & Run Fighter')) {
          unit._hitAndRunUsed = true;
          specialRulesApplied.push({ rule: 'Hit & Run Fighter', effect: 'may move 3"' });
          return { hitAndRunMove: 3 };
        }
        return {};
      },
    },
  },

  'Hive Bond Boost': {
    description: '+2 to morale instead of +1 if all models have Hive Bond.',
    hooks: {
      [HOOKS.ON_MORALE_TEST]: ({ unit, roll, specialRulesApplied }) => {
        if (unit.special_rules.includes('Hive Bond') && unit.special_rules.includes('Hive Bond Boost')) {
          specialRulesApplied.push({ rule: 'Hive Bond Boost', effect: '+2 to morale' });
          return { roll: roll + 2 };
        }
        return {};
      },
    },
  },

  'Increased Shooting Range': {
    description: '+6" range when shooting.',
    hooks: {
      [HOOKS.ON_RANGE_CHECK]: ({ unit, range, specialRulesApplied }) => {
        if (unit.special_rules.includes('Increased Shooting Range')) {
          specialRulesApplied.push({ rule: 'Increased Shooting Range', effect: '+6"' });
          return { range: range + 6 };
        }
        return {};
      },
    },
  },

  Infiltrate: {
    description: 'Ambush, but may deploy up to 1" away from enemies.',
    hooks: {
      [HOOKS.ON_DEPLOY]: () => ({ isReserve: true, reserveType: 'Infiltrate' }),
      [HOOKS.ON_RESERVE_ENTRY]: ({ unit, gameState }) => {
        const enemies = gameState.units.filter(u => u.owner !== unit.owner && u.current_models > 0);
        for (let attempts = 0; attempts < 100; attempts++) {
          const x = Math.random() * 50 + 5;
          const y = Math.random() * 36 + 12;
          if (!enemies.some(e => Math.hypot(e.x - x, e.y - y) <= 1)) {
            return { x, y };
          }
        }
        return { x: 30, y: 30 };
      },
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

  'Piercing Growth': {
    description: 'Gain one marker each round on table; each gives AP+1 (max +2). Lose all if Shaken.',
    hooks: {
      [HOOKS.ON_ROUND_END]: ({ unit }) => {
        if (unit.special_rules.includes('Piercing Growth') && !unit.reserve && unit.current_models > 0) {
          unit.piercing_growth_markers = Math.min(2, (unit.piercing_growth_markers || 0) + 1);
        }
      },
      [HOOKS.ON_MORALE_TEST]: ({ unit, passed }) => {
        if (unit.special_rules.includes('Piercing Growth') && !passed) {
          unit.piercing_growth_markers = 0;
        }
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, ap, specialRulesApplied }) => {
        const markers = Math.min(2, unit.piercing_growth_markers ?? 0);
        if (markers <= 0) return {};
        specialRulesApplied.push({ rule: 'Piercing Growth', value: markers, effect: `AP+${markers}` });
        return { ap: (ap ?? 0) + markers };
      },
    },
  },

  'Piercing Tag': {
    description: 'Once per game, place X markers on an enemy. Friendlies remove markers for +AP(Y).',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._piercingTagUsed) return {};
        const x = unit._ruleParamValue ?? 1;
        const target = gameState.units.find(u => u.owner !== unit.owner && u.distanceTo(unit) <= 36);
        if (target) {
          target.piercing_tag_markers = (target.piercing_tag_markers || 0) + x;
          unit._piercingTagUsed = true;
          specialRulesApplied.push({ rule: 'Piercing Tag', effect: `placed ${x} markers on ${target.name}` });
        }
        return {};
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, specialRulesApplied }) => {
        const markers = target?.piercing_tag_markers ?? 0;
        if (markers <= 0) return {};
        target.piercing_tag_markers = 0;
        specialRulesApplied.push({ rule: 'Piercing Tag', value: markers, effect: `+AP(${markers})` });
        return { ap: (ap ?? 0) + markers };
      },
    },
  },

  Precise: {
    description: '+1 to hit when attacking.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ quality, specialRulesApplied }) => {
        specialRulesApplied.push({ rule: 'Precise', effect: '+1 to hit' });
        return { quality: Math.max(2, quality - 1) };
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

  'Predator Fighter': {
    description: 'Each unmodified 6 to hit in melee generates +1 attack (no chain).',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ hitRolls, isMelee, specialRulesApplied }) => {
        if (!isMelee) return {};
        const sixes = (hitRolls ?? []).filter(r => r === 6).length;
        if (sixes === 0) return {};
        specialRulesApplied.push({ rule: 'Predator Fighter', value: sixes, effect: `${sixes} extra attacks` });
        return { extraAttacks: sixes, noChainExtraAttacks: true };
      },
    },
  },

  'Rapid Charge': {
    description: '+4" when charging.',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ action, speedDelta, specialRulesApplied }) => {
        if (action === 'Charge') {
          specialRulesApplied.push({ rule: 'Rapid Charge', value: 4, effect: '+4"' });
          return { speedDelta: (speedDelta ?? 0) + 4 };
        }
        return {};
      },
    },
  },

  'Rapid Charge Aura': {
    description: 'This model and its unit get Rapid Charge.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Rapid Charge Aura')) {
          return { additionalRules: ['Rapid Charge'] };
        }
        return {};
      },
    },
  },

  Ravage: {
    description: 'In melee, roll X dice; each 6+ deals 1 wound.',
    hooks: {
      [HOOKS.BEFORE_MELEE_ATTACK]: ({ unit, dice, specialRulesApplied }) => {
        const x = unit._ruleParamValue ?? 0;
        if (x <= 0) return {};
        let wounds = 0;
        for (let i = 0; i < x; i++) {
          if (dice.roll() >= 6) wounds++;
        }
        if (wounds > 0) {
          specialRulesApplied.push({ rule: 'Ravage', value: wounds, effect: `${wounds} free wounds` });
          return { extraWounds: wounds };
        }
        return {};
      },
    },
  },

  Retaliate: {
    description: 'When this model takes a wound in melee, attacker takes X hits.',
    hooks: {
      [HOOKS.ON_WOUND_ALLOCATION]: ({ unit, wounds, sourceUnit, specialRulesApplied }) => {
        if (unit.special_rules.includes('Retaliate') && wounds > 0 && sourceUnit) {
          const x = unit._ruleParamValue ?? 1;
          specialRulesApplied.push({ rule: 'Retaliate', effect: `${x} hits on attacker` });
          return { retaliateHits: { target: sourceUnit, hits: x * wounds } };
        }
        return {};
      },
    },
  },

  Rupture: {
    description: 'Ignores Regeneration. Unmodified 6 to hit that aren\'t blocked deal +1 wound.',
    hooks: {
      [HOOKS.ON_WOUND_CALC]: ({ weapon, unsavedHit, wounds, specialRulesApplied }) => {
        if (weapon.rules.includes('Rupture') && unsavedHit.value === 6 && unsavedHit.success && !unsavedHit.auto) {
          specialRulesApplied.push({ rule: 'Rupture', effect: '+1 wound' });
          return { wounds: wounds + 1 };
        }
        return {};
      },
      [HOOKS.ON_INCOMING_WOUNDS]: ({ weapon, specialRulesApplied }) => {
        if (weapon?.rules.includes('Rupture')) {
          return { suppressRegeneration: true };
        }
        return {};
      },
    },
  },

  'Self-Destruct': {
    description: 'If killed in melee, attacker takes X hits. If it survives melee, it dies and attacker takes X hits.',
    hooks: {
      [HOOKS.ON_MODEL_KILLED]: ({ unit, killer, specialRulesApplied }) => {
        if (unit.special_rules.includes('Self-Destruct') && killer) {
          const x = unit._ruleParamValue ?? 1;
          specialRulesApplied.push({ rule: 'Self-Destruct', effect: `${x} hits on killer` });
          return { retaliateHits: { target: killer, hits: x } };
        }
      },
      [HOOKS.AFTER_MELEE]: ({ unit, enemyUnit, specialRulesApplied }) => {
        if (unit.special_rules.includes('Self-Destruct') && unit.current_models > 0 && !unit._selfDestructTriggered) {
          unit._selfDestructTriggered = true;
          const x = unit._ruleParamValue ?? 1;
          unit.current_models = 0;
          unit.status = 'destroyed';
          specialRulesApplied.push({ rule: 'Self-Destruct', effect: `unit dies, ${x} hits on ${enemyUnit.name}` });
          return { retaliateHits: { target: enemyUnit, hits: x } };
        }
      },
    },
  },

  Shielded: {
    description: '+1 defense vs non-spell hits.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ isSpell, defense, specialRulesApplied }) => {
        if (isSpell) return {};
        specialRulesApplied.push({ rule: 'Shielded', effect: '+1 defense' });
        return { defense: Math.max(2, defense - 1) };
      },
    },
  },

  'Shielded Aura': {
    description: 'This model and its unit get Shielded.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Shielded Aura')) {
          return { additionalRules: ['Shielded'] };
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

  Spawn: {
    description: 'Once per game when activated, place a new unit of X fully within 6".',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._spawnUsed) return {};
        const x = unit._ruleParamValue ?? 1;
        unit._spawnUsed = true;
        specialRulesApplied.push({ rule: 'Spawn', effect: `spawn ${x} new units` });
        // The engine would need to create new units. We'll return a spawn request.
        return { spawnUnit: { type: 'spawn', count: x } };
      },
    },
  },

  'Spell Conduit': {
    description: 'Friendly casters within 12" may cast as if from this model\'s position and get +1.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, spell, target, gameState, specialRulesApplied }) => {
        const conduit = gameState.units.find(u => u.owner === caster.owner && u.rules.includes('Spell Conduit') && u.distanceTo(caster) <= 12);
        if (conduit) {
          specialRulesApplied.push({ rule: 'Spell Conduit', effect: 'cast from conduit, +1' });
          return { castModifier: 1, castPosition: conduit };
        }
        return {};
      },
    },
  },

  'Stealth Buff': {
    description: 'Once per activation, give one friendly unit Stealth once.',
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

  'Surprise Attack': {
    description: 'Counts as Infiltrate. On deployment, roll X dice; each 4+ deals 2 hits AP(1) to one enemy within 3".',
    hooks: {
      [HOOKS.ON_DEPLOY]: () => ({ isReserve: true, reserveType: 'Surprise' }),
      [HOOKS.ON_RESERVE_ENTRY]: ({ unit, gameState, dice, specialRulesApplied }) => {
        // Place unit as per Infiltrate
        const enemies = gameState.units.filter(u => u.owner !== unit.owner && u.current_models > 0);
        let placed = false;
        for (let attempts = 0; attempts < 100; attempts++) {
          const x = Math.random() * 50 + 5;
          const y = Math.random() * 36 + 12;
          if (!enemies.some(e => Math.hypot(e.x - x, e.y - y) <= 1)) {
            unit.x = x; unit.y = y;
            placed = true;
            break;
          }
        }
        if (!placed) { unit.x = 30; unit.y = 30; }

        const x = unit._ruleParamValue ?? 1;
        let hits = 0;
        for (let i = 0; i < x; i++) {
          if (dice.roll() >= 4) hits++;
        }
        if (hits > 0) {
          const nearby = gameState.units.filter(u => u.owner !== unit.owner && u.distanceTo(unit) <= 3);
          if (nearby.length > 0) {
            const target = nearby[0];
            specialRulesApplied.push({ rule: 'Surprise Attack', effect: `2 hits on ${target.name}` });
            return { extraHits: [{ target, count: hits * 2, ap: 1 }] };
          }
        }
        return {};
      },
    },
  },

  'Takedown Strike': {
    description: 'Once per game in melee, make one attack at Quality 2+, AP(2), Deadly(3) targeting one model.',
    hooks: {
      [HOOKS.BEFORE_MELEE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._takedownStrikeUsed) return {};
        const enemy = gameState.units.find(u => u.owner !== unit.owner && u.distanceTo(unit) <= 1);
        if (enemy) {
          unit._takedownStrikeUsed = true;
          specialRulesApplied.push({ rule: 'Takedown Strike', effect: `attack on ${enemy.name}` });
          return { specialAttack: { target: enemy, quality: 2, ap: 2, deadly: 3 } };
        }
        return {};
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

  'Unpredictable Fighter': {
    description: 'When in melee, roll die: 1-3 AP+1, 4-6 +1 to hit.',
    hooks: {
      [HOOKS.BEFORE_MELEE_ATTACK]: ({ unit, dice, specialRulesApplied }) => {
        if (!unit._unpredictableRolled) {
          unit._unpredictableRoll = dice.roll();
          unit._unpredictableRolled = true;
          const effect = unit._unpredictableRoll <= 3 ? 'AP+1' : '+1 to hit';
          specialRulesApplied.push({ rule: 'Unpredictable Fighter', effect: `rolled ${unit._unpredictableRoll}: ${effect}` });
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
      [HOOKS.AFTER_MELEE_ATTACK]: ({ unit }) => {
        delete unit._unpredictableRolled;
        delete unit._unpredictableRoll;
      },
    },
  },

  'Unpredictable Fighter Mark': {
    description: 'Once per activation, mark an enemy; friendlies get Unpredictable Fighter against it once.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._unpredictableMarkUsed) return {};
        const target = gameState.units.find(u => u.owner !== unit.owner && u.distanceTo(unit) <= 18);
        if (target) {
          target.unpredictable_marked = true;
          unit._unpredictableMarkUsed = true;
          specialRulesApplied.push({ rule: 'Unpredictable Fighter Mark', effect: `marked ${target.name}` });
        }
        return {};
      },
      [HOOKS.BEFORE_MELEE_ATTACK]: ({ unit, target, dice, specialRulesApplied }) => {
        if (target?.unpredictable_marked) {
          delete target.unpredictable_marked;
          const roll = dice.roll();
          const effect = roll <= 3 ? 'AP+1' : '+1 to hit';
          specialRulesApplied.push({ rule: 'Unpredictable Fighter Mark', effect: effect });
          if (effect === '+1 to hit') {
            return { qualityModifier: -1 };
          } else {
            return { apBonus: 1 };
          }
        }
        return {};
      },
    },
  },

  // Aura rules (many are just markers for ON_GET_RULES)
  'Hive Bond Boost Aura': {
    description: 'This model and its unit get Hive Bond Boost.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Hive Bond Boost Aura')) {
          return { additionalRules: ['Hive Bond Boost'] };
        }
        return {};
      },
    },
  },
  'Furious Aura': {
    description: 'This model and its unit get Furious.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Furious Aura')) {
          return { additionalRules: ['Furious'] };
        }
        return {};
      },
    },
  },
  'Increased Shooting Range Aura': {
    description: 'This model and its unit get +6" range.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Increased Shooting Range Aura')) {
          return { additionalRules: ['Increased Shooting Range'] };
        }
        return {};
      },
    },
  },

};
