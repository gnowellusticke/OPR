// RulesEngine.js
import { HOOKS } from './RuleRegistry.js';
import { Dice } from './Dice.js';

/**
 * RulesEngine – core game mechanics, using hooks for all special rules.
 * No if‑statements for specific rule names; all rule logic lives in hook handlers.
 */
export class RulesEngine {
  constructor(registry) {
    this.registry = registry;
  }

  // =========================================================================
  // ACTIVATION
  // =========================================================================

  /**
   * Called when a unit starts its activation.
   * @param {Unit} unit
   * @param {Object} gameState
   * @returns {Object} { specialRulesApplied, ... }
   */
  startActivation(unit, gameState) {
    const specialRulesApplied = [];
    const ctx = { unit, gameState, dice: Dice, specialRulesApplied };
    const results = this.registry.applyHook(HOOKS.ON_ACTIVATION_START, ctx);
    this._processActivationStartResults(results, unit, gameState, specialRulesApplied);
    return { specialRulesApplied };
  }

  /**
   * Called when a unit finishes its activation.
   * @param {Unit} unit
   * @param {Object} gameState
   * @returns {Object} { specialRulesApplied }
   */
  endActivation(unit, gameState) {
    const specialRulesApplied = [];
    const ctx = { unit, gameState, dice: Dice, specialRulesApplied };
    this.registry.applyHook(HOOKS.ON_ACTIVATION_END, ctx);
    return { specialRulesApplied };
  }

  // =========================================================================
  // MOVEMENT
  // =========================================================================

  /**
   * Executes a movement action.
   * @param {Unit} unit – the moving unit
   * @param {string} action – 'Advance' | 'Rush' | 'Charge'
   * @param {Object} target – target position {x, y} (for charge, this is the enemy unit)
   * @param {Array} terrain – list of terrain objects
   * @param {Object} gameState – full game state (for hooks that need other units)
   * @returns {Object} { distance, specialRulesApplied, pathIntersections, ... }
   */
  executeMovement(unit, action, target, terrain, gameState) {
    const ctx = { unit, action, target, gameState, terrain, dice: Dice };
    const specialRulesApplied = [];

    let speed = (action === 'Advance') ? 6 : (action === 'Rush' || action === 'Charge') ? 12 : 0;

    // GET_BASE_SPEED hooks
    const baseResults = this.registry.applyHook(HOOKS.GET_BASE_SPEED, { ...ctx, specialRulesApplied });
    baseResults.forEach(r => { if (r.overrideSpeed) speed = r.speed; });

    // MODIFY_SPEED hooks
    const modifyCtx = { ...ctx, speed, specialRulesApplied };
    const modifyResults = this.registry.applyHook(HOOKS.MODIFY_SPEED, modifyCtx);
    modifyResults.forEach(r => { if (r.speedDelta) speed += r.speedDelta; });

    const startX = unit.x, startY = unit.y;
    const endX = target.x, endY = target.y;
    const distance = Math.hypot(endX - startX, endY - startY);
    const moveDist = Math.min(distance, speed);
    const ratio = moveDist / distance;
    const newX = startX + (endX - startX) * ratio;
    const newY = startY + (endY - startY) * ratio;

    // ON_MOVE_PATH hooks
    const movePathResults = this.registry.applyHook(HOOKS.ON_MOVE_PATH, { ...ctx, fromX: startX, fromY: startY, toX: newX, toY: newY, specialRulesApplied });
    const ignoreUnits = movePathResults.some(r => r.ignoreUnits);
    const ignoreTerrain = movePathResults.some(r => r.ignoreTerrain);

    if (!ignoreUnits) {
      const blockers = gameState.units.filter(u =>
        u.id !== unit.id &&
        u.current_models > 0 &&
        !u.reserve &&
        this._lineIntersectsUnit(startX, startY, newX, newY, u)
      );
      if (blockers.length > 0) {
        return { distance: 0, blocked: true, specialRulesApplied };
      }
    }

    // Terrain movement hooks
    const terrainResults = this.registry.applyHook(HOOKS.ON_TERRAIN_MOVE, { ...ctx, terrain, specialRulesApplied });
    const ignoreDifficult = terrainResults.some(r => r.ignoreDifficult);
    const ignoreAllTerrain = terrainResults.some(r => r.ignoreTerrain);

    let effectiveSpeed = speed;
    if (!ignoreAllTerrain && !ignoreDifficult) {
      const difficultTerrain = terrain.filter(t => t.difficult && this._lineIntersectsTerrain(startX, startY, newX, newY, t));
      if (difficultTerrain.length > 0) {
        effectiveSpeed *= 0.5;
      }
    }

    const finalDist = Math.min(distance, effectiveSpeed);
    const finalRatio = finalDist / distance;
    const finalX = startX + (endX - startX) * finalRatio;
    const finalY = startY + (endY - startY) * finalRatio;

    // ON_MOVE_THROUGH_ENEMY
    const enemiesPassed = gameState.units.filter(u =>
      u.owner !== unit.owner &&
      u.current_models > 0 &&
      this._lineIntersectsUnit(startX, startY, finalX, finalY, u)
    );
    for (const enemy of enemiesPassed) {
      const throughCtx = { unit, enemyUnit: enemy, gameState, dice: Dice, specialRulesApplied };
      const throughResults = this.registry.applyHook(HOOKS.ON_MOVE_THROUGH_ENEMY, throughCtx);
      this._processStrafing(throughResults, unit, gameState);
    }

    // Dangerous terrain check
    const dangerousTerrain = terrain.filter(t => t.dangerous && this._lineIntersectsTerrain(startX, startY, finalX, finalY, t));
    for (const t of dangerousTerrain) {
      const dangerCtx = { unit, terrain: t, action, dice: Dice, specialRulesApplied };
      const dangerResults = this.registry.applyHook(HOOKS.ON_DANGEROUS_TERRAIN, dangerCtx);
      const wounds = dangerResults.reduce((sum, r) => sum + (r.wounds || 0), 0);
      if (wounds > 0) {
        this._applyWounds(unit, wounds, null, gameState);
      }
    }

    unit.x = finalX;
    unit.y = finalY;

    return { distance: finalDist, specialRulesApplied };
  }

