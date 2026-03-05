/**
 * rules/opr-rules-jackals.js
 * Jackals faction rules from v3.5.2
 */
import { HOOKS } from '../RuleRegistry.js';

export const JACKALS_RULES = {
  // Army-wide
  Scrapper: {
    description: 'Targets must re-roll unmodified Defense results of 6 when blocking hits.',
    hooks: {
      [HOOKS.ON_PER_HIT]: ({ saveRoll, dice, modifiedDefense, specialRulesApplied }) => {
        if (saveRoll === 6) {
          const reroll = dice.roll();
          specialRulesApplied.push({ rule: 'Scrapper', effect: `save 6 re-rolled (${saveRoll}→${reroll})` });
          return { rerollResult: reroll, saveSuccess: reroll >= modifiedDefense };
        }
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

  'Crossing Attack': {
    description: 'Once per activation, when moving through enemies, pick one and roll X dice; each 6+ deals 1 hit.',
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

  'Crossing Strike': {
    description: 'Once per game, when moving through enemies, pick one and roll X dice; each 4+ deals 3 hits with AP(1).',
    hooks: {
      [HOOKS.ON_MOVE_THROUGH_ENEMY]: ({ unit, enemyUnit, dice, specialRulesApplied }) => {
        if (unit._crossingStrikeUsed) return {};
        const x = unit._ruleParamValue ?? 1;
        let successes = 0;
        for (let i = 0; i < x; i++) {
          if (dice.roll() >= 4) successes++;
        }
        if (successes > 0) {
          unit._crossingStrikeUsed = true;
          const hits = successes * 3;
          specialRulesApplied.push({ rule: 'Crossing Strike', effect: `${hits} hits on ${enemyUnit.name}` });
          return { extraHits: [{ target: enemyUnit, count: hits, ap: 1 }] };
        }
        return {};
      },
    },
  },

  Destructive: {
    description: 'Unmodified 6 to hit get AP(+4).',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ hitRolls, specialRulesApplied }) => {
        const sixes = (hitRolls ?? []).filter(r => r === 6).length;
        if (sixes === 0) return {};
        specialRulesApplied.push({ rule: 'Destructive', value: sixes, effect: `${sixes} hits gain AP+4` });
        return { crackHits: sixes, crackApBonus: 4 };
      },
    },
  },

  Fortified: {
    description: 'Hits count as AP(-1), min AP(0).',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ defender, ap, specialRulesApplied }) => {
        if ((defender.special_rules || '').includes('Fortified') && ap > 0) {
          const newAp = Math.max(0, ap - 1);
          specialRulesApplied.push({ rule: 'Fortified', effect: `AP ${ap}→${newAp}` });
          return { ap: newAp };
        }
        return {};
      },
    },
  },

  'Melee Evasion': {
    description: 'Enemies get -1 to hit in melee when attacking this unit.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ isMelee, target, quality, specialRulesApplied }) => {
        if (isMelee && target?.rules?.includes('Melee Evasion')) {
          specialRulesApplied.push({ rule: 'Melee Evasion', effect: '-1 to hit in melee' });
          return { quality: Math.min(6, quality + 1) };
        }
        return {};
      },
    },
  },

  'Morale Debuff': {
    description: 'Once per activation, give an enemy -1 to morale tests once.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._moraleDebuffUsed) return {};
        const target = gameState.units.find(u => u.owner !== unit.owner && Math.hypot(u.x - unit.x, u.y - unit.y) <= 18);
        if (target) {
          target.morale_debuff = true;
          unit._moraleDebuffUsed = true;
          specialRulesApplied.push({ rule: 'Morale Debuff', effect: `gave -1 morale to ${target.name}` });
        }
        return {};
      },
      [HOOKS.ON_MORALE_TEST]: ({ unit, roll, specialRulesApplied }) => {
        if (unit.morale_debuff) {
          delete unit.morale_debuff;
          specialRulesApplied.push({ rule: 'Morale Debuff', effect: '-1 to morale' });
          return { roll: roll - 1 };
        }
        return {};
      },
    },
  },

  Precise: {
    description: '+1 to hit when attacking.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ quality, specialRulesApplied }) => {
        specialRulesApplied.push({ rule: 'Precise', effect: '+1 to hit' });
        return { quality: Math.max(2, quality - 1) };
      },
    },
  },

  'Precision Tag': {
    description: 'Once per game, place X markers on an enemy. Friendlies remove markers before rolling to hit for +Y to hit.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._precisionTagUsed) return {};
        const x = unit._ruleParamValue ?? 2; // default? from unit data
        const target = gameState.units.find(u => u.owner !== unit.owner && Math.hypot(u.x - unit.x, u.y - unit.y) <= 36);
        if (target) {
          target.precision_tag_markers = (target.precision_tag_markers || 0) + x;
          unit._precisionTagUsed = true;
          specialRulesApplied.push({ rule: 'Precision Tag', effect: `placed ${x} markers on ${target.name}` });
        }
        return {};
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ target, quality, specialRulesApplied }) => {
        const markers = target?.precision_tag_markers ?? 0;
        if (markers <= 0) return {};
        target.precision_tag_markers = 0;
        specialRulesApplied.push({ rule: 'Precision Tag', value: markers, effect: `+${markers} to hit` });
        return { quality: Math.max(2, quality - markers) };
      },
    },
  },

  'Ranged Shrouding': {
    description: 'Enemies get -6" range when shooting this unit.',
    hooks: {
      [HOOKS.ON_RANGE_CHECK]: ({ target, range, specialRulesApplied }) => {
        if (target?.rules?.includes('Ranged Shrouding')) {
          specialRulesApplied.push({ rule: 'Ranged Shrouding', effect: '-6" range' });
          return { range: range - 6 };
        }
        return {};
      },
    },
  },

  'Repel Ambushers': {
    description: 'Enemy Ambush must be >12" from this unit.',
    hooks: {
      [HOOKS.ON_RESERVE_ENTRY]: ({ unit, gameState }) => {
        const repellors = gameState.units.filter(u => u.owner !== unit.owner && (u.special_rules || '').includes('Repel Ambushers'));
        if (repellors.length > 0) {
          return { minDistance: 12 };
        }
        return {};
      },
    },
  },

  'Scrapper Boost': {
    description: 'Scrapper forces re-roll on defense 5-6 instead of only 6.',
    hooks: {
      // This rule modifies Scrapper; we'll let Scrapper check for this rule.
      // So this rule is just a marker.
    },
  },

  Scratch: {
    description: 'Against Tough(3-9), gets AP(+2).',
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
          specialRulesApplied.push({ rule: 'Scratch', effect: `+AP(2) vs Tough(${toughVal})` });
          return { ap: (ap ?? 0) + 2 };
        }
        return {};
      },
    },
  },

  Shielded: {
    description: '+1 defense against non-spell hits.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ isSpell, defense, specialRulesApplied }) => {
        if (isSpell) return {};
        specialRulesApplied.push({ rule: 'Shielded', effect: '+1 defense' });
        return { defense: Math.max(2, defense - 1) };
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

  'Surprise Piercing Shot': {
    description: 'Counts as Ambush, and gets AP(+2) when shooting on the round it deploys.',
    hooks: {
      [HOOKS.ON_DEPLOY]: () => ({ isReserve: true, reserveType: 'SurprisePiercing' }),
      [HOOKS.ON_RESERVE_ENTRY]: ({ unit, gameState }) => {
        // Place as Ambush (≥9" from enemies)
        const enemies = gameState.units.filter(u => u.owner !== unit.owner && u.current_models > 0);
        for (let attempts = 0; attempts < 100; attempts++) {
          const x = Math.random() * 50 + 5;
          const y = Math.random() * 36 + 12;
          if (!enemies.some(e => Math.hypot(e.x - x, e.y - y) < 9)) {
            unit._surprisePiercingActive = true; // flag for AP bonus this round
            return { x, y };
          }
        }
        unit._surprisePiercingActive = true;
        return { x: 30, y: 30 };
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, ap, specialRulesApplied }) => {
        if (unit._surprisePiercingActive) {
          delete unit._surprisePiercingActive;
          specialRulesApplied.push({ rule: 'Surprise Piercing Shot', effect: 'AP+2' });
          return { ap: (ap ?? 0) + 2 };
        }
        return {};
      },
    },
  },

  Unpredictable: {
    description: 'When attacking, roll die: 1-3 AP+1, 4-6 +1 to hit.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, dice, specialRulesApplied }) => {
        if (!unit._unpredictableRolled) {
          unit._unpredictableRoll = dice.roll();
          unit._unpredictableRolled = true;
          const effect = unit._unpredictableRoll <= 3 ? 'AP+1' : '+1 to hit';
          specialRulesApplied.push({ rule: 'Unpredictable', effect: `rolled ${unit._unpredictableRoll}: ${effect}` });
        }
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, specialRulesApplied }) => {
        if (unit._unpredictableRoll && unit._unpredictableRoll >= 4) {
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, ap, specialRulesApplied }) => {
        if (unit._unpredictableRoll && unit._unpredictableRoll <= 3) {
          return { ap: (ap ?? 0) + 1 };
        }
        return {};
      },
      [HOOKS.AFTER_ATTACK]: ({ unit }) => {
        delete unit._unpredictableRolled;
        delete unit._unpredictableRoll;
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
  'Precision Fighter Aura': {
    description: '+1 to hit in melee.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, isMelee, quality, specialRulesApplied }) => {
        if (isMelee && unit.special_rules.includes('Precision Fighter Aura')) {
          specialRulesApplied.push({ rule: 'Precision Fighter Aura', effect: '+1 to hit' });
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
    },
  },
  'Ranged Shrouding Aura': {
    description: 'This model and its unit get Ranged Shrouding.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Ranged Shrouding Aura')) {
          return { additionalRules: ['Ranged Shrouding'] };
        }
        return {};
      },
    },
  },
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
  // Scrapper Boost modifies Scrapper; we'll let Scrapper check for this flag.
        // We'll need to pass it to the attacker. We'll use a temporary property.
        // This is tricky because the boost is on the target (the friendly unit), not on the attacker.
        // Actually, Scrapper Boost applies to the unit that has it, so when that unit attacks, it should have the boost.
        // So we should set a flag on the target unit that will be checked in Scrapper hook.
        // We'll implement in Scrapper hook to check for _tempScrapperBoost on the attacker.
        // But Scrapper hook is called when the attacker's weapon hits and the defender rolls saves.
        // So we need the attacker to have the flag. We'll set it on the target (which is the friendly unit) when spell is cast.
        // Then when that unit attacks, it should have the flag. We'll need to persist it until its next attack.
        // We'll handle in Scrapper hook by checking if attacker._tempScrapperBoost is true, and then modify the reroll threshold.
  'Scrapper Boost Aura': {
    description: 'This model and its unit get Scrapper Boost.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Scrapper Boost Aura')) {
          return { additionalRules: ['Scrapper Boost'] };
        }
        return {};
      },
    },
  },
  'Unpredictable Shooter Aura': {
    description: 'This model and its unit get Unpredictable Shooter.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Unpredictable Shooter Aura')) {
          return { additionalRules: ['Unpredictable Shooter'] };
        }
        return {};
      },
    },
  },

  // Army spells
  'Psy-Hunter': {
    description: 'Pick one friendly unit within 12" which gets Scrapper Boost once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          target._tempScrapperBoost = true;
          specialRulesApplied.push({ rule: 'Psy-Hunter', effect: `gave Scrapper Boost to ${target.name}` });
        }
      },
      [HOOKS.ON_PER_HIT]: ({ saveRoll, dice, modifiedDefense, specialRulesApplied }) => {
        return {};
      },
    },
  },
  'Power Maw': {
    description: 'Pick up to two enemy units within 12" which take 1 hit with AP(2) each.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const enemies = gameState.units.filter(u => u.owner !== caster.owner && Math.hypot(u.x - caster.x, u.y - caster.y) <= 12).slice(0, 2);
        const extraHits = enemies.map(e => ({ target: e, count: 1, ap: 2 }));
        specialRulesApplied.push({ rule: 'Power Maw', effect: `1 hit AP2 on ${enemies.length} units` });
        return { extraHits };
      },
    },
  },
  'Mind Shaper': {
    description: 'Pick up to two enemy units within 18" which get -1 to morale once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const enemies = gameState.units.filter(u => u.owner !== caster.owner && Math.hypot(u.x - caster.x, u.y - caster.y) <= 18).slice(0, 2);
        enemies.forEach(u => u.morale_debuff = true);
        specialRulesApplied.push({ rule: 'Mind Shaper', effect: `gave -1 morale to ${enemies.length} units` });
      },
    },
  },
  'Quill Blast': {
    description: 'Pick one enemy unit within 12" which takes 4 hits with Scratch.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Quill Blast', effect: `4 hits with Scratch on ${target.name}` });
          return { extraHits: [{ target, count: 4, ap: 0, scratch: true }] };
        }
      },
    },
  },
  'Power Field': {
    description: 'Pick up to three friendly units within 12" which get Shielded once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u => u.owner === caster.owner && Math.hypot(u.x - caster.x, u.y - caster.y) <= 12).slice(0, 3);
        friendlies.forEach(u => u._tempShielded = true);
        specialRulesApplied.push({ rule: 'Power Field', effect: `gave Shielded to ${friendlies.length} units` });
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, isSpell, defense, specialRulesApplied }) => {
        if (unit._tempShielded && !isSpell) {
          delete unit._tempShielded;
          specialRulesApplied.push({ rule: 'Shielded', effect: '+1 defense' });
          return { defense: Math.max(2, defense - 1) };
        }
        return {};
      },
    },
  },
  'Feral Strike': {
    description: 'Pick one enemy unit within 6" which takes 3 hits with AP(2) and Deadly(3).',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Feral Strike', effect: `3 hits AP2 Deadly3 on ${target.name}` });
          return { extraHits: [{ target, count: 3, ap: 2, deadly: 3 }] };
        }
      },
    },
  },
};
