/**
 * rules/opr-rules-human-inquisition.js
 * Human Inquisition faction rules from v3.5.2
 */
import { HOOKS } from '../RuleRegistry.js';

export const HUMAN_INQUISITION_RULES = {
  // Army-wide
  'Inquisitorial Agent': {
    description: 'Once per game, may activate again this round (max half the army).',
    hooks: {
      // This rule requires tracking at game level. We'll handle it in BEFORE_ATTACK.
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._inquisitorialAgentUsed) return {};
        const totalWithRule = gameState.units.filter(u => u.owner === unit.owner && u.rules.includes('Inquisitorial Agent')).length;
        const usedCount = gameState._inquisitorialAgentCount || 0;
        if (usedCount >= Math.ceil(totalWithRule / 2)) return {};
        // Check if unit has already activated this round
        if (!gameState.units_activated.includes(unit.id)) return {};
        unit._inquisitorialAgentUsed = true;
        gameState._inquisitorialAgentCount = (gameState._inquisitorialAgentCount || 0) + 1;
        // Remove from activated set to allow reactivation
        gameState.units_activated = gameState.units_activated.filter(id => id !== unit.id);
        specialRulesApplied.push({ rule: 'Inquisitorial Agent', effect: 'may activate again' });
        return {};
      },
    },
  },

  // Special rules
  Bounding: {
    description: 'When activated, place all models anywhere within D3+1" of their position.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, dice, specialRulesApplied }) => {
        if (unit._boundingUsed) return {};
        const dist = dice.roll() + 1; // D3+1
        unit._boundingUsed = true;
        specialRulesApplied.push({ rule: 'Bounding', effect: `may move up to ${dist}"` });
        return { boundingMove: dist };
      },
    },
  },

  'Brutal Fighter': {
    description: 'In melee, unmodified 6 to hit deal 1 extra hit.',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ rolls, successes, isMelee, specialRulesApplied }) => {
        if (!isMelee) return {};
        const sixes = rolls.filter(r => r.value === 6 && r.success && !r.auto).length;
        if (sixes === 0) return {};
        specialRulesApplied.push({ rule: 'Brutal Fighter', value: sixes, effect: `${sixes} extra hits` });
        return { successes: successes + sixes };
      },
    },
  },

  'Caster Group': {
    description: 'Pick one model to have Caster(X) where X = total models with this rule. Transfer tokens on death.',
    hooks: {
      [HOOKS.ON_UNIT_CREATED]: ({ unit }) => {
        if (unit.rules.includes('Caster Group')) {
          unit.casterModel = 0;
          unit.casterTokens = unit.currentModels;
        }
      },
      [HOOKS.ON_MODEL_KILLED]: ({ unit, modelIndex }) => {
        if (unit.rules.includes('Caster Group') && modelIndex === unit.casterModel) {
          const newCaster = unit.models.findIndex((m, i) => i !== modelIndex);
          if (newCaster !== -1) {
            unit.casterModel = newCaster;
          }
        }
      },
      [HOOKS.ON_ROUND_END]: ({ unit }) => {
        if (unit.rules.includes('Caster Group')) {
          unit.casterTokens = 0;
        }
      },
    },
  },

  'Casting Debuff': {
    description: 'Once per activation, give an enemy Caster -1 to casting once.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._castingDebuffUsed) return {};
        const target = gameState.units.find(u => u.owner !== unit.owner && u.rules.some(r => r.includes('Caster')) && u.distanceTo(unit) <= 18);
        if (target) {
          target.casting_debuff = (target.casting_debuff || 0) + 1;
          unit._castingDebuffUsed = true;
          specialRulesApplied.push({ rule: 'Casting Debuff', effect: `gave -1 casting to ${target.name}` });
        }
        return {};
      },
      [HOOKS.ON_SPELL_CAST]: ({ caster, specialRulesApplied }) => {
        if (caster.casting_debuff) {
          delete caster.casting_debuff;
          specialRulesApplied.push({ rule: 'Casting Debuff', effect: '-1 to cast' });
          return { castModifier: -1 };
        }
        return {};
      },
    },
  },

  'Defensive Growth': {
    description: 'Gain one marker each round on table; each gives +1 defense (max +2). Lose all if Shaken.',
    hooks: {
      [HOOKS.ON_ROUND_END]: ({ unit }) => {
        if (unit.rules.includes('Defensive Growth') && !unit.reserve && unit.current_models > 0) {
          unit.defensive_growth_markers = Math.min(2, (unit.defensive_growth_markers || 0) + 1);
        }
      },
      [HOOKS.ON_MORALE_TEST]: ({ unit, passed }) => {
        if (unit.rules.includes('Defensive Growth') && !passed) {
          unit.defensive_growth_markers = 0;
        }
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, defense, specialRulesApplied }) => {
        const markers = Math.min(2, unit.defensive_growth_markers ?? 0);
        if (markers <= 0) return {};
        specialRulesApplied.push({ rule: 'Defensive Growth', value: markers, effect: `+${markers} defense` });
        return { defense: Math.max(2, defense - markers) };
      },
    },
  },

  'Delayed Action': {
    description: 'Once per round, if opponent has more units left to activate, this unit may pass its turn (may be activated later).',
    hooks: {
      [HOOKS.BEFORE_ACTIVATION]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._delayedActionUsed) return {};
        const myRemaining = gameState.units.filter(u => u.owner === unit.owner && !u.hasActivated).length;
        const oppRemaining = gameState.units.filter(u => u.owner !== unit.owner && !u.hasActivated).length;
        if (oppRemaining > myRemaining) {
          unit._delayedActionUsed = true;
          specialRulesApplied.push({ rule: 'Delayed Action', effect: 'passes activation' });
          return { passActivation: true };
        }
        return {};
      },
    },
  },

  Evasive: {
    description: 'Enemies get -1 to hit when attacking this unit.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ target, quality, specialRulesApplied }) => {
        if (target?.rules?.includes('Evasive')) {
          specialRulesApplied.push({ rule: 'Evasive', effect: '-1 to hit' });
          return { quality: Math.min(6, quality + 1) };
        }
        return {};
      },
    },
  },

  Fortified: {
    description: 'Hits count as AP(-1), min AP(0).',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ defender, ap, specialRulesApplied }) => {
        if (defender.rules.includes('Fortified') && ap > 0) {
          const newAp = Math.max(0, ap - 1);
          specialRulesApplied.push({ rule: 'Fortified', effect: `AP ${ap}→${newAp}` });
          return { ap: newAp };
        }
        return {};
      },
    },
  },

  'Hit & Run': {
    description: 'Once per round, move up to 3" after shooting or melee.',
    hooks: {
      [HOOKS.AFTER_SHOOTING]: ({ unit, specialRulesApplied }) => {
        if (unit._hitAndRunUsed) return {};
        unit._hitAndRunUsed = true;
        specialRulesApplied.push({ rule: 'Hit & Run', effect: 'may move 3" after shooting' });
        return { hitAndRunMove: 3 };
      },
      [HOOKS.AFTER_MELEE]: ({ unit, specialRulesApplied }) => {
        if (unit._hitAndRunUsed) return {};
        unit._hitAndRunUsed = true;
        specialRulesApplied.push({ rule: 'Hit & Run', effect: 'may move 3" after melee' });
        return { hitAndRunMove: 3 };
      },
    },
  },

  Infiltrate: {
    description: 'Ambush, but may deploy up to 1" away from enemies.',
    hooks: {
      [HOOKS.ON_DEPLOY]: () => ({ isReserve: true, reserveType: 'Infiltrate' }),
      [HOOKS.ON_RESERVE_ENTRY]: ({ unit, gameState }) => {
        const enemies = gameState.units.filter(u => u.owner !== unit.owner && u.current_models > 0);
        for (let attempts = 0; attempts < 100; attempts++) {
          const x = Math.random() * 50 + 5;
          const y = Math.random() * 36 + 12;
          if (!enemies.some(e => Math.hypot(e.x - x, e.y - y) <= 1)) {
            return { x, y };
          }
        }
        return { x: 30, y: 30 };
      },
    },
  },

  'Piercing Tag': {
    description: 'Once per game, place X markers on an enemy. Friendlies get +AP(Y) when attacking it.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._piercingTagUsed) return {};
        const x = unit._ruleParamValue ?? 1;
        const target = gameState.units.find(u => u.owner !== unit.owner && u.distanceTo(unit) <= 36);
        if (target) {
          target.piercing_tag_markers = (target.piercing_tag_markers || 0) + x;
          unit._piercingTagUsed = true;
          specialRulesApplied.push({ rule: 'Piercing Tag', effect: `placed ${x} markers on ${target.name}` });
        }
        return {};
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, specialRulesApplied }) => {
        const markers = target?.piercing_tag_markers ?? 0;
        if (markers <= 0) return {};
        target.piercing_tag_markers = 0;
        specialRulesApplied.push({ rule: 'Piercing Tag', value: markers, effect: `+AP(${markers})` });
        return { ap: (ap ?? 0) + markers };
      },
    },
  },

  Protected: {
    description: 'On a 6+, ignore a wound.',
    hooks: {
      [HOOKS.ON_INCOMING_WOUNDS]: ({ wounds, dice, specialRulesApplied }) => {
        let ignored = 0;
        for (let i = 0; i < wounds; i++) {
          if (dice.roll() >= 6) ignored++;
        }
        if (ignored > 0) {
          specialRulesApplied.push({ rule: 'Protected', effect: `${ignored}/${wounds} ignored` });
          return { wounds: wounds - ignored };
        }
        return {};
      },
    },
  },

  'Quick Readjustment': {
    description: 'Ignores penalties from shooting after moving when using Indirect.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, weapon, quality, specialRulesApplied }) => {
        if (weapon?.rules?.includes('Indirect') && unit.justMoved) {
          specialRulesApplied.push({ rule: 'Quick Readjustment', effect: 'ignores moving penalty' });
          // The penalty is usually +1 to quality; we can cancel it by not applying the penalty.
          // The engine applies penalty elsewhere; we can return a quality adjustment to counteract.
          // For simplicity, we'll return a quality modifier of -1 to cancel the +1 from moving.
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
    },
  },

  'Repel Ambushes': {
    description: 'Enemy Ambush must be >12" from this unit.',
    hooks: {
      [HOOKS.ON_RESERVE_ENTRY]: ({ unit, gameState }) => {
        const repellors = gameState.units.filter(u => u.owner !== unit.owner && u.rules.includes('Repel Ambushes'));
        if (repellors.length > 0) {
          return { minDistance: 12 };
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

  'Spell Accumulator': {
    description: 'Gets X tokens per round, max 6. Friendly casters within 12" may spend them as their own.',
    hooks: {
      [HOOKS.ON_TOKEN_GAIN]: ({ _ruleParamValue, currentTokens, specialRulesApplied }) => {
        const gain = _ruleParamValue ?? 1;
        const after = Math.min(6, (currentTokens ?? 0) + gain);
        specialRulesApplied.push({ rule: 'Spell Accumulator', value: gain, effect: `gained ${after - (currentTokens ?? 0)} tokens` });
        return { tokens: after };
      },
      // Friendly casters can spend these tokens; we need to modify spell casting.
      // We'll handle in ON_SPELL_CAST by checking for nearby Accumulators.
      [HOOKS.ON_SPELL_CAST]: ({ caster, spell, gameState, specialRulesApplied }) => {
        const accumulators = gameState.units.filter(u => u.owner === caster.owner && u.rules.includes('Spell Accumulator') && u.distanceTo(caster) <= 12 && u.spell_tokens > 0);
        if (accumulators.length > 0) {
          // Use tokens from accumulator instead of caster's own? Actually they can spend accumulator tokens.
          // We'll allow caster to use accumulator tokens. For simplicity, we'll use the first accumulator.
          const acc = accumulators[0];
          if (acc.spell_tokens >= spell.cost) {
            acc.spell_tokens -= spell.cost;
            specialRulesApplied.push({ rule: 'Spell Accumulator', effect: 'used accumulator tokens' });
            return { tokensUsed: spell.cost, fromAccumulator: true };
          }
        }
        return {};
      },
    },
  },

  'Spell Conduit': {
    description: 'Friendly casters within 12" may cast as if from this model\'s position and get +1.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, spell, target, gameState, specialRulesApplied }) => {
        const conduit = gameState.units.find(u => u.owner === caster.owner && u.rules.includes('Spell Conduit') && u.distanceTo(caster) <= 12);
        if (conduit) {
          specialRulesApplied.push({ rule: 'Spell Conduit', effect: 'cast from conduit, +1' });
          return { castModifier: 1, castPosition: conduit };
        }
        return {};
      },
    },
  },

  Surge: {
    description: 'Unmodified 6 to hit deal 1 extra hit.',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ rolls, successes, specialRulesApplied }) => {
        const sixes = rolls.filter(r => r.value === 6 && r.success && !r.auto).length;
        if (sixes === 0) return {};
        specialRulesApplied.push({ rule: 'Surge', effect: `${sixes} extra hits` });
        return { successes: successes + sixes };
      },
    },
  },

  'Surprise Attack': {
    description: 'Counts as Infiltrate. On deployment, roll X dice; each 4+ deals 2 hits AP(1) to one enemy within 3".',
    hooks: {
      [HOOKS.ON_DEPLOY]: () => ({ isReserve: true, reserveType: 'Surprise' }),
      [HOOKS.ON_RESERVE_ENTRY]: ({ unit, gameState, dice, specialRulesApplied }) => {
        // Place unit as per Infiltrate
        const enemies = gameState.units.filter(u => u.owner !== unit.owner && u.current_models > 0);
        let placed = false;
        for (let attempts = 0; attempts < 100; attempts++) {
          const x = Math.random() * 50 + 5;
          const y = Math.random() * 36 + 12;
          if (!enemies.some(e => Math.hypot(e.x - x, e.y - y) <= 1)) {
            unit.x = x; unit.y = y;
            placed = true;
            break;
          }
        }
        if (!placed) { unit.x = 30; unit.y = 30; }

        const x = unit._ruleParamValue ?? 2; // Surprise Attack(2) is default for Espionage Assassin
        let hits = 0;
        for (let i = 0; i < x; i++) {
          if (dice.roll() >= 4) hits++;
        }
        if (hits > 0) {
          const nearby = gameState.units.filter(u => u.owner !== unit.owner && u.distanceTo(unit) <= 3);
          if (nearby.length > 0) {
            const target = nearby[0];
            specialRulesApplied.push({ rule: 'Surprise Attack', effect: `2 hits on ${target.name}` });
            return { extraHits: [{ target, count: hits * 2, ap: 1 }] };
          }
        }
        return {};
      },
    },
  },

  Teleport: {
    description: 'Once per activation, before attacking, place this model anywhere within 6".',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, specialRulesApplied }) => {
        if (unit._teleportUsed) return {};
        unit._teleportUsed = true;
        specialRulesApplied.push({ rule: 'Teleport', effect: 'may teleport up to 6"' });
        return { teleportMove: 6 };
      },
    },
  },

  'Unpredictable Shooter': {
    description: 'When shooting, roll die: 1-3 AP+1, 4-6 +1 to hit.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, dice, specialRulesApplied }) => {
        if (!unit._unpredictableShooterRolled) {
          unit._unpredictableShooterRoll = dice.roll();
          unit._unpredictableShooterRolled = true;
          const effect = unit._unpredictableShooterRoll <= 3 ? 'AP+1' : '+1 to hit';
          specialRulesApplied.push({ rule: 'Unpredictable Shooter', effect: `rolled ${unit._unpredictableShooterRoll}: ${effect}` });
        }
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, weapon, quality, isMelee, specialRulesApplied }) => {
        if (isMelee) return {};
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

  // Auras
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
  'Courage Aura': {
    description: '+1 to morale test rolls.',
    hooks: {
      [HOOKS.ON_MORALE_TEST]: ({ unit, roll, specialRulesApplied }) => {
        if (unit.rules.includes('Courage Aura')) {
          specialRulesApplied.push({ rule: 'Courage Aura', effect: '+1 to morale' });
          return { roll: roll + 1 };
        }
        return {};
      },
    },
  },
  'Defensive Growth Aura': {
    description: 'This model and its unit get Defensive Growth.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.rules.includes('Defensive Growth Aura')) {
          return { additionalRules: ['Defensive Growth'] };
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
  'Precision Fighter Aura': {
    description: '+1 to hit in melee.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, isMelee, quality, specialRulesApplied }) => {
        if (isMelee && unit.rules.includes('Precision Fighter Aura')) {
          specialRulesApplied.push({ rule: 'Precision Fighter Aura', effect: '+1 to hit' });
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
    },
  },
  'Precision Shooter Aura': {
    description: '+1 to hit when shooting.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, weapon, quality, isMelee, specialRulesApplied }) => {
        if (!isMelee && (weapon?.range ?? 0) > 2 && unit.rules.includes('Precision Shooter Aura')) {
          specialRulesApplied.push({ rule: 'Precision Shooter Aura', effect: '+1 to hit' });
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
    },
  },
  'Regeneration Aura': {
    description: 'This model and its unit get Regeneration.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.rules.includes('Regeneration Aura')) {
          return { additionalRules: ['Regeneration'] };
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
  'Shred in Melee Aura': {
    description: 'This model and its unit get Shred in melee.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.rules.includes('Shred in Melee Aura')) {
          return { additionalRules: ['Shred'] };
        }
        return {};
      },
    },
  },
  'Stealth Aura': {
    description: 'This model and its unit get Stealth.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.rules.includes('Stealth Aura')) {
          return { additionalRules: ['Stealth'] };
        }
        return {};
      },
    },
  },

  // Army spells (same as HDF but with different names? Actually they are similar but not identical)
  // From PDF page 3:
  'Psy-Injected Courage': {
    description: 'Pick one friendly unit within 12" which gets +1 to morale once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          target._tempMoraleBonus = 1;
          specialRulesApplied.push({ rule: 'Psy-Injected Courage', effect: `gave +1 morale to ${target.name}` });
        }
      },
      [HOOKS.ON_MORALE_TEST]: ({ unit, roll, specialRulesApplied }) => {
        if (unit._tempMoraleBonus) {
          delete unit._tempMoraleBonus;
          specialRulesApplied.push({ rule: 'Psy-Injected Courage', effect: '+1 to morale' });
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
        if (target) {
          specialRulesApplied.push({ rule: 'Electric Tempest', effect: `2 hits AP1 Surge on ${target.name}` });
          return { extraHits: [{ target, count: 2, ap: 1, surge: true }] };
        }
      },
    },
  },
  'Calculated Foresight': {
    description: 'Pick up to two enemy units within 18" which get Relentless mark once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const enemies = gameState.units.filter(u => u.owner !== caster.owner && u.distanceTo(caster) <= 18).slice(0, 2);
        enemies.forEach(u => u.relentless_marked = true);
        specialRulesApplied.push({ rule: 'Calculated Foresight', effect: `marked ${enemies.length} units` });
      },
    },
  },
  'Searing Burst': {
    description: 'Pick one enemy unit within 12" which takes 6 hits.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Searing Burst', effect: `6 hits on ${target.name}` });
          return { extraHits: [{ target, count: 6, ap: 0 }] };
        }
      },
    },
  },
  'Shock Speed': {
    description: 'Pick up to three friendly units within 12" which get +2" Advance and +4" Rush/Charge once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u => u.owner === caster.owner && u.distanceTo(caster) <= 12).slice(0, 3);
        friendlies.forEach(u => {
          u._tempAdvanceBonus = 2;
          u._tempRushChargeBonus = 4;
        });
        specialRulesApplied.push({ rule: 'Shock Speed', effect: `gave speed bonus to ${friendlies.length} units` });
      },
      [HOOKS.MODIFY_SPEED]: ({ unit, action, speedDelta, specialRulesApplied }) => {
        if (action === 'Advance' && unit._tempAdvanceBonus) {
          const bonus = unit._tempAdvanceBonus;
          delete unit._tempAdvanceBonus;
          specialRulesApplied.push({ rule: 'Shock Speed', effect: `+${bonus}"` });
          return { speedDelta: (speedDelta ?? 0) + bonus };
        }
        if ((action === 'Rush' || action === 'Charge') && unit._tempRushChargeBonus) {
          const bonus = unit._tempRushChargeBonus;
          delete unit._tempRushChargeBonus;
          specialRulesApplied.push({ rule: 'Shock Speed', effect: `+${bonus}"` });
          return { speedDelta: (speedDelta ?? 0) + bonus };
        }
        return {};
      },
    },
  },
  'Expel Threat': {
    description: 'Pick one enemy model within 18" which takes 6 hits with AP(1).',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Expel Threat', effect: `6 hits AP1 on ${target.name}` });
          return { extraHits: [{ target, count: 6, ap: 1 }] };
        }
      },
    },
  },
};
