/**
 * rules/opr-rules-rebel-guerrillas.js
 * Rebel Guerrillas faction rules from v3.5.2 (page 3)
 * Uses the enhanced RulesEngine with generic weapon info.
 */

import { HOOKS } from '../RuleRegistry.js';
import { Dice } from '../Dice.js';

export const REBEL_GUERRILLAS_RULES = {
  // -------------------------------------------------------------------------
  // Army‑wide rule
  // -------------------------------------------------------------------------
  Guerrilla: {
    description: 'Once per round, units where all models have this rule may move by up to 3" after shooting or being in melee.',
    hooks: {
      [HOOKS.AFTER_ATTACK]: ({ unit, specialRulesApplied }) => {
        if (!unit.special_rules.includes('Guerrilla')) return {};
        if (unit._guerrillaUsedThisRound) return {};

        const hasBoost = unit.special_rules.includes('Guerrilla Boost') ||
                         specialRulesApplied.includes('Guerrilla Boost');
        const distance = hasBoost ? 6 : 3;
        unit._guerrillaUsedThisRound = true;
        specialRulesApplied.push({ rule: 'Guerrilla', effect: `may move up to ${distance}"` });
        return { guerrillaMove: { distance } };
      },
      [HOOKS.AFTER_MELEE]: ({ unit, specialRulesApplied }) => {
        if (!unit.special_rules.includes('Guerrilla')) return {};
        if (unit._guerrillaUsedThisRound) return {};

        const hasBoost = unit.special_rules.includes('Guerrilla Boost') ||
                         specialRulesApplied.includes('Guerrilla Boost');
        const distance = hasBoost ? 6 : 3;
        unit._guerrillaUsedThisRound = true;
        specialRulesApplied.push({ rule: 'Guerrilla', effect: `may move up to ${distance}"` });
        return { guerrillaMove: { distance } };
      },
      [HOOKS.ON_ROUND_START]: ({ unit }) => {
        // Reset the flag at the beginning of each round
        delete unit._guerrillaUsedThisRound;
        return {};
      },
    },
  },

  // -------------------------------------------------------------------------
  // Special rules
  // -------------------------------------------------------------------------
  'Counter-Attack': {
    description: 'Strikes first when charged.',
    hooks: {
      [HOOKS.ON_STRIKE_ORDER]: ({ attacker, defender, gameState, specialRulesApplied }) => {
        if ((defender.special_rules || '').includes('Counter-Attack') && defender._charged) {
          specialRulesApplied.push({ rule: 'Counter-Attack', effect: 'defender strikes first' });
          return { attackerFirst: false };
        }
        return {};
      },
    },
  },

  'Courage Buff': {
    description: 'Once per activation, before attacking, pick one friendly unit within 12", which gets +1 to morale test rolls once.',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._courageBuffUsed) return {};
        const target = gameState.units.find(u =>
          u.owner === unit.owner &&
          u !== unit &&
          Math.hypot(u.x - unit.x, u.y - unit.y) <= 12
        );
        if (target) {
          target._courageBuff = true;
          unit._courageBuffUsed = true;
          specialRulesApplied.push({ rule: 'Courage Buff', effect: `gave +1 morale to ${target.name}` });
        }
        return {};
      },
      [HOOKS.ON_MORALE_TEST]: ({ unit, roll, specialRulesApplied }) => {
        if (unit._courageBuff) {
          delete unit._courageBuff;
          specialRulesApplied.push({ rule: 'Courage Buff', effect: '+1 morale' });
          return { roll: roll + 1 };
        }
        return {};
      },
      [HOOKS.ON_ACTIVATION_END]: ({ unit }) => {
        delete unit._courageBuffUsed;
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

  'Furious Mark': {
    description: 'Once per activation, before attacking, pick one enemy unit within 18", which friendly units gets Furious against once.',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._furiousMarkUsed) return {};
        const target = gameState.units.find(u => u.owner !== unit.owner && Math.hypot(u.x - unit.x, u.y - unit.y) <= 18);
        if (target) {
          target._furiousMarked = true;
          unit._furiousMarkUsed = true;
          specialRulesApplied.push({ rule: 'Furious Mark', effect: `${target.name} marked for Furious` });
        }
        return {};
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit: attacker, target, quality, isMelee, specialRulesApplied }) => {
        if (isMelee && target?._furiousMarked && attacker.owner === unit.owner) {
          // Furious gives +1 to hit in melee
          delete target._furiousMarked; // use once
          specialRulesApplied.push({ rule: 'Furious Mark', effect: '+1 to hit' });
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
      [HOOKS.ON_ACTIVATION_END]: ({ unit }) => {
        delete unit._furiousMarkUsed;
      },
    },
  },

  'Guerrilla Boost': {
    description: 'If most models in this unit have Guerrilla, they may move by up to 6" from Guerrilla (instead of only 3").',
    // This is a flag; the actual effect is handled in Guerrilla hooks.
    hooks: {},
  },

  'Piercing Tag': {
    description: 'Once per game, during this model\'s activation, pick one enemy unit within 36" and in line of sight, and place X markers on it. When attacking, friendly units may remove markers from their target before rolling to block to get +AP(Y) where Y is the number of removed markers.',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, gameState, _ruleParamValue, specialRulesApplied }) => {
        if (unit._piercingTagUsed) return {};
        const markers = _ruleParamValue || 1;
        const target = gameState.units.find(u => u.owner !== unit.owner && Math.hypot(u.x - unit.x, u.y - unit.y) <= 36);
        if (target) {
          target._piercingMarkers = (target._piercingMarkers || 0) + markers;
          unit._piercingTagUsed = true;
          specialRulesApplied.push({ rule: 'Piercing Tag', effect: `${markers} markers on ${target.name}` });
        }
        return {};
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ attacker, target, ap, specialRulesApplied }) => {
        if (target?._piercingMarkers && attacker.owner === target.owner) {
          const markers = target._piercingMarkers;
          delete target._piercingMarkers;
          specialRulesApplied.push({ rule: 'Piercing Tag', effect: `+${markers} AP` });
          return { ap: (ap ?? 0) + markers };
        }
        return {};
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

  'Surprise Piercing Shot': {
    description: 'Counts as having Ambush, and gets AP(+2) when shooting on the round in which it deploys via this rule.',
    hooks: {
      [HOOKS.ON_RESERVE_ENTRY]: ({ unit, specialRulesApplied }) => {
        if (!unit.special_rules.includes('Surprise Piercing Shot')) return {};
        unit._deployedThisRound = true;
        specialRulesApplied.push({ rule: 'Surprise Piercing Shot', effect: 'deployed via Ambush' });
        return {};
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, ap, isMelee, specialRulesApplied }) => {
        if (!isMelee && unit._deployedThisRound && unit.special_rules.includes('Surprise Piercing Shot')) {
          delete unit._deployedThisRound; // use once
          specialRulesApplied.push({ rule: 'Surprise Piercing Shot', effect: 'AP+2' });
          return { ap: (ap ?? 0) + 2 };
        }
        return {};
      },
    },
  },

  'Takedown Strike': {
    description: 'Once per game, when it\'s this model\'s turn to attack in melee, you may pick one model in the unit as its target, and make one attack at Quality 2+ with AP(2) and Deadly(3), which is resolved as if it\'s a unit of 1.',
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
            qualityOverride: 2, // hits on 2+
          }]
        };
      },
    },
  },

  Thrash: {
    description: 'Against units where most models have Defense 5+ to 6+, this weapon gets Blast(+3).',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ weaponRules, target, successes, specialRulesApplied }) => {
        if (!weaponRules.includes('Thrash')) return {};
        if (!target) return {};
        // Check if target's defense is 5 or 6
        if (target.defense >= 5 && target.defense <= 6) {
          // In OPR, Blast adds extra hits when shooting at units with 6+ models.
          // We'll add 3 extra hits if the target has 6+ models.
          if (target.current_models >= 6) {
            const extra = 3;
            specialRulesApplied.push({ rule: 'Thrash', effect: `+${extra} hits (Blast)` });
            return { successes: successes + extra };
          }
        }
        return {};
      },
    },
  },

  // -------------------------------------------------------------------------
  // Auras
  // -------------------------------------------------------------------------
  'Bane when Shooting Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Bane when Shooting'] }) },
  },
  'Bane when Shooting': {
    // Bane: on 6+ to wound, +1 wound. In OPR, Bane gives +1 wound on 6+ to wound.
    // We'll implement in ON_WOUND_CALC.
    hooks: {
      [HOOKS.ON_WOUND_CALC]: ({ unit, weapon, unsavedHit, toughPerModel, wounds, specialRulesApplied }) => {
        if (unit.special_rules.includes('Bane when Shooting') && unsavedHit.value >= 6) {
          specialRulesApplied.push({ rule: 'Bane when Shooting', effect: '+1 wound' });
          return { wounds: wounds + 1 };
        }
        return {};
      },
    },
  },

  'Guerrilla Boost Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Guerrilla Boost'] }) },
  },

  'Regeneration Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Regeneration'] }) },
  },
  'Regeneration': {
    // Assume Regeneration is implemented elsewhere (e.g., in core rules)
    // If not, we need to define it. We'll provide a basic implementation.
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

  'Rending in Melee Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Rending in Melee'] }) },
  },
  'Rending in Melee': {
    // Rending: on 6 to hit, AP+? In OPR, Rending gives AP+1 on 6 to hit.
    hooks: {
      [HOOKS.ON_PER_HIT]: ({ unit, hitRoll, ap, isMelee, specialRulesApplied }) => {
        if (isMelee && unit.special_rules.includes('Rending in Melee') && hitRoll.value === 6 && !hitRoll.auto) {
          specialRulesApplied.push({ rule: 'Rending in Melee', effect: 'AP+1' });
          return { apBonus: 1 };
        }
        return {};
      },
    },
  },

  'Strider Aura': {
    hooks: { [HOOKS.ON_GET_RULES]: () => ({ additionalRules: ['Strider'] }) },
  },
  'Strider': {
    // Strider: ignores movement penalties from difficult terrain.
    hooks: {
      [HOOKS.ON_TERRAIN_MOVE]: ({ unit, specialRulesApplied }) => {
        if (unit.special_rules.includes('Strider')) {
          specialRulesApplied.push({ rule: 'Strider', effect: 'ignore difficult terrain' });
          return { ignoreDifficult: true };
        }
        return {};
      },
    },
  },

  // -------------------------------------------------------------------------
  // Army spells
  // -------------------------------------------------------------------------
  'Aura of Peace': {
    description: 'Pick one friendly unit within 12" which gets +1 to morale test rolls once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const target = gameState.units.find(u => u.owner === caster.owner && Math.hypot(u.x - caster.x, u.y - caster.y) <= 12);
        if (target) {
          target._courageBuff = true;
          specialRulesApplied.push({ rule: 'Aura of Peace', effect: `gave +1 morale to ${target.name}` });
        }
        return {};
      },
      // Morale bonus handled by Courage Buff hook above (same flag)
    },
  },

  'Mind Breaker': {
    description: 'Pick one enemy unit within 12" which takes 2 hits with AP(1) and Surge.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (!target) return {};
        specialRulesApplied.push({ rule: 'Mind Breaker', effect: `2 hits (AP1, Surge) on ${target.name}` });
        return {
          extraHits: [{ target, count: 2, ap: 1, surge: true }]
        };
      },
    },
  },

  'Bad Omen': {
    description: 'Pick up to two enemy units within 18", which friendly units gets Furious against once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const enemies = gameState.units.filter(u => u.owner !== caster.owner && Math.hypot(u.x - caster.x, u.y - caster.y) <= 18).slice(0, 2);
        enemies.forEach(e => e._furiousMarked = true);
        specialRulesApplied.push({ rule: 'Bad Omen', effect: `marked ${enemies.length} units` });
        return {};
      },
      // Furious effect handled by Furious Mark hook
    },
  },

  'Wave of Discord': {
    description: 'Pick one enemy unit within 18" which takes 2 hits with Thrash.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (!target) return {};
        specialRulesApplied.push({ rule: 'Wave of Discord', effect: `2 hits (Thrash) on ${target.name}` });
        return {
          extraHits: [{ target, count: 2, ap: 0, thrash: true }]
        };
      },
    },
  },

  'Deep Meditation': {
    description: 'Pick up to three friendly units within 12", which get +1 to hit rolls when shooting once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u => u.owner === caster.owner && Math.hypot(u.x - caster.x, u.y - caster.y) <= 12).slice(0, 3);
        friendlies.forEach(u => u._deepMeditation = true);
        specialRulesApplied.push({ rule: 'Deep Meditation', effect: `gave +1 to hit to ${friendlies.length} units` });
        return {};
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, isMelee, specialRulesApplied }) => {
        if (!isMelee && unit._deepMeditation) {
          delete unit._deepMeditation;
          specialRulesApplied.push({ rule: 'Deep Meditation', effect: '+1 to hit' });
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
    },
  },

  'Piercing Pulse': {
    description: 'Pick one enemy model within 24" which takes 3 hits with AP(4).',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (!target) return {};
        specialRulesApplied.push({ rule: 'Piercing Pulse', effect: `3 hits (AP4) on ${target.name}` });
        return {
          extraHits: [{ target, count: 3, ap: 4 }]
        };
      },
    },
  },
};
