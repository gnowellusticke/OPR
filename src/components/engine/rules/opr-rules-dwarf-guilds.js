/**
 * rules/opr-rules-dwarf-guilds.js
 * Dwarf Guilds faction rules from v3.5.2
 */
import { HOOKS } from '../RuleRegistry.js';

export const DWARF_GUILDS_RULES = {
  // ── Army-Wide: Sturdy ─────────────────────────────────────────────────────
  Sturdy: {
    description: 'When shot or charged from over 9" away, get +1 to defense rolls.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ attackDistance, defense, specialRulesApplied }) => {
        if (attackDistance == null || attackDistance <= 9) return {};
        specialRulesApplied.push({ rule: 'Sturdy', effect: `defense +1 (attacked from ${attackDistance.toFixed(1)}")` });
        return { defense: Math.max(2, (defense ?? 6) - 1) };
      },
    },
  },

  'Sturdy Boost': {
    description: 'Always get +1 to defense rolls from Sturdy, regardless of distance.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ defense, specialRulesApplied }) => {
        specialRulesApplied.push({ rule: 'Sturdy Boost', effect: 'defense +1 (always)' });
        return { defense: Math.max(2, (defense ?? 6) - 1) };
      },
    },
  },

  'Sturdy Boost Aura': {
    description: 'This model and its unit get Sturdy Boost.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Sturdy Boost Aura')) {
          return { additionalRules: ['Sturdy Boost'] };
        }
        return {};
      },
    },
  },

  // ── Quake ─────────────────────────────────────────────────────────────────
  Quake: {
    description: 'Ignores Regeneration. On unmodified 1s to block hits, deals 1 extra wound.',
    hooks: {
      [HOOKS.ON_PER_HIT]: ({ saveRoll, specialRulesApplied }) => {
        if (saveRoll !== 1) return {};
        specialRulesApplied.push({ rule: 'Quake', effect: 'unmodified 1 to save — +1 extra wound' });
        return { extraWounds: 1, suppressRegeneration: true };
      },
      [HOOKS.ON_INCOMING_WOUNDS]: ({ specialRulesApplied }) => {
        // Signal to suppress Regeneration for this hit (already handled above)
        return {};
      },
    },
  },

  'Quake when Shooting': {
    description: 'This model gets Quake when shooting.',
    hooks: {
      [HOOKS.ON_PER_HIT]: ({ saveRoll, isMelee, specialRulesApplied }) => {
        if (isMelee || saveRoll !== 1) return {};
        specialRulesApplied.push({ rule: 'Quake when Shooting', effect: 'unmodified 1 to save — +1 extra wound (shooting)' });
        return { extraWounds: 1, suppressRegeneration: true };
      },
    },
  },

  // ── Swift ─────────────────────────────────────────────────────────────────
  Swift: {
    description: 'This model may ignore the Slow rule.',
    hooks: {
      [HOOKS.MODIFY_SPEED]: ({ unit, speedDelta, specialRulesApplied }) => {
        const hasSlow = (unit.special_rules || '').includes('Slow');
        if (!hasSlow || (speedDelta ?? 0) >= 0) return {};
        specialRulesApplied.push({ rule: 'Swift', effect: 'Slow penalty cancelled' });
        return { speedDelta: 0 };
      },
    },
  },

  'Swift Aura': {
    description: 'This model and its unit get Swift.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Swift Aura')) {
          return { additionalRules: ['Swift'] };
        }
        return {};
      },
    },
  },

  // ── Unpredictable (all attacks) ───────────────────────────────────────────
  Unpredictable: {
    description: 'When attacking, roll one die: 1-3 get AP(+1), 4-6 get +1 to hit.',
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

  // ── Devastating Frenzy ────────────────────────────────────────────────────
  'Devastating Frenzy': {
    description: 'Gain one marker when fully destroying an enemy unit. Each marker gives AP(+1) and +1 defense (max +2).',
    hooks: {
      [HOOKS.ON_MODEL_KILLED]: ({ unit, killer, gameState }) => {
        if (killer && (killer.special_rules || '').includes('Devastating Frenzy')) {
          killer.devastating_frenzy_markers = Math.min(2, (killer.devastating_frenzy_markers || 0) + 1);
        }
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ unit, ap, defense, specialRulesApplied }) => {
        const markers = Math.min(2, unit.devastating_frenzy_markers ?? 0);
        if (markers <= 0) return {};
        specialRulesApplied.push({ rule: 'Devastating Frenzy', value: markers, effect: `AP+${markers}, defense+${markers}` });
        return { ap: (ap ?? 0) + markers, defense: Math.max(2, (defense ?? 6) - markers) };
      },
    },
  },

  // ── Ignores Cover when Shooting ───────────────────────────────────────────
  'Ignores Cover when Shooting': {
    description: 'Ranged attacks ignore cover bonuses.',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ isMelee, specialRulesApplied }) => {
        if (isMelee) return {};
        specialRulesApplied.push({ rule: 'Ignores Cover when Shooting', effect: 'cover ignored' });
        return { ignoresCover: true };
      },
    },
  },

  'Ignores Cover when Shooting Aura': {
    description: 'This model and its unit get Ignores Cover when shooting.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Ignores Cover when Shooting Aura')) {
          return { additionalRules: ['Ignores Cover when Shooting'] };
        }
        return {};
      },
    },
  },

  // ── Mend ──────────────────────────────────────────────────────────────────
