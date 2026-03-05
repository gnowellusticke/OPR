/**
 * rules/opr-rules-machine-cult.js
 * Machine Cult faction rules from v3.5.2
 */
import { HOOKS } from '../RuleRegistry.js';

export const MACHINE_CULT_RULES = {
  // Army-wide
  'Machine-Fog': {
    description: 'When shot or charged from over 9" away, enemies get -1 to hit.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ attackDistance, quality, specialRulesApplied }) => {
        if ((attackDistance ?? 0) > 9) {
          specialRulesApplied.push({ rule: 'Machine-Fog', effect: '-1 to hit' });
          return { quality: Math.min(6, quality + 1) };
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

  'Grounded Stealth': {
    description: 'If most models within 1" of terrain, enemies get -1 to hit.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ target, quality, terrain, specialRulesApplied }) => {
        if (!target?.rules?.includes('Grounded Stealth')) return {};
        // Simplified: assume unit is near terrain if any terrain piece within 1"
        // In a full implementation, we'd need to check each model's distance to terrain.
        const nearTerrain = terrain.some(t => Math.hypot(target.x - t.x, target.y - t.y) <= 1);
        if (nearTerrain) {
          specialRulesApplied.push({ rule: 'Grounded Stealth', effect: '-1 to hit' });
          return { quality: Math.min(6, quality + 1) };
        }
        return {};
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

  'Machine-Fog Boost': {
    description: 'Enemies always get -1 to hit from Machine-Fog, regardless of distance.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ quality, specialRulesApplied }) => {
        specialRulesApplied.push({ rule: 'Machine-Fog Boost', effect: '-1 to hit' });
        return { quality: Math.min(6, quality + 1) };
      },
    },
  },

  'Melee Shrouding': {
    description: 'Enemies get -3" movement when trying to charge this unit.',
    hooks: {
      // This rule reduces charger speed. We can hook into MODIFY_SPEED when action is Charge.
      [HOOKS.MODIFY_SPEED]: ({ unit, action, speedDelta, specialRulesApplied }) => {
        if (action === 'Charge') {
          // Check if the target (the unit being charged) has this rule. Not available here.
          // We'll rely on the engine to handle this via a dedicated charge distance hook.
          // For now, we'll return a flag.
          return { chargePenalty: 3 };
        }
        return {};
      },
    },
  },

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
        specialRulesApplied.push({ rule: 'Melee Slayer', effect: '+AP(2) vs Tough target' });
        return { ap: (ap ?? 0) + 2 };
      },
    },
  },

  Mend: {
    description: 'Once per activation, remove D3 wounds from a friendly Tough model within 3".',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, dice, specialRulesApplied }) => {
        if (unit._mendUsed) return {};
        const targets = gameState.units.filter(u => u.owner === unit.owner && Math.hypot(u.x - unit.x, u.y - unit.y) <= 3 && u.tough > 1 && u.current_models < u.total_models);
        if (targets.length === 0 && unit.tough > 1 && unit.current_models < unit.total_models) {
          targets.push(unit);
        }
        if (targets.length > 0) {
          const target = targets[0];
          const heal = dice.roll() % 3 + 1; // D3
          target.current_models = Math.min(target.total_models, target.current_models + heal);
          unit._mendUsed = true;
          specialRulesApplied.push({ rule: 'Mend', effect: `healed ${heal} wound(s) on ${target.name}` });
        }
        return {};
      },
    },
  },

  'Piercing Shooting Debuff': {
    description: 'Once per activation, pick an enemy within 18" which loses AP(+1) when shooting once.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._piercingShootingDebuffUsed) return {};
        const target = gameState.units.find(u => u.owner !== unit.owner && Math.hypot(u.x - unit.x, u.y - unit.y) <= 18);
        if (target) {
          target.piercing_shooting_debuff = true;
          unit._piercingShootingDebuffUsed = true;
          specialRulesApplied.push({ rule: 'Piercing Shooting Debuff', effect: `gave -AP to ${target.name}` });
        }
        return {};
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, ap, specialRulesApplied }) => {
        if (unit.piercing_shooting_debuff) {
          delete unit.piercing_shooting_debuff;
          // Reduce AP by 1? The rule says "loses AP(+1)", meaning their weapons get -1 AP.
          // So we reduce ap by 1 (but not below 0).
          const newAp = Math.max(0, (ap ?? 0) - 1);
          specialRulesApplied.push({ rule: 'Piercing Shooting Debuff', effect: `AP reduced by 1` });
          return { ap: newAp };
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

  Strafing: {
    description: 'Once per activation, when moving through enemies, attack with this weapon as if shooting.',
    hooks: {
      [HOOKS.ON_MOVE_THROUGH_ENEMY]: ({ unit, enemyUnit, weapon, specialRulesApplied }) => {
        if (unit._strafingUsed) return {};
        unit._strafingUsed = true;
        specialRulesApplied.push({ rule: 'Strafing', effect: `attacking ${enemyUnit.name}` });
        return { strafingAttack: { target: enemyUnit, weapon } };
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

  VersatileAttack: {
    description: 'When activated, choose AP+1 or +1 to hit.',
    hooks: {
      [HOOKS.BEFORE_ACTIVATION]: ({ unit, specialRulesApplied }) => {
        // AI sets unit._versatileMode
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

  Wreck: {
    description: 'Ignores cover. When attacking, target must re-roll unmodified defense results of 6.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ specialRulesApplied }) => {
        return { ignoresCover: true };
      },
      [HOOKS.ON_PER_HIT]: ({ saveRoll, dice, modifiedDefense, specialRulesApplied }) => {
        if (saveRoll === 6) {
          const reroll = dice.roll();
          specialRulesApplied.push({ rule: 'Wreck', effect: `save 6 re-rolled (${saveRoll}→${reroll})` });
          return { rerollResult: reroll, saveSuccess: reroll >= modifiedDefense };
        }
        return {};
      },
    },
  },

  // Auras
  'Machine-Fog Boost Aura': {
    description: 'This model and its unit get Machine-Fog Boost.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Machine-Fog Boost Aura')) {
          return { additionalRules: ['Machine-Fog Boost'] };
        }
        return {};
      },
    },
  },
  'Melee Shrouding Aura': {
    description: 'This model and its unit get Melee Shrouding.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Melee Shrouding Aura')) {
          return { additionalRules: ['Melee Shrouding'] };
        }
        return {};
      },
    },
  },
  'Rending when Shooting Aura': {
    description: 'This model and its unit get Rending when shooting.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Rending when Shooting Aura')) {
          return { additionalRules: ['Rending'] }; // Rending already defined in core rules
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
  'Cyborg Assault': {
    description: 'Pick one friendly unit within 12" which gets Hit & Run Shooter once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          target._tempHitAndRunShooter = true;
          specialRulesApplied.push({ rule: 'Cyborg Assault', effect: `gave Hit & Run Shooter to ${target.name}` });
        }
      },
      [HOOKS.AFTER_SHOOTING]: ({ unit, specialRulesApplied }) => {
        if (unit._tempHitAndRunShooter) {
          delete unit._tempHitAndRunShooter;
          specialRulesApplied.push({ rule: 'Cyborg Assault', effect: 'may move 3"' });
          return { hitAndRunMove: 3 };
        }
        return {};
      },
    },
  },
  'Power Beam': {
    description: 'Pick one enemy model within 18" which takes 2 hits with AP(1).',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Power Beam', effect: `2 hits AP1 on ${target.name}` });
          return { extraHits: [{ target, count: 2, ap: 1 }] };
        }
      },
    },
  },
  'Shrouding Incense': {
    description: 'Pick up to two friendly units within 12" which get Machine-Fog Boost once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const friendlies = gameState.units.filter(u => u.owner === caster.owner && Math.hypot(u.x - caster.x, u.y - caster.y) <= 12).slice(0, 2);
        friendlies.forEach(u => u._tempMachineFogBoost = true);
        specialRulesApplied.push({ rule: 'Shrouding Incense', effect: `gave Machine-Fog Boost to ${friendlies.length} units` });
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, quality, specialRulesApplied }) => {
        if (unit._tempMachineFogBoost) {
          delete unit._tempMachineFogBoost;
          specialRulesApplied.push({ rule: 'Machine-Fog Boost', effect: '-1 to hit' });
          return { quality: Math.min(6, quality + 1) };
        }
        return {};
      },
    },
  },
  'Searing Shrapnel': {
    description: 'Pick one enemy unit within 12" which takes 4 hits with AP(1) and Wreck.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Searing Shrapnel', effect: `4 hits AP1 Wreck on ${target.name}` });
          return { extraHits: [{ target, count: 4, ap: 1, wreck: true }] };
        }
      },
    },
  },
  'Corrode Weapons': {
    description: 'Pick up to three enemy units within 18" which lose AP(+1) when shooting once.',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, gameState, specialRulesApplied }) => {
        const enemies = gameState.units.filter(u => u.owner !== caster.owner && Math.hypot(u.x - caster.x, u.y - caster.y) <= 18).slice(0, 3);
        enemies.forEach(u => u.piercing_shooting_debuff = true);
        specialRulesApplied.push({ rule: 'Corrode Weapons', effect: `gave -AP to ${enemies.length} units` });
      },
    },
  },
  'Crushing Force': {
    description: 'Pick one enemy unit within 12" which takes 6 hits with AP(2).',
    hooks: {
      [HOOKS.ON_SPELL_CAST]: ({ caster, target, specialRulesApplied }) => {
        if (target) {
          specialRulesApplied.push({ rule: 'Crushing Force', effect: `6 hits AP2 on ${target.name}` });
          return { extraHits: [{ target, count: 6, ap: 2 }] };
        }
      },
    },
  },
};
