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
   * @param {Object} target – optional target position {x, y} or enemy unit for charge
   * @param {Array} terrain – list of terrain objects
   * @returns {Object} { distance, specialRulesApplied, ... }
   */
  executeMovement(unit, action, target, terrain) {
    const ctx = { unit, action, target, gameState: this._getGameState(), terrain, dice: Dice };
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

    // ON_MOVE_PATH hooks (e.g., Flying, ignore units/terrain)
    const movePathResults = this.registry.applyHook(HOOKS.ON_MOVE_PATH, { ...ctx, fromX: unit.x, fromY: unit.y, toX: target.x, toY: target.y, specialRulesApplied });
    const ignoreUnits = movePathResults.some(r => r.ignoreUnits);
    const ignoreTerrain = movePathResults.some(r => r.ignoreTerrain);

    // Terrain movement hooks (ON_TERRAIN_MOVE)
    const terrainResults = this.registry.applyHook(HOOKS.ON_TERRAIN_MOVE, { ...ctx, terrain, specialRulesApplied });
    const ignoreDifficult = terrainResults.some(r => r.ignoreDifficult);
    const ignoreAllTerrain = terrainResults.some(r => r.ignoreTerrain);

    // (Simplified) actual movement distance calculation would go here,
    // including terrain penalties if not ignored.
    // For this example, we just apply the distance.
    const distance = speed; // placeholder

    unit.x = target.x;
    unit.y = target.y;

    // Dangerous terrain check (ON_DANGEROUS_TERRAIN hook)
    const dangerCtx = { unit, terrain, action, dice: Dice, specialRulesApplied };
    const dangerResults = this.registry.applyHook(HOOKS.ON_DANGEROUS_TERRAIN, dangerCtx);
    const dangerWounds = dangerResults.reduce((sum, r) => sum + (r.wounds || 0), 0);
    if (dangerWounds > 0) {
      this._applyWounds(unit, dangerWounds, null);
    }

    // ON_MOVE_THROUGH_ENEMY for strafing etc. would be checked during path

    return { distance, specialRulesApplied };
  }

  // =========================================================================
  // SHOOTING
  // =========================================================================

  /**
   * Resolves a shooting attack from one unit against another.
   * @param {Unit} attacker
   * @param {Unit} defender
   * @param {Weapon} weapon
   * @param {Object} gameState – includes terrain, objectives, etc.
   * @returns {Object} { hits, saves, wounds, hit_rolls, defense_rolls, specialRulesApplied }
   */
  resolveShooting(attacker, defender, weapon, gameState) {
    const specialRulesApplied = [];
    const ctx = { unit: attacker, weapon, target: defender, gameState, dice: Dice, specialRulesApplied };

    // BEFORE_ATTACK (Limited weapons, etc.)
    const beforeAttackResults = this.registry.applyHook(HOOKS.BEFORE_ATTACK, ctx);
    if (beforeAttackResults.some(r => r.preventAttack)) {
      return { hits: 0, saves: 0, wounds: 0, hit_rolls: [], defense_rolls: [], specialRulesApplied };
    }

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
    const suppressed = incomingResults.some(r => r.suppressRegeneration); // maybe for later

    if (totalWounds > 0) {
      this._applyWounds(defender, totalWounds, attacker);
    }

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

    // Determine who strikes first (engine logic, but hooks could modify)
    let attackerFirst = true;
    // TODO: check for Counter-Attack, Unwieldy, etc. via hooks? Could be a hook ON_STRIKE_ORDER.
    // For now, assume attacker first unless defender has a rule.

    // Resolve attacker's melee attacks (simplified: treat as shooting with melee weapon)
    let attackerWounds = 0;
    for (const weapon of attacker.weapons.filter(w => w.range <= 2)) {
      const shootingResult = this.resolveShooting(attacker, defender, weapon, gameState);
      attackerWounds += shootingResult.wounds;
    }
    // Add extra attacks from hooks
    // (we'd need to generate extra attacks with the weapon, but for simplicity we add wounds directly)
    attackerWounds += extraAttackerWounds;

    // Defender may strike back if alive
    let defenderWounds = 0;
    if (defender.current_models > 0) {
      for (const weapon of defender.weapons.filter(w => w.range <= 2)) {
        const shootingResult = this.resolveShooting(defender, attacker, weapon, gameState);
        defenderWounds += shootingResult.wounds;
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
    if (attackerWounds > 0) this._applyWounds(defender, attackerWounds, attacker);
    if (defenderWounds > 0) this._applyWounds(attacker, defenderWounds, defender);

    return {
      attacker_wounds: attackerWounds,
      defender_wounds: defenderWounds,
      rollResults: {}, // could include detailed logs
      specialRulesApplied,
    };
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
   * @returns {Object} { success, roll, modifiedRoll, tokensAfter, specialRulesApplied }
   */
  castSpell(caster, spell, target, gameState) {
    const specialRulesApplied = [];
    const ctx = { caster, spell, target, gameState, dice: Dice, specialRulesApplied };

    // ON_SPELL_CAST hook (Caster, Spell Conduit, etc.)
    const results = this.registry.applyHook(HOOKS.ON_SPELL_CAST, ctx);
    let success = false;
    let finalRoll = 0;
    results.forEach(r => {
      if (r.success !== undefined) success = r.success;
      if (r.roll !== undefined) finalRoll = r.roll;
    });

    return { success, roll: finalRoll, modifiedRoll: finalRoll, tokensAfter: caster.spell_tokens, specialRulesApplied };
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
  // DANGEROUS TERRAIN
  // =========================================================================

  checkDangerousTerrain(unit, terrain, action) {
    // Simplified: for each terrain piece intersected, roll die, on 1 take wound.
    // This is just an example; actual check should use movement path.
    const dangerCtx = { unit, terrain, action, dice: Dice };
    const results = this.registry.applyHook(HOOKS.ON_DANGEROUS_TERRAIN, dangerCtx);
    return results.reduce((sum, r) => sum + (r.wounds || 0), 0);
  }

  // =========================================================================
  // UTILITIES
  // =========================================================================

  calculateDistance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  getZone(x, y) {
    // Returns deployment zone name (simplified)
    if (y < 18) return 'south';
    if (y > 30) return 'north';
    return 'centre';
  }

  _getGameState() {
    // In a real implementation, the gameState should be passed to methods.
    // This is a stub; we assume methods receive gameState as argument.
    return null;
  }

  _isInCover(defender, attacker, terrain) {
    // Simplified: if defender is inside any cover terrain, return true.
    return terrain.some(t => t.cover && this._distance(defender, t) <= t.radius);
  }

  _distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  _applyWounds(target, wounds, sourceUnit) {
    const ctx = { unit: target, wounds, sourceUnit };
    const results = this.registry.applyHook(HOOKS.ON_WOUND_ALLOCATION, ctx);
    let woundsToApply = wounds;
    results.forEach(r => { if (r.wounds !== undefined) woundsToApply = r.wounds; });

    const oldModels = target.current_models;
    target.current_models = Math.max(0, target.current_models - woundsToApply);
    if (target.current_models <= 0) target.status = 'destroyed';

    // If models were lost, trigger ON_MODEL_KILLED
    const modelsLost = oldModels - target.current_models;
    for (let i = 0; i < modelsLost; i++) {
      const killCtx = { unit: target, modelIndex: i, killer: sourceUnit };
      this.registry.applyHook(HOOKS.ON_MODEL_KILLED, killCtx);
    }
  }
}