  // =========================================================================
  // SHOOTING – CLEAN HOOK ARCHITECTURE
  // =========================================================================

  resolveShooting(attacker, defender, weapon, gameState) {
    const specialRulesApplied = [];
    const ctx = {
      unit: attacker,
      weapon,
      target: defender,
      gameState,
      dice: Dice,
      specialRulesApplied,
      isMelee: false,
      // Generic weapon info – hooks inspect these themselves
      weaponRules: weapon.rules || [],
      weaponParams: weapon.ruleParams || {}
    };

    // BEFORE_ATTACK
    const beforeAttackResults = this.registry.applyHook(HOOKS.BEFORE_ATTACK, ctx);
    if (beforeAttackResults.some(r => r.preventAttack)) {
      return { hits: 0, saves: 0, wounds: 0, hit_rolls: [], defense_rolls: [], specialRulesApplied };
    }
    this._processBeforeAttackResults(beforeAttackResults, attacker, gameState);

    let attacks = attacker.current_models * (weapon.attacks || 1);
    const hitRolls = [];
    let hits = 0;

    for (let i = 0; i < attacks; i++) {
      let quality = attacker.quality;
      const hitCtx = { ...ctx, quality, hitIndex: i };
      const hitResults = this.registry.applyHook(HOOKS.BEFORE_HIT_QUALITY, hitCtx);
      hitResults.forEach(r => { if (r.quality !== undefined) quality = r.quality; });

      const roll = Dice.roll();
      const success = roll >= quality;
      hitRolls.push({ value: roll, success, auto: false, relentless: false });
      if (success) hits++;
    }

    // AFTER_HIT_ROLLS – no hardcoded rule names, hooks check weaponRules themselves
    const afterHitCtx = { ...ctx, rolls: hitRolls, successes: hits };
    const afterHitResults = this.registry.applyHook(HOOKS.AFTER_HIT_ROLLS, afterHitCtx);
    afterHitResults.forEach(r => {
      if (r.successes !== undefined) hits = r.successes;
      if (r.rolls) hitRolls.push(...r.rolls);
    });

    if (hits === 0) {
      return { hits: 0, saves: 0, wounds: 0, hit_rolls, defense_rolls: [], specialRulesApplied };
    }

    let unsavedHits = 0;
    const defenseRolls = [];

    for (let i = 0; i < hits; i++) {
      const hitRoll = hitRolls[i] || { value: 0, success: true };

      // ON_PER_HIT (pre‑save)
      let ap = weapon.ap;
      const preSaveCtx = { ...ctx, hitRoll, hitIndex: i, ap, defense: defender.defense };
      const preSaveResults = this.registry.applyHook(HOOKS.ON_PER_HIT, preSaveCtx);
      preSaveResults.forEach(r => { if (r.apBonus) ap += r.apBonus; });

      let defense = defender.defense;
      const inCover = this._isInCover(defender, attacker, gameState.terrain);
      if (inCover) defense += 1;

      // BEFORE_SAVE_DEFENSE
      const saveCtx = { ...ctx, defender, weapon, terrain: null, defense, ap };
      const saveResults = this.registry.applyHook(HOOKS.BEFORE_SAVE_DEFENSE, saveCtx);
      saveResults.forEach(r => { if (r.ap !== undefined) ap = r.ap; });
      saveResults.forEach(r => { if (r.defense !== undefined) defense = r.defense; });
      const ignoresCover = saveResults.some(r => r.ignoresCover);

      const modifiedDefense = Math.min(6, defense - ap);
      let saveRoll = Dice.roll();
      let saveSuccess = saveRoll >= modifiedDefense;

      // ON_PER_HIT (post‑save)
      const postSaveCtx = { ...ctx, hitRoll, hitIndex: i, ap, defense: defender.defense, saveRoll, modifiedDefense };
      const postSaveResults = this.registry.applyHook(HOOKS.ON_PER_HIT, postSaveCtx);
      postSaveResults.forEach(r => {
        if (r.rerollResult !== undefined) {
          saveRoll = r.rerollResult;
          saveSuccess = saveRoll >= modifiedDefense;
        }
      });

      defenseRolls.push({ value: saveRoll, success: saveSuccess });
      if (!saveSuccess) unsavedHits++;
    }

    let totalWounds = 0;
    for (let i = 0; i < unsavedHits; i++) {
      let wounds = 1;
      const woundCtx = { ...ctx, weapon, unsavedHit: hitRolls[i], toughPerModel: defender.tough };
      const woundResults = this.registry.applyHook(HOOKS.ON_WOUND_CALC, woundCtx);
      woundResults.forEach(r => { if (r.wounds !== undefined) wounds = r.wounds; });
      totalWounds += wounds;
    }

    const incomingCtx = { unit: defender, wounds: totalWounds, suppressedByBane: false, dice: Dice, specialRulesApplied };
    const incomingResults = this.registry.applyHook(HOOKS.ON_INCOMING_WOUNDS, incomingCtx);
    incomingResults.forEach(r => { if (r.wounds !== undefined) totalWounds = r.wounds; });

    if (totalWounds > 0) {
      this._applyWounds(defender, totalWounds, attacker, gameState);
    }

    const afterAttackCtx = { unit: attacker, gameState, specialRulesApplied };
    this.registry.applyHook(HOOKS.AFTER_ATTACK, afterAttackCtx);

    return {
      hits,
      saves: hits - unsavedHits,
      wounds: totalWounds,
      hit_rolls: hitRolls,
      defense_rolls: defenseRolls,
      specialRulesApplied,
    };
  }

