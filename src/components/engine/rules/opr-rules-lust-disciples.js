/**
 * rules/opr-rules-lust-disciples.js
 * Lust Disciples faction rules from v3.5.2
 */
import { HOOKS } from '../RuleRegistry.js';

export const LUST_DISCIPLES_RULES = {
  // Army-wide
  Lustbound: {
    description: '+1" Advance, +3" Rush/Charge.',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ action, speedDelta, specialRulesApplied }) => {
        const delta = action === 'Advance' ? 1 : 3;
        specialRulesApplied.push({ rule: 'Lustbound', value: delta, effect: `+${delta}"` });
        return { speedDelta: (speedDelta ?? 0) + delta };
      },
    },
  },

  // Special rules
  'Dangerous Terrain Debuff': {
    description: 'Once per activation, pick an enemy unit within 18" which must take a Dangerous Terrain test.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, dice, specialRulesApplied }) => {
        if (unit._dangerousDebuffUsed) return {};
        const target = gameState.units.find(u => u.owner !== unit.owner && Math.hypot(u.x - unit.x, u.y - unit.y) <= 18);
        if (target) {
          unit._dangerousDebuffUsed = true;
          specialRulesApplied.push({ rule: 'Dangerous Terrain Debuff', effect: `forcing test on ${target.name}` });
          return { dangerousTerrainTest: target };
        }
        return {};
      },
    },
  },

  'Lustbound Boost': {
    description: '+2" Advance, +6" Rush/Charge (overrides Lustbound).',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ action, speedDelta, specialRulesApplied }) => {
        const delta = action === 'Advance' ? 2 : 6;
        specialRulesApplied.push({ rule: 'Lustbound Boost', value: delta, effect: `+${delta}"` });
        return { speedDelta: (speedDelta ?? 0) + delta };
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

  Shatter: {
    description: 'Ignores Regeneration. Against Tough(3-9), gets AP(+2).',
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
          specialRulesApplied.push({ rule: 'Shatter', effect: `+AP(2) vs Tough(${toughVal})` });
          return { ap: (ap ?? 0) + 2 };
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
        const friendly = gameState.units.find(u => u.owner === unit.owner && u !== unit && Math.hypot(u.x - unit.x, u.y - unit.y) <= 12);
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
      [HOOKS.BEFORE_ACTIVATION]: ({ unit, specialRulesApplied }) => {},
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
  'Lustbound Boost Aura': {
    description: 'This model and its unit get Lustbound Boost.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Lustbound Boost Aura')) {
          return { additionalRules: ['Lustbound Boost'] };
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
  'Combat Ecstasy': {
    description: 'Pick one enemy unit within 18" which gets Quick Shot mark once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          target._quickShotMark = true;
          specialRulesApplied.push({ rule: 'Combat Ecstasy', effect: `marked ${target.name} for Quick Shot` });
        }
      },
      [HOOKS.AFTER_MOVEMENT]: ({ unit, action, specialRulesApplied }) => {
        if (unit._quickShotMark && action === 'Rush') {
          delete unit._quickShotMark;
          specialRulesApplied.push({ rule: 'Quick Shot', effect: 'may shoot after Rush' });
          return { allowShootAfterRush: true };
        }
        return {};
      },
    },
  },
  'Beautiful Pain': {
    description: 'Pick one enemy unit within 12" which takes 2 hits with Shatter.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Beautiful Pain', effect: `2 hits with Shatter on ${target.name}` });
          return { extraHits: [{ target, count: 2, ap: 0, shatter: true }] };
        }
      },
    },
  },
  'Blissful Dance': {
    description: 'Pick up to two friendly units within 12" which get Melee Evasion once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u => u.owner === caster.owner && Math.hypot(u.x - caster.x, u.y - caster.y) <= 12).slice(0, 2);
        friendlies.forEach(u => u._tempMeleeEvasion = true);
        specialRulesApplied.push({ rule: 'Blissful Dance', effect: `gave Melee Evasion to ${friendlies.length} units` });
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, isMelee, quality, specialRulesApplied }) => {
        if (isMelee && unit._tempMeleeEvasion) {
          delete unit._tempMeleeEvasion;
          specialRulesApplied.push({ rule: 'Melee Evasion', effect: '-1 to hit attacker' });
          return { quality: Math.min(6, quality + 1) };
        }
        return {};
      },
    },
  },
  'Total Seizure': {
    description: 'Pick one enemy model within 18" which takes 4 hits with AP(1).',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Total Seizure', effect: `4 hits AP1 on ${target.name}` });
          return { extraHits: [{ target, count: 4, ap: 1 }] };
        }
      },
    },
  },
  'Lust Boon': {
    description: 'Pick up to three friendly units within 12" which get Lustbound Boost once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u => u.owner === caster.owner && Math.hypot(u.x - caster.x, u.y - caster.y) <= 12).slice(0, 3);
        friendlies.forEach(u => u._tempLustboundBoost = true);
        specialRulesApplied.push({ rule: 'Lust Boon', effect: `gave Lustbound Boost to ${friendlies.length} units` });
      },
      [HOOKS.MODIFY_SPEED]: ({ unit, action, speedDelta, specialRulesApplied }) => {
        if (unit._tempLustboundBoost) {
          delete unit._tempLustboundBoost;
          const delta = action === 'Advance' ? 2 : 6;
          specialRulesApplied.push({ rule: 'Lustbound Boost', effect: `+${delta}"` });
          return { speedDelta: (speedDelta ?? 0) + delta };
        }
        return {};
      },
    },
  },
  'Overpowering Lash': {
    description: 'Pick one enemy unit within 12" which takes 6 hits with AP(1) and Shred.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Overpowering Lash', effect: `6 hits AP1 Shred on ${target.name}` });
          return { extraHits: [{ target, count: 6, ap: 1, shred: true }] };
        }
      },
    },
  },
};
