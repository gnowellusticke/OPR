/**
 * rules/opr-rules.js
 *
 * OPR Grimdark Future special rules — hook implementations.
 * Contains ONLY the rules listed in the OPR Special Rules Reference (PDF pp.13-15).
 *
 * Rules: Aircraft, Ambush, AP(X), Artillery, Bane, Blast(X), Caster(X),
 *        Counter, Deadly(X), Fast, Fear(X), Fearless, Flying, Furious,
 *        Hero, Immobile, Impact(X), Indirect, Limited, Regeneration,
 *        Relentless, Reliable, Rending, Scout, Slow, Stealth, Strider,
 *        Surge, Takedown, Thrust, Tough(X), Transport(X), Unstoppable
 */

import { HOOKS } from '../RuleRegistry.js';

export const OPR_RULES = {

  // ── Hit Quality Modifiers ─────────────────────────────────────────────────

  Reliable: {
    description: 'This weapon always hits on 2+.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ specialRulesApplied }) => {
        specialRulesApplied.push({ rule: 'Reliable', value: null, effect: 'attacks at Quality 2+' });
        return { quality: 2 };
      },
    },
  },

  Indirect: {
    description: 'Gets -1 to hit rolls when shooting after moving. May target enemies not in LOS, ignores cover from sight obstructions.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ quality, specialRulesApplied }) => {
        specialRulesApplied.push({ rule: 'Indirect', value: null, effect: 'quality +1 (indirect fire penalty)' });
        return { quality: Math.min(6, quality + 1) };
      },
    },
  },

  Artillery: {
    description: 'May only use Hold actions. Gets +1 to hit at 9"+ range; enemies get -2 to hit from 9"+ range.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, target, quality, specialRulesApplied, calculateDistance }) => {
        if (!target || !calculateDistance) return {};
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
    description: 'When charging, gets +1 to hit rolls and AP(+1) in melee.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, specialRulesApplied }) => {
        if (!unit.just_charged) return {};
        specialRulesApplied.push({ rule: 'Thrust', value: null, effect: 'quality -1 and AP+1 on charge' });
        return { quality: Math.max(2, quality - 1), thrustApBonus: 1 };
      },
    },
  },

  Stealth: {
    description: 'When shot from over 9" away, enemy units get -1 to hit rolls.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ weapon, quality, specialRulesApplied }) => {
        if ((weapon?.range ?? 0) <= 2) return {};
        specialRulesApplied.push({ rule: 'Stealth', value: null, effect: 'quality +1 vs stealthed target' });
        return { quality: Math.min(6, quality + 1) };
      },
    },
  },

  // ── Extra Hit Generators ──────────────────────────────────────────────────

  Blast: {
    description: 'Blast(X): ignores cover; each hit multiplied by X (up to model count in target unit).',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ _ruleParamValue, target, specialRulesApplied }) => {
        const blastCount = _ruleParamValue ?? 1;
        const modelCount = target?.model_count
          ?? Math.ceil((target?.current_models ?? 1) / Math.max(target?.tough_per_model ?? 1, 1));
        const finalHits = Math.min(blastCount, modelCount);
        const autoRolls = Array.from({ length: finalHits }, () => ({ value: 6, success: true, auto: true }));
        specialRulesApplied.push({ rule: 'Blast', value: finalHits, effect: `${blastCount} auto hits capped at ${modelCount} model(s)` });
        return { successes: finalHits, rolls: autoRolls, isBlast: true };
      },
    },
  },

  Furious: {
    description: 'When charging, unmodified 6s to hit in melee deal 1 extra hit.',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ rolls, successes, specialRulesApplied }) => {
        const naturalSixes = rolls.filter(r => r.value === 6 && r.success && !r.auto).length;
        if (naturalSixes === 0) return {};
        specialRulesApplied.push({ rule: 'Furious', value: null, effect: `${naturalSixes} extra hits from natural 6s` });
        return { successes: successes + naturalSixes };
      },
    },
  },

  Surge: {
    description: 'On unmodified results of 6 to hit, deals 1 extra hit.',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ rolls, successes, specialRulesApplied }) => {
        const naturalSixes = rolls.filter(r => r.value === 6 && r.success && !r.auto).length;
        if (naturalSixes === 0) return {};
        specialRulesApplied.push({ rule: 'Surge', value: null, effect: `${naturalSixes} extra hits from natural 6s` });
        return { successes: successes + naturalSixes };
      },
    },
  },

  Relentless: {
    description: 'When shooting at enemies over 9" away, unmodified 6s to hit generate one extra hit.',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ unit, target, rolls, successes, specialRulesApplied, calculateDistance }) => {
        if (!target || !calculateDistance) return {};
        if (calculateDistance(unit, target) <= 9) return {};
        const naturalSixes = rolls.filter(r => r.value === 6 && r.success && !r.auto).length;
        if (naturalSixes === 0) return {};
        const extraRolls = Array.from({ length: naturalSixes }, () => ({ value: 1, success: true, relentless: true }));
        specialRulesApplied.push({ rule: 'Relentless', value: null, effect: `${naturalSixes} extra hits from natural 6s at 9"+` });
        return { successes: successes + naturalSixes, rolls: [...rolls, ...extraRolls] };
      },
    },
  },

  // ── Defense Modifiers ─────────────────────────────────────────────────────

  AP: {
    description: 'AP(X): targets get -X to Defense rolls when blocking hits.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ _ruleParamValue, ap, specialRulesApplied }) => {
        const apValue = _ruleParamValue ?? ap ?? 0;
        if (apValue <= 0) return {};
        specialRulesApplied.push({ rule: 'AP', value: apValue, effect: `defense reduced by ${apValue}` });
        return { ap: apValue };
      },
    },
  },

  Unstoppable: {
    description: 'Ignores Regeneration, and ignores all negative modifiers to this weapon.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ ap, specialRulesApplied }) => {
        if ((ap ?? 0) >= 0) return {};
        specialRulesApplied.push({ rule: 'Unstoppable', value: null, effect: 'ignores negative AP' });
        return { ap: 0 };
      },
    },
  },

  // ── Per-Hit Processors ────────────────────────────────────────────────────

  Rending: {
    description: 'Ignores Regeneration. Unmodified 6s to hit get AP(+4).',
    hooks: {
      [HOOKS.ON_PER_HIT]: ({ hitRoll, specialRulesApplied }) => {
        if (!hitRoll || hitRoll.value !== 6 || !hitRoll.success || hitRoll.auto) return {};
        specialRulesApplied.push({ rule: 'Rending', value: null, effect: 'natural 6 to hit gains AP(+4)' });
        return { apBonus: 4 };
      },
    },
  },

  Bane: {
    description: 'Ignores Regeneration. Defender must re-roll unmodified Defense results of 6.',
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
    description: 'Deadly(X): assign each wound to one model and multiply by X. Wounds don\'t carry over.',
    hooks: {
      [HOOKS.ON_WOUND_CALC]: ({ _ruleParamValue, toughPerModel, specialRulesApplied }) => {
        const x = _ruleParamValue ?? 1;
        const wounds = Math.min(x, toughPerModel ?? 1);
        specialRulesApplied.push({ rule: 'Deadly', value: x, effect: `each unsaved hit deals ${wounds} wounds` });
        return { wounds };
      },
    },
  },

  // ── Post-Damage ───────────────────────────────────────────────────────────

  Regeneration: {
    description: 'When the unit takes wounds, roll one die per wound — on 5+ it is ignored.',
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
          specialRulesApplied.push({ rule: 'Regeneration', value: null, effect: `${ignored}/${wounds} wounds ignored (5+ saves, rolls: ${rolls.join(',')})` });
        }
        return { wounds: Math.max(0, wounds - ignored) };
      },
    },
  },

  // ── Movement ──────────────────────────────────────────────────────────────

  Fast: {
    description: 'Models move +2" when using Advance and +4" when using Rush/Charge.',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ action, specialRulesApplied }) => {
        const delta = action === 'Advance' ? 2 : 4;
        specialRulesApplied.push({ rule: 'Fast', value: delta, effect: `+${delta}" movement` });
        return { speedDelta: delta };
      },
    },
  },

  Slow: {
    description: 'Models move -2" when using Advance, and -4" when using Rush/Charge.',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ action, specialRulesApplied }) => {
        const delta = action === 'Advance' ? -2 : -4;
        specialRulesApplied.push({ rule: 'Slow', value: Math.abs(delta), effect: `${delta}" movement` });
        return { speedDelta: delta };
      },
    },
  },

  Flying: {
    description: 'May move through units and terrain, and ignores terrain effects whilst moving.',
    hooks: {
      [HOOKS.ON_TERRAIN_MOVE]: () => ({ ignoreTerrain: true }),
    },
  },

  Strider: {
    description: 'May ignore the effects of difficult terrain when moving.',
    hooks: {
      [HOOKS.ON_TERRAIN_MOVE]: ({ terrain }) => {
        if (terrain?.difficult) return { ignoreDifficult: true };
        return {};
      },
    },
  },

  Immobile: {
    description: 'Models may only use Hold actions.',
    hooks: {
      [HOOKS.GET_BASE_SPEED]: ({ action }) => {
        if (action !== 'Hold') return { speed: 0, overrideSpeed: true };
        return {};
      },
    },
  },

  Aircraft: {
    description: 'May only use Advance actions, moving in a straight line adding 30" to its total move.',
    hooks: {
      [HOOKS.GET_BASE_SPEED]: ({ action }) => {
        if (action === 'Advance') return { speed: 36, overrideSpeed: true };
        return { speed: 0, overrideSpeed: true };
      },
    },
  },

  Scout: {
    description: 'May be set aside before deployment. After all other units deploy, may deploy anywhere fully within 12" of their deployment zone.',
    hooks: {
      [HOOKS.ON_DEPLOY]: () => ({ scoutMove: 12 }),
    },
  },

  // ── Morale ────────────────────────────────────────────────────────────────

  Fearless: {
    description: 'When a unit where all models have this rule fails a morale test, roll one die — on 4+ it counts as passed.',
    hooks: {
      [HOOKS.ON_MORALE_TEST]: ({ passed, dice, specialRulesApplied }) => {
        if (passed) return {};
        const reroll = dice.roll();
        specialRulesApplied.push({ rule: 'Fearless', value: null, effect: `morale reroll: ${reroll} (needs 4+)` });
        if (reroll >= 4) return { passed: true, reroll };
        return { reroll };
      },
    },
  },

  // ── Deployment / Reserve ──────────────────────────────────────────────────

  Ambush: {
    description: 'May be set aside before deployment. At the start of any round after the first, may deploy anywhere over 9" from enemy units.',
    hooks: {
      [HOOKS.ON_DEPLOY]: () => ({ isReserve: true, reserveType: 'Ambush' }),
      [HOOKS.ON_RESERVE_ENTRY]: ({ unit, gameState }) => {
        const enemies = gameState.units.filter(u => u.owner !== unit.owner && u.current_models > 0);
        for (let attempts = 0; attempts < 100; attempts++) {
          const x = Math.random() * 50 + 5;
          const y = Math.random() * 36 + 12;
          if (!enemies.some(e => Math.hypot(e.x - x, e.y - y) < 9)) return { x, y };
        }
        return { x: 30 + (Math.random() - 0.5) * 10, y: 30 + (Math.random() - 0.5) * 10 };
      },
    },
  },

  // ── Misc Unit Properties ──────────────────────────────────────────────────

  Fear: {
    description: 'Fear(X): this model counts as having dealt +X wounds when checking who won melee.',
    parameterised: true,
    // Fires on ON_MELEE_RESOLUTION (called without special_rules — all handlers fire).
    // Self-filters by inspecting attacker.special_rules directly.
    // Engine reads: attackerWounds / defenderWounds from results.
    hooks: {
      [HOOKS.ON_MELEE_RESOLUTION]: ({ attacker, attackerWounds, specialRulesApplied }) => {
        const sr = Array.isArray(attacker?.special_rules)
          ? attacker.special_rules.join(' ')
          : (attacker?.special_rules ?? '');
        const m = sr.match(/\bFear\((\d+)\)/);
        if (!m) return {};
        const x = parseInt(m[1]);
        specialRulesApplied.push({ rule: 'Fear', value: x, effect: `+${x} virtual wound(s) in melee comparison` });
        return { attackerWounds: attackerWounds + x };
      },
    },
  },

  Counter: {
    description: 'Strikes first when charged. Charging unit gets -1 total Impact rolls per model with Counter.',
    // Priority 10 so Counter fires before Impact on BEFORE_MELEE_ATTACK,
    // setting counterImpactReduction in context before Impact reads it.
    priority: 10,
    // Both hooks fire without special_rules — self-filter via context.
    hooks: {
      [HOOKS.ON_STRIKE_ORDER]: ({ defender, specialRulesApplied }) => {
        const sr = Array.isArray(defender?.special_rules)
          ? defender.special_rules.join(' ')
          : (defender?.special_rules ?? '');
        if (!sr.includes('Counter')) return {};
        specialRulesApplied.push({ rule: 'Counter', value: null, effect: 'defender strikes first' });
        return { attackerFirst: false };
      },
      [HOOKS.BEFORE_MELEE_ATTACK]: ({ attacker, defender, specialRulesApplied }) => {
        const sr = Array.isArray(defender?.special_rules)
          ? defender.special_rules.join(' ')
          : (defender?.special_rules ?? '');
        if (!sr.includes('Counter')) return {};
        // Impact reduction = number of models in the defending unit that carry Counter.
        // Counter is a unit rule so all current models contribute.
        const reduction = defender.current_models ?? 1;
        specialRulesApplied.push({ rule: 'Counter', value: reduction, effect: `-${reduction} Impact roll(s) from Counter` });
        return { counterImpactReduction: reduction };
      },
    },
  },

  Limited: {
    description: 'This weapon may only be used once per game.',
    // BEFORE_ATTACK is called with combined attacker + weapon special_rules,
    // so this handler fires when the weapon carries Limited.
    // Engine reads: preventAttack from results.
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ weapon, specialRulesApplied }) => {
        if (weapon?._limitedUsed) {
          specialRulesApplied.push({ rule: 'Limited', value: null, effect: 'weapon already expended — attack blocked' });
          return { preventAttack: true };
        }
        if (weapon) weapon._limitedUsed = true;
        specialRulesApplied.push({ rule: 'Limited', value: null, effect: 'weapon expended (once per game)' });
        return {};
      },
    },
  },

  Hero: {
    description: 'May deploy as part of one multi-model unit. Takes morale tests on behalf of the unit. Uses unit Defense until all other models are killed. Assigned wounds last.',
    hooks: {
      // Engine calls ON_MORALE_TEST with unit.special_rules — fires only when the unit has Hero.
      // Signals that the hero quality/roll should be used for the unit's test.
      [HOOKS.ON_MORALE_TEST]: ({ unit, specialRulesApplied }) => {
        specialRulesApplied.push({ rule: 'Hero', value: null, effect: 'hero takes morale test on behalf of unit' });
        return { useHeroQuality: unit.quality };
      },
      // ON_WOUND_ALLOCATION called with target.special_rules — fires only when unit has Hero.
      // Signals the engine to assign wounds to non-hero models first.
      [HOOKS.ON_WOUND_ALLOCATION]: ({ unit, specialRulesApplied }) => {
        const nonHeroAlive = (unit.non_hero_models_remaining ?? 0) > 0;
        if (!nonHeroAlive) return {};
        specialRulesApplied.push({ rule: 'Hero', value: null, effect: 'wounds assigned to non-hero models first' });
        return { assignHeroLast: true };
      },
    },
  },

  Transport: {
    description: 'Transport(X): may carry up to X transport points. When destroyed, embarked units take a dangerous terrain test, are Shaken, and must be placed within 6".',
    parameterised: true,
    // ON_TRANSPORT_DESTROY fires (without special_rules) when any unit is destroyed.
    // Self-filters by checking if the destroyed unit has Transport.
    // Engine reads: applyDangerousTerrainTest, applyShaken, disembarkRadius.
    hooks: {
      [HOOKS.ON_TRANSPORT_DESTROY]: ({ unit, specialRulesApplied }) => {
        const sr = Array.isArray(unit?.special_rules)
          ? unit.special_rules.join(' ')
          : (unit?.special_rules ?? '');
        const m = sr.match(/\bTransport\((\d+)\)/);
        if (!m) return {};
        specialRulesApplied.push({ rule: 'Transport', value: null, effect: 'transport destroyed — embarked units take dangerous terrain test, Shaken, placed within 6"' });
        return { applyDangerousTerrainTest: true, applyShaken: true, disembarkRadius: 6 };
      },
    },
  },

  Tough: {
    description: 'Tough(X): must take X wounds before being killed. Wounds accumulate per-model; overflow does not carry over.',
    parameterised: true,
    // ON_INCOMING_WOUNDS fires with defender.special_rules — only for units with Tough.
    // Converts raw wound count into model deaths, accumulating remainder on unit.wounds_accumulated.
    // Engine reads: wounds (treated as model deaths by _applyWounds).
    // Priority 0 (default) — fires after Regeneration (priority 10) has already reduced wounds.
    hooks: {
      [HOOKS.ON_INCOMING_WOUNDS]: ({ unit, wounds, specialRulesApplied }) => {
        const sr = Array.isArray(unit?.special_rules)
          ? unit.special_rules.join(' ')
          : (unit?.special_rules ?? '');
        const m = sr.match(/\bTough\((\d+)\)/);
        if (!m) return {};
        const toughValue = parseInt(m[1]);
        if (toughValue <= 1) return {};

        const accumulated = unit.wounds_accumulated ?? 0;
        const total = accumulated + wounds;
        const modelsKilled = Math.floor(total / toughValue);
        unit.wounds_accumulated = total % toughValue;

        specialRulesApplied.push({
          rule: 'Tough', value: toughValue,
          effect: `${accumulated}+${wounds} wounds → ${modelsKilled} model(s) killed, ${unit.wounds_accumulated} accumulated`,
        });
        return { wounds: modelsKilled };
      },
    },
  },

  Impact: {
    description: 'Impact(X): roll X dice when attacking after charging (unless fatigued). Each 2+ deals one hit on the target.',
    parameterised: true,
    // BEFORE_MELEE_ATTACK fires without special_rules — self-filters via attacker.special_rules.
    // Reads counterImpactReduction set by Counter (priority 10) earlier in the same hook pass.
    // Engine reads: extraWounds from results.
    hooks: {
      [HOOKS.BEFORE_MELEE_ATTACK]: ({ attacker, dice, counterImpactReduction, specialRulesApplied }) => {
        if (!attacker?.just_charged || attacker?.fatigued) return {};
        const sr = Array.isArray(attacker?.special_rules)
          ? attacker.special_rules.join(' ')
          : (attacker?.special_rules ?? '');
        const m = sr.match(/\bImpact\((\d+)\)/);
        if (!m) return {};
        const rawX = parseInt(m[1]);
        const x = Math.max(0, rawX - (counterImpactReduction ?? 0));
        if (x === 0) {
          specialRulesApplied.push({ rule: 'Impact', value: rawX, effect: `Impact(${rawX}) fully cancelled by Counter` });
          return {};
        }
        let hits = 0;
        const rolls = [];
        for (let i = 0; i < x; i++) {
          const r = dice.roll();
          rolls.push(r);
          if (r >= 2) hits++;
        }
        specialRulesApplied.push({ rule: 'Impact', value: rawX, effect: `Impact(${x}/${rawX} after Counter): [${rolls.join(',')}] → ${hits} hit(s)` });
        return { extraWounds: hits };
      },
    },
  },

  Caster: {
    description: 'Caster(X): gets X spell tokens at the start of each round (max 6).',
    parameterised: true,
    hooks: {
      [HOOKS.ON_TOKEN_GAIN]: ({ _ruleParamValue, currentTokens, specialRulesApplied }) => {
        const gain = _ruleParamValue ?? 0;
        const after = Math.min(6, (currentTokens ?? 0) + gain);
        specialRulesApplied.push({ rule: 'Caster', value: gain, effect: `gained ${after - (currentTokens ?? 0)} token(s) (${after}/6)` });
        return { tokens: after };
      },
    },
  },

  Takedown: {
    description: 'This model may pick any model in the target unit as its individual target, resolved as if it was a unit of [1].',
    hooks: {},
  },
};