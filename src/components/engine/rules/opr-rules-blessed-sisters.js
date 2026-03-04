/**
 * rules/opr-rules-blessed-sisters.js
 * Blessed Sisters faction rules from v3.5.2
 */
import { HOOKS } from '../RuleRegistry.js';

export const BLESSED_SISTERS_RULES = {
  // Army-wide
  Devout: {
    description: 'Unmodified 6 to hit deals 1 extra hit (no chain).',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ hitRolls, unit, specialRulesApplied }) => {
        const threshold = unit.hasRule?.('Devout Boost') ? 5 : 6;
        const extraHits = (hitRolls ?? []).filter(r => r >= threshold).length;
        if (extraHits === 0) return {};
        specialRulesApplied.push({ rule: 'Devout', value: extraHits, effect: `${extraHits} extra hits` });
        return { extraHits, extraHitsCountAsSix: false };
      },
    },
  },

  'Devout Boost': {
    description: 'Devout triggers on 5-6 instead of only 6.',
    hooks: {
      // This is just a marker; Devout hook checks for it.
    },
  },

  'Devout Boost Aura': {
    description: 'This model and its unit get Devout Boost.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Devout Boost Aura')) {
          return { additionalRules: ['Devout Boost'] };
        }
        return {};
      },
    },
  },

  Guarded: {
    description: 'When shot or charged from >9", +1 defense.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ attackDistance, defense, specialRulesApplied }) => {
        if ((attackDistance ?? 0) <= 9) return {};
        specialRulesApplied.push({ rule: 'Guarded', effect: '+1 defense' });
        return { defense: Math.max(2, defense - 1) };
      },
    },
  },

  'Guarded Buff': {
    description: 'Once per activation, give one friendly unit Guarded once.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._guardedBuffUsed) return {};
        const friendly = gameState.units.find(u => u.owner === unit.owner && u !== unit && u.distanceTo(unit) <= 12);
        if (friendly) {
          friendly._tempGuarded = true;
          unit._guardedBuffUsed = true;
          specialRulesApplied.push({ rule: 'Guarded Buff', effect: `gave Guarded to ${friendly.name}` });
        }
        return {};
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, defense, attackDistance, specialRulesApplied }) => {
        if (unit._tempGuarded && (attackDistance ?? 0) > 9) {
          delete unit._tempGuarded;
          specialRulesApplied.push({ rule: 'Guarded Buff', effect: '+1 defense' });
          return { defense: Math.max(2, defense - 1) };
        }
        return {};
      },
    },
  },

  'Piercing Assault': {
    description: 'AP+1 when charging.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ isCharging, ap, specialRulesApplied }) => {
        if (!isCharging) return {};
        specialRulesApplied.push({ rule: 'Piercing Assault', effect: 'AP+1' });
        return { ap: (ap ?? 0) + 1 };
      },
    },
  },

  'Piercing Hunter': {
    description: 'When shooting >9", AP+1.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ attackDistance, isMelee, ap, specialRulesApplied }) => {
        if (isMelee || (attackDistance ?? 0) <= 9) return {};
        specialRulesApplied.push({ rule: 'Piercing Hunter', effect: 'AP+1' });
        return { ap: (ap ?? 0) + 1 };
      },
    },
  },

  'Point-Blank Piercing': {
    description: 'When shooting within 12", AP+1.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ attackDistance, isMelee, ap, specialRulesApplied }) => {
        if (isMelee || (attackDistance ?? Infinity) > 12) return {};
        specialRulesApplied.push({ rule: 'Point-Blank Piercing', effect: 'AP+1' });
        return { ap: (ap ?? 0) + 1 };
      },
    },
  },

  'Point-Blank Piercing Aura': {
    description: 'This model and its unit get Point-Blank Piercing.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Point-Blank Piercing Aura')) {
          return { additionalRules: ['Point-Blank Piercing'] };
        }
        return {};
      },
    },
  },

  'Point-Blank Surge': {
    description: 'When shooting within 12", unmodified 6 to hit deals 1 extra hit.',
    hooks: {
      [HOOKS.AFTER_HIT_ROLLS]: ({ hitRolls, attackDistance, isMelee, specialRulesApplied }) => {
        if (isMelee || (attackDistance ?? Infinity) > 12) return {};
        const sixes = (hitRolls ?? []).filter(r => r === 6).length;
        if (sixes === 0) return {};
        specialRulesApplied.push({ rule: 'Point-Blank Surge', value: sixes, effect: `${sixes} extra hits` });
        return { extraHits: sixes, extraHitsCountAsSix: false };
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

  'Courage Buff': {
    description: 'Once per activation, give a friendly unit +1 to morale once.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._courageBuffUsed) return {};
        const friendly = gameState.units.find(u => u.owner === unit.owner && u !== unit && u.distanceTo(unit) <= 12);
        if (friendly) {
          friendly._courageBuff = true;
          unit._courageBuffUsed = true;
          specialRulesApplied.push({ rule: 'Courage Buff', effect: `gave +1 morale to ${friendly.name}` });
        }
        return {};
      },
      [HOOKS.ON_MORALE_TEST]: ({ unit, roll, specialRulesApplied }) => {
        if (unit._courageBuff) {
          delete unit._courageBuff;
          specialRulesApplied.push({ rule: 'Courage Buff', effect: '+1 to morale' });
          return { roll: roll + 1 };
        }
        return {};
      },
    },
  },

  'Courage Aura': {
    description: '+1 to morale for this model and its unit.',
    hooks: {
      [HOOKS.ON_MORALE_TEST]: ({ unit, roll, specialRulesApplied }) => {
        if (unit.special_rules.includes('Courage Aura')) {
          specialRulesApplied.push({ rule: 'Courage Aura', effect: '+1 to morale' });
          return { roll: roll + 1 };
        }
        return {};
      },
    },
  },

  'Precision Shooter Buff': {
    description: 'Once per activation, give a friendly unit +1 to hit when shooting once.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._precisionShooterBuffUsed) return {};
        const friendly = gameState.units.find(u => u.owner === unit.owner && u !== unit && u.distanceTo(unit) <= 12);
        if (friendly) {
          friendly._precisionShooterBuff = true;
          unit._precisionShooterBuffUsed = true;
          specialRulesApplied.push({ rule: 'Precision Shooter Buff', effect: `gave +1 shooting to ${friendly.name}` });
        }
        return {};
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, weapon, quality, isMelee, specialRulesApplied }) => {
        if (isMelee) return {};
        if (unit._precisionShooterBuff) {
          delete unit._precisionShooterBuff;
          specialRulesApplied.push({ rule: 'Precision Shooter Buff', effect: '+1 to hit' });
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
    },
  },

  'Precision Fighter Buff': {
    description: 'Once per activation, give a friendly unit +1 to hit in melee once.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._precisionFighterBuffUsed) return {};
        const friendly = gameState.units.find(u => u.owner === unit.owner && u !== unit && u.distanceTo(unit) <= 12);
        if (friendly) {
          friendly._precisionFighterBuff = true;
          unit._precisionFighterBuffUsed = true;
          specialRulesApplied.push({ rule: 'Precision Fighter Buff', effect: `gave +1 melee to ${friendly.name}` });
        }
        return {};
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, isMelee, quality, specialRulesApplied }) => {
        if (!isMelee) return {};
        if (unit._precisionFighterBuff) {
          delete unit._precisionFighterBuff;
          specialRulesApplied.push({ rule: 'Precision Fighter Buff', effect: '+1 to hit' });
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
    },
  },

  'Precision Target': {
    description: 'Once per game, place X markers on an enemy. Friendlies get +X to hit when attacking it.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._precisionTargetUsed) return {};
        const x = unit._ruleParamValue ?? 1;
        const target = gameState.units.find(u => u.owner !== unit.owner && u.distanceTo(unit) <= 36);
        if (target) {
          target.precision_target_markers = (target.precision_target_markers || 0) + x;
          unit._precisionTargetUsed = true;
          specialRulesApplied.push({ rule: 'Precision Target', effect: `placed ${x} markers on ${target.name}` });
        }
        return {};
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ target, quality, specialRulesApplied }) => {
        const markers = target?.precision_target_markers ?? 0;
        if (markers <= 0) return {};
        target.precision_target_markers = 0;
        specialRulesApplied.push({ rule: 'Precision Target', value: markers, effect: `+${markers} to hit` });
        return { quality: Math.max(2, quality - markers) };
      },
    },
  },

  Purge: {
    description: 'Ignores Regeneration. Against Defense 2+ to 4+, AP+1.',
    hooks: {
      [HOOKS.ON_INCOMING_WOUNDS]: ({ specialRulesApplied }) => {
        return { suppressRegeneration: true };
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ targetDefense, ap, specialRulesApplied }) => {
        if ((targetDefense ?? 7) < 2 || (targetDefense ?? 7) > 4) return {};
        specialRulesApplied.push({ rule: 'Purge', effect: 'AP+1' });
        return { ap: (ap ?? 0) + 1 };
      },
    },
  },

  'Fast Aura': {
    description: 'This model and its unit get Fast.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Fast Aura')) {
          return { additionalRules: ['Fast'] };
        }
        return {};
      },
    },
  },

  Fortified: {
    description: 'Incoming hits count as AP(-1), min AP(0).',
    hooks: {
      [HOOKS.ON_INCOMING_WOUNDS]: ({ ap, specialRulesApplied }) => {
        const newAp = Math.max(0, (ap ?? 0) - 1);
        specialRulesApplied.push({ rule: 'Fortified', effect: `AP reduced to ${newAp}` });
        return { ap: newAp };
      },
    },
  },

  'Fortified Aura': {
    description: 'This model and its unit get Fortified.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Fortified Aura')) {
          return { additionalRules: ['Fortified'] };
        }
        return {};
      },
    },
  },
};
