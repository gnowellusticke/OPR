/**
 * rules/opr-rules.js
 *
 * All One Page Rules / Grimdark Future special rules, registered as
 * self-contained hook handlers.
 *
 * To add a new rule:
 *   1. Add an entry to OPR_RULES below.
 *   2. Declare which hook(s) it fires on.
 *   3. Implement the handler — it receives a context and returns partial updates.
 *   That's it. No changes to RulesEngine required.
 *
 * To support a new game: create a new file like this one and pass a fresh
 * RuleRegistry populated from that file into your RulesEngine instance.
 */

import { HOOKS } from '../RuleRegistry.js';

// ─── Context shapes by hook (for reference) ───────────────────────────────
//
// beforeHitQuality:    { unit, weapon, target, gameState, quality, specialRulesApplied }
// afterHitRolls:       { unit, weapon, target, rolls, successes, specialRulesApplied }
// beforeSaveDefense:   { defender, weapon, terrain, defense, ap, specialRulesApplied }
// onPerHit:            { defender, weapon, hitRoll, hitIndex, ap, defense, specialRulesApplied }
//                       → { apBonus, rerollResult }   (rerollResult: the final die value if rerolled)
// onWoundCalc:         { weapon, unsavedHit, toughPerModel, specialRulesApplied }
//                       → { wounds }
// onIncomingWounds:    { unit, wounds, suppressedByBane, dice, specialRulesApplied }
//                       → { wounds }
// getBaseSpeed:        { unit, action }
//                       → { speed } (if overriding entirely)
// modifySpeed:         { unit, action, speed, specialRulesApplied }
//                       → { speedDelta }
// onMoraleTest:        { unit, roll, quality, passed, specialRulesApplied, dice }
//                       → { passed, reroll }
// onDeploy:            { unit, gameState, isAgentA }
//                       → { x, y, isReserve }