Mend: {
    description: 'Once per activation, pick one friendly Tough model within 3" and remove D3 wounds from it.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, dice, specialRulesApplied }) => {
        if (unit._mendUsed) return {};
        const targets = gameState.units.filter(u => u.owner === unit.owner && u !== unit && Math.hypot(u.x - unit.x, u.y - unit.y) <= 3 && (u.tough_per_model || 1) > 1 && u.current_models < u.total_models);
        if (targets.length === 0 && (unit.tough_per_model || 1) > 1 && unit.current_models < unit.total_models) {
          targets.push(unit);
        }
        if (targets.length > 0) {
          const target = targets[0];
          const heal = dice.roll() % 3 + 1;
          target.current_models = Math.min(target.total_models, target.current_models + heal);
          unit._mendUsed = true;
          specialRulesApplied.push({ rule: 'Mend', effect: `healed ${heal} wound(s) on ${target.name}` });
        }
        return {};
      },
    },
  },

  // ── Re-Position Artillery ─────────────────────────────────────────────────
'Re-Position Artillery': {
    description: 'Once per activation, pick one friendly Artillery model within 6" — it may immediately move up to 9".',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._repositionUsed) return {};
        const artillery = gameState.units.find(u => u.owner === unit.owner && u !== unit && Math.hypot(u.x - unit.x, u.y - unit.y) <= 6 && (u.special_rules || '').includes('Artillery'));
        if (artillery) {
          unit._repositionUsed = true;
          specialRulesApplied.push({ rule: 'Re-Position Artillery', effect: `${artillery.name} may move up to 9"` });
          return { repositionUnit: artillery, distance: 9 };
        }
        return {};
      },
    },
  },

  // ── Speed Debuff ──────────────────────────────────────────────────────────
'Speed Debuff': {
    description: 'Once per activation, pick one enemy within 18" — it moves -2" on Advance and -4" on Rush/Charge until next activation.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._speedDebuffUsed) return {};
        const target = gameState.units.find(u => u.owner !== unit.owner && Math.hypot(u.x - unit.x, u.y - unit.y) <= 18);
        if (target) {
          target.speed_debuff = true;
          unit._speedDebuffUsed = true;
          specialRulesApplied.push({ rule: 'Speed Debuff', effect: `gave -2"/-4" penalty to ${target.name}` });
        }
        return {};
      },
      [HOOKS.MODIFY_SPEED]: ({ unit, action, speedDelta, specialRulesApplied }) => {
        if (unit.speed_debuff) {
          const penalty = action === 'Advance' ? -2 : -4;
          specialRulesApplied.push({ rule: 'Speed Debuff', effect: `${penalty}" penalty` });
          return { speedDelta: (speedDelta ?? 0) + penalty };
        }
        return {};
      },
      [HOOKS.AFTER_ACTIVATION]: ({ unit }) => {
        // Clear at end of activation? Actually lasts until next activation, so we clear when the unit activates again.
        // We'll clear in BEFORE_ATTACK of that unit.
      },
    },
  },

  // ── Infiltrate Aura ───────────────────────────────────────────────────────
  'Infiltrate Aura': {
    description: 'This model and its unit get Infiltrate.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Infiltrate Aura')) {
          return { additionalRules: ['Infiltrate'] };
        }
        return {};
      },
    },
  },
};
