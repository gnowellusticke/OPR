/**
 * rules/opr-rules-dao-union.js
 * DAO Union faction rules from v3.5.2
 */
import { HOOKS } from '../RuleRegistry.js';

export const DAO_UNION_RULES = {
  // ── Army-Wide: Targeting Visor ────────────────────────────────────────────
  'Targeting Visor': {
    description: 'When shooting at enemies over 9" away, gets +1 to hit rolls.',
    hooks: {
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, target, weapon, quality, specialRulesApplied, calculateDistance }) => {
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
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Targeting Visor Boost Aura')) {
          return { additionalRules: ['Targeting Visor Boost'] };
        }
        return {};
      },
    },
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
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Fortified Aura')) {
          return { additionalRules: ['Fortified'] };
        }
        return {};
      },
    },
  },

  // ── Decimate ──────────────────────────────────────────────────────────────
  Decimate: {
    description: 'Ignores cover. Against Defense 2+-3+ targets, gains AP(+2).',
    hooks: {
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, specialRulesApplied }) => {
        if (!target) return {};
        const defense = target.defense ?? 4;
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
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Ranged Slayer Aura')) {
          return { additionalRules: ['Ranged Slayer'] };
        }
        return {};
      },
    },
  },

  // ── Counter-Attack ────────────────────────────────────────────────────────
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

  'Counter-Attack Aura': {
    description: 'This model and its unit get Counter-Attack.',
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Counter-Attack Aura')) {
          return { additionalRules: ['Counter-Attack'] };
        }
        return {};
      },
    },
  },

  // ── Melee Shrouding ───────────────────────────────────────────────────────
  'Melee Shrouding': {
    description: 'Enemies get -3" movement when trying to charge this unit.',
    hooks: {
      // Applied by the engine when calculating charge distance.
      // We can use a hook that modifies charge range.
      // For now, we'll note that the engine should check for this rule and reduce charger's speed by 3.
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

  // ── Strafing ──────────────────────────────────────────────────────────────
  Strafing: {
    description: 'Once per activation, when this model moves through enemy units, attack one with this weapon as if shooting.',
    hooks: {
      [HOOKS.ON_MOVE_THROUGH_ENEMY]: ({ unit, enemyUnit, weapon, specialRulesApplied }) => {
        if (unit._strafingUsed) return {};
        unit._strafingUsed = true;
        specialRulesApplied.push({ rule: 'Strafing', effect: `attacking ${enemyUnit.name}` });
        return { strafingAttack: { target: enemyUnit, weapon } };
      },
    },
  },

  // ── Precision Spotter ─────────────────────────────────────────────────────
  'Precision Spotter': {
    description: 'Once per activation, pick one enemy within 36" LOS and roll one die — on 4+ place a marker. Friendlies remove markers before rolling to hit for +X to hit.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, dice, specialRulesApplied }) => {
        if (unit._precisionSpotterUsed) return {};
        // In a real game, the player/AI would pick a target. For simplicity, pick the nearest enemy.
        const enemies = gameState.units.filter(u => u.owner !== unit.owner && u.current_models > 0);
        if (enemies.length === 0) return {};
        const target = enemies.reduce((a, b) => this.calculateDistance?.(unit, a) < this.calculateDistance?.(unit, b) ? a : b);
        const roll = dice.roll();
        if (roll >= 4) {
          target.precision_markers = (target.precision_markers || 0) + 1;
          unit._precisionSpotterUsed = true;
          specialRulesApplied.push({ rule: 'Precision Spotter', effect: `placed marker on ${target.name}` });
        }
        return {};
      },
      [HOOKS.BEFORE_HIT_QUALITY]: ({ unit, target, quality, specialRulesApplied }) => {
        if (!target || !target.precision_markers) return {};
        // Consume one marker (simplified: remove all)
        const markers = target.precision_markers;
        target.precision_markers = 0;
        specialRulesApplied.push({ rule: 'Precision Spotter', value: markers, effect: `removed markers, +${markers} to hit` });
        return { quality: Math.max(2, quality - markers) };
      },
    },
  },

  // ── Piercing Shooting Mark ────────────────────────────────────────────────
  'Piercing Shooting Mark': {
    description: 'Once per activation, pick one enemy within 18" — friendlies get AP(+1) when shooting against it.',
    hooks: {
      [HOOKS.BEFORE_ATTACK]: ({ unit, gameState, specialRulesApplied }) => {
        if (unit._piercingShootingMarkUsed) return {};
        const target = gameState.units.find(u => u.owner !== unit.owner && u.distanceTo(unit) <= 18);
        if (target) {
          target.piercing_shooting_mark = true;
          unit._piercingShootingMarkUsed = true;
          specialRulesApplied.push({ rule: 'Piercing Shooting Mark', effect: `marked ${target.name}` });
        }
        return {};
      },
      [HOOKS.BEFORE_SAVE_DEFENSE]: ({ target, ap, isMelee, specialRulesApplied }) => {
        if (isMelee || !target?.piercing_shooting_mark) return {};
        delete target.piercing_shooting_mark; // consume
        specialRulesApplied.push({ rule: 'Piercing Shooting Mark', effect: 'AP+1 from mark' });
        return { ap: (ap ?? 0) + 1 };
      },
    },
  },

  // ── Ambush Beacon ─────────────────────────────────────────────────────────
  'Ambush Beacon': {
    description: 'Friendly units using Ambush may ignore distance restrictions from enemies if deployed within 6" of this model.',
    hooks: {
      [HOOKS.ON_RESERVE_ENTRY]: ({ unit, gameState }) => {
        // Called when a unit is being deployed from reserve.
        // Check if there is a friendly Ambush Beacon within 6" of the intended deployment point.
        // The intended point is not passed in this context; we need to modify the deployment logic in the engine.
        // As a workaround, we'll add a flag to the unit that indicates it can deploy closer.
        // The engine should check for this rule when enforcing the 9" distance.
        // We'll return a flag.
        const beacons = gameState.units.filter(u => u.owner === unit.owner && u.rules.includes('Ambush Beacon') && u.distanceTo(unit) <= 6);
        if (beacons.length > 0) {
          return { ignoreDistanceRestriction: true };
        }
        return {};
      },
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
    hooks: {
      [HOOKS.ON_GET_RULES]: ({ unit }) => {
        if (unit.special_rules.includes('Increased Shooting Range Aura')) {
          return { additionalRules: ['Increased Shooting Range'] };
        }
        return {};
      },
    },
  },
};
