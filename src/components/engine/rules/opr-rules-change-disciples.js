/**
 * rules/opr-rules-change-disciples.js
 * Change Disciples faction rules from v3.5.2
 */
import { HOOKS } from '../RuleRegistry.js';

export const CHANGE_DISCIPLES_RULES = {
  // Army-wide
  Changebound: {
    description: 'When shot or charged from over 9" away, enemies get -1 to hit.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ attackDistance, quality, specialRulesApplied }) => {
        if ((attackDistance ?? 0) > 9) {
          specialRulesApplied.push({ rule: 'Changebound', effect: '-1 to hit' });
          return { quality: Math.min(6, quality + 1) };
        }
        return {};
      },
    },
  },

  // Special rules
  'Changebound Boost': {
    description: 'Enemies always get -1 to hit from Changebound, regardless of distance.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ quality, specialRulesApplied }) => {
        specialRulesApplied.push({ rule: 'Changebound Boost', effect: '-1 to hit' });
        return { quality: Math.min(6, quality + 1) };
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
          // The engine should apply a dangerous terrain test to the target.
          // We'll return a command.
          specialRulesApplied.push({ rule: 'Dangerous Terrain Debuff', effect: `forcing test on ${target.name}` });
          return { dangerousTerrainTest: target };
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
        const targets = gameState.units.filter(u => u.owner === unit.owner && u.distanceTo(unit) <= 3 && u.tough > 1 && u.current_models < u.total_models);
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

  Slam: {
    description: 'Ignores cover. On unmodified 1 to save, +1 wound.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ specialRulesApplied }) => {
        return { ignoresCover: true };
      },
      [HOOKS.ON_PER_HIT]: ({ saveRoll, specialRulesApplied }) => {
        if (saveRoll === 1) {
          specialRulesApplied.push({ rule: 'Slam', effect: 'extra wound' });
          return { extraWounds: 1 };
        }
        return {};
      },
    },
  },

  Slash: {
    description: 'Ignores cover. Unmodified 6 to hit deal 1 extra hit.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ specialRulesApplied }) => {
        return { ignoresCover: true };
      },
      [HOOKS.AFTER_HIT_ROLLS]: ({ rolls, successes, specialRulesApplied }) => {
        const sixes = rolls.filter(r => r.value === 6 && r.success && !r.auto).length;
        if (sixes === 0) return {};
        specialRulesApplied.push({ rule: 'Slash', effect: `${sixes} extra hits` });
        return { successes: successes + sixes };
      },
    },
  },

  Steadfast: {
    description: 'If Shaken at start of round, roll 4+ to recover.',
    hooks: {
      [HOOKS.ON_ROUND_START]: ({ unit, dice, specialRulesApplied }) => {
        if (unit.status !== 'shaken') return {};
        const roll = dice.roll();
        if (roll >= 4) {
          specialRulesApplied.push({ rule: 'Steadfast', effect: `recovered (rolled ${roll})` });
          return { clearShaken: true };
        } else {
          specialRulesApplied.push({ rule: 'Steadfast', effect: `failed recovery (rolled ${roll})` });
          return {};
        }
      },
    },
  },

  'Steadfast Buff': {
    description: 'Once per activation, give a friendly unit Steadfast once.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._steadfastBuffUsed) return {};
        const friendly = gameState.units.find(u => u.owner === unit.owner && u !== unit && u.distanceTo(unit) <= 12);
        if (friendly) {
          friendly._tempSteadfast = true;
          unit._steadfastBuffUsed = true;
          specialRulesApplied.push({ rule: 'Steadfast Buff', effect: `gave Steadfast to ${friendly.name}` });
        }
        return {};
      },
      [HOOKS.ON_ROUND_START]: ({ unit, dice, specialRulesApplied }) => {
        if (unit._tempSteadfast) {
          delete unit._tempSteadfast;
          if (unit.status === 'shaken') {
            const roll = dice.roll();
            if (roll >= 4) {
              specialRulesApplied.push({ rule: 'Steadfast Buff', effect: 'recovered' });
              return { clearShaken: true };
            }
          }
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

  VersatileDefense: {
    description: 'When deployed or activated, choose: when shot/charged from >9", get +1 defense or enemies -1 to hit.',
    hooks: {
      [HOOKS.BEFORE_ACTIVATION]: ({ unit, specialRulesApplied }) => {
        // AI sets unit._versatileDefenseMode = 'defense' or 'hit'
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, attackDistance, defense, specialRulesApplied }) => {
        if (unit._versatileDefenseMode === 'defense' && (attackDistance ?? 0) > 9) {
          specialRulesApplied.push({ rule: 'Versatile Defense', effect: '+1 defense' });
          return { defense: Math.max(2, defense - 1) };
        }
        return {};
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, attackDistance, quality, specialRulesApplied }) => {
        if (unit._versatileDefenseMode === 'hit' && (attackDistance ?? 0) > 9) {
          specialRulesApplied.push({ rule: 'Versatile Defense', effect: '-1 to hit attacker' });
          return { quality: Math.min(6, quality + 1) };
        }
        return {};
      },
      [HOOKS.AFTER_ACTIVATION]: ({ unit }) => {
        delete unit._versatileDefenseMode;
      },
    },
  },

  // Auras
  'Changebound Boost Aura': {
    description: 'This model and its unit get Changebound Boost.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Changebound Boost Aura')) {
          return { additionalRules: ['Changebound Boost'] };
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
  'Relentless Aura': {
    description: 'This model and its unit get Relentless.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Relentless Aura')) {
          return { additionalRules: ['Relentless'] };
        }
        return {};
      },
    },
  },
  'Resistance Aura': {
    description: 'This model and its unit get Resistance.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Resistance Aura')) {
          return { additionalRules: ['Resistance'] };
        }
        return {};
      },
    },
  },
  'Scout Aura': {
    description: 'This model and its unit get Scout.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Scout Aura')) {
          return { additionalRules: ['Scout'] };
        }
        return {};
      },
    },
  },
  'Versatile Defense Aura': {
    description: 'This model and its unit get Versatile Defense.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Versatile Defense Aura')) {
          return { additionalRules: ['Versatile Defense'] };
        }
        return {};
      },
    },
  },

  // Army spells
  'Shifting Form': {
    description: 'Pick one enemy unit within 18" which gets -3 to casting rolls once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          target.casting_debuff = (target.casting_debuff || 0) + 3;
          specialRulesApplied.push({ rule: 'Shifting Form', effect: `gave -3 casting to ${target.name}` });
        }
      },
    },
  },
  'Sky Blaze': {
    description: 'Pick one enemy unit within 12" which takes 2 hits with AP(1) and Slash.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Sky Blaze', effect: `2 hits AP1 Slash on ${target.name}` });
          return { extraHits: [{ target, count: 2, ap: 1, slash: true }] };
        }
      },
    },
  },
  'Breath of Change': {
    description: 'Pick up to two friendly units within 12" which get Bane when Shooting once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u => u.owner === caster.owner && u.distanceTo(caster) <= 12).slice(0, 2);
        friendlies.forEach(u => u._tempBaneShooting = true);
        specialRulesApplied.push({ rule: 'Breath of Change', effect: `gave Bane to ${friendlies.length} units` });
      },
    },
  },
  'Mutating Inferno': {
    description: 'Pick up to two enemy units within 9" which take 4 hits each.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const enemies = gameState.units.filter(u => u.owner !== caster.owner && u.distanceTo(caster) <= 9).slice(0, 2);
        const extraHits = enemies.map(e => ({ target: e, count: 4, ap: 0 }));
        specialRulesApplied.push({ rule: 'Mutating Inferno', effect: `4 hits on ${enemies.length} units` });
        return { extraHits };
      },
    },
  },
  'Change Boon': {
    description: 'Pick up to three friendly units within 12" which get Changebound Boost once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u => u.owner === caster.owner && u.distanceTo(caster) <= 12).slice(0, 3);
        friendlies.forEach(u => u._tempChangeboundBoost = true);
        specialRulesApplied.push({ rule: 'Change Boon', effect: `gave Changebound Boost to ${friendlies.length} units` });
      },
    },
  },
  'Power Bolt': {
    description: 'Pick one enemy unit within 12" which takes 6 hits with AP(2).',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Power Bolt', effect: `6 hits AP2 on ${target.name}` });
          return { extraHits: [{ target, count: 6, ap: 2 }] };
        }
      },
    },
  },
};
