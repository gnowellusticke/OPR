// BPMN State Machine - Game Flow Control
export class BPMNEngine {
  constructor() {
    this.state = 'preparation';
    this.transitions = {
      preparation: ['deployment'],
      deployment: ['round_start'],
      round_start: ['activation'],
      activation: ['activation', 'round_end'],
      round_end: ['round_start', 'victory'],
      victory: ['completed']
    };
  }

  canTransition(nextState) {
    return this.transitions[this.state]?.includes(nextState);
  }

  transition(nextState) {
    if (this.canTransition(nextState)) {
      this.state = nextState;
      return true;
    }
    return false;
  }
}

// DMN Decision Tables - AI Logic
export class DMNEngine {
  constructor() {
    this.learningData = null;
  }

  async loadLearningData(armyId) {
    try {
      const { base44 } = await import('@/api/base44Client');
      const analytics = await base44.entities.BattleAnalytics.filter({ army_id: armyId });
      this.learningData = this.analyzePastPerformance(analytics);
    } catch (err) {
      this.learningData = null;
    }
  }

  analyzePastPerformance(analytics) {
    if (!analytics || analytics.length === 0) return null;

    const wins = analytics.filter(a => a.result === 'won').length;
    const totalBattles = analytics.length;
    const winRate = totalBattles > 0 ? wins / totalBattles : 0;

    // Aggregate successful actions
    const actionSuccess = {};
    analytics.forEach(a => {
      if (a.successful_actions) {
        Object.keys(a.successful_actions).forEach(action => {
          actionSuccess[action] = (actionSuccess[action] || 0) + a.successful_actions[action];
        });
      }
    });

    return { winRate, actionSuccess, totalBattles };
  }

  // Classify unit as melee-primary: has at least one melee weapon AND melee weapons >= ranged weapons
  isMeleePrimary(unit) {
    const melee = (unit.weapons || []).filter(w => w.range <= 2);
    const ranged = (unit.weapons || []).filter(w => w.range > 2);
    return melee.length > 0 && melee.length >= ranged.length;
  }

  // Maximum charge distance for unit (base 12" for Charge action)
  maxChargeDistance(unit) {
    let base = 12;
    if (unit.special_rules?.includes('Fast')) base += 4;
    if (unit.special_rules?.includes('Slow')) base -= 4;
    return Math.max(0, base);
  }

  evaluateActionOptions(unit, gameState, owner) {
    const options = [];
    const enemies = gameState.units.filter(u => u.owner !== owner && u.current_models > 0);
    const nearestEnemy = this.findNearestEnemy(unit, enemies);
    const nearestObjective = this.findNearestObjective(unit, gameState.objectives);
    
    const strategicState = this.analyzeStrategicPosition(gameState, owner);

    if (unit.embarked_in) {
      options.push({ action: 'Disembark', score: this.scoreDisembarkAction(unit, gameState, owner), selected: true });
      return options;
    }

    const isTransport = unit.special_rules?.includes('Transport');
    
    options.push({
      action: 'Hold',
      score: this.scoreHoldAction(unit, gameState, nearestEnemy, strategicState),
      selected: false
    });

    options.push({
      action: 'Advance',
      score: this.scoreAdvanceAction(unit, gameState, nearestEnemy, nearestObjective, strategicState),
      selected: false
    });

    options.push({
      action: 'Rush',
      score: this.scoreRushAction(unit, gameState, nearestObjective, strategicState),
      selected: false
    });

    // Charge only offered when enemy is within maximum charge distance and unit hasn't charged this round
    const chargeRange = this.maxChargeDistance(unit);
    const canCharge = nearestEnemy && this.getDistance(unit, nearestEnemy) <= chargeRange && !isTransport && !unit.just_charged;
    if (canCharge) {
      options.push({
        action: 'Charge',
        score: this.scoreChargeAction(unit, nearestEnemy, gameState, owner, strategicState),
        selected: false
      });
    }

    // Apply learning adjustments
    if (this.learningData && this.learningData.actionSuccess) {
      const totalActions = Object.values(this.learningData.actionSuccess).reduce((a, b) => a + b, 0);
      options.forEach(opt => {
        const successCount = this.learningData.actionSuccess[opt.action] || 0;
        const successRate = totalActions > 0 ? successCount / totalActions : 0;
        // Boost successful actions by up to 20 points based on historical success
        opt.score += successRate * 20;
      });
    }

    // Select best option
    options.sort((a, b) => b.score - a.score);
    options[0].selected = true;

    return options;
  }
  
