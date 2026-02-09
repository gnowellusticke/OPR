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
  evaluateActionOptions(unit, gameState, owner) {
    const options = [];
    const enemies = gameState.units.filter(u => u.owner !== owner && u.current_models > 0);
    const nearestEnemy = this.findNearestEnemy(unit, enemies);
    const nearestObjective = this.findNearestObjective(unit, gameState.objectives);

    // Hold - good for shooting units or if already in good position
    options.push({
      action: 'Hold',
      score: this.scoreHoldAction(unit, gameState, nearestEnemy),
      selected: false
    });

    // Advance - balanced option for moving and shooting
    options.push({
      action: 'Advance',
      score: this.scoreAdvanceAction(unit, gameState, nearestEnemy, nearestObjective),
      selected: false
    });

    // Rush - for getting into position quickly
    options.push({
      action: 'Rush',
      score: this.scoreRushAction(unit, gameState, nearestObjective),
      selected: false
    });

    // Charge - for melee units when enemies are in range
    if (nearestEnemy && this.getDistance(unit, nearestEnemy) <= 12) {
      options.push({
        action: 'Charge',
        score: this.scoreChargeAction(unit, nearestEnemy),
        selected: false
      });
    }

    // Select best option
    options.sort((a, b) => b.score - a.score);
    options[0].selected = true;

    return options;
  }

  scoreHoldAction(unit, gameState, nearestEnemy) {
    let score = 0.3;
    
    // Bonus if unit has good ranged weapons
    const hasRanged = unit.weapons?.some(w => w.range > 12);
    if (hasRanged) score += 0.3;
    
    // Bonus if enemies are in range
    if (nearestEnemy && this.getDistance(unit, nearestEnemy) <= 24) score += 0.2;
    
    // Penalty if unit is shaken
    if (unit.status === 'shaken') score = 1.0; // Must hold to recover
    
    return score;
  }

  scoreAdvanceAction(unit, gameState, nearestEnemy, nearestObjective) {
    let score = 0.5;
    
    // Bonus for moving toward objectives
    if (nearestObjective && this.getDistance(unit, nearestObjective) > 3) {
      score += 0.3;
    }
    
    // Bonus if enemies are at medium range
    if (nearestEnemy) {
      const dist = this.getDistance(unit, nearestEnemy);
      if (dist > 12 && dist < 30) score += 0.2;
    }
    
    return score;
  }

  scoreRushAction(unit, gameState, nearestObjective) {
    let score = 0.4;
    
    // High bonus for getting to objectives quickly
    if (nearestObjective && this.getDistance(unit, nearestObjective) > 12) {
      score += 0.4;
    }
    
    // Penalty if unit has shooting weapons (can't shoot after rush)
    const hasRanged = unit.weapons?.some(w => w.range > 6);
    if (hasRanged) score -= 0.3;
    
    return score;
  }

  scoreChargeAction(unit, nearestEnemy) {
    let score = 0.6;
    
    // Bonus for melee-focused units
    const hasMelee = unit.weapons?.some(w => w.range <= 2);
    if (hasMelee) score += 0.4;
    
    // Consider unit strength vs enemy
    const strengthRatio = unit.current_models / (nearestEnemy.current_models || 1);
    score += Math.min(strengthRatio * 0.2, 0.3);
    
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
    
    // Prefer weakened targets
    const healthRatio = enemy.current_models / enemy.total_models;
    score += (1 - healthRatio) * 0.4;
    
    // Prefer closer targets
    const distance = this.getDistance(unit, enemy);
    score += Math.max(0, (30 - distance) / 30) * 0.3;
    
    // Prefer targets we can damage
    if (enemy.defense <= 3) score += 0.3;
    
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