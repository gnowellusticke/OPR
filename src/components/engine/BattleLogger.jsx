// Structured JSON battle logger — runs alongside the plain text log
export class BattleLogger {
  constructor(battleId, armyA, armyB) {
    this.battleId = battleId;
    this.armyA = armyA;
    this.armyB = armyB;
    this.events = [];
    this.firstBloodDealt = false;
    this.roundDestroyed = [];
    this.roundShaken = [];
    this.battleConfig = { scoring_mode: 'per_round', advance_rules: [] };
  }

  // ─── DEPLOYMENT ───────────────────────────────────────────────────────────

  logCoinToss({ winner, choice, reason, firstActivation }) {
    this.events.push({
      round: 0,
      timestamp: this._timestamp(),
      event_type: 'coin_toss',
      acting_unit: null,
      target_unit: null,
      weapon_used: null,
      zone: null,
      range_bracket: null,
      roll_results: { roll: Math.random() > 0.5 ? 'heads' : 'tails', winner, choice, reason },
      unit_state_after: {},
      dmn_reason: reason,
      flags: { turning_point: false, first_blood: false, unit_destroyed: false, first_activation: firstActivation }
    });
  }

  logDeploy({ unit, zone, deploymentType, reserveRule, dmnReason, specialRulesApplied }) {
    // Bug 3 & 4 fix: Include full unit profile with unit-level special rules for verification
    const unitSpecialRules = unit.special_rules || [];
    const unitProfile = {
      quality: unit.quality || 4,
      defense: unit.defense || 5,
      special_rules: unitSpecialRules,
      tough: unitSpecialRules.match(/Tough\((\d+)\)/)?.[1] || null,
      models: unit.model_count || 1,
      weapons: (unit.weapons || []).map(w => ({
        name: w.name,
        range: w.range,
        attacks: w.attacks || 1,
        ap: w.ap || 0,
        special_rules: w.special_rules || []
      }))
    };

    this.events.push({
      round: 0,
      timestamp: this._timestamp(),
      event_type: 'deploy',
      acting_unit: unit.name,
      target_unit: null,
      weapon_used: null,
      zone: zone || 'unknown',
      range_bracket: null,
      roll_results: {
        deployment_type: deploymentType || 'standard',
        ...(reserveRule ? { reserve_rule: reserveRule } : {}),
        special_rules_applied: specialRulesApplied || []
      },
      unit_state_after: {
        acting_unit: {
          wounds_remaining: unit.current_models,
          max_wounds: unit.total_models,
          status: unit.status || 'normal'
        }
      },
      unit_profile: unitProfile,
      dmn_reason: dmnReason || 'standard deployment',
      flags: { turning_point: false, first_blood: false, unit_destroyed: false }
    });
  }

  logObjectivesPlaced({ diceRoll, numObjectives, objectives }) {
    const objMap = {};
    for (let i = 1; i <= 5; i++) {
      const obj = objectives[i - 1];
      if (obj) {
        objMap[`objective_${i}`] = { x: parseFloat(obj.x.toFixed(1)), y: parseFloat(obj.y.toFixed(1)) };
      } else {
        objMap[`objective_${i}`] = 'n/a';
      }
    }
    this._numObjectives = numObjectives; // remember for round summaries
    this.events.push({
      round: 0,
      timestamp: this._timestamp(),
      event_type: 'objectives_placed',
      acting_unit: null, target_unit: null, weapon_used: null, zone: null, range_bracket: null,
      roll_results: { dice_roll: diceRoll, num_objectives: numObjectives, objectives: objMap },
      unit_state_after: {}, dmn_reason: `d3(${diceRoll})+2 = ${numObjectives} objectives`,
      flags: { turning_point: false, first_blood: false, unit_destroyed: false }
    });
  }

  logDeploymentSummary({ agentADeployed, agentBDeployed, reserves, firstActivation, dmnReason }) {
    this.events.push({
      round: 0,
      timestamp: this._timestamp(),
      event_type: 'deployment_summary',
      acting_unit: null,
      target_unit: null,
      weapon_used: null,
      zone: null,
      range_bracket: null,
      roll_results: {
        agent_a_deployed: agentADeployed,
        agent_b_deployed: agentBDeployed,
        reserves,
        first_activation: firstActivation
      },
      unit_state_after: {},
      dmn_reason: dmnReason || '',
      flags: { turning_point: false, first_blood: false, unit_destroyed: false }
    });
  }

