import { DiceRoller } from './GameEngine';

export class RulesEngine {
  constructor() {
    this.dice = new DiceRoller();
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
    
    // Apply difficult terrain penalty
    if (terrain) {
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
    const hits = this.rollToHit(attacker, weapon);
    const wounds = this.rollDefense(defender, hits.successes, weapon, terrain);
    
    return {
      weapon: weapon.name,
      hit_rolls: hits.rolls,
      hits: hits.successes,
      defense_rolls: wounds.rolls,
      wounds: wounds.wounds,
      models_killed: Math.min(wounds.wounds, defender.current_models)
    };
  }

  rollToHit(unit, weapon) {
    const quality = unit.quality || 4;
    const attacks = weapon.attacks || 1;
    const rolls = this.dice.rollQualityTest(quality, attacks);
    
    return {
      rolls,
      successes: rolls.filter(r => r.success).length
    };
  }

  rollDefense(unit, hitCount, weapon, terrain) {
    let defense = unit.defense || 5;
    const ap = weapon.ap || 0;
    
    // Apply cover bonus
    if (terrain) {
      const coverBonus = this.getCoverBonus(unit, terrain);
      defense += coverBonus;
    }
    
    const modifiedDefense = Math.min(6, Math.max(2, defense + ap));
    
    const rolls = this.dice.rollDefense(modifiedDefense, hitCount);
    const blocks = rolls.filter(r => r.success).length;
    
    return {
      rolls,
      wounds: hitCount - blocks
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
        const result = this.resolveShooting(attacker, defender, weapon);
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
        this.calculateDistance(u, obj) <= 3 && u.current_models > 0
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