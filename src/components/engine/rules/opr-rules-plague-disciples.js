/**
 * rules/opr-rules-plague-disciples.js
 * Plague Disciples faction rules from v3.5.2 (page 3)
 * Implements all special rules and spells using the hook architecture from RulesEngine.
 */

import { HOOKS } from '../RuleRegistry.js';
import { Dice } from './Dice.js';

export const PLAGUE_DISCIPLES_RULES = {
  // -------------------------------------------------------------------------
  // Army‑wide rule
  // -------------------------------------------------------------------------
  Plaguebound: {
    description: 'When a unit where all models have this rule takes wounds, roll one die for each. On a 6+ it is ignored. (Improved to 5+ with Plaguebound Boost.)',
    hooks: {
      [HOOKS.ON_INCOMING_WOUNDS]: ({ unit, wounds, specialRulesApplied }) => {
        // Only apply if all models in the unit have Plaguebound (should be guaranteed by list building)
        if (!unit.rules.includes('Plaguebound')) return {};

        const hasBoost = unit.rules.includes('Plaguebound Boost') ||
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
      // Ideally would be ON_ACTIVATION; using BEFORE_ATTACK as a proxy for attacks.
      // In a full implementation, the game controller should call a dedicated activation hook.
      [HOOKS.BEFORE_ATTACK]: ({ unit, dice, specialRulesApplied }) => {
        if (unit._boundingUsed) return {};
        const distance = dice.roll('D3') + 1;
        unit._boundingUsed = true; // once per activation
        specialRulesApplied.push({ rule: 'Bounding', effect: `may reposition up to ${distance}"` });
        return {
          boundingMove: {
            distance,
            // Engine will allow player to choose new position within distance
          },
        };
      },
    },
  },

  Butcher: {
    description: 'Ignores Regeneration, and on unmodified results of 6 to hit, this weapon deals 1 extra hit (only the original hit counts as a 6 for special rules).',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ weapon, rolls, successes, specialRulesApplied }) => {
        if (!weapon.rules.includes('Butcher')) return {};

        const sixes = rolls.filter(r => r.value === 6 && !r.auto).length;
        const extraHits = sixes;
        specialRulesApplied.push({ rule: 'Butcher', effect: `+${extraHits} hits from sixes` });
        // Mark that this attack has Butcher (to suppress Regeneration later)
        specialRulesApplied.push({ rule: 'Butcher', effect: 'suppress Regeneration' });
        return { successes: successes + extraHits };
      },
    },
  },

  'Dangerous Terrain Debuff': {
    description: 'Once per activation, before attacking, pick one enemy unit within 18" which must immediately take a Dangerous Terrain test.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._dangerUsed) return {};
        // In a real game, the player would select a target. Here we demonstrate the result.
        // The engine's _processBeforeAttackResults should handle this.
        unit._dangerUsed = true;
        specialRulesApplied.push({ rule: 'Dangerous Terrain Debuff', effect: 'enemy must test dangerous terrain' });
        return {
          dangerousTerrainTest: {
            range: 18,
            // The actual target would be chosen by UI
          },
        };
      },
    },
  },

  Mend: {
    description: 'Once per activation, before attacking, pick one friendly model within 3" with Tough, and remove D3 wounds from it.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, dice, specialRulesApplied }) => {
        if (unit._mendUsed) return {};
        // Simple auto‑targeting for demonstration – in practice player chooses
        const target = gameState.units.find(u =>
          u.owner === unit.owner &&
          u.distanceTo(unit) <= 3 &&
          u.tough > 1 &&
          u.current_models < u.total_models
        );
        if (target) {
          const heal = dice.roll() % 3 + 1; // D3
          target.current_models = Math.min(target.total_models, target.current_models + heal);
          unit._mendUsed = true;
          specialRulesApplied.push({ rule: 'Mend', effect: `healed ${heal} wound(s) on ${target.name}` });
        }
        return {};
      },
    },
  },

  'Plaguebound Boost': {
    description: 'If all models in this unit have Plaguebound, they ignore wounds on rolls of 5‑6 from Plaguebound (instead of only on 6+).',
    hooks: {
      // This rule is checked inside the Plaguebound hook (above). No separate hook needed.
      // However, we need to make it available as a rule that can be granted by auras.
    },
  },

  Protected: {
    description: 'When a unit where all models have this rule takes wounds, roll one die for each. On a 6+ it is ignored.',
    hooks: {
      [HOOKS.ON_INCOMING_WOUNDS]: ({ unit, wounds, specialRulesApplied }) => {
        if (!unit.rules.includes('Protected')) return {};

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
        if (!unit.rules.includes('Resistance')) return {};

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
        if (!weapon.rules.includes('Slam')) return {};
        specialRulesApplied.push({ rule: 'Slam', effect: 'ignores cover' });
        return { ignoresCover: true };
      },
      [HOOKS.ON_PER_HIT]: ({ weapon, saveRoll, specialRulesApplied }) => {
        if (!weapon.rules.includes('Slam')) return {};
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
    description: 'Once per activation, before attacking, pick one friendly unit within 12" which gets Steadfast once (next time the effect would apply).',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._buffUsed) return {};
        // In practice, player chooses a friendly unit. For demo, pick first eligible.
        const target = gameState.units.find(u =>
          u.owner === unit.owner &&
          u !== unit &&
          u.distanceTo(unit) <= 12
        );
        if (target) {
          target._tempSteadfast = true; // flag for next round start
          unit._buffUsed = true;
          specialRulesApplied.push({ rule: 'Steadfast Buff', effect: `gave temporary Steadfast to ${target.name}` });
        }
        return {};
      },
      // The actual Steadfast effect is applied by the Steadfast rule, but we need to treat
      // the temporary flag as if the unit had Steadfast. We can handle this in ON_GET_RULES.
      [HOOKS.ON_GET_RULES]: ({ unit, specialRulesApplied }) => {
        if (unit._tempSteadfast) {
          specialRulesApplied.push({ rule: 'Steadfast Buff', effect: 'temporary Steadfast' });
          return { additionalRules: ['Steadfast'] };
        }
        return {};
      },
    },
  },

  Unpredictable: {
    description: 'When attacking, roll one die and apply one effect to all models with this rule: on a 1‑3 they get AP(+1) and on a 4‑6 they get +1 to hit rolls instead.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, dice, specialRulesApplied }) => {
        if (!unit.rules.includes('Unpredictable')) return {};
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
        if (!unit.rules.includes('Unpredictable Fighter')) return {};
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
      // Player choice is stored in unit._versatileAttackMode ('ap' or 'hit')
      [HOOKS.BEFORE_ATTACK]: ({ unit, specialRulesApplied }) => {
        if (!unit.rules.includes('Versatile Attack')) return {};
        if (unit._versatileAttackMode) {
          specialRulesApplied.push({ rule: 'Versatile Attack', effect: `mode = ${unit._versatileAttackMode}` });
        }
        return {};
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
      [HOOKS.AFTER_ATTACK]: ({ unit }) => {
        delete unit._versatileAttackMode; // reset after activation
      },
      // Also need to reset after melee attacks if used in melee
      [HOOKS.AFTER_MELEE_ATTACK]: ({ unit }) => {
        delete unit._versatileAttackMode;
      },
    },
  },

  'Versatile Defense': {
    description: 'When this unit is deployed or activated, pick one effect: when shot or charged from over 9" away, the unit either gets +1 to defense rolls, or enemy units get -1 to hit rolls against it. This effect lasts until the units\' next activation.',
    hooks: {
      // Player choice stored in unit._versatileDefenseMode ('defense' or 'hitPenalty')
      // We'll also need to track when the effect expires (next activation). We'll clear it in BEFORE_ATTACK of the unit.
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, attacker, defense, gameState, specialRulesApplied }) => {
        if (!unit._versatileDefenseMode) return {};
        // Check distance from attacker to unit
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
      [HOOKS.BEFORE_ATTACK]: ({ unit }) => {
        // Expire the effect at the start of the unit's next activation
        delete unit._versatileDefenseMode;
      },
    },
  },

  // -------------------------------------------------------------------------
  // Aura special rules (grant the named rule to the unit and its unit)
  // -------------------------------------------------------------------------
  'Bounding Aura': {
    description: 'This model and its unit get Bounding.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.rules.includes('Bounding Aura')) {
          return { additionalRules: ['Bounding'] };
        }
        return {};
      },
    },
  },
  'Furious Aura': {
    description: 'This model and its unit get Furious.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.rules.includes('Furious Aura')) {
          return { additionalRules: ['Furious'] };
        }
        return {};
      },
    },
  },
  'Plaguebound Boost Aura': {
    description: 'This model and its unit get Plaguebound Boost.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.rules.includes('Plaguebound Boost Aura')) {
          return { additionalRules: ['Plaguebound Boost'] };
        }
        return {};
      },
    },
  },
  'Relentless Aura': {
    description: 'This model and its unit get Relentless.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.rules.includes('Relentless Aura')) {
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
        if (unit.rules.includes('Resistance Aura')) {
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
        if (unit.rules.includes('Scout Aura')) {
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
        if (unit.rules.includes('Versatile Defense Aura')) {
          return { additionalRules: ['Versatile Defense'] };
        }
        return {};
      },
    },
  },

  // -------------------------------------------------------------------------
  // Army spells
  // -------------------------------------------------------------------------
  'Aura of Pestilence': {
    description: 'Pick one enemy unit within 18", which counts as being in Difficult Terrain once (next time the effect would apply).',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (!target) return {};
        // Mark the target so that when it moves, it is treated as difficult terrain.
        target._difficultTerrainOnce = true;
        specialRulesApplied.push({ rule: 'Aura of Pestilence', effect: `${target.name} counts as difficult terrain next` });
        return {};
      },
      // The actual effect on movement would need to be checked in ON_TERRAIN_MOVE or similar.
      // We'll assume that the movement code checks for this flag.
    },
  },
  'Rapid Putrefaction': {
    description: 'Pick one enemy unit within 12", which takes 2 hits with AP(1) and Butcher. Roll as many dice as hits to see if "on rolls of 6+ effects trigger.',
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
          u.distanceTo(caster) <= 12
        ).slice(0, 2);
        friendlies.forEach(u => u._rapidRushOnce = true);
        specialRulesApplied.push({ rule: 'Blessed Virus', effect: `gave Rapid Rush to ${friendlies.length} units` });
        return {};
      },
      // The actual speed boost needs to be applied in MODIFY_SPEED when that unit rushes.
      // We'll add a hook to MODIFY_SPEED that checks for _rapidRushOnce.
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
          u.distanceTo(caster) <= 12
        ).slice(0, 3);
        friendlies.forEach(u => u._plagueboundBoostOnce = true);
        specialRulesApplied.push({ rule: 'Plague Boon', effect: `gave Plaguebound Boost to ${friendlies.length} units` });
        return {};
      },
      // The boost effect is handled in the Plaguebound hook. We need to pass that flag to the ON_INCOMING_WOUNDS.
      // We'll add a flag that the Plaguebound hook can check.
      [HOOKS.ON_INCOMING_WOUNDS]: ({ unit, specialRulesApplied }) => {
        if (unit._plagueboundBoostOnce) {
          delete unit._plagueboundBoostOnce;
          specialRulesApplied.push({ rule: 'Plague Boon', effect: 'Plaguebound Boost active' });
          // We'll return something that indicates boost, but the Plaguebound hook already checks rules.
          // Alternatively, we could set a temporary rule on the unit.
          // Simpler: add a specialRulesApplied entry that the Plaguebound hook can see.
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