  setBattleConfig(config) {
    this.battleConfig = { ...this.battleConfig, ...config };
  }

  _unitState(unit) {
    if (!unit) return null;
    return {
      wounds_remaining: unit.current_models,
      max_wounds: unit.total_models,
      status: unit.current_models <= 0 ? 'destroyed' : (unit.status || 'normal')
    };
  }

  _timestamp() {
    return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  logShoot({ round, actingUnit, targetUnit, weapon, zone, rangeDist, rollResults, gameState, dmnReason, stateBefore }) {
    const isFirstBlood = !this.firstBloodDealt && (rollResults.wounds_dealt > 0);
    if (isFirstBlood) this.firstBloodDealt = true;

    // unit_destroyed flag belongs on the event that causes death, not after
    const unitDestroyed = targetUnit.current_models <= 0;
    if (unitDestroyed && !this.roundDestroyed.includes(targetUnit.name)) {
      this.roundDestroyed.push(targetUnit.name);
    }

    const toughMatch = targetUnit.special_rules?.match(/Tough\((\d+)\)/);
    const toughValue = toughMatch ? parseInt(toughMatch[1]) : 0;
    const isTurningPoint = unitDestroyed && (toughValue >= 6 || targetUnit.status === 'shaken');

    const specialRules = rollResults.special_rules_applied || [];
    const { internal_score, ...cleanRollResults } = rollResults;

    this.events.push({
      round,
      timestamp: this._timestamp(),
      event_type: 'shoot',
      acting_unit: actingUnit.name,
      target_unit: targetUnit.name,
      weapon_used: weapon,
      zone: zone || 'centre',
      range_bracket: this._rangeBracket(rangeDist),
      roll_results: { ...cleanRollResults, special_rules_applied: specialRules },
      // Enhancement 1: unit_state_before snapshot (captured before dice are rolled)
      unit_state_before: stateBefore || null,
      unit_state_after: {
        acting_unit: this._unitState(actingUnit),
        target_unit: this._unitState(targetUnit)
      },
      dmn_reason: dmnReason || 'nearest viable target',
      internal_score: internal_score,
      flags: {
        turning_point: isTurningPoint,
        first_blood: isFirstBlood,
        unit_destroyed: unitDestroyed
      }
    });
  }

  logMelee({ round, actingUnit, targetUnit, weaponName, rollResults, gameState, dmnReason, stateBefore }) {
    const isFirstBlood = !this.firstBloodDealt && (rollResults.wounds_dealt > 0);
    if (isFirstBlood) this.firstBloodDealt = true;

    const unitDestroyed = targetUnit.current_models <= 0;
    if (unitDestroyed && !this.roundDestroyed.includes(targetUnit.name)) {
      this.roundDestroyed.push(targetUnit.name);
    }

    const toughMatch = targetUnit.special_rules?.match(/Tough\((\d+)\)/);
    const toughValue = toughMatch ? parseInt(toughMatch[1]) : 0;
    const isTurningPoint = unitDestroyed && (toughValue >= 6 || targetUnit.status === 'shaken');

    const specialRules = rollResults.special_rules_applied || [];
    const { internal_score, ...cleanRollResults } = rollResults;

    this.events.push({
      round,
      timestamp: this._timestamp(),
      event_type: 'melee',
      acting_unit: actingUnit.name,
      target_unit: targetUnit.name,
      weapon_used: weaponName || 'Fists',
      zone: null,
      range_bracket: 'close',
      roll_results: { ...cleanRollResults, special_rules_applied: specialRules },
      // Enhancement 1: unit_state_before snapshot
      unit_state_before: stateBefore || null,
      unit_state_after: {
        acting_unit: this._unitState(actingUnit),
        target_unit: this._unitState(targetUnit)
      },
      dmn_reason: dmnReason || 'charge target',
      internal_score: internal_score,
      flags: {
        turning_point: isTurningPoint,
        first_blood: isFirstBlood,
        unit_destroyed: unitDestroyed
      }
    });
  }

  logMove({ round, actingUnit, action, distance, zone, dmnReason, chargeTarget, chargeTargetState, chargeSpecialRules, stateBefore }) {
    const isCharge = action === 'Charge';
    this.events.push({
      round,
      timestamp: this._timestamp(),
      event_type: isCharge ? 'charge' : 'move',
      acting_unit: actingUnit.name,
      target_unit: chargeTarget || null,
      weapon_used: null,
      zone,
      range_bracket: null,
      roll_results: {
        distance_moved: parseFloat(distance?.toFixed(1) || 0),
        ...(isCharge ? { special_rules_applied: chargeSpecialRules || [] } : {})
      },
      // Enhancement 1: unit_state_before snapshot on charge events
      unit_state_before: isCharge ? (stateBefore || null) : null,
      unit_state_after: {
        acting_unit: this._unitState(actingUnit),
        ...(isCharge && chargeTargetState ? { target_unit: chargeTargetState } : {})
      },
      dmn_reason: dmnReason || action.toLowerCase(),
      flags: { turning_point: false, first_blood: false, unit_destroyed: false }
    });
  }

  logDestruction({ round, unit, cause, actingUnit, killedByWeapon }) {
    unit.status = 'destroyed';
    // Enhancement 2: Extract killer from cause string if not explicitly provided
    let killerName = actingUnit || null;
    let weaponName = killedByWeapon || null;
    if (!killerName && cause) {
      const byMatch = cause.match(/by (.+?) \(/) || cause.match(/with (.+)$/);
      if (byMatch) killerName = byMatch[1];
    }
    const richReason = killerName
      ? `${killerName} destroyed ${unit.name}${weaponName ? ` with ${weaponName}` : ''}${cause ? ` (${cause})` : ''}`
      : (cause || null);

    this.events.push({
      round,
      timestamp: this._timestamp(),
      event_type: 'destruction',
      // Enhancement 2: acting_unit and killed_by_weapon attributed directly
      acting_unit: killerName,
      target_unit: unit.name,
      weapon_used: weaponName,
      zone: null,
      range_bracket: null,
      roll_results: { cause },
      unit_state_after: { target_unit: { wounds_remaining: 0, max_wounds: unit.total_models, status: 'destroyed' } },
      dmn_reason: richReason,
      flags: { turning_point: true, first_blood: false, unit_destroyed: true }
    });
    if (!this.roundDestroyed.includes(unit.name)) this.roundDestroyed.push(unit.name);
  }

  logMorale({ round, unit, outcome, roll, qualityTarget, dmnReason, specialRulesApplied, woundsTaken, stateBefore }) {
    if (outcome === 'shaken' && !this.roundShaken.includes(unit.name)) {
      this.roundShaken.push(unit.name);
    }
    const quality = qualityTarget ?? (unit.quality || 4);
    const outcomeLabel = outcome === 'passed' ? 'Holds' : outcome === 'shaken' ? 'Shaken' : outcome === 'routed' ? 'Routed' : outcome;
    // Enhancement 3: rich dmn_reason for morale events
    const richReason = dmnReason && dmnReason !== 'morale check triggered'
      ? dmnReason
      : `Morale check: ${unit.name}${woundsTaken != null ? ` took ${woundsTaken} wound(s)` : ''} (${unit.current_models}/${unit.total_models} remaining), quality ${quality}+ required, rolled ${roll ?? '?'} → ${outcomeLabel}`;

    this.events.push({
      round,
      timestamp: this._timestamp(),
      event_type: 'morale',
      acting_unit: unit.name,
      target_unit: null,
      weapon_used: null,
      zone: null,
      range_bracket: null,
      roll_results: {
        roll: roll ?? null,
        quality_needed: quality,
        quality_target: quality,
        outcome,
        special_rules_applied: specialRulesApplied || []
      },
      unit_state_before: stateBefore || null,
      unit_state_after: { acting_unit: this._unitState(unit) },
      dmn_reason: richReason,
      flags: {
        turning_point: outcome === 'routed',
        first_blood: false,
        unit_destroyed: outcome === 'routed'
      }
    });
  }

  logRegeneration({ round, unit, recovered, roll, ruleName }) {
    this.events.push({
      round,
      timestamp: this._timestamp(),
      event_type: 'regeneration',
      acting_unit: unit.name,
      target_unit: null,
      weapon_used: null,
      zone: null,
      range_bracket: null,
      roll_results: {
        roll: roll ?? null,
        wounds_recovered: recovered,
        outcome: recovered > 0 ? 'recovered' : 'no recovery',
        special_rules_applied: [{ rule: ruleName || 'Regeneration', value: null, effect: 'end of round recovery roll' }]
      },
      unit_state_after: { acting_unit: this._unitState(unit) },
      dmn_reason: `end of round ${ruleName || 'Regeneration'}`,
      flags: { turning_point: false, first_blood: false, unit_destroyed: false }
    });
  }

  logAbility({ round, unit, ability, details }) {
    this.events.push({
      round,
      timestamp: this._timestamp(),
      event_type: 'ability',
      acting_unit: unit.name,
      target_unit: null,
      weapon_used: null,
      zone: null,
      range_bracket: null,
      roll_results: { ability, ...details },
      unit_state_after: { acting_unit: this._unitState(unit) },
      dmn_reason: `used ${ability}`,
      flags: { turning_point: false, first_blood: false, unit_destroyed: false }
    });
  }

  logObjective({ round, objective_idx, controlled_by }) {
    this.events.push({
      round,
      timestamp: this._timestamp(),
      event_type: 'objective',
      acting_unit: null,
      target_unit: null,
      weapon_used: null,
      zone: null,
      range_bracket: null,
      roll_results: { objective: objective_idx + 1, controlled_by },
      unit_state_after: {},
      dmn_reason: 'objective update',
      flags: { turning_point: false, first_blood: false, unit_destroyed: false }
    });
  }

  logRoundSummary({ round, objectives, score }) {
    const summary = {
      event_type: 'round_summary',
      round,
      timestamp: this._timestamp(),
      objectives: {
        objective_1: null,
        objective_2: null,
        objective_3: null,
        objective_4: null,
        objective_5: null
      },
      score,
      units_destroyed_this_round: [...this.roundDestroyed],
      units_shaken_this_round: [...this.roundShaken]
    };
    // Bug 4 fix: objectives present on the board show their state; objectives not generated
    // this game show 'n/a' — distinct from 'uncontrolled' (generated but uncaptured).
    const numOnBoard = this._numObjectives || objectives.length;
    for (let i = 0; i < Math.min(objectives.length, 5); i++) {
      const obj = objectives[i];
      summary.objectives[`objective_${i + 1}`] = obj.controlled_by || 'uncontrolled';
    }
    // Any slot beyond what was generated this game → 'n/a'
    for (let i = objectives.length; i < 5; i++) {
      summary.objectives[`objective_${i + 1}`] = 'n/a';
    }
    this.events.push(summary);
    // Reset per-round tracking
    this.roundDestroyed = [];
    this.roundShaken = [];
  }

  logBattleEnd({ winner, finalScore, armyA, armyB }) {
    this.events.push({
      round: null,
      timestamp: this._timestamp(),
      event_type: 'battle_end',
      acting_unit: null,
      target_unit: null,
      weapon_used: null,
      zone: null,
      range_bracket: null,
      roll_results: {},
      unit_state_after: {},
      dmn_reason: null,
      flags: { turning_point: true, first_blood: false, unit_destroyed: false }
    });
  }

  getFullLog(winner, finalScore) {
    return {
      battle_id: this.battleId,
      date: new Date().toISOString().split('T')[0],
      battle_config: this.battleConfig,
      advance_rules: this.battleConfig.advance_rules,
      agent_a: { faction: this.armyA?.faction || 'Unknown', list_points: this.armyA?.total_points || 0 },
      agent_b: { faction: this.armyB?.faction || 'Unknown', list_points: this.armyB?.total_points || 0 },
      winner: winner === 'agent_a' ? 'Agent A' : winner === 'agent_b' ? 'Agent B' : 'Draw',
      final_score: finalScore,
      events: this.events
    };
  }

  _rangeBracket(dist) {
    if (!dist || dist <= 12) return 'close';
    if (dist <= 24) return 'mid';
    return 'long';
  }
}