  // =========================================================================
  // MELEE (unchanged, but also uses same generic weapon info)
  // =========================================================================

  resolveMelee(attacker, defender, gameState) {
    const specialRulesApplied = [];
    const ctx = { unit: attacker, target: defender, gameState, dice: Dice, specialRulesApplied, isMelee: true };

    const beforeResults = this.registry.applyHook(HOOKS.BEFORE_MELEE_ATTACK, ctx);
    let extraAttackerWounds = 0;
    let extraAttacks = 0;
    beforeResults.forEach(r => {
      if (r.extraWounds) extraAttackerWounds += r.extraWounds;
      if (r.extraAttacks) extraAttacks += r.extraAttacks;
    });

    let attackerFirst = true;
    const orderCtx = { attacker, defender, gameState };
    const orderResults = this.registry.applyHook(HOOKS.ON_STRIKE_ORDER, orderCtx);
    orderResults.forEach(r => { if (r.attackerFirst !== undefined) attackerFirst = r.attackerFirst; });

    let attackerWounds = 0, defenderWounds = 0;
    if (attackerFirst) {
      attackerWounds = this._resolveMeleeAttacks(attacker, defender, gameState, extraAttackerWounds);
      if (defender.current_models > 0) {
        defenderWounds = this._resolveMeleeAttacks(defender, attacker, gameState, 0);
      }
    } else {
      defenderWounds = this._resolveMeleeAttacks(defender, attacker, gameState, 0);
      if (attacker.current_models > 0) {
        attackerWounds = this._resolveMeleeAttacks(attacker, defender, gameState, extraAttackerWounds);
      }
    }

    const meleeResCtx = { attacker, defender, attackerWounds, defenderWounds, gameState, specialRulesApplied };
    const meleeResResults = this.registry.applyHook(HOOKS.ON_MELEE_RESOLUTION, meleeResCtx);
    meleeResResults.forEach(r => {
      if (r.attackerWounds !== undefined) attackerWounds = r.attackerWounds;
      if (r.defenderWounds !== undefined) defenderWounds = r.defenderWounds;
    });

    if (attackerWounds > 0) this._applyWounds(defender, attackerWounds, attacker, gameState);
    if (defenderWounds > 0) this._applyWounds(attacker, defenderWounds, defender, gameState);

    const afterAttackerCtx = { unit: attacker, gameState, specialRulesApplied };
    this.registry.applyHook(HOOKS.AFTER_MELEE_ATTACK, afterAttackerCtx);
    const afterDefenderCtx = { unit: defender, gameState, specialRulesApplied };
    this.registry.applyHook(HOOKS.AFTER_MELEE_ATTACK, afterDefenderCtx);

    const afterMeleeCtx = { attacker, defender, gameState, dice: Dice, specialRulesApplied };
    const afterMeleeResults = this.registry.applyHook(HOOKS.AFTER_MELEE, afterMeleeCtx);
    this._processAfterMeleeResults(afterMeleeResults, attacker, defender, gameState);

    return {
      attacker_wounds: attackerWounds,
      defender_wounds: defenderWounds,
      rollResults: {},
      specialRulesApplied,
    };
  }

