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

  logShoot({ round, actingUnit, targetUnit, weapon, zone, rangeDist, rollResults, gameState, dmnReason }) {
    const isFirstBlood = !this.firstBloodDealt && rollResults.wounds_dealt > 0;
    if (isFirstBlood) this.firstBloodDealt = true;

    const unitDestroyed = targetUnit.current_models <= 0;
    if (unitDestroyed && !this.roundDestroyed.includes(targetUnit.name)) {
      this.roundDestroyed.push(targetUnit.name);
    }

    const toughMatch = targetUnit.special_rules?.match(/Tough\((\d+)\)/);
    const toughValue = toughMatch ? parseInt(toughMatch[1]) : 0;
    const isTurningPoint = unitDestroyed && (toughValue >= 6 || targetUnit.status === 'shaken');

    this.events.push({
      round,
      timestamp: this._timestamp(),
      event_type: 'shoot',
      acting_unit: actingUnit.name,
      target_unit: targetUnit.name,
      weapon_used: weapon,
      zone: zone || 'centre',
      range_bracket: this._rangeBracket(rangeDist),
      roll_results: rollResults,
      unit_state_after: {
        acting_unit: this._unitState(actingUnit),
        target_unit: this._unitState(targetUnit)
      },
      dmn_reason: dmnReason || 'nearest viable target',
      flags: {
        turning_point: isTurningPoint,
        first_blood: isFirstBlood,
        unit_destroyed: unitDestroyed
      }
    });
  }

  logMelee({ round, actingUnit, targetUnit, weaponName, rollResults, gameState, dmnReason }) {
    const isFirstBlood = !this.firstBloodDealt && rollResults.wounds_dealt > 0;
    if (isFirstBlood) this.firstBloodDealt = true;

    const unitDestroyed = targetUnit.current_models <= 0;
    if (unitDestroyed && !this.roundDestroyed.includes(targetUnit.name)) {
      this.roundDestroyed.push(targetUnit.name);
    }

    const toughMatch = targetUnit.special_rules?.match(/Tough\((\d+)\)/);
    const toughValue = toughMatch ? parseInt(toughMatch[1]) : 0;
    const isTurningPoint = unitDestroyed && (toughValue >= 6 || targetUnit.status === 'shaken');

    this.events.push({
      round,
      timestamp: this._timestamp(),
      event_type: 'melee',
      acting_unit: actingUnit.name,
      target_unit: targetUnit.name,
      weapon_used: weaponName || 'CCW',
      zone: null,
      range_bracket: 'close',
      roll_results: rollResults,
      unit_state_after: {
        acting_unit: this._unitState(actingUnit),
        target_unit: this._unitState(targetUnit)
      },
      dmn_reason: dmnReason || 'charge target',
      flags: {
        turning_point: isTurningPoint,
        first_blood: isFirstBlood,
        unit_destroyed: unitDestroyed
      }
    });
  }

  logMove({ round, actingUnit, action, distance, zone, dmnReason, chargeTarget }) {
    this.events.push({
      round,
      timestamp: this._timestamp(),
      event_type: action === 'Charge' ? 'charge' : action === 'Rush' ? 'advance' : 'move',
      acting_unit: actingUnit.name,
      target_unit: chargeTarget || null,
      weapon_used: null,
      zone,
      range_bracket: null,
      roll_results: { distance_moved: parseFloat(distance?.toFixed(1) || 0) },
      unit_state_after: { acting_unit: this._unitState(actingUnit) },
      dmn_reason: dmnReason || action.toLowerCase(),
      flags: { turning_point: false, first_blood: false, unit_destroyed: false }
    });
  }

  logDestruction({ round, unit, cause }) {
    unit.status = 'destroyed';
    this.events.push({
      round,
      timestamp: this._timestamp(),
      event_type: 'destruction',
      acting_unit: null,
      target_unit: unit.name,
      weapon_used: null,
      zone: null,
      range_bracket: null,
      roll_results: { cause },
      unit_state_after: { target_unit: { wounds_remaining: 0, max_wounds: unit.total_models, status: 'destroyed' } },
      dmn_reason: null,
      flags: { turning_point: true, first_blood: false, unit_destroyed: true }
    });
    if (!this.roundDestroyed.includes(unit.name)) this.roundDestroyed.push(unit.name);
  }

  logMorale({ round, unit, outcome, roll, qualityTarget, dmnReason }) {
    if (outcome === 'shaken' && !this.roundShaken.includes(unit.name)) {
      this.roundShaken.push(unit.name);
    }
    this.events.push({
      round,
      timestamp: this._timestamp(),
      event_type: 'morale',
      acting_unit: unit.name,
      target_unit: null,
      weapon_used: null,
      zone: null,
      range_bracket: null,
      roll_results: { roll: roll ?? null, quality_target: qualityTarget ?? (unit.quality || 4), outcome },
      unit_state_after: { acting_unit: this._unitState(unit) },
      dmn_reason: dmnReason || 'morale check triggered',
      flags: {
        turning_point: outcome === 'routed',
        first_blood: false,
        unit_destroyed: outcome === 'routed'
      }
    });
  }

  logRegeneration({ round, unit, recovered, roll }) {
    this.events.push({
      round,
      timestamp: this._timestamp(),
      event_type: 'regeneration',
      acting_unit: unit.name,
      target_unit: null,
      weapon_used: null,
      zone: null,
      range_bracket: null,
      // Bug 2: single roll value, not array
      roll_results: { roll: roll ?? null, wounds_recovered: recovered, outcome: recovered > 0 ? 'recovered' : 'no recovery' },
      unit_state_after: { acting_unit: this._unitState(unit) },
      dmn_reason: 'end of round regeneration',
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
      objectives: {},
      score,
      units_destroyed_this_round: [...this.roundDestroyed],
      units_shaken_this_round: [...this.roundShaken]
    };
    objectives.forEach((obj, idx) => {
      summary.objectives[`objective_${idx + 1}`] = obj.controlled_by || 'uncontrolled';
    });
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