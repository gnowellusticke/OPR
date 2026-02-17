import { DiceRoller } from './GameEngine';

export class RulesEngine {
  constructor() {
    this.dice = new DiceRoller();
  }

  // Transport Management
  getTransportCapacity(transport) {
    const match = transport.special_rules?.match(/Transport\((\d+)\)/);
    return match ? parseInt(match[1]) : 0;
  }

  getUnitTransportSize(unit) {
    // Heroes with Tough(6) or less take 1 space
    // Non-heroes with Tough(3) or less take 1 space
    // Non-heroes with Tough(3+) take 3 spaces
    const toughMatch = unit.special_rules?.match(/Tough\((\d+)\)/);
    const toughValue = toughMatch ? parseInt(toughMatch[1]) : 0;
    const isHero = unit.special_rules?.includes('Hero');
    
    if (isHero && toughValue <= 6) return 1;
    if (!isHero && toughValue <= 3) return 1;
    if (!isHero && toughValue > 3) return 3;
    return 1; // Default
  }

  canEmbark(unit, transport, gameState) {
    if (!transport.special_rules?.includes('Transport')) return false;
    if (unit.embarked_in) return false;
    if (this.calculateDistance(unit, transport) > 1) return false;
    
    const capacity = this.getTransportCapacity(transport);
    const currentLoad = this.getTransportCurrentLoad(transport, gameState);
    const unitSize = this.getUnitTransportSize(unit);
    
    return currentLoad + unitSize <= capacity;
  }

  getTransportCurrentLoad(transport, gameState) {
    const embarked = gameState.units.filter(u => u.embarked_in === transport.id);
    return embarked.reduce((sum, u) => sum + this.getUnitTransportSize(u), 0);
  }

  embark(unit, transport, gameState) {
    if (!this.canEmbark(unit, transport, gameState)) return false;
    
    unit.embarked_in = transport.id;
    unit.x = transport.x;
    unit.y = transport.y;
    return true;
  }

  disembark(unit, transport, gameState) {
    if (unit.embarked_in !== transport.id) return false;
    
    // Place within 6" of transport
    const angle = Math.random() * Math.PI * 2;
    const distance = 3 + Math.random() * 3; // 3-6 inches
    
    unit.x = transport.x + Math.cos(angle) * distance;
    unit.y = transport.y + Math.sin(angle) * distance;
    unit.embarked_in = null;
    
    return true;
  }

  handleTransportDestruction(transport, gameState, events) {
    const embarked = gameState.units.filter(u => u.embarked_in === transport.id);
    
    embarked.forEach(unit => {
      // Dangerous terrain test
      const roll = this.dice.roll();
      if (roll <= 1) {
        unit.current_models = Math.max(0, unit.current_models - 1);
        events.push({
          round: gameState.current_round,
          type: 'transport',
          message: `${unit.name} lost 1 model from transport destruction`,
          timestamp: new Date().toLocaleTimeString()
        });
      }
      
      // Immediately Shaken
      unit.status = 'shaken';
      
      // Place within 6"
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * 6;
      unit.x = transport.x + Math.cos(angle) * distance;
      unit.y = transport.y + Math.sin(angle) * distance;
      unit.embarked_in = null;
      
      events.push({
        round: gameState.current_round,
        type: 'transport',
        message: `${unit.name} disembarked from destroyed transport and is Shaken`,
        timestamp: new Date().toLocaleTimeString()
      });
    });
  }

  // Movement
  executeMovement(unit, action, targetPosition, terrain) {
    const moveDistance = this.getMoveDistance(unit, action, terrain);
    const distance = this.calculateDistance(unit, targetPosition);
    
    if (distance <= moveDistance) {
      unit.x = targetPosition.x;
      unit.y = targetPosition.y;
      return { success: true, distance };
    }
    
    // Move as far as possible toward target
    const ratio = moveDistance / distance;
    unit.x = unit.x + (targetPosition.x - unit.x) * ratio;
    unit.y = unit.y + (targetPosition.y - unit.y) * ratio;
    
    return { success: true, distance: moveDistance };
  }

