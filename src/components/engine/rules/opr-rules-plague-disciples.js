/**
 * rules/opr-rules-plague-disciples.js
 * Plague Disciples faction rules from v3.5.2 (page 3)
 * Uses the enhanced RulesEngine with activation hooks.
 */

import { HOOKS } from '../RuleRegistry.js';
import { Dice } from '../../Dice.js';

export const PLAGUE_DISCIPLES_RULES = {
  // -------------------------------------------------------------------------
  // Army‑wide rule
  // -------------------------------------------------------------------------
  Plaguebound: {
    description: 'When a unit where all models have this rule takes wounds, roll one die for each. On a 6+ it is ignored. (Improved to 5+ with Plaguebound Boost.)',
    hooks: {
      [HOOKS.ON_INCOMING_WOUNDS]: ({ unit, wounds, specialRulesApplied }) => {
        if (!unit.special_rules.includes('Plaguebound')) return {};

        const hasBoost = unit.special_rules.includes('Plaguebound Boost') ||
                         specialRulesApplied.includes('Plaguebound Boost');
        const threshold = hasBoost ? 5 : 6;

        let ignored = 0;
        for (let i = 0; i < wounds; i++) {
          const roll = Dice.roll();
          if (roll >= threshold) ignored++;
        }
        specialRulesApplied.push({ rule: 'Plaguebound', effect: `ignored ${ignored} wounds (threshold ${threshold})` });
        return { wounds: wounds - ignored };
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
        if (unit._boundingUsed) return {}; // once per activation
        const distance = dice.roll('D3') + 1;
        unit._boundingUsed = true;
        specialRulesApplied.push({ rule: 'Bounding', effect: `may reposition up to ${distance}"` });
        return {
          boundingMove: { distance }
        };
      },
      [HOOKS.ON_ACTIVATION_END]: ({ unit }) => {
        delete unit._boundingUsed;
      },
    },
  },

  Butcher: {
    description: 'Ignores Regeneration, and on unmodified results of 6 to hit, this weapon deals 1 extra hit (only the original hit counts as a 6 for special rules).',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ weapon, rolls, successes, specialRulesApplied }) => {
        if (!(weapon.special_rules || '').includes('Butcher')) return {};

        const sixes = rolls.filter(r => r.value === 6 && !r.auto).length;
        const extraHits = sixes;
        specialRulesApplied.push({ rule: 'Butcher', effect: `+${extraHits} hits from sixes` });
        specialRulesApplied.push({ rule: 'Butcher', effect: 'suppress Regeneration' });
        return { successes: successes + extraHits };
      },
    },
  },

  'Dangerous Terrain Debuff': {
    description: 'Once per activation, before attacking, pick one enemy unit within 18" which must immediately take a Dangerous Terrain test.',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._dangerUsed) return {};
        // In practice, player chooses a target. For demo, pick first eligible enemy.
        const target = gameState.units.find(u => u.owner !== unit.owner && Math.hypot(unit.x - u.x, unit.y - u.y) <= 18);
        if (target) {
          unit._dangerUsed = true;
          specialRulesApplied.push({ rule: 'Dangerous Terrain Debuff', effect: `${target.name} must take dangerous terrain test` });
          return {
            dangerousTerrainTest: { target }
          };
        }
        return {};
      },
      [HOOKS.ON_ACTIVATION_END]: ({ unit }) => {
        delete unit._dangerUsed;
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
          unit._mendUsed = true;
          specialRulesApplied.push({ rule: 'Mend', effect: `healed ${heal} wound(s) on ${target.name}` });
          return {
            mend: { target, healAmount: heal }
          };
        }
        return {};
      },
      [HOOKS.ON_ACTIVATION_END]: ({ unit }) => {
        delete unit._mendUsed;
      },
    },
  },

  'Plaguebound Boost': {
    description: 'If all models in this unit have Plaguebound, they ignore wounds on rolls of 5‑6 from Plaguebound (instead of only on 6+).',
    // This rule is a flag; the actual effect is handled in Plaguebound hook.
    hooks: {
      // No separate hook needed, but it can be granted by auras.
    },
  },

  Protected: {
    description: 'When a unit where all models have this rule takes wounds, roll one die for each. On a 6+ it is ignored.',
    hooks: {
      [HOOKS.ON_INCOMING_WOUNDS]: ({ unit, wounds, specialRulesApplied }) => {
        if (!unit.special_rules.includes('Protected')) return {};

        let ignored = 0;
        for (let i = 0; i < wounds; i++) {
          const roll = Dice.roll();
          if (roll >= 6) ignored++;
        }
        specialRulesApplied.push({ rule: 'Protected', effect: `ignored ${ignored} wounds` });
        return { wounds: wounds - ignored };
      },
    },
  },

  'Rapid Rush': {
    description: 'This model moves +6" when using Rush actions.',
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

  Resistance: {
    description: 'When a unit where all models have this rule takes wounds, roll one die for each. On a 6+ it is ignored. If the wounds were from a spell, then they are ignored on a 2+ instead.',
    hooks: {
      [HOOKS.ON_INCOMING_WOUNDS]: ({ unit, wounds, specialRulesApplied, fromSpell }) => {
        if (!unit.special_rules.includes('Resistance')) return {};

        const threshold = fromSpell ? 2 : 6;
        let ignored = 0;
        for (let i = 0; i < wounds; i++) {
          const roll = Dice.roll();
          if (roll >= threshold) ignored++;
        }
        specialRulesApplied.push({ rule: 'Resistance', effect: `ignored ${ignored} wounds (threshold ${threshold})` });
        return { wounds: wounds - ignored };
      },
    },
  },

  Slam: {
    description: 'Ignores Cover, and on unmodified results of 1 to block hits, this weapon deals 1 extra wound.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ weapon, specialRulesApplied }) => {
        if (!(weapon.special_rules || '').includes('Slam')) return {};
        specialRulesApplied.push({ rule: 'Slam', effect: 'ignores cover' });
        return { ignoresCover: true };
      },
      [HOOKS.ON_PER_HIT]: ({ weapon, saveRoll, specialRulesApplied }) => {
        if (!(weapon.special_rules || '').includes('Slam')) return {};
        if (saveRoll === 1) {
          specialRulesApplied.push({ rule: 'Slam', effect: 'extra wound from save roll 1' });
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
        if (!unit.special_rules.includes('Steadfast')) return {};
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
    description: 'Once per activation, before attacking, pick one friendly unit within 12" which gets Steadfast once (next time the effect would apply).',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._buffUsed) return {};
        const target = gameState.units.find(u =>
          u.owner === unit.owner &&
          u !== unit &&
          Math.hypot(u.x - unit.x, u.y - unit.y) <= 12
        );
        if (target) {
          target._tempSteadfast = true;
          unit._buffUsed = true;
          specialRulesApplied.push({ rule: 'Steadfast Buff', effect: `gave temporary Steadfast to ${target.name}` });
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
        // The temporary rule will expire when the unit that received it activates; we clear it in its ON_ACTIVATION_START.
      },
    },
  },

  Unpredictable: {
    description: 'When attacking, roll one die and apply one effect to all models with this rule: on a 1‑3 they get AP(+1) and on a 4‑6 they get +1 to hit rolls instead.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, dice, specialRulesApplied }) => {
        if (!unit.special_rules.includes('Unpredictable')) return {};
        const roll = dice.roll();
        const mode = roll <= 3 ? 'ap' : 'hit';
        unit._unpredictableMode = mode;
        specialRulesApplied.push({ rule: 'Unpredictable', effect: `mode = ${mode} (rolled ${roll})` });
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
    description: 'When in melee, roll one die and apply one effect to all models with this rule: on a 1‑3 they get AP(+1) and on a 4‑6 they get +1 to hit rolls instead.',
    hooks: {
      [HOOKS.BEFORE_MELEE_ATTACK]: ({ unit, dice, specialRulesApplied }) => {
        if (!unit.special_rules.includes('Unpredictable Fighter')) return {};
        const roll = dice.roll();
        const mode = roll <= 3 ? 'ap' : 'hit';
        unit._unpredictableFighterMode = mode;
        specialRulesApplied.push({ rule: 'Unpredictable Fighter', effect: `mode = ${mode} (rolled ${roll})` });
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
    description: 'When this unit is activated, pick one effect: until the end of the activation all models with this rule in it either get AP(+1) when attacking, or get +1 to hit rolls when attacking.',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, specialRulesApplied }) => {
        // In a real game, the player chooses. We'll simulate with a default (hit).
        const mode = 'hit'; // or could be 'ap'
        unit._versatileAttackMode = mode;
        specialRulesApplied.push({ rule: 'Versatile Attack', effect: `mode = ${mode}` });
        return {
          setVersatileMode: mode
        };
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
    description: 'When this unit is deployed or activated, pick one effect: when shot or charged from over 9" away, the unit either gets +1 to defense rolls, or enemy units get -1 to hit rolls against it. This effect lasts until the units\' next activation.',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, specialRulesApplied }) => {
        // Player chooses mode; default 'defense'
        const mode = 'defense';
        unit._versatileDefenseMode = mode;
        specialRulesApplied.push({ rule: 'Versatile Defense', effect: `mode = ${mode}` });
        return {
          setVersatileDefense: mode
        };
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, attacker, defense, gameState, specialRulesApplied }) => {
        if (!unit._versatileDefenseMode) return {};
        const distance = Math.hypot(attacker.x - unit.x, attacker.y - unit.y);
        if (distance > 9 && unit._versatileDefenseMode === 'defense') {
          specialRulesApplied.push({ rule: 'Versatile Defense', effect: '+1 defense' });
          return { defense: Math.min(6, defense - 1) };
        }
        return {};
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ attacker, target, quality, gameState, specialRulesApplied }) => {
        if (!target?._versatileDefenseMode) return {};
        const distance = Math.hypot(attacker.x - target.x, attacker.y - target.y);
        if (distance > 9 && target._versatileDefenseMode === 'hitPenalty') {
          specialRulesApplied.push({ rule: 'Versatile Defense', effect: 'attacker -1 to hit' });
          return { quality: Math.min(6, quality + 1) };
        }
        return {};
      },
      [HOOKS.ON_ACTIVATION_START]: ({ unit }) => {
        // At the start of the next activation, clear the mode (effect expires)
        delete unit._versatileDefenseMode;
      },
    },
  },

  // -------------------------------------------------------------------------
  // Aura special rules
  // -------------------------------------------------------------------------
  'Bounding Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Bounding'] }) },
  },
  'Furious Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Furious'] }) },
  },
  'Plaguebound Boost Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Plaguebound Boost'] }) },
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

  // -------------------------------------------------------------------------
  // Army spells
  // -------------------------------------------------------------------------
  'Aura of Pestilence': {
    description: 'Pick one enemy unit within 18", which counts as being in Difficult Terrain once (next time the effect would apply).',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (!target) return {};
        target._difficultTerrainOnce = true;
        specialRulesApplied.push({ rule: 'Aura of Pestilence', effect: `${target.name} counts as difficult terrain next` });
        return {};
      },
    },
  },

  'Rapid Putrefaction': {
    description: 'Pick one enemy unit within 12", which takes 2 hits with AP(1) and Butcher.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (!target) return {};
        specialRulesApplied.push({ rule: 'Rapid Putrefaction', effect: `2 hits (AP1, Butcher) on ${target.name}` });
        return {
          extraHits: [
            { target, count: 2, ap: 1, butcher: true }
          ]
        };
      },
    },
  },

  'Blessed Virus': {
    description: 'Pick up to two friendly units within 12", which get Rapid Rush once (next time the effect would apply).',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u =>
          u.owner === caster.owner &&
          Math.hypot(u.x - caster.x, u.y - caster.y) <= 12
        ).slice(0, 2);
        friendlies.forEach(u => u._rapidRushOnce = true);
        specialRulesApplied.push({ rule: 'Blessed Virus', effect: `gave Rapid Rush to ${friendlies.length} units` });
        return {};
      },
      [HOOKS.MODIFY_SPEED]: ({ unit, action, speedDelta, specialRulesApplied }) => {
        if (action === 'Rush' && unit._rapidRushOnce) {
          delete unit._rapidRushOnce;
          specialRulesApplied.push({ rule: 'Blessed Virus', effect: '+6" from blessed virus' });
          return { speedDelta: (speedDelta ?? 0) + 6 };
        }
        return {};
      },
    },
  },

  'Plague Malediction': {
    description: 'Pick one enemy model within 24", which takes 2 hits with AP(4).',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (!target) return {};
        specialRulesApplied.push({ rule: 'Plague Malediction', effect: `2 hits (AP4) on ${target.name}` });
        return {
          extraHits: [
            { target, count: 2, ap: 4 }
          ]
        };
      },
    },
  },

  'Plague Boon': {
    description: 'Pick up to three friendly units within 12", which get Plaguebound Boost once (next time the effect would apply).',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u =>
          u.owner === caster.owner &&
          Math.hypot(u.x - caster.x, u.y - caster.y) <= 12
        ).slice(0, 3);
        friendlies.forEach(u => u._plagueboundBoostOnce = true);
        specialRulesApplied.push({ rule: 'Plague Boon', effect: `gave Plaguebound Boost to ${friendlies.length} units` });
        return {};
      },
      [HOOKS.ON_INCOMING_WOUNDS]: ({ unit, specialRulesApplied }) => {
        if (unit._plagueboundBoostOnce) {
          delete unit._plagueboundBoostOnce;
          specialRulesApplied.push({ rule: 'Plaguebound Boost', effect: 'from Plague Boon' });
        }
        return {};
      },
    },
  },

  'Rot Wave': {
    description: 'Pick one enemy unit within 18", which takes 6 hits.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (!target) return {};
        specialRulesApplied.push({ rule: 'Rot Wave', effect: `6 hits on ${target.name}` });
        return {
          extraHits: [
            { target, count: 6, ap: 0 }
          ]
        };
      },
    },
  },
};
