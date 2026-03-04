/**
 * rules/opr-rules-war-disciples.js
 * War Disciples faction rules from v3.5.2 (page 3)
 * Uses the enhanced RulesEngine with generic weapon info.
 */

import { HOOKS } from '../RuleRegistry.js';
import { Dice } from './Dice.js';

export const WAR_DISCIPLES_RULES = {
  // -------------------------------------------------------------------------
  // Army‑wide rule
  // -------------------------------------------------------------------------
  Warbound: {
    description: 'Enemies that roll to block hits from this model\'s weapons take 1 extra wound for each unmodified result of 1 that they roll.',
    hooks: {
      [HOOKS.ON_PER_HIT]: ({ weapon, saveRoll, specialRulesApplied }) => {
        if (!weapon.rules.includes('Warbound')) return {};

        const hasBoost = weapon.rules.includes('Warbound Boost') ||
                         specialRulesApplied.includes('Warbound Boost');
        const thresholdMin = hasBoost ? 1 : 1; // For boost, it's 1-2, but we only get one saveRoll at a time.
        // Actually we need to handle the range. Since we have one saveRoll, we check if it's 1 or if boost and it's 1 or 2.
        const isExtra = hasBoost ? saveRoll <= 2 : saveRoll === 1;
        if (isExtra) {
          specialRulesApplied.push({ rule: 'Warbound', effect: 'extra wound from save roll' });
          return { extraWounds: 1 };
        }
        return {};
      },
    },
  },

  // -------------------------------------------------------------------------
  // Special rules
  // -------------------------------------------------------------------------
  Break: {
    description: 'Ignores Regeneration, and on unmodified results of 6 to hit, those hits get AP(+2).',
    hooks: {
      [HOOKS.ON_INCOMING_WOUNDS]: ({ specialRulesApplied }) => {
        specialRulesApplied.push({ rule: 'Break', effect: 'suppress Regeneration' });
        return { suppressRegeneration: true };
      },
      [HOOKS.ON_PER_HIT]: ({ weaponRules, hitRoll, ap, specialRulesApplied }) => {
        if (!weaponRules.includes('Break')) return {};
        if (hitRoll.value === 6 && !hitRoll.auto) {
          specialRulesApplied.push({ rule: 'Break', effect: 'AP+2' });
          return { apBonus: 2 };
        }
        return {};
      },
    },
  },

  'Dangerous Terrain Debuff': {
    description: 'Once per activation, before attacking, pick one enemy unit within 18" which must immediately take a Dangerous Terrain test.',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._dangerUsed) return {};
        const target = gameState.units.find(u => u.owner !== unit.owner && unit.distanceTo(u) <= 18);
        if (target) {
          unit._dangerUsed = true;
          specialRulesApplied.push({ rule: 'Dangerous Terrain Debuff', effect: `${target.name} must test` });
          return { dangerousTerrainTest: { target } };
        }
        return {};
      },
      [HOOKS.ON_ACTIVATION_END]: ({ unit }) => {
        delete unit._dangerUsed;
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

  Mend: {
    description: 'Once per activation, before attacking, pick one friendly model within 3" with Tough, and remove D3 wounds from it.',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, gameState, dice, specialRulesApplied }) => {
        if (unit._mendUsed) return {};
        const target = gameState.units.find(u =>
          u.owner === unit.owner &&
          u.distanceTo(unit) <= 3 &&
          u.tough > 1 &&
          u.current_models < u.total_models
        );
        if (target) {
          const heal = dice.roll() % 3 + 1; // D3
          unit._mendUsed = true;
          specialRulesApplied.push({ rule: 'Mend', effect: `healed ${heal} on ${target.name}` });
          return { mend: { target, healAmount: heal } };
        }
        return {};
      },
      [HOOKS.ON_ACTIVATION_END]: ({ unit }) => {
        delete unit._mendUsed;
      },
    },
  },

  'Piercing Assault': {
    description: 'This model gets AP(+1) when charging.',
    hooks: {
      [HOOKS.BEFORE_MELEE_ATTACK]: ({ unit, specialRulesApplied }) => {
        if (unit._charged && unit.rules.includes('Piercing Assault')) {
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

  Resistance: {
    description: 'When a unit where all models have this rule takes wounds, roll one die for each. On a 6+ it is ignored. If the wounds were from a spell, then they are ignored on a 2+ instead.',
    hooks: {
      [HOOKS.ON_INCOMING_WOUNDS]: ({ unit, wounds, fromSpell, specialRulesApplied }) => {
        if (!unit.rules.includes('Resistance')) return {};

        const threshold = fromSpell ? 2 : 6;
        let ignored = 0;
        for (let i = 0; i < wounds; i++) {
          const roll = Dice.roll();
          if (roll >= threshold) ignored++;
        }
        specialRulesApplied.push({ rule: 'Resistance', effect: `ignored ${ignored} wounds` });
        return { wounds: wounds - ignored };
      },
    },
  },

  Slam: {
    description: 'Ignores Cover, and on unmodified results of 1 to block hits, this weapon deals 1 extra wound.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ weaponRules, specialRulesApplied }) => {
        if (!weaponRules.includes('Slam')) return {};
        specialRulesApplied.push({ rule: 'Slam', effect: 'ignores cover' });
        return { ignoresCover: true };
      },
      [HOOKS.ON_PER_HIT]: ({ weaponRules, saveRoll, specialRulesApplied }) => {
        if (!weaponRules.includes('Slam')) return {};
        if (saveRoll === 1) {
          specialRulesApplied.push({ rule: 'Slam', effect: 'extra wound' });
          return { extraWounds: 1 };
        }
        return {};
      },
    },
  },

  Steadfast: {
    description: 'If a unit where all models have this rule is Shaken at the beginning of the round, roll one die. On a 4+ it stops being Shaken.',
    hooks: {
      [HOOKS.ON_ROUND_START]: ({ unit, dice, specialRulesApplied }) => {
        if (!unit.rules.includes('Steadfast')) return {};
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
    description: 'Once per activation, before attacking, pick one friendly unit within 12" which gets Steadfast once.',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._buffUsed) return {};
        const target = gameState.units.find(u =>
          u.owner === unit.owner &&
          u !== unit &&
          u.distanceTo(unit) <= 12
        );
        if (target) {
          target._tempSteadfast = true;
          unit._buffUsed = true;
          specialRulesApplied.push({ rule: 'Steadfast Buff', effect: `gave to ${target.name}` });
        }
        return {};
      },
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit._tempSteadfast) {
          return { additionalRules: ['Steadfast'] };
        }
        return {};
      },
      [HOOKS.ON_ACTIVATION_END]: ({ unit }) => {
        delete unit._buffUsed;
      },
    },
  },

  Unpredictable: {
    description: 'When attacking, roll one die and apply one effect: on 1‑3 they get AP(+1), on 4‑6 they get +1 to hit.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, dice, specialRulesApplied }) => {
        if (!unit.rules.includes('Unpredictable')) return {};
        const roll = dice.roll();
        const mode = roll <= 3 ? 'ap' : 'hit';
        unit._unpredictableMode = mode;
        specialRulesApplied.push({ rule: 'Unpredictable', effect: `mode = ${mode}` });
        return {};
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, specialRulesApplied }) => {
        if (unit._unpredictableMode === 'hit') {
          specialRulesApplied.push({ rule: 'Unpredictable', effect: '+1 to hit' });
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, ap, specialRulesApplied }) => {
        if (unit._unpredictableMode === 'ap') {
          specialRulesApplied.push({ rule: 'Unpredictable', effect: 'AP+1' });
          return { ap: (ap ?? 0) + 1 };
        }
        return {};
      },
      [HOOKS.AFTER_ATTACK]: ({ unit }) => {
        delete unit._unpredictableMode;
      },
    },
  },

  'Unpredictable Fighter': {
    description: 'When in melee, roll one die and apply one effect: on 1‑3 AP(+1), on 4‑6 +1 to hit.',
    hooks: {
      [HOOKS.BEFORE_MELEE_ATTACK]: ({ unit, dice, specialRulesApplied }) => {
        if (!unit.rules.includes('Unpredictable Fighter')) return {};
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

  'Versatile Attack': {
    description: 'When activated, pick AP+1 or +1 to hit for the activation.',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, specialRulesApplied }) => {
        // In real game, player chooses. We'll default to 'hit' for demo.
        const mode = 'hit';
        unit._versatileAttackMode = mode;
        specialRulesApplied.push({ rule: 'Versatile Attack', effect: `mode = ${mode}` });
        return { setVersatileMode: mode };
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, specialRulesApplied }) => {
        if (unit._versatileAttackMode === 'hit') {
          specialRulesApplied.push({ rule: 'Versatile Attack', effect: '+1 to hit' });
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, ap, specialRulesApplied }) => {
        if (unit._versatileAttackMode === 'ap') {
          specialRulesApplied.push({ rule: 'Versatile Attack', effect: 'AP+1' });
          return { ap: (ap ?? 0) + 1 };
        }
        return {};
      },
      [HOOKS.ON_ACTIVATION_END]: ({ unit }) => {
        delete unit._versatileAttackMode;
      },
    },
  },

  'Versatile Defense': {
    description: 'When deployed or activated, pick effect: when shot/charged from over 9", either +1 defense or enemy -1 to hit. Lasts until next activation.',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, specialRulesApplied }) => {
        // Player chooses mode; default 'defense'
        const mode = 'defense';
        unit._versatileDefenseMode = mode;
        specialRulesApplied.push({ rule: 'Versatile Defense', effect: `mode = ${mode}` });
        return { setVersatileDefense: mode };
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, attacker, defense, specialRulesApplied }) => {
        if (!unit._versatileDefenseMode) return {};
        const distance = Math.hypot(attacker.x - unit.x, attacker.y - unit.y);
        if (distance > 9 && unit._versatileDefenseMode === 'defense') {
          specialRulesApplied.push({ rule: 'Versatile Defense', effect: '+1 defense' });
          return { defense: Math.min(6, defense - 1) };
        }
        return {};
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ attacker, target, quality, specialRulesApplied }) => {
        if (!target?._versatileDefenseMode) return {};
        const distance = Math.hypot(attacker.x - target.x, attacker.y - target.y);
        if (distance > 9 && target._versatileDefenseMode === 'hitPenalty') {
          specialRulesApplied.push({ rule: 'Versatile Defense', effect: 'attacker -1' });
          return { quality: Math.min(6, quality + 1) };
        }
        return {};
      },
      [HOOKS.ON_ACTIVATION_START]: ({ unit }) => {
        // At next activation start, effect expires
        delete unit._versatileDefenseMode;
      },
    },
  },

  'Warbound Boost': {
    description: 'If this model has Warbound, enemies taking wounds from it take extra wounds on failed defense rolls of 1‑2 (instead of only on 1).',
    // This is a flag that modifies Warbound. No separate hook needed; Warbound hook checks for it.
    hooks: {},
  },

  // -------------------------------------------------------------------------
  // Auras
  // -------------------------------------------------------------------------
  'Furious Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Furious'] }) },
  },
  'Relentless Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Relentless'] }) },
  },
  'Resistance Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Resistance'] }) },
  },
  'Scout Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Scout'] }) },
  },
  'Versatile Defense Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Versatile Defense'] }) },
  },
  'Warbound Boost Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Warbound Boost'] }) },
  },

  // -------------------------------------------------------------------------
  // Army spells
  // -------------------------------------------------------------------------
  'Terrifying Fury': {
    description: 'Pick one enemy unit within 18" which must take a morale test. If failed, it becomes fatigued.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, dice, specialRulesApplied }) => {
        if (!target) return {};
        const moraleRoll = dice.roll();
        const passed = moraleRoll >= target.quality;
        if (!passed) {
          target._fatigued = true; // fatigue effect: -1 to hit? In OPR, fatigued gives -1 to hit? Not defined here, assume engine handles.
          specialRulesApplied.push({ rule: 'Terrifying Fury', effect: `target fatigued` });
        }
        return {};
      },
    },
  },

  'Flame of Destruction': {
    description: 'Pick one enemy unit within 18" which takes 1 hit with Blast(3).',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (!target) return {};
        specialRulesApplied.push({ rule: 'Flame of Destruction', effect: `1 hit (Blast3) on ${target.name}` });
        return {
          extraHits: [{ target, count: 1, ap: 0, blast: 3 }]
        };
      },
    },
  },

  'Fiery Protection': {
    description: 'Pick up to two friendly units within 12" which get Melee Evasion once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u => u.owner === caster.owner && u.distanceTo(caster) <= 12).slice(0, 2);
        friendlies.forEach(u => u._tempMeleeEvasion = true);
        specialRulesApplied.push({ rule: 'Fiery Protection', effect: `gave Melee Evasion to ${friendlies.length}` });
        return {};
      },
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit._tempMeleeEvasion) {
          return { additionalRules: ['Melee Evasion'] };
        }
        return {};
      },
    },
  },

  'Brutal Massacre': {
    description: 'Pick one enemy unit within 6" which takes 6 hits with Break.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (!target) return {};
        specialRulesApplied.push({ rule: 'Brutal Massacre', effect: `6 hits (Break) on ${target.name}` });
        return {
          extraHits: [{ target, count: 6, ap: 0, break: true }]
        };
      },
    },
  },

  'War Boon': {
    description: 'Pick up to three friendly units within 12" which get Warbound Boost once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u => u.owner === caster.owner && u.distanceTo(caster) <= 12).slice(0, 3);
        friendlies.forEach(u => u._tempWarboundBoost = true);
        specialRulesApplied.push({ rule: 'War Boon', effect: `gave Warbound Boost to ${friendlies.length}` });
        return {};
      },
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit._tempWarboundBoost) {
          return { additionalRules: ['Warbound Boost'] };
        }
        return {};
      },
    },
  },

  'Headtaker Strike': {
    description: 'Pick up to two enemy units within 12" which take 3 hits with AP(2) each.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const enemies = gameState.units.filter(u => u.owner !== caster.owner && u.distanceTo(caster) <= 12).slice(0, 2);
        const extraHits = enemies.map(e => ({ target: e, count: 3, ap: 2 }));
        specialRulesApplied.push({ rule: 'Headtaker Strike', effect: `3 hits (AP2) on ${enemies.length} units` });
        return { extraHits };
      },
    },
  },
};
