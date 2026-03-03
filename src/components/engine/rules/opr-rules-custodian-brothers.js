/**
 * rules/opr-rules-custodian-brothers.js
 * Custodian Brothers faction rules from v3.5.2
 */
import { HOOKS } from '../RuleRegistry.js';

export const CUSTODIAN_BROTHERS_RULES = {
  // Army-wide
  Guardian: {
    description: 'When shot or charged from over 9" away, hits count as AP(-1), min AP(0).',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ attackDistance, ap, specialRulesApplied }) => {
        if (attackDistance == null || attackDistance <= 9) return {};
        const currentAp = ap ?? 0;
        if (currentAp <= 0) return {};
        const reducedAp = Math.max(0, currentAp - 1);
        specialRulesApplied.push({ rule: 'Guardian', effect: `AP ${currentAp}→${reducedAp}` });
        return { ap: reducedAp };
      },
    },
  },

  'Guardian Boost': {
    description: 'Enemy hits always count as AP(-1) from Guardian, regardless of distance.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ ap, specialRulesApplied }) => {
        const currentAp = ap ?? 0;
        if (currentAp <= 0) return {};
        const reducedAp = Math.max(0, currentAp - 1);
        specialRulesApplied.push({ rule: 'Guardian Boost', effect: `AP ${currentAp}→${reducedAp}` });
        return { ap: reducedAp };
      },
    },
  },

  'Guardian Boost Aura': {
    description: 'This model and its unit get Guardian Boost.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.rules.includes('Guardian Boost Aura')) {
          return { additionalRules: ['Guardian Boost'] };
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

  'Hit & Run Shooter': {
    description: 'Once per round, move up to 3" after shooting.',
    hooks: {
      [HOOKS.AFTER_SHOOTING]: ({ unit, specialRulesApplied }) => {
        if (unit._hitAndRunShooterUsed) return {};
        unit._hitAndRunShooterUsed = true;
        specialRulesApplied.push({ rule: 'Hit & Run Shooter', effect: 'may move 3" after shooting' });
        return { hitAndRunMove: 3 };
      },
    },
  },

  'Hit & Run Shooter Aura': {
    description: 'This model and its unit get Hit & Run Shooter.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.rules.includes('Hit & Run Shooter Aura')) {
          return { additionalRules: ['Hit & Run Shooter'] };
        }
        return {};
      },
    },
  },

  'Piercing Target': {
    description: 'Once per game, place X markers on an enemy. Friendlies get +AP(X) when attacking it.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._piercingTargetUsed) return {};
        const x = unit._ruleParamValue ?? 1;
        // Pick nearest enemy (simplified)
        const target = gameState.units.find(u => u.owner !== unit.owner && u.current_models > 0);
        if (target) {
          target.piercing_target_markers = (target.piercing_target_markers || 0) + x;
          unit._piercingTargetUsed = true;
          specialRulesApplied.push({ rule: 'Piercing Target', effect: `placed ${x} markers on ${target.name}` });
        }
        return {};
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, specialRulesApplied }) => {
        const markers = target?.piercing_target_markers ?? 0;
        if (markers <= 0) return {};
        target.piercing_target_markers = 0;
        specialRulesApplied.push({ rule: 'Piercing Target', value: markers, effect: `+AP(${markers})` });
        return { ap: (ap ?? 0) + markers };
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

  'Ranged Shrouding Aura': {
    description: 'This model and its unit get Ranged Shrouding.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.rules.includes('Ranged Shrouding Aura')) {
          return { additionalRules: ['Ranged Shrouding'] };
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

  'Shred Mark': {
    description: 'Once per activation, mark an enemy; friendlies get Shred against it once.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._shredMarkUsed) return {};
        const target = gameState.units.find(u => u.owner !== unit.owner && u.distanceTo(unit) <= 18);
        if (target) {
          target.shred_marked = true;
          unit._shredMarkUsed = true;
          specialRulesApplied.push({ rule: 'Shred Mark', effect: `marked ${target.name}` });
        }
        return {};
      },
      [HOOKS.ON_PER_HIT]: ({ target, saveRoll, specialRulesApplied }) => {
        if (target?.shred_marked && saveRoll === 1) {
          delete target.shred_marked; // consume
          specialRulesApplied.push({ rule: 'Shred Mark', effect: 'extra wound from mark' });
          return { extraWounds: 1 };
        }
        return {};
      },
    },
  },

  'Shred when Shooting Aura': {
    description: 'This model and its unit get Shred when shooting.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.rules.includes('Shred when Shooting Aura')) {
          return { additionalRules: ['Shred'] }; // Shred already applies to all
        }
        return {};
      },
    },
  },

  Steadfast: {
    description: 'If Shaken at start of round, roll 4+ to recover.',
    hooks: {
      [HOOKS.ON_ROUND_START]: ({ unit, dice, specialRulesApplied }) => {
        if (unit.status !== 'shaken') return {};
        const roll = dice.roll();
        if (roll >= 4) {
          specialRulesApplied.push({ rule: 'Steadfast', effect: `recovered (rolled ${roll})` });
          return { clearShaken: true };
        } else {
          specialRulesApplied.push({ rule: 'Steadfast', effect: `failed recovery (rolled ${roll})` });
          return {};
        }
      },
    },
  },

  'Steadfast Aura': {
    description: 'This model and its unit get Steadfast.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.rules.includes('Steadfast Aura')) {
          return { additionalRules: ['Steadfast'] };
        }
        return {};
      },
    },
  },

  Tear: {
    description: 'Against Tough(3-9), weapon gets AP(+4).',
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
          specialRulesApplied.push({ rule: 'Tear', effect: `+AP(4) vs Tough(${toughVal})` });
          return { ap: newAp };
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

  'Teleport Aura': {
    description: 'This model and its unit get Teleport.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.rules.includes('Teleport Aura')) {
          return { additionalRules: ['Teleport'] };
        }
        return {};
      },
    },
  },

  'Unpredictable Fighter': {
    description: 'In melee, roll die: 1-3 AP+1, 4-6 +1 to hit.',
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

  'Unstoppable in Melee Aura': {
    description: 'This model and its unit get Unstoppable in melee.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.rules.includes('Unstoppable in Melee Aura')) {
          return { additionalRules: ['Unstoppable in Melee'] };
        }
        return {};
      },
    },
  },

  VersatileAttack: {
    description: 'When activated, choose AP+1 or +1 to hit.',
    hooks: {
      [HOOKS.BEFORE_ACTIVATION]: ({ unit, specialRulesApplied }) => {
        // AI should set unit._versatileMode = 'ap' or 'quality'
        // For simplicity, we'll assume it's set by the player/AI before activation.
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, specialRulesApplied }) => {
        if (unit._versatileMode === 'quality') {
          specialRulesApplied.push({ rule: 'Versatile Attack', effect: '+1 to hit' });
          return { quality: Math.max(2, quality - 1) };
        }
        return {};
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, ap, specialRulesApplied }) => {
        if (unit._versatileMode === 'ap') {
          specialRulesApplied.push({ rule: 'Versatile Attack', effect: 'AP+1' });
          return { ap: (ap ?? 0) + 1 };
        }
        return {};
      },
      [HOOKS.AFTER_ACTIVATION]: ({ unit }) => {
        delete unit._versatileMode;
      },
    },
  },

  // Auras (already defined above)
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

  // Army spells
  "The Founder's Curse": {
    description: 'Pick one enemy unit within 18" which gets Shred mark once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          target.shred_marked = true;
          specialRulesApplied.push({ rule: "The Founder's Curse", effect: `marked ${target.name}` });
        }
      },
    },
  },
  'Thunderous Mist': {
    description: 'Pick one enemy unit within 18" which takes 2 hits.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Thunderous Mist', effect: `2 hits on ${target.name}` });
          return { extraHits: [{ target, count: 2, ap: 0 }] };
        }
      },
    },
  },
  'Focused Defender': {
    description: 'Pick up to two friendly units within 12" which get Unpredictable Fighter once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u => u.owner === caster.owner && u.distanceTo(caster) <= 12).slice(0, 2);
        friendlies.forEach(u => u._tempUnpredictableFighter = true);
        specialRulesApplied.push({ rule: 'Focused Defender', effect: `gave Unpredictable Fighter to ${friendlies.length} units` });
      },
    },
  },
  'Dread Strike': {
    description: 'Pick one enemy model within 24" which takes 2 hits with Tear.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Dread Strike', effect: `2 hits with Tear on ${target.name}` });
          return { extraHits: [{ target, count: 2, ap: 0, tear: true }] };
        }
      },
    },
  },
  'Guardian Protection': {
    description: 'Pick up to three friendly units within 12" which get Guardian Boost once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u => u.owner === caster.owner && u.distanceTo(caster) <= 12).slice(0, 3);
        friendlies.forEach(u => u._tempGuardianBoost = true);
        specialRulesApplied.push({ rule: 'Guardian Protection', effect: `gave Guardian Boost to ${friendlies.length} units` });
      },
    },
  },
  'Mind Gash': {
    description: 'Pick one enemy unit within 12" which takes 6 hits with AP(1) and Shred.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Mind Gash', effect: `6 hits AP1 Shred on ${target.name}` });
          return { extraHits: [{ target, count: 6, ap: 1, shred: true }] };
        }
      },
    },
  },
};