  getMoveDistance(unit, action, terrain) {
    let base = 0;
    switch (action) {
      case 'Hold': base = 0; break;
      case 'Advance': base = 6; break;
      case 'Rush': base = 12; break;
      case 'Charge': base = 12; break;
    }
    
    // Apply difficult terrain penalty (unless Strider or Flying)
    if (terrain && !unit.special_rules?.includes('Strider') && !unit.special_rules?.includes('Flying')) {
      const unitTerrain = this.getTerrainAtPosition(unit.x, unit.y, terrain);
      if (unitTerrain && unitTerrain.type === 'difficult') {
        base = Math.max(0, base - 2); // -2" for difficult terrain
      }
    }
    
    // Apply special rules
    if (unit.special_rules?.includes('Fast')) base += (action === 'Advance' ? 2 : 4);
    if (unit.special_rules?.includes('Slow')) base -= (action === 'Advance' ? 2 : 4);
    
    return Math.max(0, base);
  }

  // Shooting
  resolveShooting(attacker, defender, weapon, terrain) {
    const hits = this.rollToHit(attacker, weapon, defender);
    const wounds = this.rollDefense(defender, hits.successes, weapon, terrain, hits.rolls);
    
    return {
      weapon: weapon.name,
      hit_rolls: hits.rolls,
      hits: hits.successes,
      defense_rolls: wounds.rolls,
      wounds: wounds.wounds,
      models_killed: Math.min(wounds.wounds, defender.current_models)
    };
  }

  rollToHit(unit, weapon, target) {
    const quality = unit.quality || 4;
    let attacks = weapon.attacks || 1;
    
    // Blast (X): Get +X attacks vs units with 5+ models
    if (weapon.special_rules?.includes('Blast') && target?.current_models >= 5) {
      const blastMatch = weapon.special_rules.match(/Blast\((\d+)\)/);
      const blastBonus = blastMatch ? parseInt(blastMatch[1]) : 3;
      attacks += blastBonus;
    }
    
    const rolls = this.dice.rollQualityTest(quality, attacks);
    let successes = rolls.filter(r => r.success).length;
    
    // Deadly (X): Unmodified rolls of X+ count as 2 hits
    if (weapon.special_rules?.includes('Deadly')) {
      const deadlyMatch = weapon.special_rules.match(/Deadly\((\d+)\)/);
      const deadlyThreshold = deadlyMatch ? parseInt(deadlyMatch[1]) : 6;
      const deadlyHits = rolls.filter(r => r.value >= deadlyThreshold).length;
      successes += deadlyHits; // Each deadly roll counts as 2 hits total (1 + 1 extra)
    }
    
    return {
      rolls,
      successes
    };
  }

  rollDefense(unit, hitCount, weapon, terrain, hitRolls) {
    let defense = unit.defense || 5;
    const ap = weapon.ap || 0;
    
    // Apply cover bonus
    if (terrain) {
      const coverBonus = this.getCoverBonus(unit, terrain);
      defense += coverBonus;
    }
    
    // Stealth: +1 defense when being shot at (range > 2)
    if (unit.special_rules?.includes('Stealth') && weapon.range > 2) {
      defense += 1;
    }
    
    const modifiedDefense = Math.min(6, Math.max(2, defense + ap));
    
    const rolls = this.dice.rollDefense(modifiedDefense, hitCount);
    let blocks = rolls.filter(r => r.success).length;
    
    // Rending: Unmodified 6s on hit rolls auto-wound (ignore defense)
    let autoWounds = 0;
    if (weapon.special_rules?.includes('Rending') && hitRolls) {
      autoWounds = hitRolls.filter(r => r.value === 6 && r.success).length;
      // Remove auto-wounds from the defense pool
      blocks = Math.max(0, blocks - autoWounds);
    }
    
    let wounds = hitCount - blocks;
    
    // Tough (X): Reduce wounds by X (min 1)
    if (unit.special_rules?.includes('Tough') && wounds > 0) {
      const toughMatch = unit.special_rules.match(/Tough\((\d+)\)/);
      const toughReduction = toughMatch ? parseInt(toughMatch[1]) : 3;
      wounds = Math.max(1, wounds - toughReduction);
    }
    
    // Regeneration: Roll to ignore each wound
    if (unit.special_rules?.includes('Regeneration') && wounds > 0) {
      let regenSaves = 0;
      for (let i = 0; i < wounds; i++) {
        if (this.dice.roll() >= 5) regenSaves++;
      }
      wounds -= regenSaves;
    }
    
    return {
      rolls,
      wounds
    };
  }

