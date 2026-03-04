/**
 * rules/opr-rules-elven-jesters.js
 * Elven Jesters faction rules from v3.5.2
 */
import { HOOKS } from '../RuleRegistry.js';

export const ELVEN_JESTERS_RULES = {
  // Army-wide
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
  'Rapid Blink': {
    description: 'When activated, place all models anywhere within 3" of their position.',
    hooks: {
      [HOOKS.BEFORE_ACTIVATION]: ({ unit, specialRulesApplied }) => {
        if (!unit._rapidBlinkUsed) {
          unit._rapidBlinkUsed = true;
          specialRulesApplied.push({ rule: 'Rapid Blink', effect: 'may reposition up to 3"' });
          return { rapidBlink: 3 };
        }
        return {};
      },
      [HOOKS.AFTER_ACTIVATION]: ({ unit }) => {
        delete unit._rapidBlinkUsed;
      },
    },
  },

  // Special rules
  'Ambush Re-Deployment': {
    description: 'Once per game, after activation, remove unit and deploy it as Ambush at the start of next round.',
    hooks: {
      [HOOKS.AFTER_ACTIVATION]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._ambushReDeployUsed) return {};
        unit._ambushReDeployUsed = true;
        unit.is_in_reserve = true; // remove from table
        unit.reserveType = 'Ambush';
        // The engine will deploy it at the start of next round via normal Ambush rules.
        specialRulesApplied.push({ rule: 'Ambush Re-Deployment', effect: 'unit returns to reserve' });
        return { removeFromTable: true };
      },
    },
  },

  'Counter-Attack': {
    description: 'Strikes first when charged.',
    hooks: {
      [HOOKS.ON_STRIKE_ORDER]: ({ defender, specialRulesApplied }) => {
        if (defender.rules.includes('Counter-Attack')) {
          specialRulesApplied.push({ rule: 'Counter-Attack', effect: 'defender strikes first' });
          return { attackerFirst: false };
        }
        return {};
      },
    },
  },

  Fragment: {
    description: 'Ignores cover. Against Defense 2+ to 4+, gets AP(+1).',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, specialRulesApplied }) => {
        const defense = target?.defense ?? 6;
        if (defense >= 2 && defense <= 4) {
          specialRulesApplied.push({ rule: 'Fragment', effect: 'AP+1 vs Defense 2-4' });
          return { ap: (ap ?? 0) + 1, ignoresCover: true };
        }
        return { ignoresCover: true };
      },
    },
  },

  'Point-Blank Surge': {
    description: 'When shooting within 12", unmodified 6 to hit deals 1 extra hit.',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ hitRolls, attackDistance, isMelee, successes, specialRulesApplied }) => {
        if (isMelee || (attackDistance ?? Infinity) > 12) return {};
        const sixes = (hitRolls ?? []).filter(r => r === 6).length;
        if (sixes === 0) return {};
        specialRulesApplied.push({ rule: 'Point-Blank Surge', value: sixes, effect: `${sixes} extra hits` });
        return { successes: successes + sixes };
      },
    },
  },

  'Rapid Blink Boost': {
    description: 'If this model has Rapid Blink, it may be placed within 6" instead of 3".',
    hooks: {
      [HOOKS.BEFORE_ACTIVATION]: ({ unit, specialRulesApplied }) => {
        if (unit.special_rules.includes('Rapid Blink') && !unit._rapidBlinkBoostUsed) {
          unit._rapidBlinkBoostUsed = true;
          specialRulesApplied.push({ rule: 'Rapid Blink Boost', effect: 'may reposition up to 6"' });
          return { rapidBlink: 6 };
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

  Slayer: {
    description: 'Weapons get AP(+2) against units where most models have Tough(3) or higher.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, specialRulesApplied }) => {
        if (!target) return {};
        const sr = Array.isArray(target.special_rules)
          ? target.special_rules.join(' ')
          : (target.special_rules || '');
        const m = sr.match(/Tough\((\d+)\)/);
        if (!m || parseInt(m[1]) < 3) return {};
        specialRulesApplied.push({ rule: 'Slayer', effect: '+AP(2) vs Tough target' });
        return { ap: (ap ?? 0) + 2 };
      },
    },
  },

  'Slayer Mark': {
    description: 'Once per activation, mark an enemy; friendlies get Slayer against it once.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._slayerMarkUsed) return {};
        const target = gameState.units.find(u => u.owner !== unit.owner && u.distanceTo(unit) <= 18);
        if (target) {
          target.slayer_marked = true;
          unit._slayerMarkUsed = true;
          specialRulesApplied.push({ rule: 'Slayer Mark', effect: `marked ${target.name}` });
        }
        return {};
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, specialRulesApplied }) => {
        if (target?.slayer_marked) {
          delete target.slayer_marked;
          specialRulesApplied.push({ rule: 'Slayer Mark', effect: '+AP(2) from mark' });
          return { ap: (ap ?? 0) + 2 };
        }
        return {};
      },
    },
  },

  'Takedown Strike': {
    description: 'Once per game in melee, make one attack at Quality 2+, AP(2), Deadly(3) targeting one model.',
    hooks: {
      [HOOKS.BEFORE_MELEE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._takedownStrikeUsed) return {};
        const enemy = gameState.units.find(u => u.owner !== unit.owner && u.distanceTo(unit) <= 1);
        if (enemy) {
          unit._takedownStrikeUsed = true;
          specialRulesApplied.push({ rule: 'Takedown Strike', effect: `attack on ${enemy.name}` });
          return { specialAttack: { target: enemy, quality: 2, ap: 2, deadly: 3 } };
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

  'Unpredictable Fighter': {
    description: 'When in melee, roll die: 1-3 AP+1, 4-6 +1 to hit.',
    hooks: {
      [HOOKS.BEFORE_MELEE_ATTACK]: ({ unit, dice, specialRulesApplied }) => {
        if (!unit._unpredictableRolled) {
          unit._unpredictableRoll = dice.roll();
          unit._unpredictableRolled = true;
          const effect = unit._unpredictableRoll <= 3 ? 'AP+1' : '+1 to hit';
          specialRulesApplied.push({ rule: 'Unpredictable Fighter', effect: `rolled ${unit._unpredictableRoll}: ${effect}` });
        }
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, isMelee, specialRulesApplied }) => {
        if (!isMelee) return {};
        if (unit._unpredictableRoll && unit._unpredictableRoll >= 4) {
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, ap, isMelee, specialRulesApplied }) => {
        if (!isMelee) return {};
        if (unit._unpredictableRoll && unit._unpredictableRoll <= 3) {
          return { ap: (ap ?? 0) + 1 };
        }
        return {};
      },
      [HOOKS.AFTER_MELEE_ATTACK]: ({ unit }) => {
        delete unit._unpredictableRolled;
        delete unit._unpredictableRoll;
      },
    },
  },

  // Auras
  'Rapid Blink Boost Aura': {
    description: 'This model and its unit get Rapid Blink Boost.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Rapid Blink Boost Aura')) {
          return { additionalRules: ['Rapid Blink Boost'] };
        }
        return {};
      },
    },
  },
  'Shielded Aura': {
    description: 'This model and its unit get Shielded.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Shielded Aura')) {
          return { additionalRules: ['Shielded'] };
        }
        return {};
      },
    },
  },
  'Shred when Shooting Aura': {
    description: 'This model and its unit get Shred when shooting.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Shred when Shooting Aura')) {
          return { additionalRules: ['Shred'] };
        }
        return {};
      },
    },
  },
  'Teleport Aura': {
    description: 'This model and its unit get Teleport.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Teleport Aura')) {
          return { additionalRules: ['Teleport'] };
        }
        return {};
      },
    },
  },
  'Unpredictable Fighter Aura': {
    description: 'This model and its unit get Unpredictable Fighter.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Unpredictable Fighter Aura')) {
          return { additionalRules: ['Unpredictable Fighter'] };
        }
        return {};
      },
    },
  },

  // Army spells
  'Asphyxiating Fog': {
    description: 'Pick one friendly unit within 12" which gets Counter-Attack once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          target._tempCounterAttack = true;
          specialRulesApplied.push({ rule: 'Asphyxiating Fog', effect: `gave Counter-Attack to ${target.name}` });
        }
      },
    },
  },
  'Blades of Discord': {
    description: 'Pick one enemy unit within 6" which takes 1 hit with AP(2) and Deadly(3).',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Blades of Discord', effect: `1 hit AP2 Deadly3 on ${target.name}` });
          return { extraHits: [{ target, count: 1, ap: 2, deadly: 3 }] };
        }
      },
    },
  },
  'Shadow Dance': {
    description: 'Pick up to two friendly units within 12" which get Rapid Blink Boost once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u => u.owner === caster.owner && u.distanceTo(caster) <= 12).slice(0, 2);
        friendlies.forEach(u => u._tempRapidBlinkBoost = true);
        specialRulesApplied.push({ rule: 'Shadow Dance', effect: `gave Rapid Blink Boost to ${friendlies.length} units` });
      },
    },
  },
  'Light Fragments': {
    description: 'Pick one enemy unit within 12" which takes 4 hits with AP(1) and Fragment.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Light Fragments', effect: `4 hits AP1 Fragment on ${target.name}` });
          return { extraHits: [{ target, count: 4, ap: 1, fragment: true }] };
        }
      },
    },
  },
  'Veil of Madness': {
    description: 'Pick up to three enemy units within 18" which get Slayer mark once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const enemies = gameState.units.filter(u => u.owner !== caster.owner && u.distanceTo(caster) <= 18).slice(0, 3);
        enemies.forEach(u => u.slayer_marked = true);
        specialRulesApplied.push({ rule: 'Veil of Madness', effect: `marked ${enemies.length} units` });
      },
    },
  },
  'Fatal Sorrow': {
    description: 'Pick one enemy unit within 18" which takes 6 hits.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Fatal Sorrow', effect: `6 hits on ${target.name}` });
          return { extraHits: [{ target, count: 6, ap: 0 }] };
        }
      },
    },
  },
};