  analyzeStrategicPosition(gameState, owner) {
    const myUnits = gameState.units.filter(u => u.owner === owner && u.current_models > 0);
    const enemyUnits = gameState.units.filter(u => u.owner !== owner && u.current_models > 0);
    
    // Count total strength
    const myStrength = myUnits.reduce((sum, u) => sum + u.current_models, 0);
    const enemyStrength = enemyUnits.reduce((sum, u) => sum + u.current_models, 0);
    
    // Count objectives controlled
    const myObjectives = gameState.objectives.filter(o => o.controlled_by === owner).length;
    const enemyObjectives = gameState.objectives.filter(o => o.controlled_by !== owner && o.controlled_by !== null).length;
    
    // Determine if we're winning
    const strengthRatio = myStrength / Math.max(enemyStrength, 1);
    const objectivesWinning = myObjectives > enemyObjectives;
    const isWinning = objectivesWinning || strengthRatio > 1.3;
    const isLosing = !objectivesWinning && strengthRatio < 0.7;
    
    return {
      isWinning,
      isLosing,
      myStrength,
      enemyStrength,
      strengthRatio,
      myObjectives,
      enemyObjectives,
      roundsRemaining: Math.max(0, 5 - (gameState.current_round || 1))
    };
  }
  
  predictOpponentResponse(unit, action, gameState, owner) {
    // Simulate what opponent might do in response
    const enemies = gameState.units.filter(u => u.owner !== owner && u.current_models > 0);
    
    let threatLevel = 0;
    
    for (const enemy of enemies) {
      const distance = this.getDistance(unit, enemy);
      
      // If we're in charge range, opponent might charge us
      if (distance <= 12 && enemy.weapons?.some(w => w.range <= 2)) {
        threatLevel += 0.4;
      }
      
      // If we're in shooting range, opponent might shoot us
      if (distance <= 24 && enemy.weapons?.some(w => w.range > 12)) {
        threatLevel += 0.2;
      }
      
      // Consider enemy strength
      const enemyStrength = enemy.current_models * (enemy.quality <= 3 ? 1.5 : 1.0);
      threatLevel += (enemyStrength / 10) * 0.1;
    }
    
    return threatLevel;
  }

  scoreDisembarkAction(unit, gameState, owner) {
    // Always disembark to take actions
    return 1.0;
  }

  scoreHoldAction(unit, gameState, nearestEnemy, strategicState) {
    let score = 0.3;

    // Bug 6: penalise Hold for units that have been inactive too long
    if ((unit.rounds_without_offense || 0) >= 2) score -= 0.4;
    
    // Bonus if unit has good ranged weapons
    const hasRanged = unit.weapons?.some(w => w.range > 12);
    if (hasRanged) score += 0.3;
    
    // Bonus if enemies are in range
    if (nearestEnemy && this.getDistance(unit, nearestEnemy) <= 24) score += 0.2;
    
    // Penalty if unit is shaken
    if (unit.status === 'shaken') score = 1.0; // Must hold to recover
    
    // Strategic adjustments
    if (strategicState.isWinning && hasRanged) {
      // If winning, defensive shooting is good
      score += 0.2;
    }
    
    // If on an objective, holding is valuable
    const onObjective = gameState.objectives.some(obj => 
      this.getDistance(unit, obj) <= 3
    );
    if (onObjective) score += 0.3;
    
    return score;
  }

  scoreAdvanceAction(unit, gameState, nearestEnemy, nearestObjective, strategicState) {
    let score = 0.5;

    // Melee-primary units within charge range should strongly prefer Charge, not Advance
    if (this.isMeleePrimary(unit) && nearestEnemy) {
      const dist = this.getDistance(unit, nearestEnemy);
      const chargeRange = this.maxChargeDistance(unit);
      if (dist <= chargeRange) score -= 0.6; // decisive penalty — Charge will win
      else if (dist <= chargeRange + 6) score -= 0.2; // getting close — still prefer Rush
    }
    
    // Bonus for moving toward objectives
    if (nearestObjective && this.getDistance(unit, nearestObjective) > 3) {
      score += 0.3;
      if (strategicState.myObjectives < strategicState.enemyObjectives) score += 0.4;
    }
    
    // Bonus if enemies are at medium range (good for shoot-and-advance units)
    if (nearestEnemy) {
      const dist = this.getDistance(unit, nearestEnemy);
      if (dist > 12 && dist < 30) score += 0.2;
    }
    
    if (strategicState.isLosing && strategicState.roundsRemaining < 3) score += 0.3;
    
    return score;
  }

