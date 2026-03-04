/**
 * rules/opr-rules-high-elf-fleets.js
 * High Elf Fleets faction rules from v3.5.2
 */
import { HOOKS } from '../RuleRegistry.js';

export const HIGH_ELF_FLEETS_RULES = {
  // ── Army-Wide: Highborn ───────────────────────────────────────────────────
  Highborn: {
    description: 'Moves +2" when using Advance, and +2" when using Rush/Charge.',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ action, speedDelta, specialRulesApplied }) => {
        const delta = action === 'Advance' ? 2 : 2;
        specialRulesApplied.push({ rule: 'Highborn', value: delta, effect: `+${delta}" movement` });
        return { speedDelta: (speedDelta ?? 0) + delta };
      },
    },
  },

  'Highborn Boost': {
    description: 'If this model has Highborn, it moves +4" on Advance and +4" on Rush/Charge instead of +2".',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ action, speedDelta, specialRulesApplied }) => {
        const delta = 4;
        specialRulesApplied.push({ rule: 'Highborn Boost', value: delta, effect: `+${delta}" movement (Highborn Boost)` });
        return { speedDelta: (speedDelta ?? 0) + delta };
      },
    },
  },

  'Highborn Boost Aura': {
    description: 'This model and its unit get Highborn Boost.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Highborn Boost Aura')) {
          return { additionalRules: ['Highborn Boost'] };
        }
        return {};
      },
    },
  },

  // ── Crack ─────────────────────────────────────────────────────────────────
  Crack: {
    description: 'On unmodified results of 6 to hit, those hits get AP(+2).',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ hitRolls, specialRulesApplied }) => {
        const crackedHits = (hitRolls ?? []).filter(r => r === 6).length;
        if (crackedHits === 0) return {};
        specialRulesApplied.push({ rule: 'Crack', value: crackedHits, effect: `${crackedHits} hit(s) on 6 gain AP(+2)` });
        // Return per-hit AP bonus for the 6s — engine applies AP+2 to those hits specifically.
        return { crackHits: crackedHits, crackApBonus: 2 };
      },
    },
  },

  // ── Resistance ────────────────────────────────────────────────────────────
  Resistance: {
    description: 'Roll one die per wound: 6+ ignores it. Wounds from spells are ignored on 2+ instead.',
    hooks: {
      [HOOKS.ON_INCOMING_WOUNDS]: ({ wounds, isSpell, dice, specialRulesApplied }) => {
        let ignored = 0;
        const threshold = isSpell ? 2 : 6;
        for (let i = 0; i < (wounds ?? 0); i++) {
          if (dice.roll() >= threshold) ignored++;
        }
        if (ignored > 0) {
          specialRulesApplied.push({ rule: 'Resistance', effect: `${ignored} wound(s) ignored` });
        }
        return { wounds: wounds - ignored };
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

  // ── Shred in Melee ────────────────────────────────────────────────────────
  'Shred in Melee': {
    description: 'On unmodified results of 1 to block hits in melee, this weapon deals 1 extra wound.',
    hooks: {
      [HOOKS.ON_PER_HIT]: ({ saveRoll, isMelee, specialRulesApplied }) => {
        if (!isMelee || saveRoll !== 1) return {};
        specialRulesApplied.push({ rule: 'Shred in Melee', effect: 'unmodified 1 to save in melee — +1 extra wound' });
        return { extraWounds: 1 };
      },
    },
  },

  'Shred in Melee Aura': {
    description: 'This model and its unit get Shred in melee.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Shred in Melee Aura')) {
          return { additionalRules: ['Shred in Melee'] };
        }
        return {};
      },
    },
  },

  // ── Scout Aura ────────────────────────────────────────────────────────────
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

  // ── Unpredictable Shooter ─────────────────────────────────────────────────
  'Unpredictable Shooter': {
    description: 'When shooting, roll one die: 1-3 get AP(+1), 4-6 get +1 to hit.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, dice, specialRulesApplied }) => {
        if (!unit._unpredictableShooterRolled) {
          unit._unpredictableShooterRoll = dice.roll();
          unit._unpredictableShooterRolled = true;
          const effect = unit._unpredictableShooterRoll <= 3 ? 'AP+1' : '+1 to hit';
          specialRulesApplied.push({ rule: 'Unpredictable Shooter', effect: `rolled ${unit._unpredictableShooterRoll}: ${effect}` });
        }
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, weapon, quality, specialRulesApplied }) => {
        if ((weapon?.range ?? 0) <= 2) return {};
        if (unit._unpredictableShooterRoll && unit._unpredictableShooterRoll >= 4) {
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, weapon, ap, isMelee, specialRulesApplied }) => {
        if (isMelee) return {};
        if (unit._unpredictableShooterRoll && unit._unpredictableShooterRoll <= 3) {
          return { ap: (ap ?? 0) + 1 };
        }
        return {};
      },
      [HOOKS.AFTER_ATTACK]: ({ unit }) => {
        delete unit._unpredictableShooterRolled;
        delete unit._unpredictableShooterRoll;
      },
    },
  },

  // ── Unwieldy ──────────────────────────────────────────────────────────────
  Unwieldy: {
    description: 'Strikes last when charging.',
    hooks: {
      [HOOKS.ON_STRIKE_ORDER]: ({ attacker, specialRulesApplied }) => {
        if (attacker.rules.includes('Unwieldy')) {
          specialRulesApplied.push({ rule: 'Unwieldy', effect: 'attacker strikes last' });
          return { attackerFirst: false };
        }
        return {};
      },
    },
  },

  'Unwieldy Debuff': {
    description: 'Once per activation, pick one enemy within 18" — it gets Unwieldy in melee once.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._unwieldyDebuffUsed) return {};
        const target = gameState.units.find(u => u.owner !== unit.owner && u.distanceTo(unit) <= 18);
        if (target) {
          target.unwieldy_debuff = true;
          unit._unwieldyDebuffUsed = true;
          specialRulesApplied.push({ rule: 'Unwieldy Debuff', effect: `gave Unwieldy to ${target.name}` });
        }
        return {};
      },
      [HOOKS.ON_STRIKE_ORDER]: ({ attacker, defender, specialRulesApplied }) => {
        if (defender?.unwieldy_debuff) {
          delete defender.unwieldy_debuff;
          specialRulesApplied.push({ rule: 'Unwieldy Debuff', effect: 'defender strikes first' });
          return { attackerFirst: false };
        }
        return {};
      },
    },
  },

  // ── Piercing Spotter ──────────────────────────────────────────────────────
  'Piercing Spotter': {
    description: 'Once per activation, pick one enemy within 36" LOS, roll one die — on 4+ place a marker. Friendlies remove markers before rolling to block to get +AP(X) where X is markers removed.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, dice, specialRulesApplied }) => {
        if (unit._piercingSpotterUsed) return {};
        const enemies = gameState.units.filter(u => u.owner !== unit.owner && u.current_models > 0);
        if (enemies.length === 0) return {};
        const target = enemies.reduce((a, b) => this.calculateDistance?.(unit, a) < this.calculateDistance?.(unit, b) ? a : b);
        const roll = dice.roll();
        if (roll >= 4) {
          target.piercing_spotter_markers = (target.piercing_spotter_markers || 0) + 1;
          unit._piercingSpotterUsed = true;
          specialRulesApplied.push({ rule: 'Piercing Spotter', effect: `placed marker on ${target.name}` });
        }
        return {};
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, specialRulesApplied }) => {
        const markers = target?.piercing_spotter_markers ?? 0;
        if (markers <= 0) return {};
        target.piercing_spotter_markers = 0;
        specialRulesApplied.push({ rule: 'Piercing Spotter', value: markers, effect: `+AP(${markers})` });
        return { ap: (ap ?? 0) + markers };
      },
    },
  },

  // ── Crossing Attack ────────────────────────────────────────────────────────
  'Crossing Attack': {
    description: 'Once per activation, when this model moves through enemy units, pick one and roll X dice — each 6+ deals 1 hit.',
    hooks: {
      [HOOKS.ON_MOVE_THROUGH_ENEMY]: ({ unit, enemyUnit, dice, specialRulesApplied }) => {
        if (unit._crossingAttackUsed) return {};
        const x = unit._ruleParamValue ?? 1;
        let hits = 0;
        for (let i = 0; i < x; i++) {
          if (dice.roll() >= 6) hits++;
        }
        if (hits > 0) {
          unit._crossingAttackUsed = true;
          specialRulesApplied.push({ rule: 'Crossing Attack', effect: `${hits} hits on ${enemyUnit.name}` });
          return { extraHits: [{ target: enemyUnit, count: hits, ap: 0 }] };
        }
        return {};
      },
    },
  },

  // ── Caster Group ─────────────────────────────────────────────────────────
  'Caster Group': {
    description: 'Pick one model in the unit to have Caster(X) where X equals the total number of models with this rule. On death, transfer spell tokens to another model.',
    hooks: {
      [HOOKS.ON_UNIT_CREATED]: ({ unit }) => {
        if (unit.special_rules.includes('Caster Group')) {
          // Set initial caster: first model
          unit.casterModel = 0;
          unit.casterTokens = unit.currentModels; // X = number of models
        }
      },
      [HOOKS.ON_MODEL_KILLED]: ({ unit, modelIndex }) => {
        if (unit.special_rules.includes('Caster Group') && modelIndex === unit.casterModel) {
          // Transfer to another model
          const newCaster = unit.models.findIndex((m, i) => i !== modelIndex);
          if (newCaster !== -1) {
            unit.casterModel = newCaster;
          } else {
            // No models left, unit dead
          }
        }
      },
      [HOOKS.ON_ROUND_END]: ({ unit }) => {
        if (unit.special_rules.includes('Caster Group')) {
          unit.casterTokens = 0;
        }
      },
      [HOOKS.ON_TOKEN_GAIN]: ({ unit, currentTokens }) => {
        if (unit.special_rules.includes('Caster Group')) {
          // Tokens are managed separately; we just need to ensure the caster model has tokens.
          // For now, we'll assume unit.spell_tokens is the total.
          return {};
        }
      },
    },
  },

  // ── Spell Conduit ─────────────────────────────────────────────────────────
  'Spell Conduit': {
    description: 'Friendly casters within 12" may cast as if from this model\'s position and get +1 to casting rolls.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, spell, target, gameState, specialRulesApplied }) => {
        const conduit = gameState.units.find(u => u.owner === caster.owner && u.rules.includes('Spell Conduit') && u.distanceTo(caster) <= 12);
        if (conduit) {
          specialRulesApplied.push({ rule: 'Spell Conduit', effect: 'cast from conduit position, +1 to roll' });
          return { castModifier: 1, castPosition: conduit };
        }
        return {};
      },
    },
  },
};