export const OPR_RULES = {

  // ── Hit Quality Modifiers ─────────────────────────────────────────────────

  Shaken: {
    description: 'Unit hits on a worse quality while shaken.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, specialRulesApplied }) => {
        // Shaken is a unit status, not a rule — checked separately.
        // This hook fires if the unit has the Shaken rule as a keyword;
        // the status check is handled in the engine before calling the hook.
        return {};
      },
    },
  },

  Reliable: {
    description: 'This weapon always hits on 2+.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ quality, specialRulesApplied }) => {
        specialRulesApplied.push({ rule: 'Reliable', value: null, effect: 'attacks at Quality 2+' });
        return { quality: 2 };
      },
    },
  },

  Indirect: {
    description: 'Ignores LOS but hits on a worse quality.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ quality, specialRulesApplied }) => {
        const next = Math.min(6, quality + 1);
        specialRulesApplied.push({ rule: 'Indirect', value: null, effect: 'quality +1 (indirect fire penalty)' });
        return { quality: next };
      },
    },
  },

  Artillery: {
    description: 'Hits on better quality at 9"+ range.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, target, quality, specialRulesApplied, calculateDistance }) => {
        if (!target) return {};
        const dist = calculateDistance(unit, target);
        if (dist > 9) {
          specialRulesApplied.push({ rule: 'Artillery', value: null, effect: 'quality -1 at 9"+ range' });
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
    },
  },

  Thrust: {
    description: 'On a charge, this weapon hits on better quality and gains AP(+1).',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, specialRulesApplied }) => {
        if (!unit.just_charged) return {};
        specialRulesApplied.push({ rule: 'Thrust', value: null, effect: 'quality -1 (easier) and AP+1 on charge' });
        return { quality: Math.max(2, quality - 1), thrustApBonus: 1 };
      },
    },
  },

  Stealth: {
    description: 'Ranged attacks against this unit hit on a worse quality.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ weapon, quality, specialRulesApplied }) => {
        // Only affects ranged attacks (range > 2")
        if ((weapon?.range ?? 0) <= 2) return {};
        specialRulesApplied.push({ rule: 'Stealth', value: null, effect: 'quality +1 vs stealthed target' });
        return { quality: Math.min(6, quality + 1) };
      },
    },
  },

  'Stealth Aura': {
    description: 'Friendly units within 6" count as having Stealth.',
    // Applied by the engine when checking target stealth — no hook needed here.
    hooks: {},
  },

  'Machine-Fog': {
    description: 'Attackers hit this unit on a worse quality.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ quality, specialRulesApplied }) => {
        specialRulesApplied.push({ rule: 'Machine-Fog', value: null, effect: 'quality +1 vs target' });
        return { quality: Math.min(6, quality + 1) };
      },
    },
  },

  // ── Extra Hit Generators ──────────────────────────────────────────────────

  Blast: {
    description: 'Blast(X): X automatic hits, no quality roll. Ignores cover. Capped at model count.',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ _ruleParamValue, target, specialRulesApplied }) => {
        const blastCount = _ruleParamValue ?? 1;
        const modelCount = target?.model_count
          ?? Math.ceil((target?.current_models ?? 1) / Math.max(target?.tough_per_model ?? 1, 1));
        const finalHits = Math.min(blastCount, modelCount);
        const autoRolls = Array.from({ length: finalHits }, () => ({ value: 6, success: true, auto: true }));
        specialRulesApplied.push({
          rule: 'Blast',
          value: finalHits,
          effect: `${blastCount} automatic hits capped at ${modelCount} model(s)`,
        });
        // Override everything — Blast replaces the normal roll
        return { successes: finalHits, rolls: autoRolls, isBlast: true };
      },
    },
  },

  Furious: {
    description: 'Unmodified 6s to hit generate one extra hit.',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ rolls, successes, specialRulesApplied }) => {
        const naturalSixes = rolls.filter(r => r.value === 6 && r.success && !r.auto).length;
        if (naturalSixes === 0) return {};
        specialRulesApplied.push({ rule: 'Furious', value: null, effect: `${naturalSixes} natural 6s → ${naturalSixes} extra hits` });
        return { successes: successes + naturalSixes };
      },
    },
  },

  Surge: {
    description: 'Unmodified 6s to hit generate one extra hit (stacks with weapon rules).',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ rolls, successes, specialRulesApplied }) => {
        const naturalSixes = rolls.filter(r => r.value === 6 && r.success && !r.auto).length;
        if (naturalSixes === 0) return {};
        specialRulesApplied.push({ rule: 'Surge', value: null, effect: `${naturalSixes} extra hits from natural 6s` });
        return { successes: successes + naturalSixes };
      },
    },
  },

  Crack: {
    description: 'Unmodified 6s to hit count as 2 hits (+1 extra each).',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ rolls, successes, specialRulesApplied }) => {
        const naturalSixes = rolls.filter(r => r.value === 6 && r.success && !r.auto && !r.relentless).length;
        if (naturalSixes === 0) return {};
        specialRulesApplied.push({ rule: 'Crack', value: null, effect: `${naturalSixes} natural 6s each count as 2 hits (+${naturalSixes} extra)` });
        return { successes: successes + naturalSixes };
      },
    },
  },

  Relentless: {
    description: 'Unmodified 6s to hit at 9"+ range generate one extra hit (the extra hit does not itself count as a 6).',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ unit, target, rolls, successes, specialRulesApplied, calculateDistance }) => {
        if (!target) return {};
        if (calculateDistance(unit, target) <= 9) return {};
        const naturalSixes = rolls.filter(r => r.value === 6 && r.success && !r.auto).length;
        if (naturalSixes === 0) return {};
        // Extra hits tagged relentless: they don't count as 6s for Furious/Surge/Crack
        const extraRolls = Array.from({ length: naturalSixes }, () => ({ value: 1, success: true, relentless: true }));
        specialRulesApplied.push({ rule: 'Relentless', value: null, effect: `${naturalSixes} extra hits from natural 6s at 9"+ (extras don't count as 6s)` });
        return { successes: successes + naturalSixes, rolls: [...rolls, ...extraRolls] };
      },
    },
  },

  // ── Defense Modifiers ─────────────────────────────────────────────────────

  AP: {
    description: 'AP(X): reduce defender save by X.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ _ruleParamValue, defense, ap, specialRulesApplied }) => {
        const apValue = _ruleParamValue ?? ap ?? 0;
        if (apValue <= 0) return {};
        specialRulesApplied.push({ rule: 'AP', value: apValue, effect: `defense reduced by ${apValue}` });
        return { ap: apValue };
      },
    },
  },

  Unstoppable: {
    description: 'Negative AP modifiers do not apply against this weapon.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ ap, specialRulesApplied }) => {
        if (ap >= 0) return {};
        specialRulesApplied.push({ rule: 'Unstoppable', value: null, effect: 'ignores negative AP' });
        return { ap: 0 };
      },
    },
  },

  // ── Per-Hit Processors ────────────────────────────────────────────────────

  Rending: {
    description: 'Natural 6s to hit gain AP(+4) for that hit.',
    hooks: {
      [HOOKS.ON_PER_HIT]: ({ hitRoll, specialRulesApplied }) => {
        const isRendingHit = hitRoll && hitRoll.value === 6 && hitRoll.success && !hitRoll.auto;
        if (!isRendingHit) return {};
        specialRulesApplied.push({ rule: 'Rending', value: null, effect: 'natural 6 to hit gained AP(+4)' });
        return { apBonus: 4 };
      },
    },
  },

  Bane: {
    description: 'Defender must re-roll unmodified 6s on save rolls.',
    hooks: {
      [HOOKS.ON_PER_HIT]: ({ saveRoll, dice, modifiedDefense, specialRulesApplied }) => {
        if (saveRoll !== 6) return {};
        const reroll = dice.roll();
        specialRulesApplied.push({ rule: 'Bane', value: null, effect: `save 6 re-rolled (${saveRoll}→${reroll})` });
        return { rerollResult: reroll, saveSuccess: reroll >= modifiedDefense };
      },
    },
  },

  // ── Wound Calculation ─────────────────────────────────────────────────────

  Deadly: {
    description: 'Deadly(X): each unsaved hit deals min(X, toughPerModel) wounds.',
    hooks: {
      [HOOKS.ON_WOUND_CALC]: ({ _ruleParamValue, toughPerModel, specialRulesApplied }) => {
        const x = _ruleParamValue ?? 1;
        const wounds = Math.min(x, toughPerModel);
        specialRulesApplied.push({ rule: 'Deadly', value: x, effect: `each unsaved hit deals ${wounds} wounds (no carry-over)` });
        return { wounds };
      },
    },
  },

  // ── Post-Damage ───────────────────────────────────────────────────────────

  Regeneration: {
    description: 'Roll one die per incoming wound; each 5+ ignores that wound. Suppressed by Bane.',
    hooks: {
      [HOOKS.ON_INCOMING_WOUNDS]: ({ wounds, suppressedByBane, dice, specialRulesApplied }) => {
        if (suppressedByBane || wounds <= 0) return {};
        let ignored = 0;
        const rolls = [];
        for (let i = 0; i < wounds; i++) {
          const r = dice.roll();
          rolls.push(r);
          if (r >= 5) ignored++;
        }
        if (ignored > 0) {
          specialRulesApplied.push({ rule: 'Regeneration', value: null, effect: `${ignored}/${wounds} wounds ignored (5+ saves)` });
        }
        return { wounds: Math.max(0, wounds - ignored) };
      },
    },
  },

  'Self-Repair': {
    description: 'Alias for Regeneration.',
    hooks: {
      [HOOKS.ON_INCOMING_WOUNDS]: ({ wounds, suppressedByBane, dice, specialRulesApplied }) => {
        if (suppressedByBane || wounds <= 0) return {};
        let ignored = 0;
        for (let i = 0; i < wounds; i++) {
          if (dice.roll() >= 5) ignored++;
        }
        if (ignored > 0) specialRulesApplied.push({ rule: 'Self-Repair', value: null, effect: `${ignored}/${wounds} wounds ignored` });
        return { wounds: Math.max(0, wounds - ignored) };
      },
    },
  },

  // ── Movement ──────────────────────────────────────────────────────────────

  Immobile: {
    description: 'Cannot move except to Hold.',
    hooks: {
      [HOOKS.GET_BASE_SPEED]: ({ action }) => {
        if (action !== 'Hold') return { speed: 0, overrideSpeed: true };
        return {};
      },
    },
  },

  Aircraft: {
    description: 'Must Advance 36" each activation. Cannot Rush or Charge.',
    hooks: {
      [HOOKS.GET_BASE_SPEED]: ({ action }) => {
        if (action === 'Advance') return { speed: 36, overrideSpeed: true };
        return { speed: 0, overrideSpeed: true };
      },
    },
  },

  Fast: {
    description: 'Gains +2" on Advance, +4" on Rush/Charge.',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ action, specialRulesApplied }) => {
        const delta = action === 'Advance' ? 2 : 4;
        specialRulesApplied.push({ rule: 'Fast', value: delta, effect: `+${delta}" movement` });
        return { speedDelta: delta };
      },
    },
  },

  Slow: {
    description: 'Loses 2" on Advance, 4" on Rush/Charge.',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ action, specialRulesApplied }) => {
        const delta = action === 'Advance' ? -2 : -4;
        specialRulesApplied.push({ rule: 'Slow', value: Math.abs(delta), effect: `${delta}" movement` });
        return { speedDelta: delta };
      },
    },
  },

  Flying: {
    description: 'Ignores terrain movement penalties.',
    hooks: {
      [HOOKS.ON_TERRAIN_MOVE]: () => ({ ignoreTerrain: true }),
    },
  },

  Strider: {
    description: 'Ignores difficult terrain movement penalties.',
    hooks: {
      [HOOKS.ON_TERRAIN_MOVE]: ({ terrain }) => {
        if (terrain?.difficult) return { ignoreDifficult: true };
        return {};
      },
    },
  },

  // ── Morale ────────────────────────────────────────────────────────────────

  Fearless: {
    description: 'May re-roll failed morale tests on a 4+.',
    hooks: {
      [HOOKS.ON_MORALE_TEST]: ({ passed, roll, dice, specialRulesApplied }) => {
        if (passed) return {};
        const reroll = dice.roll();
        specialRulesApplied.push({ rule: 'Fearless', value: null, effect: `morale reroll on 4+ (rolled ${reroll})` });
        if (reroll >= 4) return { passed: true, reroll };
        return { reroll };
      },
    },
  },

  // ── Deployment / Reserve ──────────────────────────────────────────────────

  Ambush: {
    description: 'Deploys to reserve. Enters mid-game at least 9" from all enemies.',
    hooks: {
      [HOOKS.ON_DEPLOY]: () => ({ isReserve: true, reserveType: 'Ambush' }),
      [HOOKS.ON_RESERVE_ENTRY]: ({ unit, gameState }) => {
        const enemies = gameState.units.filter(u => u.owner !== unit.owner && u.current_models > 0);
        for (let attempts = 0; attempts < 100; attempts++) {
          const x = Math.random() * 50 + 5;
          const y = Math.random() * 36 + 12;
          const tooClose = enemies.some(e => Math.hypot(e.x - x, e.y - y) < 9);
          if (!tooClose) return { x, y };
        }
        // Fallback
        return { x: 30 + (Math.random() - 0.5) * 10, y: 30 + (Math.random() - 0.5) * 10 };
      },
    },
  },

  Teleport: {
    description: 'Can teleport anywhere on the board at least 9" from enemies.',
    hooks: {
      [HOOKS.ON_DEPLOY]: () => ({ isReserve: true, reserveType: 'Teleport' }),
      [HOOKS.ON_RESERVE_ENTRY]: ({ unit, gameState }) => {
        const enemies = gameState.units.filter(u => u.owner !== unit.owner && u.current_models > 0);
        for (let attempts = 0; attempts < 50; attempts++) {
          const x = Math.random() * 66 + 3;
          const y = Math.random() * 42 + 3;
          const tooClose = enemies.some(e => Math.hypot(e.x - x, e.y - y) < 9);
          if (!tooClose) return { x, y };
        }
        return {}; // failed to place
      },
    },
  },

  Infiltrate: {
    description: 'Deploys to reserve. Enters via any board edge.',
    hooks: {
      [HOOKS.ON_DEPLOY]: () => ({ isReserve: true, reserveType: 'Infiltrate' }),
    },
  },

  // ── Objective Interaction ─────────────────────────────────────────────────

  // Units with Shaken status can't claim — handled by engine status check.
  // No rule keyword needed here.

  // ── Spell / Caster ────────────────────────────────────────────────────────

  Caster: {
    description: 'Caster(X): gains X spell tokens per round (max 6).',
    // Token gain and spell casting are handled by dedicated engine methods;
    // these hooks give extension points without engine changes.
    hooks: {
      [HOOKS.ON_TOKEN_GAIN]: ({ _ruleParamValue, currentTokens, specialRulesApplied }) => {
        const gain = _ruleParamValue ?? 0;
        const after = Math.min(6, currentTokens + gain);
        specialRulesApplied.push({ rule: 'Caster', value: gain, effect: `gained ${after - currentTokens} token(s) (${after}/6)` });
        return { tokens: after };
      },
    },
  },

  // ── Misc Combat ───────────────────────────────────────────────────────────

  Fear: {
    description: 'Fear(X): adds X to wound total for melee resolution comparison only.',
    // Applied at melee resolution time, not in a hook — stored as a unit property.
    // Hook provided for future extension (e.g. morale effect on seeing Fear unit).
    hooks: {},
  },

  Counter: {
    description: 'Adds models count as penalty wounds against charging attacker.',
    hooks: {},
  },

  Limited: {
    description: 'This weapon can only be used once per game.',
    hooks: {},
  },

  Hero: {
    description: 'Single-model unit with a Tough value representing its wound pool.',
    hooks: {},
  },

  Transport: {
    description: 'Transport(X): can carry up to X transport points of friendly units.',
    hooks: {},
  },

  Tough: {
    description: 'Tough(X): unit has X wounds (multi-wound single model or multi-wound per model).',
    hooks: {},
  },

  Impact: {
    description: 'Impact(X): on a charge, deal X automatic hits before melee.',
    hooks: {},
    // Impact is resolved at charge time in the engine, not in a hit hook,
    // because it happens before melee begins. Registered here for documentation.
  },

  Takedown: {
    description: 'Special melee weapon rule — handled by engine.',
    hooks: {},
  },
};
