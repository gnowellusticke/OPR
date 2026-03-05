/**
 * rules/opr-rules-knight-brothers.js
 * Knight Brothers faction rules from v3.5.2
 */
import { HOOKS } from '../RuleRegistry.js';

export const KNIGHT_BROTHERS_RULES = {
  // Army-wide
  Knightborn: {
    description: 'On 6+ ignore wound (4+ vs spells).',
    hooks: {
      [HOOKS.ON_INCOMING_WOUNDS]: ({ wounds, isSpell, dice, specialRulesApplied }) => {
        let ignored = 0;
        const threshold = isSpell ? 4 : 6;
        for (let i = 0; i < wounds; i++) {
          if (dice.roll() >= threshold) ignored++;
        }
        if (ignored > 0) {
          specialRulesApplied.push({ rule: 'Knightborn', effect: `${ignored}/${wounds} ignored` });
          return { wounds: wounds - ignored };
        }
        return {};
      },
    },
  },

  // Special rules (shared with Battle Brothers, but we'll redefine with same implementations)
  Evasive: {
    description: 'Enemies get -1 to hit when attacking this unit.',
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

  'Melee Shrouding': {
    description: 'Enemies get -3" movement when trying to charge this unit.',
    hooks: {
      // Requires charge distance modification. We'll return a flag.
      [HOOKS.MODIFY_SPEED]: ({ unit, action, speedDelta, specialRulesApplied }) => {
        if (action === 'Charge') {
          // Check if target has Melee Shrouding? Not available here. The engine should handle.
          // We'll leave it as a marker.
          return { chargePenalty: 3 };
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
        const targets = gameState.units.filter(u => u.owner === unit.owner && Math.hypot(u.x - unit.x, u.y - unit.y) <= 3 && u.tough > 1 && u.current_models < u.total_models);
        if (targets.length === 0 && unit.tough > 1 && unit.current_models < unit.total_models) {
          targets.push(unit);
        }
        if (targets.length > 0) {
          const target = targets[0];
          const heal = dice.roll() % 3 + 1;
          target.current_models = Math.min(target.total_models, target.current_models + heal);
          unit._mendUsed = true;
          specialRulesApplied.push({ rule: 'Mend', effect: `healed ${heal} wound(s) on ${target.name}` });
        }
        return {};
      },
    },
  },

  'Rapid Rush': {
    description: '+6" when using Rush actions.',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ action, speedDelta, specialRulesApplied }) => {
        if (action === 'Rush') {
          specialRulesApplied.push({ rule: 'Rapid Rush', effect: '+6"' });
          return { speedDelta: (speedDelta ?? 0) + 6 };
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

  'Re-Position Artillery': {
    description: 'Once per activation, pick one friendly Artillery model within 6" — it may immediately move up to 9".',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._repositionUsed) return {};
        const artillery = gameState.units.find(u => u.owner === unit.owner && u !== unit && Math.hypot(u.x - unit.x, u.y - unit.y) <= 6 && (u.special_rules || '').includes('Artillery'));
        if (artillery) {
          unit._repositionUsed = true;
          specialRulesApplied.push({ rule: 'Re-Position Artillery', effect: `${artillery.name} may move up to 9"` });
          return { repositionUnit: artillery, distance: 9 };
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

  Smash: {
    description: 'Ignores Regeneration. Against Defense 5+ to 6+, gets Blast(+3).',
    hooks: {
      [HOOKS.ON_INCOMING_WOUNDS]: ({ specialRulesApplied }) => {
        return { suppressRegeneration: true };
      },
      [HOOKS.ON_WOUND_CALC]: ({ target, wounds, specialRulesApplied }) => {
        if (!target) return {};
        const defense = target.defense ?? 6;
        if (defense >= 5 && defense <= 6) {
          const extra = 3;
          specialRulesApplied.push({ rule: 'Smash', effect: `+${extra} wounds (Blast)` });
          return { wounds: wounds + extra };
        }
        return {};
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

  'Unstoppable Shooting Mark': {
    description: 'Once per activation, mark an enemy; friendlies get Unstoppable when shooting against it.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._unstoppableMarkUsed) return {};
        const target = gameState.units.find(u => u.owner !== unit.owner && Math.hypot(u.x - unit.x, u.y - unit.y) <= 18);
        if (target) {
          target.unstoppable_marked = true;
          unit._unstoppableMarkUsed = true;
          specialRulesApplied.push({ rule: 'Unstoppable Shooting Mark', effect: `marked ${target.name}` });
        }
        return {};
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, specialRulesApplied }) => {
        if (target?.unstoppable_marked) {
          delete target.unstoppable_marked;
          specialRulesApplied.push({ rule: 'Unstoppable Shooting Mark', effect: 'AP ignored' });
          return { ap: Math.max(0, ap ?? 0) };
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

  VersatileReach: {
    description: 'When activated, choose +4" range or +2" charge.',
    hooks: {
      [HOOKS.BEFORE_ACTIVATION]: ({ unit, specialRulesApplied }) => {},
      [HOOKS.ON_RANGE_CHECK]: ({ unit, weapon, range, specialRulesApplied }) => {
        if (unit._versatileReachMode === 'range' && (weapon?.range ?? 0) > 2) {
          specialRulesApplied.push({ rule: 'Versatile Reach', effect: '+4" range' });
          return { range: range + 4 };
        }
        return {};
      },
      [HOOKS.MODIFY_SPEED]: ({ unit, action, speedDelta, specialRulesApplied }) => {
        if (unit._versatileReachMode === 'charge' && action === 'Charge') {
          specialRulesApplied.push({ rule: 'Versatile Reach', effect: '+2" charge' });
          return { speedDelta: (speedDelta ?? 0) + 2 };
        }
        return {};
      },
      [HOOKS.AFTER_ACTIVATION]: ({ unit }) => {
        delete unit._versatileReachMode;
      },
    },
  },

  // Auras
  'Bane in Melee Aura': {
    description: 'This model and its unit get Bane in melee.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Bane in Melee Aura')) {
          return { additionalRules: ['Bane'] };
        }
        return {};
      },
    },
  },
  'Bane when Shooting Aura': {
    description: 'This model and its unit get Bane when shooting.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Bane when Shooting Aura')) {
          return { additionalRules: ['Bane'] };
        }
        return {};
      },
    },
  },
  'Courage Aura': {
    description: '+1 to morale test rolls.',
    hooks: {
      [HOOKS.ON_MORALE_TEST]: ({ unit, roll, specialRulesApplied }) => {
        if (unit.special_rules.includes('Courage Aura')) {
          specialRulesApplied.push({ rule: 'Courage Aura', effect: '+1 to morale' });
          return { roll: roll + 1 };
        }
        return {};
      },
    },
  },
  'Melee Shrouding Aura': {
    description: 'This model and its unit get Melee Shrouding.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Melee Shrouding Aura')) {
          return { additionalRules: ['Melee Shrouding'] };
        }
        return {};
      },
    },
  },
  'Rapid Rush Aura': {
    description: 'This model and its unit get Rapid Rush.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Rapid Rush Aura')) {
          return { additionalRules: ['Rapid Rush'] };
        }
        return {};
      },
    },
  },
  'Regeneration Aura': {
    description: 'This model and its unit get Regeneration.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Regeneration Aura')) {
          return { additionalRules: ['Regeneration'] };
        }
        return {};
      },
    },
  },
  'Unpredictable Fighter Aura': {
    description: 'This model and its unit get Unpredictable Fighter.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Unpredictable Fighter Aura')) {
          return { additionalRules: ['Unpredictable Fighter'] };
        }
        return {};
      },
    },
  },
  'Versatile Reach Aura': {
    description: 'This model and its unit get Versatile Reach.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Versatile Reach Aura')) {
          return { additionalRules: ['Versatile Reach'] };
        }
        return {};
      },
    },
  },

  // Army spells
  'Knight Sight': {
    description: 'Pick one enemy unit within 18" which gets Unstoppable mark once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          target.unstoppable_marked = true;
          specialRulesApplied.push({ rule: 'Knight Sight', effect: `marked ${target.name}` });
        }
      },
    },
  },
  'Knight Trauma': {
    description: 'Pick one enemy unit within 18" which takes 1 hit with Smash.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Knight Trauma', effect: `1 hit with Smash on ${target.name}` });
          return { extraHits: [{ target, count: 1, ap: 0, smash: true }] };
        }
      },
    },
  },
  'Banishing Sigil': {
    description: 'Pick up to two enemy units within 18" which get -1 to defense rolls once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const enemies = gameState.units.filter(u => u.owner !== caster.owner && Math.hypot(u.x - caster.x, u.y - caster.y) <= 18).slice(0, 2);
        enemies.forEach(u => u._defenseDebuff = true);
        specialRulesApplied.push({ rule: 'Banishing Sigil', effect: `gave -1 defense to ${enemies.length} units` });
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, defense, specialRulesApplied }) => {
        if (unit._defenseDebuff) {
          delete unit._defenseDebuff;
          specialRulesApplied.push({ rule: 'Banishing Sigil', effect: '-1 defense' });
          return { defense: Math.min(6, defense + 1) };
        }
        return {};
      },
    },
  },
  'Doom Strike': {
    description: 'Pick one enemy unit within 6" which takes 2 hits with AP(2) and Deadly(3).',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Doom Strike', effect: `2 hits AP2 Deadly3 on ${target.name}` });
          return { extraHits: [{ target, count: 2, ap: 2, deadly: 3 }] };
        }
      },
    },
  },
  'Knight Dome': {
    description: 'Pick up to three friendly units within 12" which get Evasive once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u => u.owner === caster.owner && Math.hypot(u.x - caster.x, u.y - caster.y) <= 12).slice(0, 3);
        friendlies.forEach(u => u._tempEvasive = true);
        specialRulesApplied.push({ rule: 'Knight Dome', effect: `gave Evasive to ${friendlies.length} units` });
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, specialRulesApplied }) => {
        if (unit._tempEvasive) {
          delete unit._tempEvasive;
          specialRulesApplied.push({ rule: 'Evasive', effect: '-1 to hit' });
          return { quality: Math.min(6, quality + 1) };
        }
        return {};
      },
    },
  },
  'Purge the Impure': {
    description: 'Pick up to two enemy units within 12" which take 3 hits with AP(2) each.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const enemies = gameState.units.filter(u => u.owner !== caster.owner && Math.hypot(u.x - caster.x, u.y - caster.y) <= 12).slice(0, 2);
        const extraHits = enemies.map(e => ({ target: e, count: 3, ap: 2 }));
        specialRulesApplied.push({ rule: 'Purge the Impure', effect: `3 hits AP2 on ${enemies.length} units` });
        return { extraHits };
      },
    },
  },
};