  _resolveMeleeAttacks(attacker, defender, gameState, extraWoundsFromHooks = 0) {
    let totalWounds = 0;
    for (const weapon of attacker.weapons.filter(w => w.range <= 2)) {
      const shootingResult = this.resolveShooting(attacker, defender, weapon, gameState);
      totalWounds += shootingResult.wounds;
    }
    totalWounds += extraWoundsFromHooks;
    return totalWounds;
  }

  // =========================================================================
  // SPELL CASTING
  // =========================================================================

  castSpell(caster, spell, target, gameState, friendlyBonus = 0, hostileBonus = 0) {
    const specialRulesApplied = [];
    const ctx = { caster, spell, target, gameState, dice: Dice, specialRulesApplied };

    const results = this.registry.applyHook(HOOKS.ON_SPELL_CAST, ctx);
    let success = false;
    let finalRoll = 0;
    let modifiedRoll = 0;
    let actualCaster = caster;
    let actualTarget = target;
    let rangeMod = 0;
    results.forEach(r => {
      if (r.success !== undefined) success = r.success;
      if (r.roll !== undefined) finalRoll = r.roll;
      if (r.modifiedRoll !== undefined) modifiedRoll = r.modifiedRoll;
      if (r.castPosition) actualCaster = r.castPosition;
      if (r.target) actualTarget = r.target;
      if (r.rangeMod) rangeMod = r.rangeMod;
    });

    if (results.length === 0) {
      const roll = Dice.roll();
      modifiedRoll = roll + friendlyBonus - hostileBonus;
      success = modifiedRoll >= 4;
      finalRoll = modifiedRoll;
      if (success) {
        caster.spell_tokens -= spell.cost;
      }
    }

    if (success) {
      this._processSpellResults(results, actualCaster, actualTarget, gameState, specialRulesApplied);
    }

    return { success, roll: finalRoll, modifiedRoll, tokensAfter: caster.spell_tokens, specialRulesApplied };
  }

  // =========================================================================
  // MORALE, REGENERATION, OBJECTIVES, DEPLOYMENT, TOKENS (unchanged)
  // =========================================================================

