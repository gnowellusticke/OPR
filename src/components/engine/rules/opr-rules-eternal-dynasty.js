/**
 * rules/opr-rules-eternal-dynasty.js
 * Eternal Dynasty faction rules from v3.5.2
 */
import { HOOKS } from '../RuleRegistry.js';

export const ETERNAL_DYNASTY_RULES = {
  // Army-wide
  'Clan Warrior': {
    description: 'Each unmodified 6 to hit generates +1 attack (no chain).',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ rolls, successes, specialRulesApplied }) => {
        const sixes = rolls.filter(r => r.value === 6 && r.success && !r.auto).length;
        if (sixes === 0) return {};
        specialRulesApplied.push({ rule: 'Clan Warrior', value: sixes, effect: `${sixes} extra attacks` });
        return { extraAttacks: sixes, noChainExtraAttacks: true };
      },
    },
  },

  // Special rules
  'Ambush Beacon': {
    description: 'Friendly Ambush units may ignore distance restrictions if deployed within 6" of this model.',
    hooks: {
      [HOOKS.ON_RESERVE_ENTRY]: ({ unit, gameState }) => {
        const beacons = gameState.units.filter(u => u.owner === unit.owner && u.rules.includes('Ambush Beacon') && u.distanceTo(unit) <= 6);
        if (beacons.length > 0) {
          return { ignoreDistanceRestriction: true };
        }
        return {};
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
        return { boundingMove: dist };
      },
    },
  },

  'Casting Buff': {
    description: 'Once per activation, give a friendly Caster +1 to casting rolls once.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._castingBuffUsed) return {};
        const caster = gameState.units.find(u => u.owner === unit.owner && u !== unit && u.rules.some(r => r.includes('Caster')) && u.distanceTo(unit) <= 12);
        if (caster) {
          caster._castingBuff = true;
          unit._castingBuffUsed = true;
          specialRulesApplied.push({ rule: 'Casting Buff', effect: `gave +1 casting to ${caster.name}` });
        }
        return {};
      },
      [HOOKS.ON_SPELL_CAST]: ({ caster, specialRulesApplied }) => {
        if (caster._castingBuff) {
          delete caster._castingBuff;
          specialRulesApplied.push({ rule: 'Casting Buff', effect: '+1 to cast' });
          return { castModifier: 1 };
        }
        return {};
      },
    },
  },

  'Clan Warrior Boost': {
    description: 'Clan Warrior triggers on 5-6 instead of only 6.',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ rolls, successes, specialRulesApplied }) => {
        // This modifies Clan Warrior; we'll let Clan Warrior check for this rule.
        // So this rule is just a marker.
        return {};
      },
    },
  },

  'Counter-Attack': {
    description: 'Strikes first when charged.',
    hooks: {
      [HOOKS.ON_STRIKE_ORDER]: ({ defender, specialRulesApplied }) => {
        if (defender.rules.includes('Counter-Attack')) {
          specialRulesApplied.push({ rule: 'Counter-Attack', effect: 'defender strikes first' });
          return { attackerFirst: false };
        }
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

  'Increased Shooting Range Mark': {
    description: 'Once per activation, mark an enemy; friendlies get +6" range when shooting against it.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._rangeMarkUsed) return {};
        const target = gameState.units.find(u => u.owner !== unit.owner && u.distanceTo(unit) <= 18);
        if (target) {
          target.range_marked = true;
          unit._rangeMarkUsed = true;
          specialRulesApplied.push({ rule: 'Increased Shooting Range Mark', effect: `marked ${target.name}` });
        }
        return {};
      },
      [HOOKS.ON_RANGE_CHECK]: ({ target, range, specialRulesApplied }) => {
        if (target?.range_marked) {
          delete target.range_marked; // consume
          specialRulesApplied.push({ rule: 'Increased Shooting Range Mark', effect: '+6" range' });
          return { range: range + 6 };
        }
        return {};
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

  'Piercing Hunter': {
    description: 'When shooting at enemies over 9" away, weapons get AP(+1).',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ attackDistance, isMelee, ap, specialRulesApplied }) => {
        if (isMelee || (attackDistance ?? 0) <= 9) return {};
        specialRulesApplied.push({ rule: 'Piercing Hunter', effect: 'AP+1 at >9"' });
        return { ap: (ap ?? 0) + 1 };
      },
    },
  },

  Puncture: {
    description: 'Ignores Regeneration. Against Tough(3-9), gets AP(+4).',
    hooks: {
      [HOOKS.ON_INCOMING_WOUNDS]: ({ specialRulesApplied }) => {
        return { suppressRegeneration: true };
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, specialRulesApplied }) => {
        if (!target) return {};
        const sr = Array.isArray(target.special_rules)
          ? target.special_rules.join(' ')
          : (target.special_rules || '');
        const m = sr.match(/Tough\((\d+)\)/);
        if (!m) return {};
        const toughVal = parseInt(m[1]);
        if (toughVal >= 3 && toughVal <= 9) {
          specialRulesApplied.push({ rule: 'Puncture', effect: `+AP(4) vs Tough(${toughVal})` });
          return { ap: (ap ?? 0) + 4 };
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

  'Repel Ambushes': {
    description: 'Enemy Ambush must be >12" from this unit.',
    hooks: {
      [HOOKS.ON_RESERVE_ENTRY]: ({ unit, gameState }) => {
        // Called when an enemy unit is being deployed. Check if any unit with Repel Ambushes is nearby.
        // We need to know the deployment point to enforce distance. This is tricky.
        // We'll return a flag that the engine should use when checking deployment distance.
        const repellors = gameState.units.filter(u => u.owner !== unit.owner && u.rules.includes('Repel Ambushes'));
        if (repellors.length > 0) {
          // The engine should check distance to these units and reject if <12".
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

  Teleport: {
    description: 'Once per activation, before attacking, place this model anywhere within 6".',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, specialRulesApplied }) => {
        if (unit._teleportUsed) return {};
        unit._teleportUsed = true;
        specialRulesApplied.push({ rule: 'Teleport', effect: 'may teleport up to 6"' });
        return { teleportMove: 6 };
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

  Vengeance: {
    description: 'When this unit is destroyed, place markers equal to its starting models. Friendlies get +X to hit when attacking that unit.',
    hooks: {
      [HOOKS.ON_MODEL_KILLED]: ({ unit, killer }) => {
        if (unit.current_models <= 0 && unit.special_rules.includes('Vengeance') && killer) {
          // Store vengeance markers on the killer unit
          const count = unit.models; // starting models
          killer.vengeance_markers = (killer.vengeance_markers || 0) + count;
        }
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, target, quality, specialRulesApplied }) => {
        if (target?.vengeance_markers) {
          const markers = target.vengeance_markers;
          // Markers are consumed? The rule says "friendly units get +X to hit rolls with their weapons when attacking that unit"
          // It doesn't say they are consumed, so they persist? Probably they remain until the target is destroyed.
          // We'll not consume them.
          specialRulesApplied.push({ rule: 'Vengeance', value: markers, effect: `+${markers} to hit` });
          return { quality: Math.max(2, quality - markers) };
        }
        return {};
      },
    },
  },

  VersatileAttack: {
    description: 'When activated, choose AP+1 or +1 to hit.',
    hooks: {
      [HOOKS.BEFORE_ACTIVATION]: ({ unit, specialRulesApplied }) => {},
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, specialRulesApplied }) => {
        if (unit._versatileMode === 'quality') {
          specialRulesApplied.push({ rule: 'Versatile Attack', effect: '+1 to hit' });
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, ap, specialRulesApplied }) => {
        if (unit._versatileMode === 'ap') {
          specialRulesApplied.push({ rule: 'Versatile Attack', effect: 'AP+1' });
          return { ap: (ap ?? 0) + 1 };
        }
        return {};
      },
      [HOOKS.AFTER_ACTIVATION]: ({ unit }) => {
        delete unit._versatileMode;
      },
    },
  },

  // Auras
  'Clan Warrior Boost Aura': {
    description: 'This model and its unit get Clan Warrior Boost.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Clan Warrior Boost Aura')) {
          return { additionalRules: ['Clan Warrior Boost'] };
        }
        return {};
      },
    },
  },
  'Counter-Attack Aura': {
    description: 'This model and its unit get Counter-Attack.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Counter-Attack Aura')) {
          return { additionalRules: ['Counter-Attack'] };
        }
        return {};
      },
    },
  },
  'Fearless Aura': {
    description: 'This model and its unit get Fearless.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Fearless Aura')) {
          return { additionalRules: ['Fearless'] };
        }
        return {};
      },
    },
  },
  'Ignores Cover Aura': {
    description: 'This model and its unit get Ignores Cover when shooting.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Ignores Cover Aura')) {
          return { additionalRules: ['Ignores Cover'] };
        }
        return {};
      },
    },
  },
  'Melee Evasion Aura': {
    description: 'This model and its unit get Melee Evasion.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Melee Evasion Aura')) {
          return { additionalRules: ['Melee Evasion'] };
        }
        return {};
      },
    },
  },
  'Piercing Hunter Aura': {
    description: 'This model and its unit get Piercing Hunter.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Piercing Hunter Aura')) {
          return { additionalRules: ['Piercing Hunter'] };
        }
        return {};
      },
    },
  },
  'Precision Fighter Aura': {
    description: 'This model and its unit get +1 to hit in melee.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        // This is a bonus, not a rule. We'll add a temporary rule.
        // Alternatively, we can directly modify BEFORE_HIT_QUALITY.
        // For simplicity, we'll add a rule that the engine can check.
        return { additionalRules: ['Precision Fighter'] };
      },
    },
  },
  'Rapid Advance Aura': {
    description: 'This model and its unit get Rapid Advance.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Rapid Advance Aura')) {
          return { additionalRules: ['Rapid Advance'] };
        }
        return {};
      },
    },
  },
  'Rapid Charge Aura': {
    description: 'This model and its unit get +4" when charging.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Rapid Charge Aura')) {
          return { additionalRules: ['Rapid Charge'] };
        }
        return {};
      },
    },
  },
  'Stealth Aura': {
    description: 'This model and its unit get Stealth.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Stealth Aura')) {
          return { additionalRules: ['Stealth'] };
        }
        return {};
      },
    },
  },

  // Army spells
  'Spirit Power': {
    description: 'Pick one friendly unit within 12" which gets Flying once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          target._tempFlying = true;
          specialRulesApplied.push({ rule: 'Spirit Power', effect: `gave Flying to ${target.name}` });
        }
      },
      [HOOKS.ON_MOVE_PATH]: ({ unit }) => {
        if (unit._tempFlying) {
          delete unit._tempFlying;
          return { ignoreTerrain: true, ignoreUnits: true };
        }
        return {};
      },
    },
  },
  'Soul Spear': {
    description: 'Pick one enemy model within 24" which takes 1 hit with Puncture.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Soul Spear', effect: `1 hit with Puncture on ${target.name}` });
          return { extraHits: [{ target, count: 1, ap: 0, puncture: true }] };
        }
      },
    },
  },
  'Spirit Resolve': {
    description: 'Pick up to two friendly units within 12" which get Clan Warrior Boost once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u => u.owner === caster.owner && u.distanceTo(caster) <= 12).slice(0, 2);
        friendlies.forEach(u => u._tempClanWarriorBoost = true);
        specialRulesApplied.push({ rule: 'Spirit Resolve', effect: `gave Clan Warrior Boost to ${friendlies.length} units` });
      },
    },
  },
  'Mind Vortex': {
    description: 'Pick up to two enemy units within 12" which take 2 hits with AP(2) each.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const enemies = gameState.units.filter(u => u.owner !== caster.owner && u.distanceTo(caster) <= 12).slice(0, 2);
        const extraHits = enemies.map(e => ({ target: e, count: 2, ap: 2 }));
        specialRulesApplied.push({ rule: 'Mind Vortex', effect: `2 hits AP2 on ${enemies.length} units` });
        return { extraHits };
      },
    },
  },
  'Eternal Guidance': {
    description: 'Pick up to three enemy units within 18" which get +6" range mark once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const enemies = gameState.units.filter(u => u.owner !== caster.owner && u.distanceTo(caster) <= 18).slice(0, 3);
        enemies.forEach(u => u.range_marked = true);
        specialRulesApplied.push({ rule: 'Eternal Guidance', effect: `marked ${enemies.length} units for +6" range` });
      },
    },
  },
  'Dragon Breath': {
    description: 'Pick one enemy unit within 12" which takes 9 hits.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Dragon Breath', effect: `9 hits on ${target.name}` });
          return { extraHits: [{ target, count: 9, ap: 0 }] };
        }
      },
    },
  },
};
