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
    const toughMatch = unit.special_rules?.match(/Tough\((\d+)\)/);
    const toughValue = toughMatch ? parseInt(toughMatch[1]) : 0;
    const isHero = unit.special_rules?.includes('Hero');
    if (isHero && toughValue <= 6) return 1;
    if (!isHero && toughValue <= 3) return 1;
    if (!isHero && toughValue > 3) return 3;
    return 1;
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
    const angle = Math.random() * Math.PI * 2;
    const distance = 3 + Math.random() * 3;
    unit.x = transport.x + Math.cos(angle) * distance;
    unit.y = transport.y + Math.sin(angle) * distance;
    unit.embarked_in = null;
    return true;
  }

  handleTransportDestruction(transport, gameState, events) {
    const embarked = gameState.units.filter(u => u.embarked_in === transport.id);
    embarked.forEach(unit => {
      const roll = this.dice.roll();
      if (roll <= 1) {
        unit.current_models = Math.max(0, unit.current_models - 1);
        events.push({ round: gameState.current_round, type: 'transport', message: `${unit.name} lost 1 model from transport destruction`, timestamp: new Date().toLocaleTimeString() });
      }
      unit.status = 'shaken';
      const angle = Math.random() * Math.PI * 2;
      unit.x = transport.x + Math.cos(angle) * Math.random() * 6;
      unit.y = transport.y + Math.sin(angle) * Math.random() * 6;
      unit.embarked_in = null;
      events.push({ round: gameState.current_round, type: 'transport', message: `${unit.name} disembarked from destroyed transport and is Shaken`, timestamp: new Date().toLocaleTimeString() });
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
    const ratio = moveDistance / distance;
    unit.x = unit.x + (targetPosition.x - unit.x) * ratio;
    unit.y = unit.y + (targetPosition.y - unit.y) * ratio;
    return { success: true, distance: moveDistance };
  }

  // Ambush: check if a unit has the Ambush rule and is currently in reserve
  isAmbushUnit(unit) {
    return unit.special_rules?.includes('Ambush');
  }

  // Deploy an Ambush unit from reserve — places it anywhere on the table > 9" from all enemies.
  // Returns true if a valid position was found and the unit was placed, false otherwise.
  deployAmbush(unit, gameState) {
    const enemies = gameState.units.filter(u => u.owner !== unit.owner && u.current_models > 0);
    let attempts = 0;
    while (attempts < 100) {
      const x = Math.random() * 66 + 3;
      const y = Math.random() * 42 + 3;
      const tooClose = enemies.some(e => {
        const dx = e.x - x; const dy = e.y - y;
        return Math.sqrt(dx * dx + dy * dy) < 9;
      });
      if (!tooClose) {
        unit.x = x;
        unit.y = y;
        unit.is_in_reserve = false;
        return true;
      }
      attempts++;
    }
    return false;
  }

  // Teleport: redeploy anywhere outside 9" of all enemies
  executeTeleport(unit, gameState) {
    const enemies = gameState.units.filter(u => u.owner !== unit.owner && u.current_models > 0);
    let attempts = 0;
    while (attempts < 50) {
      const x = Math.random() * 66 + 3;
      const y = Math.random() * 42 + 3;
      const tooClose = enemies.some(e => {
        const dx = e.x - x; const dy = e.y - y;
        return Math.sqrt(dx * dx + dy * dy) < 9;
      });
      if (!tooClose) {
        unit.x = x;
        unit.y = y;
        return true;
      }
      attempts++;
    }
    return false;
  }

  getMoveDistance(unit, action, terrain) {
    let base = 0;
    switch (action) {
      case 'Hold': base = 0; break;
      case 'Advance': base = 6; break;
      case 'Rush': base = 12; break;
      case 'Charge': base = 12; break;
    }
    if (terrain && !unit.special_rules?.includes('Strider') && !unit.special_rules?.includes('Flying')) {
      const unitTerrain = this.getTerrainAtPosition(unit.x, unit.y, terrain);
      if (unitTerrain && unitTerrain.type === 'difficult') base = Math.max(0, base - 2);
    }
    if (unit.special_rules?.includes('Fast')) base += (action === 'Advance' ? 2 : 4);
    if (unit.special_rules?.includes('Slow')) base -= (action === 'Advance' ? 2 : 4);
    return Math.max(0, base);
  }

  // Check if any friendly unit within 6" has Stealth Aura
  hasStealth(unit, gameState) {
    if (unit.special_rules?.includes('Stealth')) return true;
    if (!gameState) return false;
    return gameState.units.some(u =>
      u.owner === unit.owner &&
      u.id !== unit.id &&
      u.current_models > 0 &&
      u.special_rules?.includes('Stealth Aura') &&
      this.calculateDistance(unit, u) <= 6
    );
  }

  // Shooting
  resolveShooting(attacker, defender, weapon, terrain, gameState) {
    const hits = this.rollToHit(attacker, weapon, defender, gameState);
    const saves = this.rollDefense(defender, hits.successes, weapon, terrain, hits.rolls);
    return {
      weapon: weapon.name,
      hit_rolls: hits.rolls,
      hits: hits.successes,
      defense_rolls: saves.rolls,
      saves: saves.saves,
      wounds: saves.wounds
    };
  }

  rollToHit(unit, weapon, target, gameState) {
    let quality = unit.quality || 4;

    // Shaken: -1 to Quality (higher number = harder to hit)
    if (unit.status === 'shaken') quality = Math.min(6, quality + 1);

    // Machine-Fog on target: +1 to quality needed to hit
    if (target?.special_rules?.includes('Machine-Fog')) quality = Math.min(6, quality + 1);

    // Stealth on target (direct or via Stealth Aura): +1 to quality needed
    if (target && this.hasStealth(target, gameState) && weapon.range > 2) quality = Math.min(6, quality + 1);

    let attacks = weapon.attacks || 1;

    // Blast(X) — X automatic hits, no quality roll, proceeds directly to saves (Bug 1)
    if (weapon.special_rules?.includes('Blast')) {
      const blastMatch = weapon.special_rules.match(/Blast\((\d+)\)/);
      const blastCount = blastMatch ? parseInt(blastMatch[1]) : 3;
      const autoHitRolls = Array.from({ length: blastCount }, () => ({ value: 6, success: true, auto: true }));
      return { rolls: autoHitRolls, successes: blastCount };
    }

    const rolls = this.dice.rollQualityTest(quality, attacks);
    let successes = rolls.filter(r => r.success).length;

    if (weapon.special_rules?.includes('Deadly')) {
      const deadlyMatch = weapon.special_rules.match(/Deadly\((\d+)\)/);
      const deadlyThreshold = deadlyMatch ? parseInt(deadlyMatch[1]) : 6;
      successes += rolls.filter(r => r.value >= deadlyThreshold).length;
    }

    return { rolls, successes };
  }

  rollDefense(unit, hitCount, weapon, terrain, hitRolls) {
    let defense = unit.defense || 5;
    // FIX: AP reduces defence save (makes it harder to save = higher number needed)
    const ap = weapon.ap || 0;

    if (terrain) {
      const coverBonus = this.getCoverBonus(unit, terrain);
      defense -= coverBonus; // cover reduces the target number needed (easier to save)
    }

    // AP worsens defence (raises threshold)
    const modifiedDefense = Math.min(6, Math.max(2, defense + ap));
    const rolls = this.dice.rollDefense(modifiedDefense, hitCount);
    let saves = rolls.filter(r => r.success).length;

    // Rending: Unmodified 6s on hit rolls auto-wound (bypass saves)
    let autoWounds = 0;
    if (weapon.special_rules?.includes('Rending') && hitRolls) {
      autoWounds = hitRolls.filter(r => r.value === 6 && r.success && !r.auto).length;
      saves = Math.max(0, saves - autoWounds);
    }

    let wounds = hitCount - saves;

    return { rolls, saves, wounds };
  }

  // End-of-round regeneration — single roll per unit per round regardless of wounds lost (Bug 2)
  applyRegeneration(unit) {
    if (!unit.special_rules?.includes('Regeneration')) return { recovered: 0, roll: null };
    if (unit.current_models >= unit.total_models) return { recovered: 0, roll: null };
    const roll = this.dice.roll();
    const recovered = roll >= 5 ? 1 : 0;
    unit.current_models = Math.min(unit.total_models, unit.current_models + recovered);
    return { recovered, roll };
  }

  // Melee
  resolveMelee(attacker, defender, gameState) {
    const attackerResults = this.resolveMeleeStrikes(attacker, defender, false, gameState);
    // FIX: correct operator precedence — check defender.status !== 'shaken'
    let defenderResults = null;
    if (defender.status !== 'shaken' && defender.current_models > 0) {
      defenderResults = this.resolveMeleeStrikes(defender, attacker, true, gameState);
    }

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

  resolveMeleeStrikes(attacker, defender, isStrikeBack = false, gameState = null) {
    const results = [];
    let totalWounds = 0;

    const meleeWeapons = attacker.weapons?.filter(w => w.range <= 2) || [];

    // If no melee weapons defined, use a default attack
    const weaponsToUse = meleeWeapons.length > 0 ? meleeWeapons : [{ name: 'CCW', range: 1, attacks: 1, ap: 0 }];

    weaponsToUse.forEach(weapon => {
      let modifiedWeapon = { ...weapon };
      if (attacker.just_charged && attacker.special_rules?.includes('Furious')) {
        modifiedWeapon.attacks = (weapon.attacks || 1) + 1;
      }
      const result = this.resolveShooting(attacker, defender, modifiedWeapon, null, gameState);
      // Expose hits/saves directly on each result for the logger
      result.hits = result.hits ?? 0;
      result.saves = result.saves ?? 0;
      results.push(result);
      totalWounds += result.wounds;
    });

    if (isStrikeBack || attacker.just_charged) {
      attacker.fatigued = true;
    }

    return { results, total_wounds: totalWounds };
  }

  // Morale — never called on already-shaken units (callers must guard), but defensively roll anyway
  checkMorale(unit, reason = 'wounds') {
    const quality = unit.quality || 4;
    const roll = this.dice.roll(); // always a real integer 1-6
    if (unit.status === 'shaken') {
      return { passed: false, roll, reason: 'Already Shaken' };
    }
    const passed = roll >= quality;

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
        unit.current_models = 0;
        unit.status = 'routed';
        return 'routed';
      } else {
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
      if (agentANear && !agentBNear) obj.controlled_by = 'agent_a';
      else if (agentBNear && !agentANear) obj.controlled_by = 'agent_b';
      else if (agentANear && agentBNear) obj.controlled_by = 'contested';
    });
  }

  // Utilities
  calculateDistance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  checkLineOfSight(from, to, terrain) { return true; }

  getTerrainAtPosition(x, y, terrain) {
    if (!terrain) return null;
    return terrain.find(t => x >= t.x && x <= t.x + t.width && y >= t.y && y <= t.y + t.height);
  }

  getCoverBonus(unit, terrain) {
    const unitTerrain = this.getTerrainAtPosition(unit.x, unit.y, terrain);
    return (unitTerrain && unitTerrain.type === 'cover') ? 1 : 0;
  }

  // Zone helper for JSON log
  getZone(x, y) {
    const col = x < 24 ? 'left' : x < 48 ? 'centre' : 'right';
    const row = y < 16 ? 'north' : y < 32 ? 'centre' : 'south';
    return row === 'centre' && col === 'centre' ? 'centre' : `${row}-${col}`;
  }

  getRangeBracket(dist) {
    if (dist <= 12) return 'close';
    if (dist <= 24) return 'mid';
    return 'long';
  }
}