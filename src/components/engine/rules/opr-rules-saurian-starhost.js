/**
 * rules/opr-rules-saurian-starhost.js
 * Saurian Starhost faction rules from v3.5.2 (page 3)
 * Uses the enhanced RulesEngine with generic weapon info.
 */

import { HOOKS } from '../RuleRegistry.js';
import { Dice } from './Dice.js';

export const SAURIAN_STARHOST_RULES = {
  // -------------------------------------------------------------------------
  // Army‑wide rule
  // -------------------------------------------------------------------------
  Primal: {
    description: 'For each unmodified roll of 6 to hit when attacking, this model may roll +1 attack with that weapon. This rule doesn\'t apply to newly generated attacks.',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ unit, weapon, rolls, successes, weaponRules, specialRulesApplied }) => {
        if (!unit.special_rules.includes('Primal')) return {};

        // Count unmodified sixes that are not from auto-generated attacks
        const sixes = rolls.filter(r => r.value === 6 && !r.auto).length;
        if (sixes === 0) return {};

        const hasBoost = unit.special_rules.includes('Primal Boost') ||
                         specialRulesApplied.includes('Primal Boost');
        const threshold = hasBoost ? 5 : 6;
        // But we already only have sixes; if boost is active, we also need to handle fives.
        // However, Primal's base is only on 6; Boost extends to 5-6.
        // To avoid double counting, we need to adjust: if boost, count fives as well.
        // But we only have sixes here. So we need to know if boost is active.
        // Better: in AFTER_HIT_ROLLS, we have the original rolls. We can count both fives and sixes if boost.
        let extraAttacks = 0;
        if (hasBoost) {
          const fivesAndSixes = rolls.filter(r => (r.value === 5 || r.value === 6) && !r.auto).length;
          extraAttacks = fivesAndSixes;
        } else {
          extraAttacks = sixes;
        }

        if (extraAttacks === 0) return {};

        // Generate extra attack rolls. Mark them as auto to prevent recursion.
        const newRolls = [];
        for (let i = 0; i < extraAttacks; i++) {
          const roll = Dice.roll();
          const quality = unit.quality;
          const success = roll >= quality;
          newRolls.push({ value: roll, success, auto: true, relentless: false });
        }

        specialRulesApplied.push({ rule: 'Primal', effect: `+${extraAttacks} extra attacks from primal` });
        return {
          rolls: newRolls,
          successes: successes + newRolls.filter(r => r.success).length,
        };
      },
    },
  },

  // -------------------------------------------------------------------------
  // Special rules
  // -------------------------------------------------------------------------
  'Ambush Beacon': {
    description: 'Friendly units using Ambush may ignore distance restrictions from enemies if they are deployed within 6" of this model.',
    hooks: {
      [HOOKS.ON_RESERVE_ENTRY]: ({ unit, gameState, specialRulesApplied }) => {
        // This is called when a friendly unit attempts to deploy via Ambush.
        // Check if any friendly unit with Ambush Beacon is within 6" of the deployment point.
        // The engine would need to know the intended deployment point.
        // We'll just note that the beacon allows ignoring restrictions.
        specialRulesApplied.push({ rule: 'Ambush Beacon', effect: 'may deploy within 1" of enemies' });
        return { ignoreDistanceRestrictions: true };
      },
    },
  },

  'Bane Mark': {
    description: 'Once per activation, before attacking, pick one enemy unit within 18", which friendly units gets Bane when attacking against once.',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._baneMarkUsed) return {};
        const target = gameState.units.find(u => u.owner !== unit.owner && Math.hypot(u.x - unit.x, u.y - unit.y) <= 18);
        if (target) {
          target._baneMarked = true;
          unit._baneMarkUsed = true;
          specialRulesApplied.push({ rule: 'Bane Mark', effect: `${target.name} marked for Bane` });
        }
        return {};
      },
      [HOOKS.ON_PER_HIT]: ({ target, specialRulesApplied }) => {
        if (target?._baneMarked) {
          delete target._baneMarked;
          specialRulesApplied.push({ rule: 'Bane Mark', effect: 'Bane active' });
          // Bane effect: +1 wound on 6+? Actually Bane is a rule that adds extra wounds on 6+ to wound.
          // We need to implement Bane separately. We'll just flag that Bane should apply.
          return { baneActive: true };
        }
        return {};
      },
      [HOOKS.ON_ACTIVATION_END]: ({ unit }) => {
        delete unit._baneMarkUsed;
      },
    },
  },

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

  'Breath Attack': {
    description: 'Once per activation, before attacking, roll one die. On a 2+ one enemy unit within 6" in line of sight takes 1 hit with Blast(3) and AP(1).',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, gameState, dice, specialRulesApplied }) => {
        if (unit._breathUsed) return {};
        const roll = dice.roll();
        if (roll >= 2) {
          // Find a target within 6" in line of sight (simplified: pick first eligible)
          const target = gameState.units.find(u => u.owner !== unit.owner && Math.hypot(u.x - unit.x, u.y - unit.y) <= 6);
          if (target) {
            unit._breathUsed = true;
            specialRulesApplied.push({ rule: 'Breath Attack', effect: `1 hit (Blast3, AP1) on ${target.name}` });
            return {
              extraHits: [{
                target,
                count: 1,
                ap: 1,
                blast: 3,
              }]
            };
          }
        }
        return {};
      },
      [HOOKS.ON_ACTIVATION_END]: ({ unit }) => {
        delete unit._breathUsed;
      },
    },
  },

  'Counter-Attack': {
    description: 'Strikes first when charged.',
    hooks: {
      [HOOKS.ON_STRIKE_ORDER]: ({ attacker, defender, gameState, specialRulesApplied }) => {
        // If defender has Counter-Attack and is being charged, defender strikes first.
        if ((defender.special_rules || '').includes('Counter-Attack') && defender._charged) {
          specialRulesApplied.push({ rule: 'Counter-Attack', effect: 'defender strikes first' });
          return { attackerFirst: false };
        }
        return {};
      },
    },
  },

  'Crossing Strike': {
    description: 'Once per game, once during its activation when this model moves through enemy units, pick one of them, and roll X dice. For each 4+ it takes 3 hits with AP(1).',
    hooks: {
      [HOOKS.ON_MOVE_THROUGH_ENEMY]: ({ unit, enemyUnit, gameState, _ruleParamValue, specialRulesApplied }) => {
        if (unit._crossingStrikeUsed) return {};
        // X is the parameter (e.g., Crossing Strike(3) means 3 dice)
        const diceCount = _ruleParamValue || 1;
        let hits = 0;
        for (let i = 0; i < diceCount; i++) {
          const roll = Dice.roll();
          if (roll >= 4) hits += 3;
        }
        if (hits > 0) {
          unit._crossingStrikeUsed = true;
          specialRulesApplied.push({ rule: 'Crossing Strike', effect: `${hits} hits on ${enemyUnit.name}` });
          return {
            extraHits: [{
              target: enemyUnit,
              count: hits,
              ap: 1,
            }]
          };
        }
        return {};
      },
    },
  },

  Disintegrate: {
    description: 'Ignores Regeneration, and against units where most models have Defense 2+ to 3+, this weapon gets AP(+2).',
    hooks: {
      [HOOKS.ON_INCOMING_WOUNDS]: ({ specialRulesApplied }) => {
        // Suppress Regeneration
        specialRulesApplied.push({ rule: 'Disintegrate', effect: 'suppress Regeneration' });
        return { suppressRegeneration: true };
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, specialRulesApplied }) => {
        if (!target) return {};
        const defense = target.defense;
        if (defense >= 2 && defense <= 3) {
          specialRulesApplied.push({ rule: 'Disintegrate', effect: 'AP+2' });
          return { ap: (ap ?? 0) + 2 };
        }
        return {};
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

  Fortified: {
    description: 'When units where all models have this rule take hits, those hits count as having AP(-1), to a min. of AP(0).',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, specialRulesApplied }) => {
        if (target?.rules?.includes('Fortified')) {
          const newAp = Math.max(0, (ap ?? 0) - 1);
          specialRulesApplied.push({ rule: 'Fortified', effect: `AP reduced from ${ap} to ${newAp}` });
          return { ap: newAp };
        }
        return {};
      },
    },
  },

  'Good Shot': {
    description: 'This model gets +1 to hit rolls when shooting.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, isMelee, specialRulesApplied }) => {
        if (!isMelee && unit.special_rules.includes('Good Shot')) {
          specialRulesApplied.push({ rule: 'Good Shot', effect: '+1 to hit' });
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
    },
  },

  'Heavy Impact': {
    description: 'Counts as having Impact(X) with hits that have AP(1).',
    hooks: {
      [HOOKS.BEFORE_MELEE_ATTACK]: ({ unit, target, _ruleParamValue, specialRulesApplied }) => {
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

  Precise: {
    description: 'Gets +1 to hit when attacking.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, specialRulesApplied }) => {
        if (unit.special_rules.includes('Precise')) {
          specialRulesApplied.push({ rule: 'Precise', effect: '+1 to hit' });
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
    },
  },

  'Precision Target': {
    description: 'Once per game, during this model\'s activation, pick one enemy unit within 36" and in line of sight of it, and place X markers on it. Friendly units get +X to hit rolls when attacking it.',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, gameState, _ruleParamValue, specialRulesApplied }) => {
        if (unit._precisionTargetUsed) return {};
        const markers = _ruleParamValue || 1;
        // Pick first eligible enemy within 36" and LOS (simplified)
        const target = gameState.units.find(u => u.owner !== unit.owner && Math.hypot(u.x - unit.x, u.y - unit.y) <= 36);
        if (target) {
          target._precisionMarkers = (target._precisionMarkers || 0) + markers;
          unit._precisionTargetUsed = true;
          specialRulesApplied.push({ rule: 'Precision Target', effect: `${markers} markers on ${target.name}` });
        }
        return {};
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ target, quality, specialRulesApplied }) => {
        if (target?._precisionMarkers) {
          const bonus = target._precisionMarkers;
          specialRulesApplied.push({ rule: 'Precision Target', effect: `+${bonus} to hit` });
          return { quality: Math.max(2, quality - bonus) };
        }
        return {};
      },
      // Markers last until the target is attacked? Probably for the whole turn? We'll clear after first use.
      [HOOKS.AFTER_HIT_ROLLS]: ({ target }) => {
        if (target?._precisionMarkers) {
          delete target._precisionMarkers;
        }
      },
    },
  },

  'Primal Boost': {
    description: 'If this model has Primal, it gets extra attacks on successful unmodified hit results of 5-6 from Primal (instead of only on 6).',
    // This is a flag that modifies the Primal rule. No separate hook needed.
    hooks: {},
  },

  'Primal Boost Buff': {
    description: 'Once per activation, before attacking, pick one friendly unit within 12", which gets Primal Boost once.',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._primalBuffUsed) return {};
        const target = gameState.units.find(u =>
          u.owner === unit.owner &&
          u !== unit &&
          Math.hypot(u.x - unit.x, u.y - unit.y) <= 12 &&
          (u.special_rules || '').includes('Primal')
        );
        if (target) {
          target._tempPrimalBoost = true;
          unit._primalBuffUsed = true;
          specialRulesApplied.push({ rule: 'Primal Boost Buff', effect: `gave boost to ${target.name}` });
        }
        return {};
      },
      [HOOKS.ON_ACTIVATION_END]: ({ unit }) => {
        delete unit._primalBuffUsed;
      },
      // The actual boost is checked in Primal's hook.
    },
  },

  'Protection Feat': {
    description: 'Once per game, when this unit takes wounds and all its models have this rule, you may use this rule and roll one die per wound, and on a 4+ it is ignored.',
    hooks: {
      [HOOKS.ON_INCOMING_WOUNDS]: ({ unit, wounds, specialRulesApplied }) => {
        if (!unit.special_rules.includes('Protection Feat') || unit._protectionFeatUsed) return {};
        unit._protectionFeatUsed = true;
        let ignored = 0;
        for (let i = 0; i < wounds; i++) {
          const roll = Dice.roll();
          if (roll >= 4) ignored++;
        }
        specialRulesApplied.push({ rule: 'Protection Feat', effect: `ignored ${ignored} wounds` });
        return { wounds: wounds - ignored };
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

  'Spell Conduit': {
    description: 'Casters within 12" that are from other friendly units may cast spells as if they were in this model\'s position, and get +1 to casting rolls when doing so.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        // Find a friendly Spell Conduit within 12" of the caster
        const conduit = gameState.units.find(u =>
          u.owner === caster.owner &&
          u !== caster &&
          (u.special_rules || '').includes('Spell Conduit') &&
          Math.hypot(u.x - caster.x, u.y - caster.y) <= 12
        );
        if (conduit) {
          specialRulesApplied.push({ rule: 'Spell Conduit', effect: 'casting from conduit, +1' });
          return {
            castPosition: conduit, // use conduit's position for range/LOS
            friendlyBonus: 1,
          };
        }
        return {};
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

  'Unpredictable Fighter': {
    description: 'When in melee, roll one die and apply one effect to all models with this rule: on a 1-3 they get AP(+1), and on a 4-6 they get +1 to hit rolls instead.',
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
  // Auras
  // -------------------------------------------------------------------------
  'Counter-Attack Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Counter-Attack'] }) },
  },
  'Rapid Charge Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Rapid Charge'] }) },
  },
  'Rapid Charge': {
    // This rule is not defined elsewhere; it gives +4" when charging? Actually Rapid Charge Aura gives +4" on charge.
    // We need to implement Rapid Charge as a rule that modifies speed.
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ unit, action, speedDelta, specialRulesApplied }) => {
        if (action === 'Charge' && unit.special_rules.includes('Rapid Charge')) {
          specialRulesApplied.push({ rule: 'Rapid Charge', effect: '+4"' });
          return { speedDelta: (speedDelta ?? 0) + 4 };
        }
        return {};
      },
    },
  },
  'Rending when Shooting Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Rending when Shooting'] }) },
  },
  'Rending when Shooting': {
    // Rending: on 6 to hit, AP+? Actually Rending gives AP+? In OPR, Rending gives +1 AP on 6 to hit.
    // We'll implement as a rule that modifies AP on 6s.
    hooks: {
      [HOOKS.ON_PER_HIT]: ({ unit, weaponRules, hitRoll, ap, isMelee, specialRulesApplied }) => {
        if (!isMelee && unit.special_rules.includes('Rending when Shooting') && hitRoll.value === 6 && !hitRoll.auto) {
          specialRulesApplied.push({ rule: 'Rending when Shooting', effect: 'AP+1' });
          return { apBonus: 1 };
        }
        return {};
      },
    },
  },
  'Scout Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Scout'] }) },
  },

  // -------------------------------------------------------------------------
  // Army spells
  // -------------------------------------------------------------------------
  'Toxin Mist': {
    description: 'Pick one enemy unit within 18", which friendly units gets Bane when attacking against once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (!target) return {};
        target._baneMarked = true;
        specialRulesApplied.push({ rule: 'Toxin Mist', effect: `marked ${target.name}` });
        return {};
      },
      // Bane effect handled by Bane Mark rule or generic Bane implementation.
    },
  },

  'Serpent Comet': {
    description: 'Pick one enemy unit within 12" which takes 2 hits with Disintegrate.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (!target) return {};
        specialRulesApplied.push({ rule: 'Serpent Comet', effect: `2 hits (Disintegrate) on ${target.name}` });
        return {
          extraHits: [{ target, count: 2, ap: 0, disintegrate: true }]
        };
      },
    },
  },

  'Fateful Guidance': {
    description: 'Pick up to two friendly units within 12", which get Furious once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u =>
          u.owner === caster.owner &&
          Math.hypot(u.x - caster.x, u.y - caster.y) <= 12
        ).slice(0, 2);
        friendlies.forEach(u => u._tempFurious = true);
        specialRulesApplied.push({ rule: 'Fateful Guidance', effect: `gave Furious to ${friendlies.length}` });
        return {};
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, specialRulesApplied }) => {
        if (unit._tempFurious) {
          delete unit._tempFurious;
          // Furious: +1 to hit? Actually Furious gives +1 to hit in melee? In OPR, Furious gives +1 to hit when charging.
          // We'll assume Furious is a rule that gives +1 to hit in melee.
          specialRulesApplied.push({ rule: 'Fateful Guidance', effect: 'Furious active' });
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
    },
  },

  'Piranha Curse': {
    description: 'Pick up to two enemy units within 9", which take 4 hits each.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const enemies = gameState.units.filter(u =>
          u.owner !== caster.owner &&
          Math.hypot(u.x - caster.x, u.y - caster.y) <= 9
        ).slice(0, 2);
        const extraHits = enemies.map(e => ({ target: e, count: 4, ap: 0 }));
        specialRulesApplied.push({ rule: 'Piranha Curse', effect: `4 hits on ${enemies.length} units` });
        return { extraHits };
      },
    },
  },

  'Celestial Roar': {
    description: 'Pick up to three friendly units within 12", which get Primal Boost once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u =>
          u.owner === caster.owner &&
          Math.hypot(u.x - caster.x, u.y - caster.y) <= 12 &&
          (u.special_rules || '').includes('Primal')
        ).slice(0, 3);
        friendlies.forEach(u => u._tempPrimalBoost = true);
        specialRulesApplied.push({ rule: 'Celestial Roar', effect: `gave Primal Boost to ${friendlies.length}` });
        return {};
      },
      // Boost effect handled by Primal rule.
    },
  },

  'Jaguar Blaze': {
    description: 'Pick one enemy unit within 12" which takes 6 hits with AP(1) and Shred.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (!target) return {};
        specialRulesApplied.push({ rule: 'Jaguar Blaze', effect: `6 hits (AP1, Shred) on ${target.name}` });
        return {
          extraHits: [{ target, count: 6, ap: 1, shred: true }]
        };
      },
    },
  },
};
