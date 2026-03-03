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

    // Base speed
    let speed = (action === 'Advance') ? 6 : (action === 'Rush' || action === 'Charge') ? 12 : 0;

    // GET_BASE_SPEED hooks (e.g., Immobile, Aircraft)
    const baseResults = this.registry.applyHook(HOOKS.GET_BASE_SPEED, { ...ctx, specialRulesApplied });
    baseResults.forEach(r => { if (r.overrideSpeed) speed = r.speed; });

    // MODIFY_SPEED hooks (e.g., Fast, Slow, Agile)
    const modifyCtx = { ...ctx, speed, specialRulesApplied };
    const modifyResults = this.registry.applyHook(HOOKS.MODIFY_SPEED, modifyCtx);
    modifyResults.forEach(r => { if (r.speedDelta) speed += r.speedDelta; });

    // Determine path (simplified: straight line from current to target)
    const startX = unit.x, startY = unit.y;
    const endX = target.x, endY = target.y;
    const distance = Math.hypot(endX - startX, endY - startY);
    // Clamp to speed
    const moveDist = Math.min(distance, speed);
    const ratio = moveDist / distance;
    const newX = startX + (endX - startX) * ratio;
    const newY = startY + (endY - startY) * ratio;

    // ON_MOVE_PATH hooks (e.g., Flying, ignore units/terrain)
    const movePathResults = this.registry.applyHook(HOOKS.ON_MOVE_PATH, { ...ctx, fromX: startX, fromY: startY, toX: newX, toY: newY, specialRulesApplied });
    const ignoreUnits = movePathResults.some(r => r.ignoreUnits);
    const ignoreTerrain = movePathResults.some(r => r.ignoreTerrain);

    // Check for unit blocking (unless ignored)
    if (!ignoreUnits) {
      const blockers = gameState.units.filter(u =>
        u.id !== unit.id &&
        u.current_models > 0 &&
        !u.reserve &&
        this._lineIntersectsUnit(startX, startY, newX, newY, u)
      );
      if (blockers.length > 0) {
        // Cannot move through enemy units unless charging? OPR rule: cannot move through other units.
        // For now, abort movement.
        return { distance: 0, blocked: true, specialRulesApplied };
      }
    }

    // Terrain movement hooks (ON_TERRAIN_MOVE)
    const terrainResults = this.registry.applyHook(HOOKS.ON_TERRAIN_MOVE, { ...ctx, terrain, specialRulesApplied });
    const ignoreDifficult = terrainResults.some(r => r.ignoreDifficult);
    const ignoreAllTerrain = terrainResults.some(r => r.ignoreTerrain);

    // Check for terrain penalties (simplified: difficult terrain halves movement if not ignored)
    let effectiveSpeed = speed;
    if (!ignoreAllTerrain && !ignoreDifficult) {
      const difficultTerrain = terrain.filter(t => t.difficult && this._lineIntersectsTerrain(startX, startY, newX, newY, t));
      if (difficultTerrain.length > 0) {
        effectiveSpeed *= 0.5; // simplified penalty
      }
    }

    // Final position after terrain penalties
    const finalDist = Math.min(distance, effectiveSpeed);
    const finalRatio = finalDist / distance;
    const finalX = startX + (endX - startX) * finalRatio;
    const finalY = startY + (endY - startY) * finalRatio;

    // ON_MOVE_THROUGH_ENEMY – check if we passed over any enemy units (for Strafing, etc.)
    const enemiesPassed = gameState.units.filter(u =>
      u.owner !== unit.owner &&
      u.current_models > 0 &&
      this._lineIntersectsUnit(startX, startY, finalX, finalY, u)
    );
    for (const enemy of enemiesPassed) {
      const throughCtx = { unit, enemyUnit: enemy, gameState, dice: Dice, specialRulesApplied };
      const throughResults = this.registry.applyHook(HOOKS.ON_MOVE_THROUGH_ENEMY, throughCtx);
      // The hook may return strafingAttack; process it
      this._processStrafing(throughResults, unit, gameState);
    }

    // Dangerous terrain check (ON_DANGEROUS_TERRAIN)
    const dangerousTerrain = terrain.filter(t => t.dangerous && this._lineIntersectsTerrain(startX, startY, finalX, finalY, t));
    for (const t of dangerousTerrain) {
      const dangerCtx = { unit, terrain: t, action, dice: Dice, specialRulesApplied };
      const dangerResults = this.registry.applyHook(HOOKS.ON_DANGEROUS_TERRAIN, dangerCtx);
      const wounds = dangerResults.reduce((sum, r) => sum + (r.wounds || 0), 0);
      if (wounds > 0) {
        this._applyWounds(unit, wounds, null, gameState);
      }
    }

    // Update unit position
    unit.x = finalX;
    unit.y = finalY;

    return { distance: finalDist, specialRulesApplied };
  }

  // =========================================================================
  // SHOOTING
  // =========================================================================

  /**
   * Resolves a shooting attack from one unit against another.
   * @param {Unit} attacker
   * @param {Unit} defender
   * @param {Weapon} weapon
   * @param {Object} gameState
   * @returns {Object} { hits, saves, wounds, hit_rolls, defense_rolls, specialRulesApplied }
   */
  resolveShooting(attacker, defender, weapon, gameState) {
    const specialRulesApplied = [];
    const ctx = { unit: attacker, weapon, target: defender, gameState, dice: Dice, specialRulesApplied, isMelee: false };

    // BEFORE_ATTACK (Limited weapons, etc.)
    const beforeAttackResults = this.registry.applyHook(HOOKS.BEFORE_ATTACK, ctx);
    if (beforeAttackResults.some(r => r.preventAttack)) {
      return { hits: 0, saves: 0, wounds: 0, hit_rolls: [], defense_rolls: [], specialRulesApplied };
    }
    // Process any healing, spawn, etc. from BEFORE_ATTACK
    this._processBeforeAttackResults(beforeAttackResults, attacker, gameState);

    // Determine number of attacks (may be modified by hooks later)
    let attacks = attacker.current_models * (weapon.attacks || 1);
    const hitRolls = [];
    let hits = 0;

    for (let i = 0; i < attacks; i++) {
      let quality = attacker.quality;

      // BEFORE_HIT_QUALITY hooks
      const hitCtx = { ...ctx, quality, hitIndex: i };
      const hitResults = this.registry.applyHook(HOOKS.BEFORE_HIT_QUALITY, hitCtx);
      hitResults.forEach(r => { if (r.quality !== undefined) quality = r.quality; });

      const roll = Dice.roll();
      const success = roll >= quality;
      hitRolls.push({ value: roll, success, auto: false, relentless: false });
      if (success) hits++;
    }

    // AFTER_HIT_ROLLS hooks (Blast, Furious, etc.)
    const afterHitCtx = { ...ctx, rolls: hitRolls, successes: hits, _ruleParamValue: weapon.getParam('Blast') };
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

      // ON_PER_HIT pre-save (Rending, etc.)
      let ap = weapon.ap;
      const preSaveCtx = { ...ctx, hitRoll, hitIndex: i, ap, defense: defender.defense };
      const preSaveResults = this.registry.applyHook(HOOKS.ON_PER_HIT, preSaveCtx);
      preSaveResults.forEach(r => { if (r.apBonus) ap += r.apBonus; });

      let defense = defender.defense;
      // Cover check (engine's own logic, not a hook)
      const inCover = this._isInCover(defender, attacker, gameState.terrain);
      if (inCover) defense += 1;

      // BEFORE_SAVE_DEFENSE hooks (AP, Fortified, etc.)
      const saveCtx = { ...ctx, defender, weapon, terrain: null, defense, ap, _ruleParamValue: weapon.getParam('AP') };
      const saveResults = this.registry.applyHook(HOOKS.BEFORE_SAVE_DEFENSE, saveCtx);
      saveResults.forEach(r => { if (r.ap !== undefined) ap = r.ap; });
      saveResults.forEach(r => { if (r.defense !== undefined) defense = r.defense; });
      const ignoresCover = saveResults.some(r => r.ignoresCover);

      const modifiedDefense = Math.min(6, defense - ap);
      let saveRoll = Dice.roll();
      let saveSuccess = saveRoll >= modifiedDefense;

      // ON_PER_HIT post-save (Bane, Shred, etc.)
      const postSaveCtx = { ...ctx, hitRoll, hitIndex: i, ap, defense: defender.defense, saveRoll, modifiedDefense };
      const postSaveResults = this.registry.applyHook(HOOKS.ON_PER_HIT, postSaveCtx);
      postSaveResults.forEach(r => {
        if (r.rerollResult !== undefined) {
          saveRoll = r.rerollResult;
          saveSuccess = saveRoll >= modifiedDefense;
        }
        if (r.extraWounds) {
          // handled later in wound calc
        }
      });

      defenseRolls.push({ value: saveRoll, success: saveSuccess });
      if (!saveSuccess) unsavedHits++;
    }

    let totalWounds = 0;
    for (let i = 0; i < unsavedHits; i++) {
      let wounds = 1;
      const woundCtx = { ...ctx, weapon, unsavedHit: hitRolls[i], toughPerModel: defender.tough, _ruleParamValue: weapon.getParam('Deadly') };
      const woundResults = this.registry.applyHook(HOOKS.ON_WOUND_CALC, woundCtx);
      woundResults.forEach(r => { if (r.wounds !== undefined) wounds = r.wounds; });
      totalWounds += wounds;
    }

    // ON_INCOMING_WOUNDS (Regeneration, etc.)
    const incomingCtx = { unit: defender, wounds: totalWounds, suppressedByBane: false, dice: Dice, specialRulesApplied };
    const incomingResults = this.registry.applyHook(HOOKS.ON_INCOMING_WOUNDS, incomingCtx);
    incomingResults.forEach(r => { if (r.wounds !== undefined) totalWounds = r.wounds; });

    if (totalWounds > 0) {
      this._applyWounds(defender, totalWounds, attacker, gameState);
    }

    // AFTER_ATTACK cleanup hook
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
  // MELEE
  // =========================================================================

  /**
   * Resolves melee combat between two units.
   * @param {Unit} attacker
   * @param {Unit} defender
   * @param {Object} gameState
   * @returns {Object} { attacker_wounds, defender_wounds, rollResults, specialRulesApplied }
   */
  resolveMelee(attacker, defender, gameState) {
    const specialRulesApplied = [];
    const ctx = { unit: attacker, target: defender, gameState, dice: Dice, specialRulesApplied, isMelee: true };

    // BEFORE_MELEE_ATTACK hooks (Ravage, Regenerative Strength, etc.)
    const beforeResults = this.registry.applyHook(HOOKS.BEFORE_MELEE_ATTACK, ctx);
    let extraAttackerWounds = 0;
    let extraAttacks = 0;
    beforeResults.forEach(r => {
      if (r.extraWounds) extraAttackerWounds += r.extraWounds;
      if (r.extraAttacks) extraAttacks += r.extraAttacks;
    });

    // Determine strike order (ON_STRIKE_ORDER hook)
    let attackerFirst = true;
    const orderCtx = { attacker, defender, gameState };
    const orderResults = this.registry.applyHook(HOOKS.ON_STRIKE_ORDER, orderCtx);
    orderResults.forEach(r => { if (r.attackerFirst !== undefined) attackerFirst = r.attackerFirst; });

    // Resolve attacks in order
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

    // ON_MELEE_RESOLUTION hooks (Fear)
    const meleeResCtx = { attacker, defender, attackerWounds, defenderWounds, gameState, specialRulesApplied };
    const meleeResResults = this.registry.applyHook(HOOKS.ON_MELEE_RESOLUTION, meleeResCtx);
    meleeResResults.forEach(r => {
      if (r.attackerWounds !== undefined) attackerWounds = r.attackerWounds;
      if (r.defenderWounds !== undefined) defenderWounds = r.defenderWounds;
    });

    // Apply wounds (with ON_WOUND_ALLOCATION and ON_MODEL_KILLED)
    if (attackerWounds > 0) this._applyWounds(defender, attackerWounds, attacker, gameState);
    if (defenderWounds > 0) this._applyWounds(attacker, defenderWounds, defender, gameState);

    // AFTER_MELEE_ATTACK cleanup for both units
    const afterAttackerCtx = { unit: attacker, gameState, specialRulesApplied };
    this.registry.applyHook(HOOKS.AFTER_MELEE_ATTACK, afterAttackerCtx);
    const afterDefenderCtx = { unit: defender, gameState, specialRulesApplied };
    this.registry.applyHook(HOOKS.AFTER_MELEE_ATTACK, afterDefenderCtx);

    // AFTER_MELEE global hook (for Hit & Run, Self-Destruct, etc.)
    const afterMeleeCtx = { attacker, defender, gameState, dice: Dice, specialRulesApplied };
    const afterMeleeResults = this.registry.applyHook(HOOKS.AFTER_MELEE, afterMeleeCtx);
    // Process any hitAndRunMove, retaliateHits, etc.
    this._processAfterMeleeResults(afterMeleeResults, attacker, defender, gameState);

    return {
      attacker_wounds: attackerWounds,
      defender_wounds: defenderWounds,
      rollResults: {}, // could include detailed logs
      specialRulesApplied,
    };
  }

  /**
   * Helper to resolve one side's melee attacks.
   */
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

  /**
   * Attempts to cast a spell.
   * @param {Unit} caster
   * @param {Object} spell – { name, cost, range, effect, ... }
   * @param {Unit} target
   * @param {Object} gameState
   * @param {number} friendlyBonus – additional bonus from helpers
   * @param {number} hostileBonus – penalty from enemy counters
   * @returns {Object} { success, roll, modifiedRoll, tokensAfter, specialRulesApplied }
   */
  castSpell(caster, spell, target, gameState, friendlyBonus = 0, hostileBonus = 0) {
    const specialRulesApplied = [];
    const ctx = { caster, spell, target, gameState, dice: Dice, specialRulesApplied };

    // ON_SPELL_CAST hook (Caster, Spell Conduit, etc.)
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
      if (r.castPosition) actualCaster = r.castPosition; // for Spell Conduit
      if (r.target) actualTarget = r.target;
      if (r.rangeMod) rangeMod = r.rangeMod;
    });

    // If no hook provided a result, do default casting
    if (results.length === 0) {
      const roll = Dice.roll();
      modifiedRoll = roll + friendlyBonus - hostileBonus;
      success = modifiedRoll >= 4;
      finalRoll = modifiedRoll;
      if (success) {
        caster.spell_tokens -= spell.cost;
      }
    }

    return { success, roll: finalRoll, modifiedRoll, tokensAfter: caster.spell_tokens, specialRulesApplied };
  }

  // =========================================================================
  // MORALE
  // =========================================================================

  /**
   * Performs a morale test.
   * @param {Unit} unit
   * @param {string} reason – 'wounds' | 'melee_loss'
   * @returns {Object} { passed, roll, quality, specialRulesApplied }
   */
  checkMorale(unit, reason) {
    const roll = Dice.roll();
    let quality = unit.quality;
    const specialRulesApplied = [];
    const ctx = { unit, roll, quality, passed: roll >= quality, reason, dice: Dice, specialRulesApplied };

    // ON_MORALE_TEST hooks (Fearless, Hive Bond, etc.)
    const results = this.registry.applyHook(HOOKS.ON_MORALE_TEST, ctx);
    let passed = roll >= quality;
    results.forEach(r => {
      if (r.passed !== undefined) passed = r.passed;
      if (r.quality !== undefined) quality = r.quality;
      if (r.roll !== undefined) roll = r.roll; // some hooks modify roll
    });

    return { passed, roll, quality, specialRulesApplied };
  }

  /**
   * Applies the result of a morale test (Shaken/Rout).
   * @param {Unit} unit
   * @param {boolean} passed
   * @param {string} reason
   */
  applyMoraleResult(unit, passed, reason) {
    if (passed) {
      return 'passed';
    }
    // Unit fails: if <= half starting models, rout; else shaken.
    const halfThreshold = Math.floor((unit.total_models || 1) / 2);
    if (unit.current_models <= halfThreshold) {
      unit.status = 'routed';
      unit.current_models = 0; // rout = remove
      return 'routed';
    } else {
      unit.status = 'shaken';
      return 'shaken';
    }
  }

  // =========================================================================
  // REGENERATION (applied separately)
  // =========================================================================

  /**
   * Applies Regeneration to incoming wounds.
   * @param {Unit} unit
   * @param {number} wounds
   * @param {boolean} suppressed – if Regeneration is suppressed by Bane etc.
   * @returns {Object} { finalWounds, ignored, rolls }
   */
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

  // =========================================================================
  // OBJECTIVES
  // =========================================================================

  updateObjectives(gameState) {
    // Simple: unit within 3" of objective and not shaken controls it
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

  // =========================================================================
  // DEPLOYMENT (Ambush, etc.)
  // =========================================================================

  /**
   * Attempts to deploy a unit from reserve.
   * @param {Unit} unit
   * @param {Object} gameState
   * @returns {boolean} true if deployed
   */
  deployAmbush(unit, gameState) {
    const ctx = { unit, gameState, dice: Dice };
    const results = this.registry.applyHook(HOOKS.ON_RESERVE_ENTRY, ctx);
    if (results.length > 0) {
      // Use first result's coordinates
      const r = results[0];
      if (r.x !== undefined && r.y !== undefined) {
        unit.x = r.x;
        unit.y = r.y;
        return true;
      }
    }
    return false;
  }

  // =========================================================================
  // SPELL TOKENS
  // =========================================================================

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

  // =========================================================================
  // DANGEROUS TERRAIN (legacy method, kept for compatibility)
  // =========================================================================

  checkDangerousTerrain(unit, terrain, action) {
    // Simplified: for each terrain piece intersected, roll die, on 1 take wound.
    // This is just an example; actual check should use movement path.
    const dangerCtx = { unit, terrain, action, dice: Dice };
    const results = this.registry.applyHook(HOOKS.ON_DANGEROUS_TERRAIN, dangerCtx);
    return results.reduce((sum, r) => sum + (r.wounds || 0), 0);
  }

  // =========================================================================
  // ROUND END HOOK (called by game controller)
  // =========================================================================

  onRoundEnd(gameState) {
    const ctx = { gameState, dice: Dice };
    this.registry.applyHook(HOOKS.ON_ROUND_END, ctx);
  }

  // =========================================================================
  // AURA RESOLUTION
  // =========================================================================

  /**
   * Returns all active rules for a unit, including those from auras.
   * @param {Unit} unit
   * @param {Object} gameState
   * @returns {Array} combined list of rule names
   */
  getActiveRules(unit, gameState) {
    // Start with unit's own rules
    const rules = new Set(unit.rules || []);
    // Apply ON_GET_RULES hook to add any temporary/aura rules
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
  // UTILITIES / INTERNAL PROCESSING
  // =========================================================================

  _processBeforeAttackResults(results, unit, gameState) {
    results.forEach(r => {
      if (r.extraHits) {
        // extraHits is an array of { target, count, blast, ap, rupture, ... }
        // For each hit, we need to resolve an automatic hit. We'll call a helper.
        r.extraHits.forEach(hit => {
          const { target, count, blast, ap, rupture } = hit;
          for (let i = 0; i < count; i++) {
            // Resolve as automatic hit; we need a weapon-like object
            const autoWeapon = {
              name: 'auto-hit',
              attacks: 1,
              ap: ap || 0,
              rules: [],
              getParam: () => null,
            };
            if (blast) autoWeapon.ruleParams = { Blast: blast };
            if (rupture) autoWeapon.rules.push('Rupture');
            // We need to resolve this hit. We can call resolveShooting with a dummy attacker? 
            // Actually, we need to apply the hit directly to target. For simplicity, we'll just apply a wound.
            // But proper resolution would involve saves, etc. For now, we'll treat as automatic wound.
            // In a full implementation, you'd call resolveShooting with a dummy weapon.
            target.current_models = Math.max(0, target.current_models - 1);
            if (target.current_models <= 0) target.status = 'destroyed';
          }
        });
      }
      if (r.spawnUnit) {
        // Create new unit of type r.spawnUnit.type with count r.spawnUnit.count within 6"
        console.log('Spawning new unit');
        // Implementation would involve creating a new unit and adding to gameState.
        // This is complex; we'll leave it as a placeholder.
      }
      if (r.heal) {
        unit.current_models = Math.min(unit.total_models, unit.current_models + r.heal);
      }
      if (r.boundingMove) {
        // The unit may be repositioned; the engine should allow the player/AI to choose a new position within r.boundingMove inches.
        // We'll just note it.
        console.log(`Bounding move: may reposition up to ${r.boundingMove}"`);
      }
    });
  }

  _processStrafing(results, unit, gameState) {
    results.forEach(r => {
      if (r.strafingAttack) {
        const { target, weapon } = r.strafingAttack;
        // Resolve a shooting attack with this weapon against the target
        this.resolveShooting(unit, target, weapon, gameState);
      }
    });
  }

  _processAfterMeleeResults(results, attacker, defender, gameState) {
    results.forEach(r => {
      if (r.hitAndRunMove) {
        console.log(`Hit & Run: may move up to ${r.hitAndRunMove}"`);
        // The engine should allow the player to move the unit.
      }
      if (r.retaliateHits) {
        // retaliateHits is { target, hits }
        const { target, hits } = r.retaliateHits;
        for (let i = 0; i < hits; i++) {
          // Resolve as automatic hit (simplified)
          target.current_models = Math.max(0, target.current_models - 1);
          if (target.current_models <= 0) target.status = 'destroyed';
        }
      }
    });
  }

  calculateDistance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  getZone(x, y) {
    if (y < 18) return 'south';
    if (y > 30) return 'north';
    return 'centre';
  }

  _isInCover(defender, attacker, terrain) {
    // Simplified: if defender is inside any cover terrain, return true.
    return terrain.some(t => t.cover && this._distance(defender, t) <= t.radius);
  }

  _distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  _lineIntersectsUnit(x1, y1, x2, y2, unit) {
    // Simple check: distance from unit's center to line segment < 1"
    const d = this._pointToLineDistance(unit.x, unit.y, x1, y1, x2, y2);
    return d < 1;
  }

  _lineIntersectsTerrain(x1, y1, x2, y2, terrain) {
    // Simplified: check if line segment intersects terrain circle
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

    // If models were lost, trigger ON_MODEL_KILLED for each lost model
    const modelsLost = oldModels - target.current_models;
    for (let i = 0; i < modelsLost; i++) {
      const killCtx = { unit: target, modelIndex: i, killer: sourceUnit, gameState };
      this.registry.applyHook(HOOKS.ON_MODEL_KILLED, killCtx);
    }
  }
}