  // Melee
  resolveMelee(attacker, defender, gameState) {
    // Attacker strikes
    const attackerResults = this.resolveMeleeStrikes(attacker, defender);
    
    // Defender strikes back (if able)
    let defenderResults = null;
    if (!defender.status === 'shaken' && defender.current_models > 0) {
      defenderResults = this.resolveMeleeStrikes(defender, attacker, true);
    }
    
    // Determine winner
    const attackerWounds = attackerResults.total_wounds;
    const defenderWounds = defenderResults?.total_wounds || 0;
    
    const winner = attackerWounds > defenderWounds ? attacker : 
                   defenderWounds > attackerWounds ? defender : null;
    
    return {
      attacker_results: attackerResults,
      defender_results: defenderResults,
      winner,
      attacker_wounds: attackerWounds,
      defender_wounds: defenderWounds
    };
  }

  resolveMeleeStrikes(attacker, defender, isStrikeBack = false) {
    const results = [];
    let totalWounds = 0;
    
    attacker.weapons?.forEach(weapon => {
      if (weapon.range <= 2) { // Melee weapons
        // Furious: +1 attack on charge
        let modifiedWeapon = { ...weapon };
        if (attacker.just_charged && attacker.special_rules?.includes('Furious')) {
          modifiedWeapon.attacks = (weapon.attacks || 1) + 1;
        }
        
        const result = this.resolveShooting(attacker, defender, modifiedWeapon, null);
        results.push(result);
        totalWounds += result.wounds;
      }
    });
    
    // Apply fatigue if striking back or just charged
    if (isStrikeBack || attacker.just_charged) {
      attacker.fatigued = true;
    }
    
    return { results, total_wounds: totalWounds };
  }

  // Morale
  checkMorale(unit, reason = 'wounds') {
    // Auto-fail if shaken
    if (unit.status === 'shaken') {
      return { passed: false, roll: null, reason: 'Already Shaken' };
    }
    
    // Roll quality test
    const quality = unit.quality || 4;
    const roll = this.dice.roll();
    const passed = roll >= quality || roll === 6;
    
    // Apply Fearless
    if (!passed && unit.special_rules?.includes('Fearless')) {
      const reroll = this.dice.roll();
      if (reroll >= 4) {
        return { passed: true, roll, reroll, reason: 'Fearless reroll' };
      }
    }
    
    return { passed, roll, reason };
  }

  applyMoraleResult(unit, passed, reason) {
    if (!passed) {
      const atHalfStrength = unit.current_models <= unit.total_models / 2;
      
      if (reason === 'melee_loss' && atHalfStrength) {
        // Rout - unit is destroyed
        unit.current_models = 0;
        unit.status = 'routed';
        return 'routed';
      } else {
        // Shaken
        unit.status = 'shaken';
        return 'shaken';
      }
    }
    return 'passed';
  }

  // Objectives
  updateObjectives(gameState) {
    gameState.objectives?.forEach(obj => {
      const unitsNear = gameState.units.filter(u => 
        this.calculateDistance(u, obj) <= 3 && u.current_models > 0 && !u.embarked_in
      );
      
      const agentANear = unitsNear.filter(u => u.owner === 'agent_a' && u.status !== 'shaken').length > 0;
      const agentBNear = unitsNear.filter(u => u.owner === 'agent_b' && u.status !== 'shaken').length > 0;
      
      if (agentANear && !agentBNear) {
        obj.controlled_by = 'agent_a';
      } else if (agentBNear && !agentANear) {
        obj.controlled_by = 'agent_b';
      } else if (agentANear && agentBNear) {
        obj.controlled_by = 'contested';
      }
      // If no one is near, it stays with whoever controlled it
    });
  }

  // Utilities
  calculateDistance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  checkLineOfSight(from, to, terrain) {
    // Simplified LOS - check if terrain blocks
    // In a full implementation, this would do ray-casting
    return true; // For now, always true
  }

  getTerrainAtPosition(x, y, terrain) {
    if (!terrain) return null;
    return terrain.find(t => 
      x >= t.x && x <= t.x + t.width &&
      y >= t.y && y <= t.y + t.height
    );
  }

  getCoverBonus(unit, terrain) {
    const unitTerrain = this.getTerrainAtPosition(unit.x, unit.y, terrain);
    if (unitTerrain && unitTerrain.type === 'cover') {
      return 1; // +1 Defense for cover
    }
    return 0;
  }
}