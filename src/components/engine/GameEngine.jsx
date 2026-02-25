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
  constructor(personality = null) {
    this.learningData = null;
    this.personality = personality || null; // loaded from PersonalityRegistry
    this._tunnelTarget = null; // for tunnel-vision: locked target id
  }

  setPersonality(personality) {
    this.personality = personality;
    this._tunnelTarget = null;
  }

  // ── Personality helpers ────────────────────────────────────────────────────

  // Returns true if the personality is in "attrition critical" state for a unit.
  // Overrides the default threshold using personality.attrition_threshold.
  isAttritionCritical(unit) {
    const threshold = this.personality?.attrition_threshold ?? 0.4;
    const healthRatio = unit.current_models / Math.max(unit.total_models, 1);
    return healthRatio < threshold;
  }

  // Apply a random risk bias (positive = riskier choices get a nudge).
  _riskBias() {
    const bias = this.personality?.risk_bias ?? 0;
    // Small random fluctuation around the bias value to simulate human variance
    return bias + (Math.random() - 0.5) * 0.2;
  }

  // Tunnel vision: occasionally lock onto a single target for the whole activation.
  // Returns the locked target if still alive, otherwise releases the lock.
  _resolveTunnelTarget(unit, enemies) {
    const chance = this.personality?.tunnel_vision_chance ?? 0;
    if (this._tunnelTarget) {
      const stillAlive = enemies.find(e => e.id === this._tunnelTarget && e.current_models > 0);
      if (stillAlive) return stillAlive;
      this._tunnelTarget = null; // target is dead — release lock
    }
    if (chance > 0 && Math.random() < chance && enemies.length > 0) {
      // Pick the highest-threat enemy and lock onto them
      const scored = enemies.map(e => ({ e, s: this.scoreTarget(unit, e, enemies) }));
      scored.sort((a, b) => b.s - a.s);
      this._tunnelTarget = scored[0].e.id;
      return scored[0].e;
    }
    return null;
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

  isMeleePrimary(unit) {
    const isFireSupport = unit.special_rules?.includes('Indirect') ||
      /artillery|gun|cannon|mortar|support/i.test(unit.name);
    if (isFireSupport) return false;
    const melee = (unit.weapons || []).filter(w => w.range <= 2);
    const ranged = (unit.weapons || []).filter(w => w.range > 2);
    return melee.length > 0 && melee.length >= ranged.length;
  }

  maxChargeDistance(unit) {
    let base = 12;
    if (unit.special_rules?.includes('Fast')) base += 4;
    if (unit.special_rules?.includes('Slow')) base -= 4;
    return Math.max(0, base);
  }

  // ── 1. ENEMY ARCHETYPE DETECTION ─────────────────────────────────────────
  // Detect the opponent's army composition to adapt counter-strategy.
  detectEnemyArchetype(enemies) {
    if (!enemies || enemies.length === 0) return 'unknown';
    let meleeCount = 0, rangedCount = 0, vehicleCount = 0;
    enemies.forEach(e => {
      const toughMatch = e.special_rules?.match(/Tough\((\d+)\)/);
      const toughVal = toughMatch ? parseInt(toughMatch[1]) : 0;
      if (toughVal >= 6) vehicleCount++;
      else if (this.isMeleePrimary(e)) meleeCount++;
      else rangedCount++;
    });
    const total = enemies.length;
    if (vehicleCount / total >= 0.4) return 'vehicle_heavy';
    if (meleeCount / total >= 0.5) return 'melee_swarm';
    if (rangedCount / total >= 0.5) return 'elite_ranged';
    return 'mixed';
  }

  // ── 2. FORMATION / POSITIONING: ally cluster & flank exposure ────────────
  // Returns a positioning penalty if unit is too clustered with allies,
  // or a bonus for screening fire-support units.
  scoreFormation(unit, allies, gameState) {
    let score = 0;
    const CLUSTER_RADIUS = 8;
    const nearbyAllies = allies.filter(a => a.id !== unit.id && this.getDistance(unit, a) < CLUSTER_RADIUS);

    // Penalise clustering — spread units across the board
    score -= nearbyAllies.length * 0.15;

    // Fire support units want allies between them and the enemy
    const isFireSupport = unit.special_rules?.includes('Indirect') ||
      /artillery|gun|cannon|mortar|support/i.test(unit.name) ||
      unit.weapons?.some(w => w.range >= 24);
    if (isFireSupport) {
      const screeningAllies = allies.filter(a =>
        a.id !== unit.id &&
        this.getDistance(unit, a) < 15 &&
        !this.isMeleePrimary(a)
      );
      score += screeningAllies.length * 0.2;
    }

    // Bonus for flanking — being in a different column from most allies
    const allyColumns = allies.filter(a => a.id !== unit.id).map(a => a.x < 24 ? 'left' : a.x < 48 ? 'centre' : 'right');
    const myCol = unit.x < 24 ? 'left' : unit.x < 48 ? 'centre' : 'right';
    const uniqueCols = new Set(allyColumns);
    if (!uniqueCols.has(myCol) || allyColumns.filter(c => c === myCol).length <= 1) score += 0.2;

    return score;
  }

  // ── 3. ATTRITION / RETREAT LOGIC ─────────────────────────────────────────
  // Units below 40% health should avoid melee and retreat if possible.
  isAttritionCritical(unit) {
    const healthRatio = unit.current_models / Math.max(unit.total_models, 1);
    return healthRatio < 0.4;
  }

  // ── 4. THREAT ZONE MAP ────────────────────────────────────────────────────
  // Returns a threat level at (x, y) given all enemies — used to route units around danger.
  getThreatLevel(x, y, enemies) {
    let threat = 0;
    for (const e of enemies) {
      const dist = Math.hypot(x - e.x, y - e.y);
      const toughMatch = e.special_rules?.match(/Tough\((\d+)\)/);
      const isTough = toughMatch && parseInt(toughMatch[1]) >= 6;
      const hasLongRange = e.weapons?.some(w => w.range >= 24);
      const isMelee = this.isMeleePrimary(e);
      // Heavy melee threats dominate close zones
      if (isMelee && dist < 14) threat += (14 - dist) / 14 * (isTough ? 2.0 : 1.2);
      // Ranged threats cover wider zones
      if (hasLongRange && dist < 30) threat += (30 - dist) / 30 * 0.6;
    }
    return threat;
  }

  evaluateActionOptions(unit, gameState, owner) {
    const enemies = gameState.units.filter(u => u.owner !== owner && u.current_models > 0);
    const allies = gameState.units.filter(u => u.owner === owner && u.current_models > 0);
    const nearestEnemy = this.findNearestEnemy(unit, enemies);
    const nearestObjective = this.findNearestObjective(unit, gameState.objectives);
    const strategicState = this.analyzeStrategicPosition(gameState, owner);
    const enemyArchetype = this.detectEnemyArchetype(enemies);
    const formationScore = this.scoreFormation(unit, allies, gameState);
    const attritionCritical = this.isAttritionCritical(unit);

    if (unit.embarked_in) {
      return [{ action: 'Disembark', score: 1.0, details: [{ label: 'Always disembark to act', value: 1.0 }], selected: true }];
    }

    const isTransport = unit.special_rules?.includes('Transport');
    const isFireSupport = unit.special_rules?.includes('Indirect') ||
      /artillery|gun|cannon|mortar|support/i.test(unit.name);
    const chargeRange = this.maxChargeDistance(unit);
    const canCharge = nearestEnemy &&
      this.getDistance(unit, nearestEnemy) <= chargeRange &&
      !isTransport && !unit.just_charged && !isFireSupport;

    const p = this.personality;
    const riskBias = this._riskBias();

    const options = [
      { action: 'Hold',    ...this.scoreHoldAction(unit, gameState, nearestEnemy, strategicState, enemyArchetype, formationScore, attritionCritical),    selected: false },
      { action: 'Advance', ...this.scoreAdvanceAction(unit, gameState, nearestEnemy, nearestObjective, strategicState, enemyArchetype, formationScore, attritionCritical), selected: false },
      { action: 'Rush',    ...this.scoreRushAction(unit, gameState, nearestObjective, strategicState, enemies, attritionCritical),    selected: false },
    ];

    // Apply personality base score overrides
    if (p) {
      options.forEach(opt => {
        const w = p.action_weights?.[opt.action];
        if (!w) return;
        const defaultBases = { Hold: 0.3, Advance: 0.5, Rush: 0.4, Charge: 1.2 };
        const delta = (w.base_score ?? defaultBases[opt.action]) - defaultBases[opt.action];
        if (delta !== 0) {
          opt.score += delta;
          opt.details.push({ label: `${p.name} personality (${opt.action})`, value: +delta.toFixed(2) });
        }
      });
      // Apply risk bias as a small global nudge to aggressive actions
      if (riskBias !== 0) {
        const riskyActions = ['Rush', 'Charge'];
        options.forEach(opt => {
          if (riskyActions.includes(opt.action)) {
            opt.score += riskBias;
            opt.details.push({ label: `${p.name} risk bias`, value: +riskBias.toFixed(2) });
          }
        });
      }
    }

    if (canCharge) {
      options.push({ action: 'Charge', ...this.scoreChargeAction(unit, nearestEnemy, gameState, owner, strategicState, attritionCritical), selected: false });
    }

    // Historical learning adjustments
    if (this.learningData?.actionSuccess) {
      const totalActions = Object.values(this.learningData.actionSuccess).reduce((a, b) => a + b, 0);
      options.forEach(opt => {
        const successRate = totalActions > 0 ? (this.learningData.actionSuccess[opt.action] || 0) / totalActions : 0;
        if (successRate > 0) {
          opt.score += successRate * 20;
          opt.details.push({ label: 'Historical success bonus', value: +(successRate * 20).toFixed(2) });
        }
      });
    }

    options.sort((a, b) => b.score - a.score);
    options[0].selected = true;
    return options;
  }

  analyzeStrategicPosition(gameState, owner) {
    const myUnits = gameState.units.filter(u => u.owner === owner && u.current_models > 0);
    const enemyUnits = gameState.units.filter(u => u.owner !== owner && u.current_models > 0);
    const myStrength = myUnits.reduce((sum, u) => sum + u.current_models, 0);
    const enemyStrength = enemyUnits.reduce((sum, u) => sum + u.current_models, 0);
    const myObjectives = gameState.objectives.filter(o => o.controlled_by === owner).length;
    const enemyObjectives = gameState.objectives.filter(o => o.controlled_by !== owner && o.controlled_by !== null).length;
    const strengthRatio = myStrength / Math.max(enemyStrength, 1);
    const objectivesWinning = myObjectives > enemyObjectives;
    const isWinning = objectivesWinning || strengthRatio > 1.3;
    const isLosing = !objectivesWinning && strengthRatio < 0.7;
    const round = gameState.current_round || 1;
    return {
      isWinning, isLosing, myStrength, enemyStrength, strengthRatio,
      myObjectives, enemyObjectives,
      roundsRemaining: Math.max(0, 5 - round),
      round
    };
  }

  scoreHoldAction(unit, gameState, nearestEnemy, strategicState, enemyArchetype, formationScore, attritionCritical) {
    const details = [];
    let score = 0.3;
    details.push({ label: 'Base score', value: 0.3 });

    if (unit.status === 'shaken') {
      return { score: 10.0, details: [{ label: 'Shaken: must Hold to recover', value: 10.0 }] };
    }

    if ((unit.rounds_without_offense || 0) >= 2) { score -= 0.4; details.push({ label: 'Inactive 2+ rounds penalty', value: -0.4 }); }

    const hasRanged = unit.weapons?.some(w => w.range > 12);
    if (hasRanged) { score += 0.3; details.push({ label: 'Has ranged weapons (can shoot)', value: 0.3 }); }
    if (nearestEnemy && this.getDistance(unit, nearestEnemy) <= 24) { score += 0.2; details.push({ label: 'Enemy in shooting range', value: 0.2 }); }

    const onObjective = gameState.objectives.some(obj => this.getDistance(unit, obj) <= 3);
    if (onObjective) { score += 0.4; details.push({ label: 'Holding an objective', value: 0.4 }); }
    if (strategicState.isWinning && hasRanged) { score += 0.2; details.push({ label: 'Winning: defensive fire good', value: 0.2 }); }
    if (strategicState.isWinning && onObjective && strategicState.roundsRemaining <= 2) { score += 0.5; details.push({ label: 'Late game: hold objective to win', value: 0.5 }); }
    if (enemyArchetype === 'melee_swarm' && hasRanged) { score += 0.35; details.push({ label: 'Counter melee swarm: hold & shoot', value: 0.35 }); }
    if (attritionCritical) { score += 0.5; details.push({ label: 'Critically wounded: hold to survive', value: 0.5 }); }
    if (formationScore * 0.3 !== 0) { score += formationScore * 0.3; details.push({ label: 'Formation score', value: +(formationScore * 0.3).toFixed(2) }); }

    return { score, details };
  }

  scoreAdvanceAction(unit, gameState, nearestEnemy, nearestObjective, strategicState, enemyArchetype, formationScore, attritionCritical) {
    const details = [];
    let score = 0.5;
    details.push({ label: 'Base score', value: 0.5 });

    if (this.isMeleePrimary(unit) && nearestEnemy) {
      const dist = this.getDistance(unit, nearestEnemy);
      const chargeRange = this.maxChargeDistance(unit);
      if (dist <= chargeRange) { score -= 1.5; details.push({ label: 'Melee unit: charge is better', value: -1.5 }); }
      else if (dist <= chargeRange + 8) { score -= 0.6; details.push({ label: 'Melee unit: rush to charge range', value: -0.6 }); }
    }

    if (nearestObjective && this.getDistance(unit, nearestObjective) > 3) {
      score += 0.3; details.push({ label: 'Moving toward objective', value: 0.3 });
      if (strategicState.myObjectives < strategicState.enemyObjectives) { score += 0.4; details.push({ label: 'Behind on objectives', value: 0.4 }); }
      if (nearestObjective.controlled_by !== unit.owner) { score += 0.2; details.push({ label: 'Objective not held by us', value: 0.2 }); }
    }

    if (nearestEnemy) {
      const dist = this.getDistance(unit, nearestEnemy);
      if (dist > 12 && dist < 30) { score += 0.2; details.push({ label: 'Enemy at optimal shooting range', value: 0.2 }); }
    }

    if (strategicState.isLosing && strategicState.roundsRemaining < 3) { score += 0.3; details.push({ label: 'Losing late game: push forward', value: 0.3 }); }
    if (enemyArchetype === 'elite_ranged' && !this.isMeleePrimary(unit)) { score += 0.3; details.push({ label: 'Counter elite ranged: close in', value: 0.3 }); }
    if (enemyArchetype === 'vehicle_heavy') {
      const hasAP = unit.weapons?.some(w => (w.ap || 0) >= 2 || w.special_rules?.includes('AP'));
      if (hasAP) { score += 0.25; details.push({ label: 'AP weapons vs vehicles: advance to range', value: 0.25 }); }
    }
    if (attritionCritical && !this.isMeleePrimary(unit)) { score -= 0.3; details.push({ label: 'Critically wounded: avoid advancing', value: -0.3 }); }
    if (formationScore * 0.2 !== 0) { score += formationScore * 0.2; details.push({ label: 'Formation score', value: +(formationScore * 0.2).toFixed(2) }); }

    return { score, details };
  }

  scoreRushAction(unit, gameState, nearestObjective, strategicState, enemies, attritionCritical) {
    const details = [];
    let score = 0.4;
    details.push({ label: 'Base score', value: 0.4 });

    if (nearestObjective && this.getDistance(unit, nearestObjective) > 12) {
      score += 0.4; details.push({ label: 'Far from objective: rush', value: 0.4 });
      if (nearestObjective.controlled_by !== unit.owner) { score += 0.3; details.push({ label: 'Objective not held by us', value: 0.3 }); }
    }

    const hasRanged = unit.weapons?.some(w => w.range > 6);
    if (hasRanged) { score -= 0.3; details.push({ label: 'Ranged unit: can\'t shoot after rush', value: -0.3 }); }

    if (this.isMeleePrimary(unit)) {
      const nearest = this.findNearestEnemy(unit, enemies);
      if (nearest) {
        const dist = this.getDistance(unit, nearest);
        const chargeRange = this.maxChargeDistance(unit);
        if (dist > chargeRange && dist <= chargeRange + 14) { score += 0.8; details.push({ label: 'Rush into charge range next turn', value: 0.8 }); }
      }
    }

    if (strategicState.isLosing && strategicState.roundsRemaining <= 2) { score += 0.5; details.push({ label: 'Losing: desperate rush', value: 0.5 }); }
    if (strategicState.enemyObjectives > strategicState.myObjectives) { score += 0.3; details.push({ label: 'Behind on objectives: contest', value: 0.3 }); }
    if (strategicState.round <= 2 && nearestObjective && this.getDistance(unit, nearestObjective) > 6) { score += 0.3; details.push({ label: 'Early game: rush to objectives', value: 0.3 }); }

    if (attritionCritical) {
      const nearestEnemy = this.findNearestEnemy(unit, enemies);
      if (nearestEnemy && this.getDistance(unit, nearestEnemy) < 18) { score -= 0.6; details.push({ label: 'Critically wounded: avoid rushing toward enemy', value: -0.6 }); }
    }

    return { score, details };
  }

  scoreChargeAction(unit, nearestEnemy, gameState, owner, strategicState, attritionCritical) {
    const details = [];
    const meleeWeapons = (unit.weapons || []).filter(w => w.range <= 2);
    const hasMelee = meleeWeapons.length > 0;
    const meleePrimary = this.isMeleePrimary(unit);

    if (!hasMelee) return { score: 0.2, details: [{ label: 'No melee weapons', value: 0.2 }] };

      const pCharge = this.personality?.action_weights?.Charge;
      const chargeBase = pCharge?.base_score ?? 1.2;
      let score = chargeBase;
      details.push({ label: 'Base melee score', value: chargeBase });
    const chargeRange = this.maxChargeDistance(unit);
    const dist = nearestEnemy ? this.getDistance(unit, nearestEnemy) : 99;
    if (dist > chargeRange) return { score: -99, details: [{ label: 'Out of charge range', value: -99 }] };

    if (meleePrimary) { score += 1.5; details.push({ label: 'Melee-primary archetype', value: 1.5 }); }
    if (unit.special_rules?.includes('Furious')) { score += 0.6; details.push({ label: 'Furious (extra attack on charge)', value: 0.6 }); }
    if (unit.special_rules?.includes('Rage')) { score += 0.5; details.push({ label: 'Rage rule', value: 0.5 }); }
    if (unit.special_rules?.includes('Hatred')) { score += 0.4; details.push({ label: 'Hatred rule', value: 0.4 }); }
    if (unit.special_rules?.includes('Fear')) { score += 0.3; details.push({ label: 'Fear: intimidate in melee', value: 0.3 }); }
    if (hasMelee) { score += 0.5; details.push({ label: 'Has melee weapon', value: 0.5 }); }

    const distBonus = +((chargeRange - dist) / chargeRange).toFixed(2);
    score += distBonus;
    details.push({ label: `Distance bonus (${dist.toFixed(1)}" of ${chargeRange}")`, value: distBonus });

    const enemyHealthRatio = nearestEnemy.current_models / (nearestEnemy.total_models || 1);
    if (enemyHealthRatio < 0.5) { score += 0.4; details.push({ label: 'Target weakened (<50% HP)', value: 0.4 }); }
    if (enemyHealthRatio < 0.25) { score += 0.6; details.push({ label: 'Target near destroyed (<25% HP)', value: 0.6 }); }

    const unitBestAP = Math.max(...(unit.weapons || []).map(w => w.ap || 0), 0);
    const targetIsTough = nearestEnemy.special_rules?.match(/Tough\((\d+)\)/);
    if (targetIsTough && unitBestAP >= 2) { score += 0.4; details.push({ label: `AP(${unitBestAP}) weapon vs Tough target`, value: 0.4 }); }

    const enemies = gameState.units.filter(u => u.owner !== owner && u.current_models > 0);
    const archetype = this.detectEnemyArchetype(enemies);
    if (archetype === 'vehicle_heavy' && unitBestAP >= 2 && meleePrimary) { score += 0.5; details.push({ label: 'Counter vehicle-heavy with AP melee', value: 0.5 }); }

    const targetOnObjective = gameState.objectives.some(obj =>
      this.getDistance(nearestEnemy, obj) <= 3 && obj.controlled_by !== owner
    );
    if (targetOnObjective) { score += 0.5; details.push({ label: 'Charge enemy holding objective', value: 0.5 }); }

    if ((unit.rounds_without_offense || 0) >= 1) { score += 0.4; details.push({ label: 'Inactive 1+ rounds: push forward', value: 0.4 }); }
    if ((unit.rounds_without_offense || 0) >= 2) { score += 0.5; details.push({ label: 'Inactive 2+ rounds: strongly push', value: 0.5 }); }

    const strengthRatio = unit.current_models / (nearestEnemy.current_models || 1);
    if (strengthRatio < 0.3) { score -= 0.3; details.push({ label: 'Badly outnumbered', value: -0.3 }); }
    const critPenalty = this.personality?.action_weights?.Charge?.critically_wounded_penalty ?? -1.0;
    if (attritionCritical && enemyHealthRatio > 0.3) { score += critPenalty; details.push({ label: 'Critically wounded: avoid charge', value: critPenalty }); }
    if (strategicState.isLosing && strategicState.roundsRemaining <= 1) { score += 0.8; details.push({ label: 'Final round desperation charge', value: 0.8 }); }

    return { score, details };
  }

  selectTarget(unit, enemies) {
    if (!enemies || enemies.length === 0) return null;
    // Tunnel vision: personality may lock onto a fixed target
    const tunnelTarget = this._resolveTunnelTarget(unit, enemies);
    if (tunnelTarget) return tunnelTarget;
    const scoredEnemies = enemies.map(enemy => ({
      enemy,
      score: this.scoreTarget(unit, enemy, enemies)
    }));
    scoredEnemies.sort((a, b) => b.score - a.score);
    return scoredEnemies[0].enemy;
  }

  // ── 1. SMART TARGET SCORING ───────────────────────────────────────────────
  scoreTarget(unit, enemy, allEnemies = []) {
    let score = 0;
    const p = this.personality;

    const healthRatio = enemy.current_models / Math.max(enemy.total_models, 1);
    score += (1 - healthRatio) * 0.5;

    // Opportunity kill: nearly dead — finish them before they act
    const oppKillBonus = p?.targeting?.opportunity_kill_bonus ?? 0.6;
    const weakenedBonus = p?.targeting?.weakened_target_bonus ?? 0.6;
    if (healthRatio < 0.3) score += oppKillBonus;
    if (healthRatio < 0.15) score += weakenedBonus; // stacked — near certain kill

    const distance = this.getDistance(unit, enemy);
    score += Math.max(0, (30 - distance) / 30) * 0.3;

    // ── 1a. WEAPON MATCHING ────────────────────────────────────────────────
    // AP weapons prefer high-defence targets
    const unitBestAP = Math.max(...(unit.weapons || []).map(w => w.ap || 0), 0);
    const apBonus = p?.targeting?.ap_vs_tough_bonus ?? 0.4;
    if (unitBestAP >= 2 && enemy.defense >= 5) score += apBonus;

    // Blast weapons prefer blob targets
    const hasBlast = unit.weapons?.some(w => {
      const sr = Array.isArray(w.special_rules) ? w.special_rules.join(' ') : (w.special_rules || '');
      return sr.includes('Blast');
    });
    if (hasBlast && enemy.current_models >= 5) score += 0.5;

    // Deadly weapons prefer Tough targets
    const hasDeadly = unit.weapons?.some(w => {
      const sr = Array.isArray(w.special_rules) ? w.special_rules.join(' ') : (w.special_rules || '');
      return sr.includes('Deadly');
    });
    if (hasDeadly && enemy.special_rules?.match(/Tough\(\d+\)/)) score += 0.5;

    // ── 1b. THREAT ASSESSMENT: prioritise dangerous enemies ───────────────
    const threatBonus = p?.targeting?.high_quality_threat_bonus ?? 0.25;
    if (enemy.quality <= 3) score += threatBonus; // high-quality units are dangerous
    if (enemy.weapons?.some(w => w.range > 18 && (w.attacks || 1) >= 3)) score += 0.3;
    if (enemy.special_rules?.includes('Fear')) score += 0.15;

    // ── 1c. ABOUT-TO-ACT: prefer activated-neighbour heuristic (not yet activated) ──
    // If enemy has not yet activated this round, it's a higher priority kill target
    // to prevent it from acting. We can't directly know activation order, but
    // if their wounds are full they likely haven't taken damage yet = priority target
    if (healthRatio >= 0.95) score += 0.1;

    // ── 5. COUNTER-STRATEGY: match weapon type to archetype target ────────
    const toughMatch = enemy.special_rules?.match(/Tough\((\d+)\)/);
    const isVehicle = toughMatch && parseInt(toughMatch[1]) >= 6;
    if (isVehicle && unitBestAP >= 2) score += 0.4; // prioritise vehicles if we have AP

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

  // ── 6. MORALE/ATTRITION: find most vulnerable allied unit needing screening ──
  findMostVulnerableAlly(gameState, owner) {
    const shaken = gameState.units.filter(u =>
      u.owner === owner && u.current_models > 0 && u.status === 'shaken'
    );
    if (shaken.length > 0) return shaken[0];
    const critical = gameState.units.filter(u =>
      u.owner === owner && u.current_models > 0 && this.isAttritionCritical(u)
    );
    return critical[0] || null;
  }

  predictOpponentResponse(unit, action, gameState, owner) {
    const enemies = gameState.units.filter(u => u.owner !== owner && u.current_models > 0);
    let threatLevel = 0;
    for (const enemy of enemies) {
      const distance = this.getDistance(unit, enemy);
      if (distance <= 12 && enemy.weapons?.some(w => w.range <= 2)) threatLevel += 0.4;
      if (distance <= 24 && enemy.weapons?.some(w => w.range > 12)) threatLevel += 0.2;
      const enemyStrength = enemy.current_models * (enemy.quality <= 3 ? 1.5 : 1.0);
      threatLevel += (enemyStrength / 10) * 0.1;
    }
    return threatLevel;
  }

  // ─── DEPLOYMENT DMN ──────────────────────────────────────────────────────

  /**
  * Decide the best deployment zone and coordinates for a unit.
  * Returns { x, y, zone, dmnReason, specialRulesApplied }
  * Bug 2 fix: usedZones set passed in to prevent friendly zone stacking
  */
  decideDeployment(unit, isAgentA, deployedEnemies, deployedFriendlies, objectives, terrain, usedZones = new Set()) {
  const isReserve = unit.special_rules?.includes('Ambush') ||
                  unit.special_rules?.includes('Teleport') ||
                  unit.special_rules?.includes('Infiltrate');
  if (isReserve) {
    return { x: unit.x, y: unit.y, zone: 'reserve', dmnReason: `${unit.special_rules?.match(/Ambush|Teleport|Infiltrate/)?.[0] || 'Reserve'} rule: unit enters from reserve mid-battle`, specialRulesApplied: [{ rule: unit.special_rules?.match(/Ambush|Teleport|Infiltrate/)?.[0] || 'Reserve', value: null, effect: 'deployed to reserve, not on table' }] };
  }

  const meleeWeapons = (unit.weapons || []).filter(w => w.range <= 2);
  const rangedWeapons = (unit.weapons || []).filter(w => w.range > 2);
  const hasLongRange = rangedWeapons.some(w => w.range >= 24);
  const hasIndirect = rangedWeapons.some(w => w.special_rules?.includes('Indirect'));
  const isFireSupport = unit.special_rules?.includes('Indirect') || 
                        /artillery|gun|cannon|mortar|support/i.test(unit.name);

  // Bug 2 fix: classify by highest-Attack weapon to distinguish fire support from melee
  const bestMeleeAttacks = meleeWeapons.reduce((max, w) => Math.max(max, w.attacks || 1), 0);
  const bestRangedAttacks = rangedWeapons.reduce((max, w) => Math.max(max, w.attacks || 1), 0);
  // A unit is melee-primary only if its best melee weapon out-attacks its best ranged weapon
  const isMeleePrimary = meleeWeapons.length > 0 && (rangedWeapons.length === 0 || bestMeleeAttacks >= bestRangedAttacks);
  const toughMatch = unit.special_rules?.match(/Tough\((\d+)\)/);
  const toughValue = toughMatch ? parseInt(toughMatch[1]) : 0;
  const isHeavy = toughValue >= 6;
  const isFast = unit.special_rules?.includes('Fast');
  const isScreener = !isHeavy && !isMeleePrimary && (unit.total_models <= 3 || unit.special_rules?.includes('Scout'));

  // Deployment band: agent_a deploys in y=4..15, agent_b in y=33..44
  // These MUST match the hard clamp in runDeploymentPhase
  const yMin = isAgentA ? 4 : 33;
  const yMax = isAgentA ? 15 : 44;
  const yCentre = (yMin + yMax) / 2;

  // Helper: score terrain near a position for cover/LOS value
  const scoreTerrainAt = (cx, cy, wantCover) => {
    if (!terrain || terrain.length === 0) return 0;
    let t = 0;
    for (const piece of terrain) {
      const dist = Math.hypot(cx - (piece.x + piece.width / 2), cy - (piece.y + piece.height / 2));
      if (dist > 10) continue;
      // Cover-seeking units (ranged/fire support) want terrain nearby for protection
      if (wantCover && (piece.cover || piece.blocksThroughLOS || piece.blocking)) t += Math.max(0, 10 - dist) * 1.5;
      // Melee units don't need cover but can use LOS-blocking terrain to advance unseen
      if (!wantCover && (piece.blocksThroughLOS || piece.blocking)) t += Math.max(0, 10 - dist) * 0.8;
      // Penalise impassable terrain that would trap a unit
      if (piece.impassable) t -= Math.max(0, 6 - dist) * 2.0;
    }
    return t;
  };

  // Generate 40 random candidates strictly within the deployment strip.
  const candidates = [];
  for (let i = 0; i < 40; i++) {
    const bx = Math.max(5, Math.min(65, 6 + Math.random() * 58));
    const by = Math.max(yMin + 0.5, Math.min(yMax - 0.5, yMin + 0.5 + Math.random() * (yMax - yMin - 1)));
    const col = bx < 24 ? 'left' : bx < 48 ? 'centre' : 'right';
    candidates.push({ x: bx, y: by, col, label: `${col} (${bx.toFixed(0)},${by.toFixed(0)})` });
  }

  let bestScore = -Infinity;
  let best = candidates[0];

  for (const cand of candidates) {
  const cx = cand.x;
  const cy = cand.y;
  let score = 0;

  // Terrain awareness — cover-seekers want nearby terrain, melee wants LOS-blockers for advance routes
  const wantsCover = !isMeleePrimary && !isFast;
  const terrainScore = scoreTerrainAt(cx, cy, wantsCover);
  score += terrainScore;

  // Objective proximity bonus for objective-seekers
  if (objectives?.length > 0) {
    const nearestObj = objectives.reduce((n, o) => {
      const d = Math.hypot(cx - o.x, cy - o.y);
      return d < Math.hypot(cx - n.x, cy - n.y) ? o : n;
    });
    const objDist = Math.hypot(cx - nearestObj.x, cy - nearestObj.y);
    if (isFast) score += Math.max(0, 40 - objDist) * 0.8;
    else if (!isMeleePrimary && !isHeavy) score += Math.max(0, 30 - objDist) * 0.5;
  }

  // Heavy melee: deploy close to likely enemy deployment zone
  if (isMeleePrimary && deployedEnemies.length > 0) {
    const nearestEnemy = deployedEnemies.reduce((n, e) => {
      const d = Math.hypot(cx - e.x, cy - e.y);
      return d < Math.hypot(cx - n.x, cy - n.y) ? e : n;
    });
    const enemyDist = Math.hypot(cx - nearestEnemy.x, cy - nearestEnemy.y);
    score += Math.max(0, 60 - enemyDist) * 0.6;
  }

  // Fire support: prefer flanks AND nearby cover terrain
  if (isFireSupport) {
    if (cand.col !== 'centre') score += 25;
  } else if (hasLongRange && !hasIndirect) {
    if (cand.col === 'centre') score += 20;
  }

  // Indirect: deprioritise centre (hide behind flanks)
  if (hasIndirect) {
    if (cand.col !== 'centre') score += 15;
  }

  // Heavy vehicles: anchor a flank
  if (isHeavy && !isMeleePrimary) {
    if (cand.col !== 'centre') score += 18;
  }

  // Screeners: deploy in front of heavies/key assets
  if (isScreener && deployedFriendlies.length > 0) {
    const nearestFriendly = deployedFriendlies.reduce((n, f) => {
      const d = Math.hypot(cx - f.x, cy - f.y);
      return d < Math.hypot(cx - n.x, cy - n.y) ? f : n;
    });
    const friendlyDist = Math.hypot(cx - nearestFriendly.x, cy - nearestFriendly.y);
    score += Math.max(0, 20 - friendlyDist) * 0.4;
  }

  // (zone cap removed — proximity penalty above handles spreading naturally)

  // Spread: penalise proximity to ANY already-deployed friendly (both x and y)
  // This is the key to breaking up rows — units must spread in both axes
  deployedFriendlies.forEach(f => {
    const dx = Math.abs(f.x - cx);
    const dy = Math.abs(f.y - cy);
    const proximity = Math.max(0, 10 - Math.hypot(dx, dy));
    score -= proximity * 5; // strong penalty for being close to any friendly
  });

  // Reactive: avoid columns with concentrated dangerous enemies
  if (deployedEnemies.length > 0) {
    const nearbyEnemies = deployedEnemies.filter(e => Math.abs(e.x - cx) < 14);
    const bigThreats = nearbyEnemies.filter(e => {
      const t = e.special_rules?.match(/Tough\((\d+)\)/);
      return t && parseInt(t[1]) >= 6;
    });
    if (!isHeavy && !isMeleePrimary) score -= bigThreats.length * 10;
  }

  if (score > bestScore) { bestScore = score; best = cand; }
  }

  // Hard clamp — candidates already constrained but score selection can pick edge values
  const finalX = Math.max(5, Math.min(65, best.x));
  const finalY = Math.max(yMin, Math.min(yMax, best.y));
  const colLabel = best.col === 'left' ? 'left' : best.col === 'right' ? 'right' : 'centre';
  const rowLabel = isAgentA ? 'south' : 'north';
  const zone = `${rowLabel}-${colLabel}`;

  // Bug 2 fix: build reason based on actual classification
  let reason = '';
  if (isHeavy && !isMeleePrimary) reason = `Tough(${toughValue}) vehicle anchoring ${best.label} near objective, threatening approach lanes`;
  else if (isMeleePrimary && rangedWeapons.length === 0) reason = `Melee-only unit — deployed ${best.label} to close on enemy cluster quickly`;
  else if (isMeleePrimary && deployedEnemies.length > 0) reason = `Melee-primary unit (melee attacks ${bestMeleeAttacks} ≥ ranged ${bestRangedAttacks}) — deployed ${best.label} to close on enemy`;
  else if (hasIndirect) reason = `Indirect weapon — deployed ${best.label} rear, no LOS required`;
  else if (hasLongRange && !isMeleePrimary) reason = `Ranged fire support (${Math.max(...rangedWeapons.map(w => w.range))}" range) — deployed ${best.label} for maximum arc coverage`;
  else if (rangedWeapons.length > 0 && !isMeleePrimary) reason = `Ranged unit (best ranged attacks ${bestRangedAttacks} > melee ${bestMeleeAttacks}) — deployed ${best.label} for fire support`;
  else if (isFast && objectives?.length > 0) reason = `Fast unit prioritising nearest objective — deployed forward-${best.label} for Round 1 cap`;
  else if (isScreener) reason = `Light screen unit — deployed ${best.label} to absorb early charges`;
  else reason = `Standard infantry — deployed ${best.label} balancing objective proximity and spread`;

  // Reactive note
  if (deployedEnemies.length > 0) {
  const nearbyThreats = deployedEnemies.filter(e => {
    const t = e.special_rules?.match(/Tough\((\d+)\)/);
    return t && parseInt(t[1]) >= 6 && Math.abs(e.x - finalX) > 20;
  });
  if (!isHeavy && nearbyThreats.length > 0) {
    reason += ` — reacting to ${nearbyThreats[0].name} placement, avoiding their flank`;
  }
  }

  return { x: finalX, y: finalY, zone, dmnReason: reason, specialRulesApplied: [] };
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