  scoreRushAction(unit, gameState, nearestObjective, strategicState) {
    let score = 0.4;
    
    // High bonus for getting to objectives quickly
    if (nearestObjective && this.getDistance(unit, nearestObjective) > 12) {
      score += 0.4;
    }
    
    // Penalty if unit has shooting weapons (can't shoot after rush)
    const hasRanged = unit.weapons?.some(w => w.range > 6);
    if (hasRanged) score -= 0.3;
    
    // If we're behind on objectives and time is running out, rush!
    if (strategicState.isLosing && strategicState.roundsRemaining <= 2) {
      score += 0.5;
    }
    
    // If enemy controls more objectives, rush to contest
    if (strategicState.enemyObjectives > strategicState.myObjectives) {
      score += 0.3;
    }
    
    return score;
  }

  scoreChargeAction(unit, nearestEnemy, gameState, owner, strategicState) {
    // Base score — deliberately high so melee-primary units almost always pick Charge
    // when an enemy is within charge range.
    let score = 1.0;

    const meleeWeapons = (unit.weapons || []).filter(w => w.range <= 2);
    const hasMelee = meleeWeapons.length > 0;
    const meleePrimary = this.isMeleePrimary(unit);
    const chargeRange = this.maxChargeDistance(unit);
    const dist = nearestEnemy ? this.getDistance(unit, nearestEnemy) : 99;

    // Hard gate: never score Charge if enemy is outside max charge distance
    // (evaluateActionOptions already filters this, but guard defensively)
    if (dist > chargeRange) return -99;

    // Melee-primary archetype bonus — ensures Orc Warriors / Buggies / Cyborgs charge reliably
    if (meleePrimary) score += 1.0;

    // Named rule bonuses
    if (unit.special_rules?.includes('Furious')) score += 0.5;
    if (unit.special_rules?.includes('Rage')) score += 0.4;

    // Any melee weapon is better than nothing
    if (hasMelee) score += 0.4;

    // Distance scaling: closer = better (normalised to 0–0.8 range)
    score += ((chargeRange - dist) / chargeRange) * 0.8;

    // Finish off weak targets
    const enemyHealthRatio = nearestEnemy.current_models / (nearestEnemy.total_models || 1);
    if (enemyHealthRatio < 0.5) score += 0.3;

    // Objective pressure
    const targetOnObjective = gameState.objectives.some(obj =>
      this.getDistance(nearestEnemy, obj) <= 3 && obj.controlled_by !== owner
    );
    if (targetOnObjective) score += 0.4;

    // Inactivity boost — push units that haven't fought recently
    if ((unit.rounds_without_offense || 0) >= 2) score += 0.5;

    // Penalise pure-ranged units (no melee weapons) — they should not charge
    if (!hasMelee) score = 0.2;

    // Reduce if badly outnumbered and no support
    const strengthRatio = unit.current_models / (nearestEnemy.current_models || 1);
    if (strengthRatio < 0.3) score -= 0.3;

    return score;
  }

  selectTarget(unit, enemies) {
    if (!enemies || enemies.length === 0) return null;
    
    // Score each enemy
    const scoredEnemies = enemies.map(enemy => ({
      enemy,
      score: this.scoreTarget(unit, enemy)
    }));
    
    scoredEnemies.sort((a, b) => b.score - a.score);
    return scoredEnemies[0].enemy;
  }