  checkMorale(unit, reason) {
    const roll = Dice.roll();
    let quality = unit.quality;
    const specialRulesApplied = [];
    const ctx = { unit, roll, quality, passed: roll >= quality, reason, dice: Dice, specialRulesApplied };

    const results = this.registry.applyHook(HOOKS.ON_MORALE_TEST, ctx);
    let passed = roll >= quality;
    results.forEach(r => {
      if (r.passed !== undefined) passed = r.passed;
      if (r.quality !== undefined) quality = r.quality;
      if (r.roll !== undefined) roll = r.roll;
    });

    return { passed, roll, quality, specialRulesApplied };
  }

  applyMoraleResult(unit, passed, reason) {
    if (passed) return 'passed';
    const halfThreshold = Math.floor((unit.total_models || 1) / 2);
    if (unit.current_models <= halfThreshold) {
      unit.status = 'routed';
      unit.current_models = 0;
      return 'routed';
    } else {
      unit.status = 'shaken';
      return 'shaken';
    }
  }

  applyRegeneration(unit, wounds, suppressed = false) {
    if (suppressed || wounds <= 0) return { finalWounds: wounds, ignored: 0, rolls: [] };
    const rolls = [];
    let ignored = 0;
    for (let i = 0; i < wounds; i++) {
      const roll = Dice.roll();
      rolls.push(roll);
      if (roll >= 5) ignored++;
    }
    return { finalWounds: wounds - ignored, ignored, rolls };
  }

  updateObjectives(gameState) {
    for (const obj of gameState.objectives) {
      const controllingUnit = gameState.units.find(u =>
        u.current_models > 0 &&
        u.status !== 'shaken' &&
        u.status !== 'routed' &&
        this._distance(u, obj) <= 3
      );
      obj.controlled_by = controllingUnit ? controllingUnit.owner : null;
    }
  }

  deployAmbush(unit, gameState) {
    const ctx = { unit, gameState, dice: Dice };
    const results = this.registry.applyHook(HOOKS.ON_RESERVE_ENTRY, ctx);
    if (results.length > 0) {
      const r = results[0];
      if (r.x !== undefined && r.y !== undefined) {
        unit.x = r.x;
        unit.y = r.y;
        return true;
      }
    }
    return false;
  }

  replenishSpellTokens(unit) {
    const tokensBefore = unit.spell_tokens || 0;
    const ctx = { unit, currentTokens: tokensBefore };
    const results = this.registry.applyHook(HOOKS.ON_TOKEN_GAIN, ctx);
    let tokensAfter = tokensBefore;
    results.forEach(r => { if (r.tokens !== undefined) tokensAfter = r.tokens; });
    unit.spell_tokens = tokensAfter;
    return tokensAfter - tokensBefore;
  }

  getCasterTokens(unit) {
    return unit.spell_tokens || 0;
  }

  checkDangerousTerrain(unit, terrain, action) {
    const dangerCtx = { unit, terrain, action, dice: Dice };
    const results = this.registry.applyHook(HOOKS.ON_DANGEROUS_TERRAIN, dangerCtx);
    return results.reduce((sum, r) => sum + (r.wounds || 0), 0);
  }

  onRoundEnd(gameState) {
    const ctx = { gameState, dice: Dice };
    this.registry.applyHook(HOOKS.ON_ROUND_END, ctx);
  }

  getActiveRules(unit, gameState) {
    const rules = new Set(unit.rules || []);
    const ctx = { unit, gameState };
    const results = this.registry.applyHook(HOOKS.ON_GET_RULES, ctx);
    results.forEach(r => {
      if (r.additionalRules) {
        r.additionalRules.forEach(rule => rules.add(rule));
      }
    });
    return Array.from(rules);
  }

  // =========================================================================
  // INTERNAL PROCESSORS (handle generic effect descriptors)
  // =========================================================================

  _processActivationStartResults(results, unit, gameState, specialRulesApplied) {
    results.forEach(r => {
      if (r.boundingMove) {
        console.log(`Bounding move: may reposition up to ${r.boundingMove}"`);
      }
      if (r.mend) {
        const { target, healAmount } = r.mend;
        target.current_models = Math.min(target.total_models, target.current_models + healAmount);
        specialRulesApplied.push({ rule: 'Mend', effect: `healed ${healAmount} on ${target.name}` });
      }
      if (r.setVersatileMode) {
        unit._versatileAttackMode = r.setVersatileMode;
      }
      if (r.setVersatileDefense) {
        unit._versatileDefenseMode = r.setVersatileDefense;
      }
      if (r.dangerousTerrainTest) {
        const { target } = r.dangerousTerrainTest;
        target._forcedDangerousTerrain = true;
      }
    });
  }

