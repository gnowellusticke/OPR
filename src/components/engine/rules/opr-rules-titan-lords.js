/**
 * rules/opr-rules-titan-lords.js
 * Titan Lords faction rules from v3.5.2 (page 3)
 * Uses the enhanced RulesEngine with generic weapon info.
 */

import { HOOKS } from '../RuleRegistry.js';
import { Dice } from './Dice.js';

export const TITAN_LORDS_RULES = {
  // -------------------------------------------------------------------------
  // Army‑wide rule
  // -------------------------------------------------------------------------
  'Honor Code': {
    description: 'If a unit where all models have this rule is Shaken at the beginning of the round, roll one die. On a 4+ it stops being Shaken.',
    hooks: {
      [HOOKS.ON_ROUND_START]: ({ unit, dice, specialRulesApplied }) => {
        if (!unit.special_rules.includes('Honor Code')) return {};
        if (unit.status !== 'shaken') return {};

        const roll = dice.roll();
        if (roll >= 4) {
          specialRulesApplied.push({ rule: 'Honor Code', effect: `recovered (rolled ${roll})` });
          return { clearShaken: true };
        } else {
          specialRulesApplied.push({ rule: 'Honor Code', effect: `failed recovery (rolled ${roll})` });
          return {};
        }
      },
    },
  },

  // -------------------------------------------------------------------------
  // Special rules
  // -------------------------------------------------------------------------
  Changebound: {
    description: 'When units where all models have this rule are shot or charged from over 9" away, enemy units get -1 to hit rolls.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ target, attacker, quality, specialRulesApplied }) => {
        if (!target?.rules?.includes('Changebound')) return {};
        const distance = Math.hypot(attacker.x - target.x, attacker.y - target.y);
        if (distance > 9) {
          specialRulesApplied.push({ rule: 'Changebound', effect: 'attacker -1 to hit' });
          return { quality: Math.min(6, quality + 1) };
        }
        return {};
      },
    },
  },

  'Delayed Action': {
    description: 'Once per round, if your opponent has more units left to activate than you, then this model\'s unit may pass its turn instead of activating (may still be activated later).',
    hooks: {
      [HOOKS.ON_ACTIVATION_START]: ({ unit, gameState, specialRulesApplied }) => {
        if (!unit.special_rules.includes('Delayed Action')) return {};
        if (unit._delayedActionUsedThisRound) return {};

        // Count remaining activations for both players
        const myRemaining = gameState.units.filter(u => u.owner === unit.owner && !u.activated && u.current_models > 0).length;
        const oppRemaining = gameState.units.filter(u => u.owner !== unit.owner && !u.activated && u.current_models > 0).length;

        if (oppRemaining > myRemaining) {
          unit._delayedActionUsedThisRound = true;
          specialRulesApplied.push({ rule: 'Delayed Action', effect: 'skipping activation, may activate later' });
          return { skipActivation: true };
        }
        return {};
      },
      [HOOKS.ON_ROUND_START]: ({ unit }) => {
        delete unit._delayedActionUsedThisRound;
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

  Lustbound: {
    description: 'Moves +1" when using Advance, and +3" when using Rush/Charge.',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ unit, action, speedDelta, specialRulesApplied }) => {
        if (!unit.special_rules.includes('Lustbound')) return {};
        if (action === 'Advance') {
          specialRulesApplied.push({ rule: 'Lustbound', effect: '+1"' });
          return { speedDelta: (speedDelta ?? 0) + 1 };
        }
        if (action === 'Rush' || action === 'Charge') {
          specialRulesApplied.push({ rule: 'Lustbound', effect: '+3"' });
          return { speedDelta: (speedDelta ?? 0) + 3 };
        }
        return {};
      },
    },
  },

  Plaguebound: {
    description: 'When a unit where all models have this rule takes wounds, roll one die for each. On a 6+ it is ignored.',
    hooks: {
      [HOOKS.ON_INCOMING_WOUNDS]: ({ unit, wounds, specialRulesApplied }) => {
        if (!unit.special_rules.includes('Plaguebound')) return {};
        let ignored = 0;
        for (let i = 0; i < wounds; i++) {
          const roll = Dice.roll();
          if (roll >= 6) ignored++;
        }
        specialRulesApplied.push({ rule: 'Plaguebound', effect: `ignored ${ignored} wounds` });
        return { wounds: wounds - ignored };
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

  Warbound: {
    description: 'Enemies that roll to block hits from this model\'s weapons take 1 extra wound for each unmodified result of 1 that they roll.',
    hooks: {
      [HOOKS.ON_PER_HIT]: ({ weapon, saveRoll, specialRulesApplied }) => {
        if (!weapon.rules.includes('Warbound')) return {};
        if (saveRoll === 1) {
          specialRulesApplied.push({ rule: 'Warbound', effect: 'extra wound from save roll 1' });
          return { extraWounds: 1 };
        }
        return {};
      },
    },
  },

  // -------------------------------------------------------------------------
  // Army spells
  // -------------------------------------------------------------------------
  'Psy-Injected Courage': {
    description: 'Pick one friendly unit within 12" which gets +1 to morale test rolls once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const target = gameState.units.find(u => u.owner === caster.owner && u.distanceTo(caster) <= 12);
        if (target) {
          target._psyCourage = true;
          specialRulesApplied.push({ rule: 'Psy-Injected Courage', effect: `+1 morale for ${target.name}` });
        }
        return {};
      },
      [HOOKS.ON_MORALE_TEST]: ({ unit, roll, specialRulesApplied }) => {
        if (unit._psyCourage) {
          delete unit._psyCourage;
          specialRulesApplied.push({ rule: 'Psy-Injected Courage', effect: '+1 morale' });
          return { roll: roll + 1 };
        }
        return {};
      },
    },
  },

  'Electric Tempest': {
    description: 'Pick one enemy unit within 12" which takes 2 hits with AP(1) and Surge.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (!target) return {};
        specialRulesApplied.push({ rule: 'Electric Tempest', effect: `2 hits (AP1, Surge) on ${target.name}` });
        return {
          extraHits: [{ target, count: 2, ap: 1, surge: true }]
        };
      },
    },
  },

  'Calculated Foresight': {
    description: 'Pick up to two enemy units within 18", which friendly units gets Relentless against once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const enemies = gameState.units.filter(u => u.owner !== caster.owner && u.distanceTo(caster) <= 18).slice(0, 2);
        enemies.forEach(e => e._calculatedForesight = true);
        specialRulesApplied.push({ rule: 'Calculated Foresight', effect: `marked ${enemies.length} units` });
        return {};
      },
      // Relentless effect: ignore move penalty when shooting at marked target.
      // We need to know if attacker moved. The engine could have a flag on attacker.
      // We'll assume attacker._moved is set during movement.
      [HOOKS.BEFORE_HIT_QUALITY]: ({ attacker, target, quality, isMelee, specialRulesApplied }) => {
        if (isMelee) return {}; // only shooting
        if (target?._calculatedForesight && attacker._moved) {
          delete target._calculatedForesight; // use once
          // Relentless: no penalty for moving; we need to counteract any move penalty.
          // If the engine applies a penalty (e.g., +1 to quality), we remove it.
          // Here we simply don't apply penalty. But we don't know the original quality.
          // We'll assume the engine applies a penalty and we need to remove it.
          // The simplest is to return a quality adjustment that cancels the penalty.
          // However, we don't know the penalty amount. In OPR, moving and shooting usually incurs no penalty except for certain weapons.
          // Actually, in Grimdark Future, moving does not inherently give a penalty; only certain weapons (Heavy) have penalties.
          // Relentless allows moving and shooting with Heavy weapons without penalty.
          // This is complex. We'll just mark that Relentless is active and let the weapon's own rules handle it.
          // For now, we'll return a flag that the engine can interpret.
          specialRulesApplied.push({ rule: 'Calculated Foresight', effect: 'Relentless active' });
          return {}; // No quality change; engine should know to ignore move penalty.
        }
        return {};
      },
    },
  },

  'Searing Burst': {
    description: 'Pick one enemy unit within 12" which takes 6 hits.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (!target) return {};
        specialRulesApplied.push({ rule: 'Searing Burst', effect: `6 hits on ${target.name}` });
        return {
          extraHits: [{ target, count: 6, ap: 0 }]
        };
      },
    },
  },

  'Shock Speed': {
    description: 'Pick up to three friendly units within 12" which moves +2" on Advance and +4" on Rush/Charge once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u => u.owner === caster.owner && u.distanceTo(caster) <= 12).slice(0, 3);
        friendlies.forEach(u => u._shockSpeed = true);
        specialRulesApplied.push({ rule: 'Shock Speed', effect: `speed buff for ${friendlies.length} units` });
        return {};
      },
      [HOOKS.MODIFY_SPEED]: ({ unit, action, speedDelta, specialRulesApplied }) => {
        if (unit._shockSpeed) {
          if (action === 'Advance') {
            specialRulesApplied.push({ rule: 'Shock Speed', effect: '+2"' });
            return { speedDelta: (speedDelta ?? 0) + 2 };
          }
          if (action === 'Rush' || action === 'Charge') {
            specialRulesApplied.push({ rule: 'Shock Speed', effect: '+4"' });
            return { speedDelta: (speedDelta ?? 0) + 4 };
          }
        }
        return {};
      },
      [HOOKS.AFTER_ATTACK]: ({ unit }) => {
        // Clear after activation (since it's once per activation)
        delete unit._shockSpeed;
      },
      [HOOKS.AFTER_MELEE_ATTACK]: ({ unit }) => {
        delete unit._shockSpeed;
      },
    },
  },

  'Expel Threat': {
    description: 'Pick one enemy model within 18" which takes 6 hits with AP(1).',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (!target) return {};
        specialRulesApplied.push({ rule: 'Expel Threat', effect: `6 hits (AP1) on ${target.name}` });
        return {
          extraHits: [{ target, count: 6, ap: 1 }]
        };
      },
    },
  },
};