  scoreTarget(unit, enemy) {
    let score = 0;
    
    // Prefer weakened targets we can finish off
    const healthRatio = enemy.current_models / enemy.total_models;
    score += (1 - healthRatio) * 0.5;
    
    // Big bonus for nearly destroyed units (finish them off!)
    if (healthRatio < 0.3) score += 0.4;
    
    // Prefer closer targets
    const distance = this.getDistance(unit, enemy);
    score += Math.max(0, (30 - distance) / 30) * 0.3;
    
    // Prefer targets we can damage
    if (enemy.defense <= 3) score += 0.3;
    
    // Prioritize threats - units with high quality/firepower
    if (enemy.quality <= 3) score += 0.2;
    if (enemy.weapons?.some(w => w.range > 18 && w.attacks >= 3)) score += 0.2;

    // DEADLY units prioritize TOUGH units
    const hasDeadly = unit.weapons?.some(w => w.special_rules?.includes('Deadly'));
    if (hasDeadly && enemy.special_rules?.includes('Tough')) {
      score += 0.5;
    }

    // BLAST units prioritize units with many models
    const hasBlast = unit.weapons?.some(w => w.special_rules?.includes('Blast'));
    if (hasBlast && enemy.current_models >= 5) {
      score += 0.4;
    }
    
    return score;
  }

  getDistance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  findNearestEnemy(unit, enemies) {
    if (!enemies || enemies.length === 0) return null;
    return enemies.reduce((nearest, enemy) => {
      const dist = this.getDistance(unit, enemy);
      return dist < this.getDistance(unit, nearest) ? enemy : nearest;
    });
  }

  findNearestObjective(unit, objectives) {
    if (!objectives || objectives.length === 0) return null;
    return objectives.reduce((nearest, obj) => {
      const dist = this.getDistance(unit, obj);
      return dist < this.getDistance(unit, nearest) ? obj : nearest;
    });
  }

  findNearestTransport(unit, gameState, owner) {
    const transports = gameState.units.filter(u => 
      u.owner === owner && 
      u.special_rules?.includes('Transport') &&
      u.current_models > 0 &&
      !u.embarked_in
    );
    
    if (transports.length === 0) return null;
    
    return transports.reduce((nearest, transport) => {
      const dist = this.getDistance(unit, transport);
      return !nearest || dist < this.getDistance(unit, nearest) ? transport : nearest;
    });
  }
}

// CMMN Case Manager - Complex State Handling
export class CMMNEngine {
  constructor() {
    this.activeCases = new Map();
  }

  createCase(type, data) {
    const caseId = `${type}_${Date.now()}`;
    this.activeCases.set(caseId, {
      type,
      data,
      status: 'active',
      created: Date.now()
    });
    return caseId;
  }

  handleMeleeCase(attacker, defender, gameState) {
    const caseId = this.createCase('melee', { attacker, defender });
    
    // Track fatigue state
    if (attacker.just_charged) {
      attacker.fatigued = true;
    }
    
    return {
      caseId,
      requiresStrikeBack: true,
      requiresMoraleCheck: true,
      fatigueApplied: attacker.fatigued
    };
  }

  handleMoraleCase(unit, reason, gameState) {
    const caseId = this.createCase('morale', { unit, reason });
    
    // Determine if unit should test
    let shouldTest = false;
    
    if (reason === 'wounds' && unit.current_models <= unit.total_models / 2) {
      shouldTest = true;
    } else if (reason === 'melee_loss') {
      shouldTest = true;
    }
    
    return {
      caseId,
      shouldTest,
      autoFail: unit.status === 'shaken'
    };
  }

  handleShakenCase(unit) {
    const caseId = this.createCase('shaken', { unit });
    
    return {
      caseId,
      canAct: false,
      canStrikeBack: true,
      cannotSeizeObjectives: true,
      recoveryAction: 'hold'
    };
  }

  closeCase(caseId) {
    const case_ = this.activeCases.get(caseId);
    if (case_) {
      case_.status = 'closed';
      case_.closed = Date.now();
    }
  }
}

// Dice Roller
export class DiceRoller {
  roll() {
    return Math.floor(Math.random() * 6) + 1;
  }

  rollQualityTest(quality, count = 1) {
    const rolls = [];
    for (let i = 0; i < count; i++) {
      const value = this.roll();
      rolls.push({
        value,
        success: value >= quality || value === 6
      });
    }
    return rolls;
  }

  rollDefense(defense, count = 1) {
    const rolls = [];
    for (let i = 0; i < count; i++) {
      const value = this.roll();
      rolls.push({
        value,
        success: value >= defense || value === 6
      });
    }
    return rolls;
  }
}

export default {
  BPMNEngine,
  DMNEngine,
  CMMNEngine,
  DiceRoller
};