  _processBeforeAttackResults(results, unit, gameState) {
    results.forEach(r => {
      if (r.extraHits) {
        r.extraHits.forEach(hit => {
          const { target, count } = hit;
          for (let i = 0; i < count; i++) {
            target.current_models = Math.max(0, target.current_models - 1);
            if (target.current_models <= 0) target.status = 'destroyed';
          }
        });
      }
      if (r.spawnUnit) {
        console.log('Spawning new unit');
      }
      if (r.heal) {
        unit.current_models = Math.min(unit.total_models, unit.current_models + r.heal);
      }
      if (r.boundingMove) {
        console.log(`Bounding move: may reposition up to ${r.boundingMove}"`);
      }
    });
  }

  _processSpellResults(results, caster, target, gameState, specialRulesApplied) {
    results.forEach(r => {
      if (r.extraHits) {
        r.extraHits.forEach(hit => {
          const { target: hitTarget, count } = hit;
          for (let i = 0; i < count; i++) {
            hitTarget.current_models = Math.max(0, hitTarget.current_models - 1);
            if (hitTarget.current_models <= 0) hitTarget.status = 'destroyed';
          }
        });
      }
      if (r.heal) {
        const { target: healTarget, amount } = r.heal;
        healTarget.current_models = Math.min(healTarget.total_models, healTarget.current_models + amount);
      }
      if (r.grantRule) {
        const { target: ruleTarget, rule, duration } = r.grantRule;
        ruleTarget._tempRules = ruleTarget._tempRules || [];
        ruleTarget._tempRules.push({ rule, duration });
      }
    });
  }

  _processStrafing(results, unit, gameState) {
    results.forEach(r => {
      if (r.strafingAttack) {
        const { target, weapon } = r.strafingAttack;
        this.resolveShooting(unit, target, weapon, gameState);
      }
    });
  }

  _processAfterMeleeResults(results, attacker, defender, gameState) {
    results.forEach(r => {
      if (r.hitAndRunMove) {
        console.log(`Hit & Run: may move up to ${r.hitAndRunMove}"`);
      }
      if (r.retaliateHits) {
        const { target, hits } = r.retaliateHits;
        for (let i = 0; i < hits; i++) {
          target.current_models = Math.max(0, target.current_models - 1);
          if (target.current_models <= 0) target.status = 'destroyed';
        }
      }
    });
  }

  // =========================================================================
  // UTILITIES
  // =========================================================================

  calculateDistance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  getZone(x, y) {
    if (y < 18) return 'south';
    if (y > 30) return 'north';
    return 'centre';
  }

  _isInCover(defender, attacker, terrain) {
    return terrain.some(t => t.cover && this._distance(defender, t) <= t.radius);
  }

  _distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  _lineIntersectsUnit(x1, y1, x2, y2, unit) {
    const d = this._pointToLineDistance(unit.x, unit.y, x1, y1, x2, y2);
    return d < 1;
  }

  _lineIntersectsTerrain(x1, y1, x2, y2, terrain) {
    return terrain.intersectsLine(x1, y1, x2, y2);
  }

  _pointToLineDistance(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
    if (t < 0) return Math.hypot(px - x1, py - y1);
    if (t > 1) return Math.hypot(px - x2, py - y2);
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
  }

  _applyWounds(target, wounds, sourceUnit, gameState) {
    const ctx = { unit: target, wounds, sourceUnit, gameState };
    const results = this.registry.applyHook(HOOKS.ON_WOUND_ALLOCATION, ctx);
    let woundsToApply = wounds;
    results.forEach(r => { if (r.wounds !== undefined) woundsToApply = r.wounds; });

    const oldModels = target.current_models;
    target.current_models = Math.max(0, target.current_models - woundsToApply);
    if (target.current_models <= 0) target.status = 'destroyed';

    const modelsLost = oldModels - target.current_models;
    for (let i = 0; i < modelsLost; i++) {
      const killCtx = { unit: target, modelIndex: i, killer: sourceUnit, gameState };
      this.registry.applyHook(HOOKS.ON_MODEL_KILLED, killCtx);
    }
  }
}
