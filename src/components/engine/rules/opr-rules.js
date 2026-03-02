/**
 * rules/opr-rules.js
 *
 * OPR Grimdark Future special rules — full hook implementations.
 * Updated with all rules from Custodian Brothers v3.5.2.
 *
 * New rules added:
 *   Guardian, Guardian Boost, Shielded, Shred, Tear, Steadfast,
 *   Versatile Attack, Unpredictable Fighter, Hit & Run, Hit & Run Shooter,
 *   Ranged Shrouding, Piercing Target, Shred Mark, Scout, Teleport (in-game)
 *   — plus all Aura variants.
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
    description: 'Ignores LOS but hits on a worse quality.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ quality, specialRulesApplied }) => {
        specialRulesApplied.push({ rule: 'Indirect', value: null, effect: 'quality +1 (indirect fire penalty)' });
        return { quality: Math.min(6, quality + 1) };
      },
    },
  },

  Artillery: {
    description: 'Hits on better quality at 9"+ range.',
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
    description: 'On a charge, hits on better quality and gains AP(+1).',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, specialRulesApplied }) => {
        if (!unit.just_charged) return {};
        specialRulesApplied.push({ rule: 'Thrust', value: null, effect: 'quality -1 and AP+1 on charge' });
        return { quality: Math.max(2, quality - 1), thrustApBonus: 1 };
      },
    },
  },

  Stealth: {
    description: 'Ranged attacks against this unit hit on a worse quality.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ weapon, quality, specialRulesApplied }) => {
        if ((weapon?.range ?? 0) <= 2) return {};
        specialRulesApplied.push({ rule: 'Stealth', value: null, effect: 'quality +1 vs stealthed target' });
        return { quality: Math.min(6, quality + 1) };
      },
    },
  },

  'Stealth Aura': {
    description: 'This model and its unit get Stealth.',
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

  // ── Army-Wide: Guardian ───────────────────────────────────────────────────

  Guardian: {
    description: 'When shot or charged from over 9" away, hits count as AP(-1), min AP(0).',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ attackDistance, ap, isSpell, specialRulesApplied }) => {
        if (isSpell) return {};
        if (attackDistance == null || attackDistance <= 9) return {};
        const currentAp = ap ?? 0;
        if (currentAp <= 0) return {};
        const reducedAp = Math.max(0, currentAp - 1);
        specialRulesApplied.push({ rule: 'Guardian', value: null, effect: `AP ${currentAp}→${reducedAp} (attacked from ${attackDistance.toFixed(1)}")` });
        return { ap: reducedAp };
      },
    },
  },

  'Guardian Boost': {
    description: 'Enemy hits always count as AP(-1) from Guardian, regardless of distance.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ ap, isSpell, specialRulesApplied }) => {
        if (isSpell) return {};
        const currentAp = ap ?? 0;
        if (currentAp <= 0) return {};
        const reducedAp = Math.max(0, currentAp - 1);
        specialRulesApplied.push({ rule: 'Guardian Boost', value: null, effect: `AP ${currentAp}→${reducedAp}` });
        return { ap: reducedAp };
      },
    },
  },

  'Guardian Boost Aura': {
    description: 'This model and its unit get Guardian Boost.',
    hooks: {},
  },

  // ── Extra Hit Generators ──────────────────────────────────────────────────

  Blast: {
    description: 'Blast(X): X automatic hits, no quality roll.',
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
    description: 'Unmodified 6s to hit generate one extra hit.',
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
    description: 'Unmodified 6s to hit generate one extra hit.',
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
    description: 'Unmodified 6s to hit count as 2 hits.',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ rolls, successes, specialRulesApplied }) => {
        const naturalSixes = rolls.filter(r => r.value === 6 && r.success && !r.auto && !r.relentless).length;
        if (naturalSixes === 0) return {};
        specialRulesApplied.push({ rule: 'Crack', value: null, effect: `${naturalSixes} natural 6s each count as 2 hits` });
        return { successes: successes + naturalSixes };
      },
    },
  },

  Relentless: {
    description: 'Unmodified 6s to hit at 9"+ range generate one extra hit.',
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
    description: 'AP(X): reduce defender save by X.',
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
    description: 'Negative AP modifiers do not apply against this weapon.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ ap, specialRulesApplied }) => {
        if ((ap ?? 0) >= 0) return {};
        specialRulesApplied.push({ rule: 'Unstoppable', value: null, effect: 'ignores negative AP' });
        return { ap: 0 };
      },
    },
  },

  'Unstoppable in Melee': {
    description: 'Negative AP modifiers do not apply in melee.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ ap, isMelee, specialRulesApplied }) => {
        if (!isMelee || (ap ?? 0) >= 0) return {};
        specialRulesApplied.push({ rule: 'Unstoppable in Melee', value: null, effect: 'ignores negative AP in melee' });
        return { ap: 0 };
      },
    },
  },

  'Unstoppable in Melee Aura': {
    description: 'This model and its unit get Unstoppable in Melee.',
    hooks: {},
  },

  Shielded: {
    description: '+1 to defense rolls against non-spell hits.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ defense, isSpell, specialRulesApplied }) => {
        if (isSpell) return {};
        // defense is a target number (e.g. 2 means 2+), so subtract 1 to make it easier
        specialRulesApplied.push({ rule: 'Shielded', value: null, effect: 'defense +1 vs non-spell hits' });
        return { defense: Math.max(2, (defense ?? 6) - 1) };
      },
    },
  },

  // ── Per-Hit Processors ────────────────────────────────────────────────────

  Rending: {
    description: 'Natural 6s to hit gain AP(+4) for that hit.',
    hooks: {
      [HOOKS.ON_PER_HIT]: ({ hitRoll, specialRulesApplied }) => {
        if (!hitRoll || hitRoll.value !== 6 || !hitRoll.success || hitRoll.auto) return {};
        specialRulesApplied.push({ rule: 'Rending', value: null, effect: 'natural 6 to hit gains AP(+4)' });
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

  Shred: {
    description: 'On unmodified 1s to block hits, this weapon deals 1 extra wound.',
    hooks: {
      [HOOKS.ON_PER_HIT]: ({ saveRoll, specialRulesApplied }) => {
        if (saveRoll !== 1) return {};
        specialRulesApplied.push({ rule: 'Shred', value: null, effect: 'unmodified 1 to save — +1 extra wound' });
        return { extraWounds: 1 };
      },
    },
  },

  Tear: {
    description: 'Against units where most models have Tough(3) to Tough(9), gains AP(+4).',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, specialRulesApplied }) => {
        if (!target) return {};
        const sr = Array.isArray(target.special_rules)
          ? target.special_rules.join(' ')
          : (target.special_rules || '');
        const m = sr.match(/Tough\((\d+)\)/);
        if (!m) return {};
        const toughVal = parseInt(m[1]);
        if (toughVal >= 3 && toughVal <= 9) {
          const newAp = (ap ?? 0) + 4;
          specialRulesApplied.push({ rule: 'Tear', value: null, effect: `+AP(4) vs Tough(${toughVal}) target → AP(${newAp})` });
          return { ap: newAp };
        }
        return {};
      },
    },
  },

  // ── Wound Calculation ─────────────────────────────────────────────────────

  Deadly: {
    description: 'Deadly(X): each unsaved hit deals min(X, toughPerModel) wounds.',
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
    description: 'Roll one die per incoming wound; each 5+ ignores that wound.',
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

  'Regeneration Aura': {
    description: 'This model and its unit get Regeneration.',
    hooks: {},
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
    description: 'Must Advance 36" each activation.',
    hooks: {
      [HOOKS.GET_BASE_SPEED]: ({ action }) => {
        if (action === 'Advance') return { speed: 36, overrideSpeed: true };
        return { speed: 0, overrideSpeed: true };
      },
    },
  },

  Scout: {
    description: 'May move up to 12" before the first round.',
    hooks: {
      [HOOKS.ON_DEPLOY]: () => ({ scoutMove: 12 }),
    },
  },

  'Hit & Run': {
    description: 'Once per round, may move up to 3" after shooting or being in melee.',
    hooks: {
      [HOOKS.AFTER_COMBAT]: ({ unit, specialRulesApplied }) => {
        if (unit._hitAndRunUsed) return {};
        specialRulesApplied.push({ rule: 'Hit & Run', value: null, effect: 'may move up to 3" (once per round)' });
        return { hitAndRunMove: 3 };
      },
    },
  },

  'Hit & Run Shooter': {
    description: 'Once per round, may move up to 3" after shooting.',
    hooks: {
      [HOOKS.AFTER_SHOOTING]: ({ unit, specialRulesApplied }) => {
        if (unit._hitAndRunShooterUsed) return {};
        specialRulesApplied.push({ rule: 'Hit & Run Shooter', value: null, effect: 'may move up to 3" after shooting (once per round)' });
        return { hitAndRunMove: 3 };
      },
    },
  },

  'Hit & Run Shooter Aura': {
    description: 'This model and its unit get Hit & Run Shooter.',
    hooks: {},
  },

  'Ranged Shrouding': {
    description: 'Enemies get -6" effective range when shooting this unit.',
    hooks: {
      [HOOKS.BEFORE_RANGE_CHECK]: ({ specialRulesApplied }) => {
        specialRulesApplied.push({ rule: 'Ranged Shrouding', value: null, effect: 'enemy range -6" to shoot this unit' });
        return { effectiveRangeReduction: 6 };
      },
    },
  },

  'Ranged Shrouding Aura': {
    description: 'This model and its unit get Ranged Shrouding.',
    hooks: {},
  },

  // ── Activation Special Rules ──────────────────────────────────────────────

  'Versatile Attack': {
    description: 'When activated, choose: AP(+1) when attacking OR +1 to hit rolls.',
    hooks: {
      // Engine sets unit._versatileMode = 'ap' | 'quality' at activation start.
      // DMN AI should choose based on situation (shooting vs melee, enemy defense etc).
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, specialRulesApplied }) => {
        if (unit._versatileMode !== 'quality') return {};
        specialRulesApplied.push({ rule: 'Versatile Attack', value: null, effect: '+1 to hit rolls' });
        return { quality: Math.max(2, quality - 1) };
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, ap, specialRulesApplied }) => {
        if (unit._versatileMode !== 'ap') return {};
        specialRulesApplied.push({ rule: 'Versatile Attack', value: null, effect: 'AP+1 when attacking' });
        return { ap: (ap ?? 0) + 1 };
      },
    },
  },

  'Unpredictable Fighter': {
    description: 'In melee, roll one die: 1-3 get AP(+1), 4-6 get +1 to hit.',
    hooks: {
      // Engine rolls once at melee start and sets unit._unpredictableRoll.
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, specialRulesApplied }) => {
        const roll = unit._unpredictableRoll;
        if (roll == null || roll < 4) return {};
        specialRulesApplied.push({ rule: 'Unpredictable Fighter', value: null, effect: `rolled ${roll}: +1 to hit` });
        return { quality: Math.max(2, quality - 1) };
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, ap, specialRulesApplied }) => {
        const roll = unit._unpredictableRoll;
        if (roll == null || roll >= 4) return {};
        specialRulesApplied.push({ rule: 'Unpredictable Fighter', value: null, effect: `rolled ${roll}: AP+1` });
        return { ap: (ap ?? 0) + 1 };
      },
    },
  },

  Teleport: {
    description: 'Once per activation, before attacking, place this model anywhere within 6".',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, specialRulesApplied }) => {
        if (unit._teleportUsedThisActivation) return {};
        unit._teleportUsedThisActivation = true;
        specialRulesApplied.push({ rule: 'Teleport', value: null, effect: 'repositioned up to 6" before attacking' });
        return { teleportMove: 6 };
      },
    },
  },

  'Teleport Aura': {
    description: 'This model and its unit get Teleport.',
    hooks: {},
  },

  // ── Morale ────────────────────────────────────────────────────────────────

  Fearless: {
    description: 'May re-roll failed morale tests on a 4+.',
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

  Steadfast: {
    description: 'If Shaken at the start of a round, roll one die — on 4+ stop being Shaken.',
    hooks: {
      [HOOKS.ON_ROUND_START]: ({ unit, dice, specialRulesApplied }) => {
        if (unit.status !== 'shaken') return {};
        const roll = dice.roll();
        specialRulesApplied.push({ rule: 'Steadfast', value: null, effect: `Shaken recovery: rolled ${roll} (needs 4+)` });
        if (roll >= 4) return { clearShaken: true };
        return {};
      },
    },
  },

  'Steadfast Aura': {
    description: 'This model and its unit get Steadfast.',
    hooks: {},
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
          if (!enemies.some(e => Math.hypot(e.x - x, e.y - y) < 9)) return { x, y };
        }
        return { x: 30 + (Math.random() - 0.5) * 10, y: 30 + (Math.random() - 0.5) * 10 };
      },
    },
  },

  Infiltrate: {
    description: 'Deploys to reserve. Enters via any board edge.',
    hooks: {
      [HOOKS.ON_DEPLOY]: () => ({ isReserve: true, reserveType: 'Infiltrate' }),
    },
  },

  // ── Targeting / Buff Rules ────────────────────────────────────────────────

  'Piercing Target': {
    description: 'Piercing Target(X): once per game, mark one enemy — friendlies get +AP(X) against it.',
    parameterised: true,
    hooks: {
      // Engine sets target.piercing_ap_bonus = X when this ability is used.
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, specialRulesApplied }) => {
        const bonus = target?.piercing_ap_bonus ?? 0;
        if (bonus <= 0) return {};
        specialRulesApplied.push({ rule: 'Piercing Target', value: bonus, effect: `+AP(${bonus}) from marker` });
        return { ap: (ap ?? 0) + bonus };
      },
    },
  },

  'Shred Mark': {
    description: 'Once per activation, pick one enemy within 18" — friendlies get Shred against it.',
    hooks: {},
    // Engine sets target.shred_marked = true. Shred rule then fires on save rolls of 1.
  },

  'Shred when Shooting': {
    description: 'This unit has Shred on ranged attacks.',
    hooks: {
      [HOOKS.ON_PER_HIT]: ({ saveRoll, isMelee, specialRulesApplied }) => {
        if (isMelee || saveRoll !== 1) return {};
        specialRulesApplied.push({ rule: 'Shred when Shooting', value: null, effect: 'unmodified 1 to save — +1 extra wound' });
        return { extraWounds: 1 };
      },
    },
  },

  'Shred when Shooting Aura': {
    description: 'This model and its unit get Shred when shooting.',
    hooks: {},
  },

  // ── Misc Unit Properties ──────────────────────────────────────────────────

  Fear: {
    description: 'Fear(X): adds X to wound total in melee resolution comparison.',
    parameterised: true,
    hooks: {},
    // Applied at melee resolution time — engine reads _param(unit, 'Fear') directly.
  },

  Counter: {
    description: 'Adds model count as penalty wounds against charging attacker.',
    hooks: {},
  },

  Limited: {
    description: 'This weapon can only be used once per game.',
    hooks: {},
  },

  Hero: {
    description: 'Single-model unit with a Tough value.',
    hooks: {},
  },

  Transport: {
    description: 'Transport(X): can carry up to X transport points of friendly units.',
    parameterised: true,
    hooks: {},
  },

  Tough: {
    description: 'Tough(X): unit has X wounds.',
    parameterised: true,
    hooks: {},
  },

  Impact: {
    description: 'Impact(X): on a charge, deal X automatic hits before melee.',
    parameterised: true,
    hooks: {},
    // Resolved at charge time in the engine.
  },

  Caster: {
    description: 'Caster(X): gains X spell tokens per round (max 6).',
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
    description: 'Special melee weapon rule.',
    hooks: {},
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // DAO UNION RULES — added from DAO Union v3.5.2
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Army-Wide: Targeting Visor ────────────────────────────────────────────

  'Targeting Visor': {
    description: 'When shooting at enemies over 9" away, gets +1 to hit rolls.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, target, weapon, quality, specialRulesApplied, calculateDistance }) => {
        // Only applies to ranged attacks
        if (!target || !calculateDistance || (weapon?.range ?? 0) <= 2) return {};
        const dist = calculateDistance(unit, target);
        if (dist <= 9) return {};
        specialRulesApplied.push({ rule: 'Targeting Visor', value: null, effect: '+1 to hit at 9"+ range (quality -1)' });
        return { quality: Math.max(2, quality - 1) };
      },
    },
  },

  'Targeting Visor Boost': {
    description: 'Always gets +1 to hit rolls when shooting (not just over 9").',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ weapon, quality, specialRulesApplied }) => {
        if ((weapon?.range ?? 0) <= 2) return {};
        specialRulesApplied.push({ rule: 'Targeting Visor Boost', value: null, effect: '+1 to hit when shooting' });
        return { quality: Math.max(2, quality - 1) };
      },
    },
  },

  'Targeting Visor Boost Aura': {
    description: 'This model and its unit get Targeting Visor Boost.',
    hooks: {},
  },

  // ── Good Shot ─────────────────────────────────────────────────────────────

  'Good Shot': {
    description: 'This model gets +1 to hit rolls when shooting.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ weapon, quality, specialRulesApplied }) => {
        if ((weapon?.range ?? 0) <= 2) return {};
        specialRulesApplied.push({ rule: 'Good Shot', value: null, effect: '+1 to hit when shooting' });
        return { quality: Math.max(2, quality - 1) };
      },
    },
  },

  // ── Evasive ───────────────────────────────────────────────────────────────

  Evasive: {
    description: 'Enemies get -1 to hit rolls when attacking this unit.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ quality, specialRulesApplied }) => {
        specialRulesApplied.push({ rule: 'Evasive', value: null, effect: 'enemy -1 to hit (quality +1)' });
        return { quality: Math.min(6, quality + 1) };
      },
    },
  },

  // ── Fortified ─────────────────────────────────────────────────────────────

  Fortified: {
    description: 'Hits against this unit count as AP(-1), min AP(0).',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ ap, specialRulesApplied }) => {
        const currentAp = ap ?? 0;
        if (currentAp <= 0) return {};
        const reducedAp = Math.max(0, currentAp - 1);
        specialRulesApplied.push({ rule: 'Fortified', value: null, effect: `AP ${currentAp}→${reducedAp}` });
        return { ap: reducedAp };
      },
    },
  },

  'Fortified Aura': {
    description: 'This model and its unit get Fortified.',
    hooks: {},
  },

  // ── Decimate ──────────────────────────────────────────────────────────────

  Decimate: {
    description: 'Ignores cover. Against Defense 2+-3+ targets, gains AP(+2).',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, specialRulesApplied }) => {
        if (!target) return {};
        const defense = target.defense ?? 4;
        // Defense 2+ = value 2, Defense 3+ = value 3
        if (defense <= 3) {
          const newAp = (ap ?? 0) + 2;
          specialRulesApplied.push({ rule: 'Decimate', value: null, effect: `+AP(2) vs Defense ${defense}+ target → AP(${newAp})` });
          return { ap: newAp, ignoresCover: true };
        }
        return { ignoresCover: true };
      },
    },
  },

  // ── Slayer variants ───────────────────────────────────────────────────────

  Slayer: {
    description: 'This model\'s weapons get AP(+2) against units where most models have Tough(3) or higher.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, specialRulesApplied }) => {
        if (!target) return {};
        const sr = Array.isArray(target.special_rules)
          ? target.special_rules.join(' ')
          : (target.special_rules || '');
        const m = sr.match(/Tough\((\d+)\)/);
        if (!m || parseInt(m[1]) < 3) return {};
        const newAp = (ap ?? 0) + 2;
        specialRulesApplied.push({ rule: 'Slayer', value: null, effect: `+AP(2) vs Tough(${m[1]}) target → AP(${newAp})` });
        return { ap: newAp };
      },
    },
  },

  'Ranged Slayer': {
    description: 'This model\'s ranged weapons get AP(+2) against units where most models have Tough(3) or higher.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, isMelee, specialRulesApplied }) => {
        if (isMelee || !target) return {};
        const sr = Array.isArray(target.special_rules)
          ? target.special_rules.join(' ')
          : (target.special_rules || '');
        const m = sr.match(/Tough\((\d+)\)/);
        if (!m || parseInt(m[1]) < 3) return {};
        const newAp = (ap ?? 0) + 2;
        specialRulesApplied.push({ rule: 'Ranged Slayer', value: null, effect: `+AP(2) vs Tough(${m[1]}) target (ranged) → AP(${newAp})` });
        return { ap: newAp };
      },
    },
  },

  'Ranged Slayer Aura': {
    description: 'This model and its unit get Ranged Slayer.',
    hooks: {},
  },

  // ── Counter-Attack ────────────────────────────────────────────────────────

  'Counter-Attack': {
    description: 'Strikes first when charged.',
    hooks: {
      // Engine checks this flag before determining strike order in resolveMelee.
      // When defender has Counter-Attack, defender strikes first.
    },
  },

  'Counter-Attack Aura': {
    description: 'This model and its unit get Counter-Attack.',
    hooks: {},
  },

  // ── Melee Shrouding ───────────────────────────────────────────────────────

  'Melee Shrouding': {
    description: 'Enemies get -3" movement when trying to charge this unit.',
    hooks: {
      // Applied by the engine when calculating charge distance.
      // Engine checks target.special_rules for Melee Shrouding and reduces charger move by 3".
    },
  },

  'Melee Shrouding Aura': {
    description: 'This model and its unit get Melee Shrouding.',
    hooks: {},
  },

  // ── Strafing ──────────────────────────────────────────────────────────────

  Strafing: {
    description: 'Once per activation, when this model moves through enemy units, attack one with this weapon as if shooting.',
    hooks: {
      // Applied by the engine during movement resolution for Aircraft units.
      // Engine checks for Strafing weapon on move-through and triggers a free attack.
    },
  },

  // ── Precision Spotter ─────────────────────────────────────────────────────

  'Precision Spotter': {
    description: 'Once per activation, pick one enemy within 36" LOS and roll one die — on 4+ place a marker. Friendlies remove markers before rolling to hit for +X to hit.',
    hooks: {
      // Engine sets target.precision_markers += 1 on a 4+ roll.
      // BEFORE_HIT_QUALITY hook for the shooter reads unit._precisionTarget and applies bonus.
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, target, quality, specialRulesApplied }) => {
        if (!target || !unit._precisionTarget) return {};
        const markers = target.precision_markers ?? 0;
        if (markers <= 0 || unit._precisionTarget !== target.id) return {};
        // Consume markers
        target.precision_markers = 0;
        specialRulesApplied.push({ rule: 'Precision Spotter', value: markers, effect: `removed ${markers} marker(s) → quality -${markers}` });
        return { quality: Math.max(2, quality - markers) };
      },
    },
  },

  // ── Piercing Shooting Mark ────────────────────────────────────────────────

  'Piercing Shooting Mark': {
    description: 'Once per activation, pick one enemy within 18" — friendlies get AP(+1) when shooting against it.',
    hooks: {
      // Engine sets target.piercing_shooting_ap_bonus = 1.
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, isMelee, specialRulesApplied }) => {
        if (isMelee || !target) return {};
        const bonus = target?.piercing_shooting_ap_bonus ?? 0;
        if (bonus <= 0) return {};
        const newAp = (ap ?? 0) + bonus;
        specialRulesApplied.push({ rule: 'Piercing Shooting Mark', value: bonus, effect: `+AP(${bonus}) from mark (shooting) → AP(${newAp})` });
        return { ap: newAp };
      },
    },
  },

  // ── Ambush Beacon ─────────────────────────────────────────────────────────

  'Ambush Beacon': {
    description: 'Friendly units using Ambush may ignore distance restrictions from enemies if deployed within 6" of this model.',
    hooks: {
      // Applied by the engine during reserve entry — checks if a friendly Ambush Beacon
      // unit is within 6" of the desired entry point and skips the 9" enemy distance check.
    },
  },

  // ── Increased Shooting Range ──────────────────────────────────────────────

  'Increased Shooting Range': {
    description: '+6" to weapon range when shooting.',
    hooks: {
      [HOOKS.BEFORE_RANGE_CHECK]: ({ specialRulesApplied }) => {
        specialRulesApplied.push({ rule: 'Increased Shooting Range', value: 6, effect: '+6" weapon range' });
        return { effectiveRangeBonus: 6 };
      },
    },
  },

  'Increased Shooting Range Aura': {
    description: 'This model and its unit get +6" range when shooting.',
    hooks: {},
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // DARK ELF RAIDERS RULES — added from Dark Elf Raiders v3.5.2
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Army-Wide: Harassing ─────────────────────────────────────────────────
  // Identical in effect to Hit & Run — 3" move after shooting or melee.
  // Registered separately so army books can reference it by name.

  Harassing: {
    description: 'Once per round, may move up to 3" after shooting or being in melee.',
    hooks: {
      [HOOKS.AFTER_COMBAT]: ({ unit, specialRulesApplied }) => {
        if (unit._harassingUsed) return {};
        specialRulesApplied.push({ rule: 'Harassing', value: null, effect: 'may move up to 3" (once per round)' });
        return { hitAndRunMove: 3 };
      },
      [HOOKS.AFTER_SHOOTING]: ({ unit, specialRulesApplied }) => {
        if (unit._harassingUsed) return {};
        specialRulesApplied.push({ rule: 'Harassing', value: null, effect: 'may move up to 3" after shooting (once per round)' });
        return { hitAndRunMove: 3 };
      },
    },
  },

  'Harassing Boost': {
    description: 'May move up to 6" from Harassing instead of 3".',
    hooks: {
      [HOOKS.AFTER_COMBAT]: ({ unit, specialRulesApplied }) => {
        if (unit._harassingUsed) return {};
        specialRulesApplied.push({ rule: 'Harassing Boost', value: null, effect: 'may move up to 6" (once per round)' });
        return { hitAndRunMove: 6 };
      },
      [HOOKS.AFTER_SHOOTING]: ({ unit, specialRulesApplied }) => {
        if (unit._harassingUsed) return {};
        specialRulesApplied.push({ rule: 'Harassing Boost', value: null, effect: 'may move up to 6" after shooting (once per round)' });
        return { hitAndRunMove: 6 };
      },
    },
  },

  'Harassing Boost Aura': {
    description: 'This model and its unit get Harassing Boost.',
    hooks: {},
  },

  // ── Lacerate ──────────────────────────────────────────────────────────────

  Lacerate: {
    description: 'When attacking, target must re-roll unmodified defense results of 6.',
    hooks: {
      [HOOKS.ON_PER_HIT]: ({ saveRoll, dice, modifiedDefense, specialRulesApplied }) => {
        // saveRoll of 6 on an unmodified defense roll must be re-rolled
        if (saveRoll !== 6) return {};
        const reroll = dice.roll();
        specialRulesApplied.push({ rule: 'Lacerate', value: null, effect: `defense 6 re-rolled (${saveRoll}→${reroll})` });
        // If re-roll also >= modifiedDefense it's still a save; otherwise it fails
        return { rerollResult: reroll, saveSuccess: reroll >= modifiedDefense };
      },
    },
  },

  // ── Melee Evasion ─────────────────────────────────────────────────────────

  'Melee Evasion': {
    description: 'Enemies get -1 to hit rolls in melee when attacking this unit.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ isMelee, quality, specialRulesApplied }) => {
        if (!isMelee) return {};
        specialRulesApplied.push({ rule: 'Melee Evasion', value: null, effect: 'enemy -1 to hit in melee (quality +1)' });
        return { quality: Math.min(6, quality + 1) };
      },
    },
  },

  // ── Melee Slayer ──────────────────────────────────────────────────────────

  'Melee Slayer': {
    description: 'Melee weapons get AP(+2) against units where most models have Tough(3) or higher.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, isMelee, specialRulesApplied }) => {
        if (!isMelee || !target) return {};
        const sr = Array.isArray(target.special_rules)
          ? target.special_rules.join(' ')
          : (target.special_rules || '');
        const m = sr.match(/Tough\((\d+)\)/);
        if (!m || parseInt(m[1]) < 3) return {};
        const newAp = (ap ?? 0) + 2;
        specialRulesApplied.push({ rule: 'Melee Slayer', value: null, effect: `+AP(2) vs Tough(${m[1]}) target (melee) → AP(${newAp})` });
        return { ap: newAp };
      },
    },
  },

  // ── Piercing Hunter ───────────────────────────────────────────────────────

  'Piercing Hunter': {
    description: 'When shooting at enemies over 9" away, weapons get AP(+1).',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, target, ap, isMelee, specialRulesApplied, calculateDistance }) => {
        if (isMelee || !target || !calculateDistance) return {};
        const dist = calculateDistance(unit, target);
        if (dist <= 9) return {};
        const newAp = (ap ?? 0) + 1;
        specialRulesApplied.push({ rule: 'Piercing Hunter', value: null, effect: `+AP(1) at ${dist.toFixed(1)}" range → AP(${newAp})` });
        return { ap: newAp };
      },
    },
  },

  'Piercing Hunter Aura': {
    description: 'This model and its unit get Piercing Hunter.',
    hooks: {},
  },

  // ── Courage Aura ──────────────────────────────────────────────────────────

  'Courage Aura': {
    description: '+1 to morale test rolls for this model and its unit.',
    hooks: {
      [HOOKS.ON_MORALE_TEST]: ({ roll, threshold, specialRulesApplied }) => {
        specialRulesApplied.push({ rule: 'Courage Aura', value: null, effect: '+1 to morale roll' });
        return { roll: (roll ?? 0) + 1 };
      },
    },
  },

  'Furious Aura': {
    description: 'This model and its unit get Furious.',
    hooks: {},
  },

  // ── Martial Prowess ───────────────────────────────────────────────────────

  'Martial Prowess': {
    description: 'Once per game, may activate again even if already activated this round. Only up to half the army\'s units with this rule may use it in a single round.',
    hooks: {},
    // Engine needs to:
    // - Track unit._martialProwessUsed (once per game)
    // - Track gameState._martialProwessUsedThisRound count
    // - Allow re-activation when triggered by AI/player
    // - Clear the round counter at end of round
  },

  // ── Ruinous Frenzy ────────────────────────────────────────────────────────

  'Ruinous Frenzy': {
    description: 'Gain one marker when fully destroying an enemy unit. Each marker gives +1 to hit and +1 defense (max +2).',
    hooks: {
      // Engine sets unit.ruinous_frenzy_markers when an enemy unit is destroyed.
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, specialRulesApplied }) => {
        const markers = Math.min(2, unit.ruinous_frenzy_markers ?? 0);
        if (markers <= 0) return {};
        specialRulesApplied.push({ rule: 'Ruinous Frenzy', value: markers, effect: `+${markers} to hit rolls` });
        return { quality: Math.max(2, quality - markers) };
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, defense, specialRulesApplied }) => {
        const markers = Math.min(2, unit.ruinous_frenzy_markers ?? 0);
        if (markers <= 0) return {};
        specialRulesApplied.push({ rule: 'Ruinous Frenzy', value: markers, effect: `+${markers} to defense rolls` });
        return { defense: Math.max(2, (defense ?? 6) - markers) };
      },
    },
  },

  // ── Regeneration Buff ─────────────────────────────────────────────────────

  'Regeneration Buff': {
    description: 'Once per activation, pick one friendly unit within 12" — it gets Regeneration once.',
    hooks: {},
    // Applied as a unit buff by the engine/AI: target.regeneration_buff_active = true for one combat.
  },

  // ── Regenerative Strength ─────────────────────────────────────────────────

  'Regenerative Strength': {
    description: 'Gain one marker each time a wound is ignored. In melee, one weapon gets +X attacks where X is marker count.',
    hooks: {
      // Engine increments unit.regenerative_strength_markers when Regeneration ignores a wound.
      // Engine applies bonus attacks to one melee weapon at activation start.
    },
  },

  // ── Precision Fighting Mark ───────────────────────────────────────────────

  'Precision Fighting Mark': {
    description: 'Once per activation, pick one enemy within 18" — friendlies get +1 to hit in melee against it.',
    hooks: {
      // Engine sets target.precision_fighting_marked = true.
      [HOOKS.BEFORE_HIT_QUALITY]: ({ target, isMelee, quality, specialRulesApplied }) => {
        if (!isMelee || !target?.precision_fighting_marked) return {};
        specialRulesApplied.push({ rule: 'Precision Fighting Mark', value: null, effect: '+1 to hit in melee vs marked target' });
        return { quality: Math.max(2, quality - 1) };
      },
    },
  },

  // ── Speed Boost ───────────────────────────────────────────────────────────
  // Used as an upgrade ("Dark-Sails") on skimmer units — functions like Fast.

  'Speed Boost': {
    description: '+2" on Advance, +4" on Rush/Charge.',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ action, specialRulesApplied }) => {
        const delta = action === 'Advance' ? 2 : 4;
        specialRulesApplied.push({ rule: 'Speed Boost', value: delta, effect: `+${delta}" movement` });
        return { speedDelta: delta };
      },
    },
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // DWARF GUILDS RULES — added from Dwarf Guilds v3.5.2
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Army-Wide: Sturdy ─────────────────────────────────────────────────────

  Sturdy: {
    description: 'When shot or charged from over 9" away, get +1 to defense rolls.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ attackDistance, defense, specialRulesApplied }) => {
        if (attackDistance == null || attackDistance <= 9) return {};
        specialRulesApplied.push({ rule: 'Sturdy', value: null, effect: `defense +1 (attacked from ${attackDistance.toFixed(1)}")` });
        return { defense: Math.max(2, (defense ?? 6) - 1) };
      },
    },
  },

  'Sturdy Boost': {
    description: 'Always get +1 to defense rolls from Sturdy, regardless of distance.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ defense, specialRulesApplied }) => {
        specialRulesApplied.push({ rule: 'Sturdy Boost', value: null, effect: 'defense +1 (always)' });
        return { defense: Math.max(2, (defense ?? 6) - 1) };
      },
    },
  },

  'Sturdy Boost Aura': {
    description: 'This model and its unit get Sturdy Boost.',
    hooks: {},
  },

  // ── Quake ─────────────────────────────────────────────────────────────────

  Quake: {
    description: 'Ignores Regeneration. On unmodified 1s to block hits, deals 1 extra wound.',
    hooks: {
      [HOOKS.ON_PER_HIT]: ({ saveRoll, specialRulesApplied }) => {
        if (saveRoll !== 1) return {};
        specialRulesApplied.push({ rule: 'Quake', value: null, effect: 'unmodified 1 to save — +1 extra wound' });
        return { extraWounds: 1 };
      },
      [HOOKS.ON_INCOMING_WOUNDS]: ({ specialRulesApplied }) => {
        // Signal to suppress Regeneration for this hit
        specialRulesApplied.push({ rule: 'Quake', value: null, effect: 'Regeneration suppressed' });
        return { suppressRegeneration: true };
      },
    },
  },

  'Quake when Shooting': {
    description: 'This model gets Quake when shooting.',
    hooks: {
      [HOOKS.ON_PER_HIT]: ({ saveRoll, isMelee, specialRulesApplied }) => {
        if (isMelee || saveRoll !== 1) return {};
        specialRulesApplied.push({ rule: 'Quake when Shooting', value: null, effect: 'unmodified 1 to save — +1 extra wound (shooting)' });
        return { extraWounds: 1, suppressRegeneration: true };
      },
    },
  },

  // ── Swift ─────────────────────────────────────────────────────────────────

  Swift: {
    description: 'This model may ignore the Slow rule.',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ unit, speedDelta, specialRulesApplied }) => {
        // If Slow applied a -2 or -4 penalty, cancel it out
        const hasSlow = (unit.special_rules || '').includes('Slow');
        if (!hasSlow || (speedDelta ?? 0) >= 0) return {};
        specialRulesApplied.push({ rule: 'Swift', value: null, effect: 'Slow penalty cancelled' });
        return { speedDelta: 0 };
      },
    },
  },

  'Swift Aura': {
    description: 'This model and its unit get Swift.',
    hooks: {},
  },

  // ── Unpredictable (all attacks, not just melee) ───────────────────────────

  Unpredictable: {
    description: 'When attacking, roll one die: 1-3 get AP(+1), 4-6 get +1 to hit.',
    hooks: {
      // Engine rolls once at activation start and sets unit._unpredictableRoll (same field as Unpredictable Fighter).
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, specialRulesApplied }) => {
        const roll = unit._unpredictableRoll;
        if (roll == null || roll < 4) return {};
        specialRulesApplied.push({ rule: 'Unpredictable', value: null, effect: `rolled ${roll}: +1 to hit` });
        return { quality: Math.max(2, quality - 1) };
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, ap, specialRulesApplied }) => {
        const roll = unit._unpredictableRoll;
        if (roll == null || roll >= 4) return {};
        specialRulesApplied.push({ rule: 'Unpredictable', value: null, effect: `rolled ${roll}: AP+1` });
        return { ap: (ap ?? 0) + 1 };
      },
    },
  },

  'Unpredictable Fighter Aura': {
    description: 'This model and its unit get Unpredictable Fighter.',
    hooks: {},
  },

  // ── Devastating Frenzy ────────────────────────────────────────────────────
  // Like Ruinous Frenzy but gives AP+1 and defense+1 per marker (max +2).

  'Devastating Frenzy': {
    description: 'Gain one marker when fully destroying an enemy unit. Each marker gives AP(+1) and +1 defense (max +2).',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, ap, defense, specialRulesApplied }) => {
        const markers = Math.min(2, unit.devastating_frenzy_markers ?? 0);
        if (markers <= 0) return {};
        const newAp = (ap ?? 0) + markers;
        const newDef = Math.max(2, (defense ?? 6) - markers);
        specialRulesApplied.push({ rule: 'Devastating Frenzy', value: markers, effect: `AP+${markers}, defense+${markers} (${markers} kill marker(s))` });
        return { ap: newAp, defense: newDef };
      },
    },
  },

  // ── Ignores Cover ─────────────────────────────────────────────────────────

  'Ignores Cover when Shooting': {
    description: 'Ranged attacks ignore cover bonuses.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ isMelee, specialRulesApplied }) => {
        if (isMelee) return {};
        specialRulesApplied.push({ rule: 'Ignores Cover when Shooting', value: null, effect: 'cover ignored' });
        return { ignoresCover: true };
      },
    },
  },

  'Ignores Cover when Shooting Aura': {
    description: 'This model and its unit get Ignores Cover when shooting.',
    hooks: {},
  },

  // ── Mend ──────────────────────────────────────────────────────────────────

  Mend: {
    description: 'Once per activation, pick one friendly Tough model within 3" and remove D3 wounds from it.',
    hooks: {},
    // Engine/AI: at activation start, check for nearby wounded friendly Tough units within 3" and apply D3 wound recovery.
    // unit._mendUsedThisActivation flag to enforce once-per-activation.
  },

  // ── Re-Position Artillery ─────────────────────────────────────────────────

  'Re-Position Artillery': {
    description: 'Once per activation, pick one friendly Artillery model within 6" — it may immediately move up to 9".',
    hooks: {},
    // Engine/AI: at activation start, find friendly Artillery unit within 6" and move it up to 9".
  },

  // ── Speed Debuff ──────────────────────────────────────────────────────────

  'Speed Debuff': {
    description: 'Once per activation, pick one enemy within 18" — it moves -2" on Advance and -4" on Rush/Charge until next activation.',
    hooks: {
      // Engine sets target.speed_debuff = true for one activation.
      [HOOKS.MODIFY_SPEED]: ({ unit, action, speedDelta, specialRulesApplied }) => {
        if (!unit.speed_debuff) return {};
        const penalty = action === 'Advance' ? -2 : -4;
        specialRulesApplied.push({ rule: 'Speed Debuff', value: penalty, effect: `${penalty}" movement penalty` });
        return { speedDelta: (speedDelta ?? 0) + penalty };
      },
    },
  },

  // ── Infiltrate Aura ───────────────────────────────────────────────────────

  'Infiltrate Aura': {
    description: 'This model and its unit get Infiltrate.',
    hooks: {},
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // HIGH ELF FLEETS RULES — added from High Elf Fleets v3.5.2
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Army-Wide: Highborn ───────────────────────────────────────────────────

  Highborn: {
    description: 'Moves +2" when using Advance, and +2" when using Rush/Charge.',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ action, speedDelta, specialRulesApplied }) => {
        const delta = action === 'Advance' ? 2 : 2; // +2" on both Advance and Rush/Charge
        specialRulesApplied.push({ rule: 'Highborn', value: delta, effect: `+${delta}" movement` });
        return { speedDelta: (speedDelta ?? 0) + delta };
      },
    },
  },

  'Highborn Boost': {
    description: 'If this model has Highborn, it moves +4" on Advance and +4" on Rush/Charge instead of +2".',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ action, speedDelta, specialRulesApplied }) => {
        // Overrides the Highborn +2 with +4 — net +2 more on top of base Highborn.
        // Engine should apply Highborn Boost instead of Highborn when both present.
        const delta = 4;
        specialRulesApplied.push({ rule: 'Highborn Boost', value: delta, effect: `+${delta}" movement (Highborn Boost)` });
        return { speedDelta: (speedDelta ?? 0) + delta };
      },
    },
  },

  'Highborn Boost Aura': {
    description: 'This model and its unit get Highborn Boost.',
    hooks: {},
  },

  // ── Crack ─────────────────────────────────────────────────────────────────

  Crack: {
    description: 'On unmodified results of 6 to hit, those hits get AP(+2).',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ hitRolls, ap, specialRulesApplied }) => {
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
          specialRulesApplied.push({ rule: 'Resistance', value: ignored, effect: `${ignored} wound(s) ignored (${isSpell ? '2+' : '6+'} vs ${isSpell ? 'spell' : 'normal'})` });
        }
        return { ignoredWounds: ignored };
      },
    },
  },

  'Resistance Aura': {
    description: 'This model and its unit get Resistance.',
    hooks: {},
  },

  // ── Shred in Melee ────────────────────────────────────────────────────────

  'Shred in Melee': {
    description: 'On unmodified results of 1 to block hits in melee, this weapon deals 1 extra wound.',
    hooks: {
      [HOOKS.ON_PER_HIT]: ({ saveRoll, isMelee, specialRulesApplied }) => {
        if (!isMelee || saveRoll !== 1) return {};
        specialRulesApplied.push({ rule: 'Shred in Melee', value: null, effect: 'unmodified 1 to save in melee — +1 extra wound' });
        return { extraWounds: 1 };
      },
    },
  },

  'Shred in Melee Aura': {
    description: 'This model and its unit get Shred in melee.',
    hooks: {},
  },

  // ── Scout Aura ────────────────────────────────────────────────────────────

  'Scout Aura': {
    description: 'This model and its unit get Scout.',
    hooks: {},
  },

  // ── Unpredictable Shooter ─────────────────────────────────────────────────

  'Unpredictable Shooter': {
    description: 'When shooting, roll one die: 1-3 get AP(+1), 4-6 get +1 to hit.',
    hooks: {
      // Engine sets unit._unpredictableShooterRoll at start of shooting activation.
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, weapon, quality, specialRulesApplied }) => {
        if ((weapon?.range ?? 0) <= 2) return {}; // melee weapon
        const roll = unit._unpredictableShooterRoll;
        if (roll == null || roll < 4) return {};
        specialRulesApplied.push({ rule: 'Unpredictable Shooter', value: null, effect: `rolled ${roll}: +1 to hit (shooting)` });
        return { quality: Math.max(2, quality - 1) };
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, weapon, ap, isMelee, specialRulesApplied }) => {
        if (isMelee) return {};
        const roll = unit._unpredictableShooterRoll;
        if (roll == null || roll >= 4) return {};
        specialRulesApplied.push({ rule: 'Unpredictable Shooter', value: null, effect: `rolled ${roll}: AP+1 (shooting)` });
        return { ap: (ap ?? 0) + 1 };
      },
    },
  },

  // ── Unwieldy ──────────────────────────────────────────────────────────────

  Unwieldy: {
    description: 'Strikes last when charging.',
    hooks: {},
    // Engine checks: if charger has Unwieldy → defender strikes first in that melee.
    // Opposite of Counter-Attack — same strike-order mechanism, opposite direction.
  },

  'Unwieldy Debuff': {
    description: 'Once per activation, pick one enemy within 18" — it gets Unwieldy in melee once.',
    hooks: {},
    // Engine/AI sets target.unwieldy_debuff_active = true.
    // resolveMelee checks target.unwieldy_debuff_active and applies Unwieldy for that combat.
  },

  // ── Piercing Spotter ──────────────────────────────────────────────────────

  'Piercing Spotter': {
    description: 'Once per activation, pick one enemy within 36" LOS, roll one die — on 4+ place a marker. Friendlies remove markers before rolling to block to get +AP(X) where X is markers removed.',
    hooks: {
      // Engine sets target.piercing_spotter_markers += 1 on a 4+ roll.
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, specialRulesApplied }) => {
        const markers = target?.piercing_spotter_markers ?? 0;
        if (markers <= 0) return {};
        // Consume markers
        target.piercing_spotter_markers = 0;
        const newAp = (ap ?? 0) + markers;
        specialRulesApplied.push({ rule: 'Piercing Spotter', value: markers, effect: `removed ${markers} marker(s) → +AP(${markers}) → AP(${newAp})` });
        return { ap: newAp };
      },
    },
  },

  // ── Crossing Attack(X) ────────────────────────────────────────────────────

  'Crossing Attack': {
    description: 'Once per activation, when this model moves through enemy units, pick one and roll X dice — each 6+ deals 1 hit.',
    hooks: {},
    // Engine handles during movement resolution (same branch as Strafing).
    // Rolls _ruleParamValue dice, counts 6s as hits, applies them to the chosen unit.
    // Complex — do separately with Strafing.
  },

  // ── Caster Group ─────────────────────────────────────────────────────────

  'Caster Group': {
    description: 'Pick one model in the unit to have Caster(X) where X equals the total number of models with this rule. On death, transfer spell tokens to another model.',
    hooks: {},
    // Complex engine feature — tracks group caster assignment, token transfer on death.
    // Do separately.
  },

  // ── Spell Conduit ─────────────────────────────────────────────────────────

  'Spell Conduit': {
    description: 'Friendly casters within 12" may cast as if from this model\'s position and get +1 to casting rolls.',
    hooks: {},
    // Engine: during spell casting, check if caster is within 12" of a Spell Conduit model.
    // If so, use Spell Conduit model position for range/LOS, and add +1 to cast roll.
    // Complex — do separately.
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // ALIEN HIVES RULES — added from Alien Hives v3.5.2
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Army-Wide: Hive Bond ──────────────────────────────────────────────────

  'Hive Bond': {
    description: 'Units where all models have this rule get +1 to morale test rolls.',
    hooks: {
      [HOOKS.ON_MORALE_TEST]: ({ roll, specialRulesApplied }) => {
        specialRulesApplied.push({ rule: 'Hive Bond', value: 1, effect: '+1 to morale roll' });
        return { roll: roll + 1 };
      },
    },
  },

  'Hive Bond Boost': {
    description: 'If all models have Hive Bond, get +2 to morale instead of +1.',
    hooks: {
      [HOOKS.ON_MORALE_TEST]: ({ roll, specialRulesApplied }) => {
        // Engine skips Hive Bond base if Hive Bond Boost present (same dedup pattern as Highborn/Boost).
        specialRulesApplied.push({ rule: 'Hive Bond Boost', value: 2, effect: '+2 to morale roll (Hive Bond Boost)' });
        return { roll: roll + 2 };
      },
    },
  },

  'Hive Bond Boost Aura': {
    description: 'This model and its unit get Hive Bond Boost.',
    hooks: {},
  },

  // ── Agile ─────────────────────────────────────────────────────────────────

  Agile: {
    description: 'Moves +1" on Advance, +2" on Rush/Charge.',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ action, speedDelta, specialRulesApplied }) => {
        const delta = action === 'Advance' ? 1 : 2;
        specialRulesApplied.push({ rule: 'Agile', value: delta, effect: `+${delta}" movement` });
        return { speedDelta: (speedDelta ?? 0) + delta };
      },
    },
  },

  // ── Rapid Charge / Aura ───────────────────────────────────────────────────

  'Rapid Charge': {
    description: 'Moves +4" when using Charge actions.',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ action, speedDelta, specialRulesApplied }) => {
        if (action !== 'Charge') return {};
        specialRulesApplied.push({ rule: 'Rapid Charge', value: 4, effect: '+4" charge distance' });
        return { speedDelta: (speedDelta ?? 0) + 4 };
      },
    },
  },

  'Rapid Charge Aura': {
    description: 'This model and its unit get Rapid Charge.',
    hooks: {},
  },

  // ── Precise ───────────────────────────────────────────────────────────────

  Precise: {
    description: 'Gets +1 to hit when attacking.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ quality, specialRulesApplied }) => {
        specialRulesApplied.push({ rule: 'Precise', value: 1, effect: '+1 to hit' });
        return { quality: Math.max(2, quality - 1) };
      },
    },
  },

  // ── Rupture ───────────────────────────────────────────────────────────────

  Rupture: {
    description: 'Ignores Regeneration. Unmodified 6 to hit that aren\'t blocked deal 1 extra wound.',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ hitRolls, specialRulesApplied }) => {
        const sixes = (hitRolls ?? []).filter(r => r === 6).length;
        if (sixes === 0) return {};
        specialRulesApplied.push({ rule: 'Rupture', value: sixes, effect: `${sixes} hit(s) on 6 — +1 wound if not blocked` });
        return { ruptureHits: sixes };
      },
      [HOOKS.ON_INCOMING_WOUNDS]: ({ isRupture, specialRulesApplied }) => {
        if (!isRupture) return {};
        specialRulesApplied.push({ rule: 'Rupture', value: null, effect: 'Regeneration suppressed' });
        return { suppressRegeneration: true };
      },
    },
    // Engine: after save roll fails on a rupture hit, deal +1 extra wound. Pass isRupture flag.
  },

  // ── Ravage(X) ─────────────────────────────────────────────────────────────

  Ravage: {
    description: 'When it\'s this model\'s turn to attack in melee, roll X dice. Each 6+ deals 1 wound on the target.',
    hooks: {
      [HOOKS.BEFORE_MELEE_ATTACK]: ({ unit, dice, specialRulesApplied }) => {
        const x = unit._ruleParamValue ?? 0;
        if (x <= 0) return {};
        let wounds = 0;
        for (let i = 0; i < x; i++) { if (dice.roll() >= 6) wounds++; }
        if (wounds > 0) {
          specialRulesApplied.push({ rule: 'Ravage', value: wounds, effect: `Ravage(${x}): ${wounds} free wound(s)` });
        }
        return { ravageWounds: wounds };
      },
    },
  },

  // ── Retaliate(X) ──────────────────────────────────────────────────────────

  Retaliate: {
    description: 'When this model takes a wound in melee, the attacker takes X hits.',
    hooks: {
      [HOOKS.ON_INCOMING_WOUNDS]: ({ wounds, unit, specialRulesApplied }) => {
        if ((wounds ?? 0) <= 0) return {};
        const x = unit._ruleParamValue ?? 1;
        specialRulesApplied.push({ rule: 'Retaliate', value: x, effect: `took wound → attacker takes ${x} hit(s)` });
        return { retaliateHits: x * wounds };
      },
    },
  },

  // ── Predator Fighter ──────────────────────────────────────────────────────

  'Predator Fighter': {
    description: 'Each unmodified 6 to hit in melee generates +1 attack with that weapon (no chain).',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ hitRolls, isMelee, specialRulesApplied }) => {
        if (!isMelee) return {};
        const sixes = (hitRolls ?? []).filter(r => r === 6).length;
        if (sixes === 0) return {};
        specialRulesApplied.push({ rule: 'Predator Fighter', value: sixes, effect: `${sixes} extra attack(s) from 6s (no chain)` });
        return { extraAttacks: sixes, noChainExtraAttacks: true };
      },
    },
  },

  // ── No Retreat ────────────────────────────────────────────────────────────

  'No Retreat': {
    description: 'When this unit fails a morale test causing Shaken/Routed, count as passed instead. Then roll dice equal to wounds needed to destroy it — each 1-3 deals 1 wound (can\'t be ignored).',
    hooks: {
      [HOOKS.ON_MORALE_TEST]: ({ testResult, unit, dice, specialRulesApplied }) => {
        if (testResult !== 'failed') return {};
        // Count remaining wounds for the roll
        const remainingWounds = unit.tough_remaining ?? 1;
        let selfWounds = 0;
        for (let i = 0; i < remainingWounds; i++) {
          if (dice.roll() <= 3) selfWounds++;
        }
        specialRulesApplied.push({ rule: 'No Retreat', value: selfWounds, effect: `morale failed → test passed, ${selfWounds} self-wound(s) (can't be ignored)` });
        return { overrideResult: 'passed', selfWounds, selfWoundsIgnorable: false };
      },
    },
  },

  // ── Piercing Growth ───────────────────────────────────────────────────────

  'Piercing Growth': {
    description: 'Gain one marker each round end while on table. Each marker gives AP(+1) (max +2). Lose all markers if Shaken.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, ap, specialRulesApplied }) => {
        const markers = Math.min(2, unit.piercing_growth_markers ?? 0);
        if (markers <= 0) return {};
        specialRulesApplied.push({ rule: 'Piercing Growth', value: markers, effect: `AP+${markers} (${markers} growth marker(s))` });
        return { ap: (ap ?? 0) + markers };
      },
    },
    // Engine: at round end, increment unit.piercing_growth_markers (max 2) for each on-table unit.
    // On Shaken: set unit.piercing_growth_markers = 0.
  },

  // ── Piercing Tag(X) ───────────────────────────────────────────────────────

  'Piercing Tag': {
    description: 'Once per game, place X markers on one enemy within 36" LOS. Friendlies remove markers for +AP(Y) where Y = markers removed.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, specialRulesApplied }) => {
        const markers = target?.piercing_tag_markers ?? 0;
        if (markers <= 0) return {};
        target.piercing_tag_markers = 0;
        specialRulesApplied.push({ rule: 'Piercing Tag', value: markers, effect: `removed ${markers} tag marker(s) → AP+${markers}` });
        return { ap: (ap ?? 0) + markers };
      },
    },
    // Engine/AI: once-per-game activation, set target.piercing_tag_markers = _ruleParamValue.
    // unit._piercingTagUsed flag to enforce once per game.
  },

  // ── Precision Debuff ──────────────────────────────────────────────────────

  'Precision Debuff': {
    description: 'Once per activation, pick one enemy within 18" — it gets -1 to hit once.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, specialRulesApplied }) => {
        if (!unit.precision_debuffed) return {};
        specialRulesApplied.push({ rule: 'Precision Debuff', value: -1, effect: '-1 to hit (debuffed)' });
        unit.precision_debuffed = false; // consume
        return { quality: Math.min(6, quality + 1) };
      },
    },
    // Engine/AI sets target.precision_debuffed = true on activation.
  },

  // ── Self-Destruct(X) ──────────────────────────────────────────────────────

  'Self-Destruct': {
    description: 'If killed in melee, attacker takes X hits. If it survives melee, it dies anyway and attacker takes X hits.',
    hooks: {},
    // Engine: in resolveMelee post-combat:
    // - If unit with Self-Destruct is destroyed: apply X hits to attacker (no save).
    // - If unit survives melee: kill it anyway, apply X hits to attacker.
    // X = _ruleParamValue.
  },

  // ── Breath Attack ─────────────────────────────────────────────────────────

  'Breath Attack': {
    description: 'Once per activation before attacking, roll one die. On 2+, one enemy within 6" LOS takes 1 hit with Blast(3) and AP(1).',
    hooks: {},
    // Engine/AI: at activation start, roll die, if 2+ pick nearest visible enemy within 6" and apply hit.
    // unit._breathAttackUsedThisActivation flag.
  },

  // ── Furious Buff ──────────────────────────────────────────────────────────

  'Furious Buff': {
    description: 'Once per activation, before attacking, pick one friendly unit within 12" — it gets Furious once.',
    hooks: {},
    // Engine/AI: at activation start, find best nearby friendly to buff with Furious.
    // Sets target.furious_buff_active = true for one attack phase.
  },

  // ── Stealth Buff ──────────────────────────────────────────────────────────

  'Stealth Buff': {
    description: 'Once per activation, before attacking, pick one friendly unit within 12" — it gets Stealth once.',
    hooks: {},
    // Engine/AI: sets target.stealth_buff_active = true for one round.
  },

  // ── Unpredictable Fighter Mark ────────────────────────────────────────────

  'Unpredictable Fighter Mark': {
    description: 'Once per activation, pick one enemy within 18" — friendlies get Unpredictable Fighter against it once.',
    hooks: {
      // BEFORE_HIT_QUALITY and BEFORE_SAVE_DEFENSE: check target.unpredictable_fighter_marked.
      // Engine/AI sets target.unpredictable_fighter_marked = true; engine clears after first attack.
      [HOOKS.BEFORE_HIT_QUALITY]: ({ target, unit, quality, specialRulesApplied }) => {
        if (!target?.unpredictable_fighter_marked) return {};
        const roll = unit._unpredictableFighterMarkRoll;
        if (roll == null || roll < 4) return {};
        specialRulesApplied.push({ rule: 'Unpredictable Fighter Mark', value: null, effect: `rolled ${roll}: +1 to hit vs marked target` });
        return { quality: Math.max(2, quality - 1) };
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, unit, ap, isMelee, specialRulesApplied }) => {
        if (!target?.unpredictable_fighter_marked) return {};
        const roll = unit._unpredictableFighterMarkRoll;
        if (roll == null || roll >= 4) return {};
        specialRulesApplied.push({ rule: 'Unpredictable Fighter Mark', value: null, effect: `rolled ${roll}: AP+1 vs marked target` });
        return { ap: (ap ?? 0) + 1 };
      },
    },
  },

  // ── Hit & Run Fighter ─────────────────────────────────────────────────────

  'Hit & Run Fighter': {
    description: 'Once per round, may move up to 3" after being in melee.',
    hooks: {
      [HOOKS.AFTER_COMBAT]: ({ isMelee, specialRulesApplied }) => {
        if (!isMelee) return {};
        specialRulesApplied.push({ rule: 'Hit & Run Fighter', value: 3, effect: '3" move after melee' });
        return { hitAndRunMove: 3 };
      },
    },
  },

  // ── Shielded Aura ─────────────────────────────────────────────────────────

  'Shielded Aura': {
    description: 'This model and its unit get Shielded.',
    hooks: {},
  },

  // ── Takedown Strike ───────────────────────────────────────────────────────

  'Takedown Strike': {
    description: 'Once per game in melee, make one attack at Quality 2+, AP(2), Deadly(3) targeting one model, resolved as unit of 1.',
    hooks: {},
    // Engine/AI: once per game, during melee, may substitute one attack with Takedown Strike profile.
    // unit._takedownStrikeUsed flag.
    // Complex — do separately.
  },

  // ── Spawn ─────────────────────────────────────────────────────────────────

  Spawn: {
    description: 'Once per game when activated, place a new unit of X fully within 6".',
    hooks: {},
    // Complex — requires unit instantiation during gameplay.
    // Engine: once per game activation, create unit from _ruleParamUnit type, place within 6".
    // unit._spawnUsed flag.
    // Do separately.
  },

  // ── Surprise Attack(X) ────────────────────────────────────────────────────

  'Surprise Attack': {
    description: 'Counts as Infiltrate. On deployment, roll X dice — each 4+ deals 2 hits AP(1) to one enemy within 3".',
    hooks: {},
    // Engine: on reserve entry, roll _ruleParamValue dice, count 4+, apply hits to visible enemies within 3".
    // Same phase as Ambush Beacon check.
  },
};
