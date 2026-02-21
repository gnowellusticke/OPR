import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Home, Download } from "lucide-react";
import BattlefieldView from '../components/battle/BattlefieldView';
import GameStatePanel from '../components/battle/GameStatePanel';
import ActionLog from '../components/battle/ActionLog';
import DecisionTreeView from '../components/battle/DecisionTreeView';
import CombatResolver from '../components/battle/CombatResolver';
import { base44 } from "@/api/base44Client";
import { BPMNEngine, DMNEngine, CMMNEngine } from '../components/engine/GameEngine';
import { RulesEngine } from '../components/engine/RulesEngine';
import { BattleLogger } from '../components/engine/BattleLogger';


export default function Battle() {
  const navigate = useNavigate();
  const [battle, setBattle] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [events, setEvents] = useState([]);
  const [activeUnit, setActiveUnit] = useState(null);
  const [currentDecision, setCurrentDecision] = useState(null);
  const [currentCombat, setCurrentCombat] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1000);
  
  const [bpmn] = useState(new BPMNEngine());
  const [dmn] = useState(new DMNEngine());
  const [cmmn] = useState(new CMMNEngine());
  const [rules] = useState(new RulesEngine());
  const [actionTracking, setActionTracking] = useState({ agent_a: {}, agent_b: {} });
  const [battleLogger, setBattleLogger] = useState(null);
  const [armyAData, setArmyAData] = useState(null);
  const [armyBData, setArmyBData] = useState(null);
  const [fullJsonLog, setFullJsonLog] = useState(null);

  // Use a ref for gameState so closures inside async functions always read the latest value
  const gameStateRef = React.useRef(null);
  const eventsRef = React.useRef([]);

  const setGameStateAndRef = (newState) => {
    gameStateRef.current = newState;
    setGameState(newState);
  };

  const setEventsAndRef = (newEvents) => {
    eventsRef.current = newEvents;
    setEvents(newEvents);
  };

  useEffect(() => {
    loadBattle();
  }, []);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    if (playing && gameState && battle?.status !== 'completed') {
      const timer = setTimeout(() => {
        processNextAction();
      }, speed);
      return () => clearTimeout(timer);
    }
  }, [playing, gameState, battle]);

  const loadBattle = async () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    
    if (!id) {
      navigate('/Home');
      return;
    }

    try {
      const battleData = await base44.entities.Battle.get(id);
      const armyA = await base44.entities.ArmyList.get(battleData.army_a_id);
      const armyB = await base44.entities.ArmyList.get(battleData.army_b_id);

      await dmn.loadLearningData(battleData.army_a_id);
      await dmn.loadLearningData(battleData.army_b_id);

      setArmyAData(armyA);
      setArmyBData(armyB);
      setBattle(battleData);

      const logger = new BattleLogger(battleData.id, armyA, armyB);
      setBattleLogger(logger);
      
      if (battleData.status === 'setup') {
        await initializeBattle(battleData, armyA, armyB, logger);
      } else {
        setGameState(battleData.game_state);
        setEvents(battleData.event_log || []);
      }

      battleData.armyAName = armyA.name;
      battleData.armyBName = armyB.name;
    } catch (err) {
      console.error('Failed to load battle:', err);
    }
  };

  const initializeBattle = async (battleData, armyA, armyB, logger) => {
    const terrain = generateTerrain();
    const objectives = generateObjectives();
    const units = deployArmies(armyA, armyB);

    // Read advance_rules from game_state set at battle creation
    const advRules = battleData.game_state?.advance_rules || {};
    
    const initialState = {
      units,
      terrain,
      objectives,
      active_agent: 'agent_a',
      current_round: 1,
      units_activated: [],
      advance_rules: advRules,
      cumulative_score: { agent_a: 0, agent_b: 0 },
    };
    
    setGameState(initialState);
    
    const log = [{
      round: 0,
      type: 'setup',
      message: 'Battle initialized. Terrain placed, objectives set, armies deployed.',
      timestamp: new Date().toLocaleTimeString()
    }];
    setEvents(log);
    
    await base44.entities.Battle.update(battleData.id, {
      status: 'in_progress',
      current_round: 1,
      game_state: initialState,
      event_log: log
    });
    
    setBattle({ ...battleData, status: 'in_progress', current_round: 1 });
  };

  const generateTerrain = () => {
    const terrain = [];
    const checkOverlap = (newTerrain, existing) => {
      return existing.some(t => {
        const xOverlap = newTerrain.x < t.x + t.width && newTerrain.x + newTerrain.width > t.x;
        const yOverlap = newTerrain.y < t.y + t.height && newTerrain.y + newTerrain.height > t.y;
        return xOverlap && yOverlap;
      });
    };
    
    let attempts = 0;
    while (terrain.length < 8 && attempts < 50) {
      const newTerrain = {
        type: Math.random() > 0.5 ? 'cover' : 'difficult',
        x: Math.random() * 60 + 6,
        y: Math.random() * 36 + 6,
        width: 6 + Math.random() * 6,
        height: 6 + Math.random() * 6
      };
      if (!checkOverlap(newTerrain, terrain)) terrain.push(newTerrain);
      attempts++;
    }
    
    return terrain;
  };

  const generateObjectives = () => {
    const count = Math.floor(Math.random() * 3) + 3;
    const objectives = [];
    const MIN_DISTANCE = 9;
    const MAX_ATTEMPTS = 100;
    
    while (objectives.length < count) {
      let validPosition = false;
      let attempts = 0;
      
      while (!validPosition && attempts < MAX_ATTEMPTS) {
        const newObj = {
          x: Math.random() * 54 + 9,
          y: Math.random() * 18 + 15,
          controlled_by: null
        };
        const tooClose = objectives.some(existing => {
          const dx = newObj.x - existing.x;
          const dy = newObj.y - existing.y;
          return Math.sqrt(dx * dx + dy * dy) < MIN_DISTANCE;
        });
        if (!tooClose) {
          objectives.push(newObj);
          validPosition = true;
        }
        attempts++;
      }
      if (attempts >= MAX_ATTEMPTS) break;
    }
    
    return objectives;
  };

  // Compute correct wound pool for each unit (Bug 1, 9)
  const computeWounds = (unit) => {
    const toughMatch = unit.special_rules?.match(/Tough\((\d+)\)/);
    const toughValue = toughMatch ? parseInt(toughMatch[1]) : 0;
    const isHero = unit.special_rules?.toLowerCase().includes('hero');

    if (isHero && toughValue > 0) {
      // Hero with Tough(X) joined to a squad: (squad models - 1 non-hero) × 1 + hero Tough(X)
      // unit.models includes both the hero and squad members
      const squadModels = Math.max(0, unit.models - 1);
      return squadModels + toughValue;
    }
    if (isHero) {
      // Hero without explicit Tough: just counts as 1 wound but may be joined to squad
      return unit.models;
    }
    // Regular Tough(X) unit — X is the unit's total wound pool (e.g. tank with Tough(12))
    if (toughValue > 0) return toughValue;
    // Standard infantry: 1 wound per model
    return unit.models;
  };

  // Bug 3: assign unique disambiguated names (e.g. "Support Sisters A", "Support Sisters B")
  const disambiguateUnitNames = (units) => {
    const nameCounts = {};
    const nameIndex = {};
    // Count occurrences of each name
    units.forEach(u => { nameCounts[u.name] = (nameCounts[u.name] || 0) + 1; });
    return units.map(u => {
      if (nameCounts[u.name] > 1) {
        nameIndex[u.name] = (nameIndex[u.name] || 0);
        const suffix = String.fromCharCode(65 + nameIndex[u.name]); // A, B, C...
        nameIndex[u.name]++;
        return { ...u, name: `${u.name} ${suffix}`, display_name: `${u.name} ${suffix}` };
      }
      return u;
    });
  };

  // Bug 3: resolve best melee weapon name from list, fallback to "Fists"
  const resolveMeleeWeaponName = (unit) => {
    const melee = unit.weapons?.filter(w => w.range <= 2) || [];
    if (melee.length === 0) return 'Fists';
    // Pick highest AP then highest attacks
    const best = melee.sort((a, b) => (b.ap || 0) - (a.ap || 0) || (b.attacks || 1) - (a.attacks || 1))[0];
    return best.name || 'Fists';
  };

  const deployArmies = (armyA, armyB) => {
    let idCounter = 0;

    const buildUnits = (army, owner, yFn) =>
      army.units.map((unit, idx) => {
        const maxWounds = computeWounds(unit);
        return {
          ...unit,
          id: `${owner === 'agent_a' ? 'a' : 'b'}_${idCounter++}`,
          owner,
          x: (idx * 12) % 60 + 6,
          y: yFn(idx),
          current_models: maxWounds,
          total_models: maxWounds,
          status: 'normal',
          fatigued: false,
          just_charged: false,
          rounds_without_offense: 0,
          // Bug 3: store resolved melee weapon name at deploy time
          melee_weapon_name: resolveMeleeWeaponName(unit),
        };
      });

    const aUnits = buildUnits(armyA, 'agent_a', idx => 6 + (Math.floor(idx / 5) * 3));
    const bUnits = buildUnits(armyB, 'agent_b', idx => 42 - (Math.floor(idx / 5) * 3));

    // Disambiguate within each army separately (same unit type in same army gets A/B suffix)
    const disambiguated = [
      ...disambiguateUnitNames(aUnits),
      ...disambiguateUnitNames(bUnits),
    ];

    return disambiguated;
  };

  const processNextAction = async () => {
    const gs = gameStateRef.current;
    if (!gs || !battle) return;

    // Every living unit gets exactly one activation per round
    const activeUnits = gs.units.filter(u =>
      u.current_models > 0 &&
      u.status !== 'destroyed' &&
      u.status !== 'routed' &&
      !gs.units_activated?.includes(u.id)
    );

    if (activeUnits.length === 0) {
      await endRound();
      return;
    }

    // Alternate agents; if current agent has no units left, drain the other side
    const agentUnits = activeUnits.filter(u => u.owner === gs.active_agent);

    if (agentUnits.length === 0) {
      const newState = { ...gs, active_agent: gs.active_agent === 'agent_a' ? 'agent_b' : 'agent_a' };
      setGameStateAndRef(newState);
      return;
    }

    const unit = agentUnits[0];
    await activateUnit(unit);
  };

  const activateUnit = async (unit) => {
    // Always read the canonical live state from the ref (avoids stale closure wound resets)
    const gs = gameStateRef.current;
    const liveUnit = gs.units.find(u => u.id === unit.id) || unit;
    setActiveUnit(liveUnit);

    let canShootOrCharge = true;
    if (liveUnit.status === 'shaken') {
      const quality = liveUnit.quality || 4;
      const roll = rules.dice.roll();
      const recovered = roll >= quality;
      const outcome = recovered ? 'recovered' : 'failed';
      const round = gs.current_round;
      if (recovered) liveUnit.status = 'normal';
      else canShootOrCharge = false;

      const recoveryEvents = [...eventsRef.current, {
        round, type: 'morale',
        message: `${liveUnit.name} Shaken recovery roll: ${roll} (need ${quality}+) — ${outcome}`,
        timestamp: new Date().toLocaleTimeString()
      }];
      battleLogger?.logMorale({ round, unit: liveUnit, outcome, roll, qualityTarget: quality, dmnReason: 'shaken recovery check' });
      setEventsAndRef(recoveryEvents);
    }

    const options = dmn.evaluateActionOptions(liveUnit, gs, liveUnit.owner);
    let selectedAction = options.find(o => o.selected)?.action || 'Hold';
    if (!canShootOrCharge && (selectedAction === 'Charge' || selectedAction === 'Hold')) {
      selectedAction = 'Advance';
    }

    setCurrentDecision({
      unit: liveUnit, options, dmn_phase: 'Action Selection',
      reasoning: `Unit at (${liveUnit.x.toFixed(0)}, ${liveUnit.y.toFixed(0)}) selected ${selectedAction} based on tactical evaluation.`
    });

    await new Promise(resolve => setTimeout(resolve, 500));
    await executeAction(liveUnit, selectedAction, canShootOrCharge);

    // Mark activated and switch agent using the latest ref state
    const latestGs = gameStateRef.current;
    const newState = {
      ...latestGs,
      units_activated: [...(latestGs.units_activated || []), liveUnit.id],
      active_agent: latestGs.active_agent === 'agent_a' ? 'agent_b' : 'agent_a'
    };
    setGameStateAndRef(newState);
    setActiveUnit(null);
  };

  const executeAction = async (unit, action, canShootOrCharge = true) => {
    // Always read latest state from ref to avoid stale closures
    const gs = gameStateRef.current;
    const newEvents = [...eventsRef.current];

    const tracking = { ...actionTracking };
    tracking[unit.owner][action] = (tracking[unit.owner][action] || 0) + 1;
    setActionTracking(tracking);

    const round = gs.current_round;
    const dmnOptions = dmn.evaluateActionOptions(unit, gs, unit.owner);
    const topOption = dmnOptions.sort((a, b) => b.score - a.score)[0];
    const dmnReason = topOption ? `${topOption.action} scored highest (${topOption.score.toFixed(2)})` : action;

    // Teleport — reposition then shoot/charge
    if (unit.special_rules?.includes('Teleport') && (action === 'Advance' || action === 'Rush')) {
      const teleported = rules.executeTeleport(unit, gs);
      if (teleported) {
        const zone = rules.getZone(unit.x, unit.y);
        newEvents.push({ round, type: 'ability', message: `${unit.name} used Teleport to redeploy`, timestamp: new Date().toLocaleTimeString() });
        battleLogger?.logAbility({ round, unit, ability: 'Teleport', details: { zone } });
        if (canShootOrCharge) {
          const didShoot = await attemptShooting(unit, newEvents, dmnReason);
          if (!didShoot) {
            const enemies = gs.units.filter(u => u.owner !== unit.owner && u.current_models > 0 && u.status !== 'destroyed' && u.status !== 'routed');
            const chargeTarget = enemies.find(e => rules.calculateDistance(unit, e) <= 12);
            if (chargeTarget) {
              unit.just_charged = true;
              rules.executeMovement(unit, 'Charge', chargeTarget, gs.terrain);
              newEvents.push({ round, type: 'movement', message: `${unit.name} charged ${chargeTarget.name}!`, timestamp: new Date().toLocaleTimeString() });
              battleLogger?.logMove({ round, actingUnit: unit, action: 'Charge', distance: null, zone: rules.getZone(unit.x, unit.y), dmnReason, chargeTarget: chargeTarget.name });
              await resolveMelee(unit, chargeTarget, newEvents, dmnReason);
            }
          }
          unit.rounds_without_offense = 0;
        }
        setEventsAndRef(newEvents);
        rules.updateObjectives(gs);
        return;
      }
    }

    if (action === 'Hold') {
      if (canShootOrCharge) await attemptShooting(unit, newEvents, dmnReason);

    } else if (action === 'Advance') {
      const target = dmn.findNearestObjective(unit, gs.objectives);
      if (target) {
        const result = rules.executeMovement(unit, action, target, gs.terrain);
        const zone = rules.getZone(unit.x, unit.y);
        newEvents.push({ round, type: 'movement', message: `${unit.name} advanced ${result.distance.toFixed(1)}" toward objective`, timestamp: new Date().toLocaleTimeString() });
        battleLogger?.logMove({ round, actingUnit: unit, action, distance: result.distance, zone, dmnReason });
      }
      if (canShootOrCharge) await attemptShooting(unit, newEvents, dmnReason);

    } else if (action === 'Rush') {
      const target = dmn.findNearestObjective(unit, gs.objectives);
      if (target) {
        const result = rules.executeMovement(unit, action, target, gs.terrain);
        const zone = rules.getZone(unit.x, unit.y);
        newEvents.push({ round, type: 'movement', message: `${unit.name} rushed ${result.distance.toFixed(1)}" toward objective`, timestamp: new Date().toLocaleTimeString() });
        battleLogger?.logMove({ round, actingUnit: unit, action, distance: result.distance, zone, dmnReason });
      }
      unit.rounds_without_offense = (unit.rounds_without_offense || 0) + 1;

    } else if (action === 'Charge') {
      const enemies = gs.units.filter(u => u.owner !== unit.owner && u.current_models > 0 && u.status !== 'destroyed' && u.status !== 'routed');
      const target = dmn.selectTarget(unit, enemies);
      if (target) {
        unit.just_charged = true;
        rules.executeMovement(unit, action, target, gs.terrain);
        const zone = rules.getZone(unit.x, unit.y);
        newEvents.push({ round, type: 'movement', message: `${unit.name} charged ${target.name}!`, timestamp: new Date().toLocaleTimeString() });
        battleLogger?.logMove({ round, actingUnit: unit, action: 'Charge', distance: null, zone, dmnReason, chargeTarget: target.name });
        await resolveMelee(unit, target, newEvents, dmnReason);
        unit.rounds_without_offense = 0;
      }
    }

    setEventsAndRef(newEvents);
    rules.updateObjectives(gs);
  };

  // Fire ALL ranged weapons in a single activation — one shoot event per weapon
  const attemptShooting = async (unit, newEvents, dmnReason) => {
    const gs = gameStateRef.current;
    const round = gs.current_round;
    let shotFired = false;

    const rangedWeapons = unit.weapons?.filter(w => w.range > 2) || [];
    if (rangedWeapons.length === 0) return false;

    for (const weapon of rangedWeapons) {
      // Re-fetch living enemies per weapon so mid-activation kills are respected
      const liveEnemies = gs.units.filter(u =>
        u.owner !== unit.owner && u.current_models > 0 && u.status !== 'destroyed' && u.status !== 'routed'
      );
      if (liveEnemies.length === 0) break;

      const target = dmn.selectTarget(unit, liveEnemies);
      if (!target) continue;

      const dist = rules.calculateDistance(unit, target);
      if (dist > weapon.range) continue;

      const result = rules.resolveShooting(unit, target, weapon, gs.terrain, gs);
      const woundsDealt = result.wounds;
      target.current_models = Math.max(0, target.current_models - woundsDealt);
      if (target.current_models <= 0) target.status = 'destroyed';
      shotFired = true;
      unit.rounds_without_offense = 0;

      // Blast(X) — attacks = X auto-hits
      const blastMatch = weapon.special_rules?.match(/Blast\((\d+)\)/);
      const blastCount = blastMatch ? parseInt(blastMatch[1]) : 0;
      const loggedAttacks = blastCount > 0 ? blastCount : (weapon.attacks || 1);

      const scoredEnemies = liveEnemies.map(e => ({ enemy: e, score: dmn.scoreTarget(unit, e) }));
      scoredEnemies.sort((a, b) => b.score - a.score);
      const topScore = scoredEnemies[0]?.score.toFixed(2);
      const shootDmnReason = target.current_models <= 0
        ? `Eliminated weakest target (${topScore})`
        : target.current_models <= target.total_models * 0.5
        ? `Weakest target available (${topScore})`
        : `Highest threat score in range (${topScore})`;

      setCurrentCombat({
        type: 'shooting',
        attacker: unit,
        defender: target,
        weapon: weapon.name,
        hit_rolls: result.hit_rolls,
        hits: result.hits,
        defense_rolls: result.defense_rolls,
        saves: result.saves,
        result: `${result.hits} hits, ${result.saves} saves`
      });

      newEvents.push({
        round,
        type: 'combat',
        message: `${unit.name} shot at ${target.name} with ${weapon.name}: ${result.hits} hits, ${result.saves} saves, ${woundsDealt} wounds`,
        timestamp: new Date().toLocaleTimeString()
      });

      if (target.current_models <= 0) {
        newEvents.push({ round, type: 'combat', message: `${target.name} was destroyed!`, timestamp: new Date().toLocaleTimeString() });
        battleLogger?.logDestruction({ round, unit: target, cause: `shooting by ${unit.name}` });
      }

      battleLogger?.logShoot({
        round,
        actingUnit: unit,
        targetUnit: target,
        weapon: weapon.name,
        zone: rules.getZone(unit.x, unit.y),
        rangeDist: dist,
        rollResults: { attacks: loggedAttacks, hits: result.hits, saves: result.saves, wounds_dealt: woundsDealt },
        gameState: gs,
        dmnReason: shootDmnReason
      });

      // Only trigger morale if unit is still alive and normal (Bugs 3 & 8)
      if (target.current_models > 0 && target.status === 'normal' && target.current_models <= target.total_models / 2) {
        const moraleResult = rules.checkMorale(target, 'wounds');
        if (!moraleResult.passed) {
          const outcome = rules.applyMoraleResult(target, false, 'wounds');
          newEvents.push({
            round, type: 'morale',
            message: `${target.name} morale check failed — ${outcome} (roll: ${moraleResult.roll})`,
            timestamp: new Date().toLocaleTimeString()
          });
          battleLogger?.logMorale({ round, unit: target, outcome, roll: moraleResult.roll, qualityTarget: target.quality || 4 });
        }
      }

      await new Promise(resolve => setTimeout(resolve, 800));
    }

    setCurrentCombat(null);
    return shotFired;
  };

  const resolveMelee = async (attacker, defender, newEvents, dmnReason) => {
    const gs = gameStateRef.current;
    const result = rules.resolveMelee(attacker, defender, gs);
    const round = gs.current_round;
    
    defender.current_models = Math.max(0, defender.current_models - result.attacker_wounds);
    attacker.current_models = Math.max(0, attacker.current_models - result.defender_wounds);
    // Bug 5: mark destroyed immediately
    if (defender.current_models <= 0) defender.status = 'destroyed';
    if (attacker.current_models <= 0) attacker.status = 'destroyed';
    
    newEvents.push({
      round,
      type: 'combat',
      message: `Melee: ${attacker.name} vs ${defender.name} — ${result.attacker_wounds} wounds dealt, ${result.defender_wounds} wounds taken`,
      timestamp: new Date().toLocaleTimeString()
    });
    // Bug 5: explicit destruction events
    if (defender.current_models <= 0) {
      newEvents.push({ round, type: 'combat', message: `${defender.name} was destroyed in melee!`, timestamp: new Date().toLocaleTimeString() });
      battleLogger?.logDestruction({ round, unit: defender, cause: `melee with ${attacker.name}` });
    }
    if (attacker.current_models <= 0) {
      newEvents.push({ round, type: 'combat', message: `${attacker.name} was destroyed in melee!`, timestamp: new Date().toLocaleTimeString() });
      battleLogger?.logDestruction({ round, unit: attacker, cause: `melee with ${defender.name}` });
    }

    // Bug 4 & 7 fix: capture full roll breakdown and specific weapon name
    const attackerMeleeWeapon = attacker.weapons?.filter(w => w.range <= 2).sort((a, b) => (b.ap || 0) - (a.ap || 0) || (b.attacks || 1) - (a.attacks || 1))[0];
    const defenderMeleeWeapon = defender.weapons?.filter(w => w.range <= 2).sort((a, b) => (b.ap || 0) - (a.ap || 0) || (b.attacks || 1) - (a.attacks || 1))[0];
    // resolveShooting returns: { hits (successes), saves, wounds }
    const aRes = result.attacker_results?.results?.[0]; // first weapon result
    const dRes = result.defender_results?.results?.[0];
    battleLogger?.logMelee({
      round,
      actingUnit: attacker,
      targetUnit: defender,
      weaponName: attackerMeleeWeapon?.name || attacker.melee_weapon_name || 'Fists',
      rollResults: {
        attacker_attacks: attackerMeleeWeapon?.attacks || 1,
        attacker_hits: aRes?.hits ?? 0,
        attacker_saves_forced: aRes?.hits ?? 0,
        defender_saves_made: aRes?.saves ?? 0,
        wounds_dealt: result.attacker_wounds,
        defender_attacks: defenderMeleeWeapon?.attacks || 1,
        defender_hits: dRes?.hits ?? 0,
        defender_saves_forced: dRes?.hits ?? 0,
        attacker_saves_made: dRes?.saves ?? 0,
        wounds_taken: result.defender_wounds
      },
      gameState: gs,
      dmnReason
    });
    
    // Bugs 3 & 8: only check morale on melee loser if it's not already shaken/destroyed
    const loser = result.winner === attacker ? defender : (result.winner === defender ? attacker : null);
    if (loser && loser.current_models > 0 && loser.status === 'normal') {
      const moraleResult = rules.checkMorale(loser, 'melee_loss');
      const outcome = rules.applyMoraleResult(loser, moraleResult.passed, 'melee_loss');
      newEvents.push({
        round,
        type: 'morale',
        message: `${loser.name} ${outcome === 'routed' ? 'routed!' : outcome === 'shaken' ? 'is Shaken' : 'passed morale'} (roll: ${moraleResult.roll})`,
        timestamp: new Date().toLocaleTimeString()
      });
      battleLogger?.logMorale({ round, unit: loser, outcome, roll: moraleResult.roll, qualityTarget: loser.quality || 4 });
    }
  };

  const endRound = async () => {
    const gs = gameStateRef.current;
    const newRound = gs.current_round + 1;

    if (newRound > 4) {
      await endBattle();
      return;
    }

    const newState = {
      ...gs,
      current_round: newRound,
      units_activated: [],
      active_agent: 'agent_a'
    };

    // Validate — force-log units that died with no destruction event
    const prevAlive = gs.units.filter(u => u.current_models > 0 && u.status !== 'destroyed' && u.status !== 'routed');
    prevAlive.forEach(u => {
      const inNew = newState.units.find(n => n.id === u.id);
      if (inNew && inNew.current_models <= 0 && inNew.status !== 'destroyed') {
        inNew.status = 'destroyed';
        battleLogger?.logDestruction({ round: gs.current_round, unit: inNew, cause: 'unknown (validated at round end)' });
      }
    });

    newState.units.forEach(u => {
      u.fatigued = false;
      u.just_charged = false;
      // Only clear Shaken, NEVER reset wounds
      if (u.status === 'shaken') u.status = 'normal';
      if (u.current_models <= 0) u.status = 'destroyed';
    });

    const REGEN_RULES = ['Regeneration', 'Self-Repair', 'Repair'];
    const getRegenRuleName = (u) => REGEN_RULES.find(r => u.special_rules?.includes(r));

    const regenEvents = [];
    newState.units.forEach(u => {
      const regenRule = getRegenRuleName(u);
      if (u.current_models > 0 && regenRule && u.current_models < u.total_models) {
        const { recovered, roll } = rules.applyRegeneration(u);
        regenEvents.push({
          round: gs.current_round, type: 'regen',
          message: `${u.name} ${regenRule} roll: ${roll} — ${recovered ? 'recovered 1 wound' : 'no recovery'}`,
          timestamp: new Date().toLocaleTimeString()
        });
        battleLogger?.logRegeneration({ round: gs.current_round, unit: u, recovered, roll, ruleName: regenRule });
      }
      u.rounds_without_offense = u.rounds_without_offense || 0;
    });

    // Round summary — cumulative scoring
    const roundA = newState.objectives.filter(o => o.controlled_by === 'agent_a').length;
    const roundB = newState.objectives.filter(o => o.controlled_by === 'agent_b').length;
    const isCumulative = newState.advance_rules?.cumulativeScoring;
    const prevCumulative = newState.cumulative_score || { agent_a: 0, agent_b: 0 };
    if (isCumulative) {
      newState.cumulative_score = { agent_a: prevCumulative.agent_a + roundA, agent_b: prevCumulative.agent_b + roundB };
    }
    const scoreToLog = isCumulative ? newState.cumulative_score : { agent_a: roundA, agent_b: roundB };
    battleLogger?.logRoundSummary({ round: gs.current_round, objectives: newState.objectives, score: scoreToLog, units: newState.units });

    setGameStateAndRef(newState);

    const newEvents = [...eventsRef.current, ...regenEvents, {
      round: newRound, type: 'round',
      message: `--- Round ${newRound} begins ---`,
      timestamp: new Date().toLocaleTimeString()
    }];
    setEventsAndRef(newEvents);
  };

  const endBattle = async () => {
    const gs = gameStateRef.current;
    const isCumulative = gs.advance_rules?.cumulativeScoring;
    const roundA = gs.objectives.filter(o => o.controlled_by === 'agent_a').length;
    const roundB = gs.objectives.filter(o => o.controlled_by === 'agent_b').length;
    const finalCumulative = isCumulative
      ? { agent_a: (gs.cumulative_score?.agent_a || 0) + roundA, agent_b: (gs.cumulative_score?.agent_b || 0) + roundB }
      : null;
    const aScore = isCumulative ? finalCumulative.agent_a : roundA;
    const bScore = isCumulative ? finalCumulative.agent_b : roundB;
    const winner = aScore > bScore ? 'agent_a' : bScore > aScore ? 'agent_b' : 'draw';

    await base44.entities.Battle.update(battle.id, {
      status: 'completed', winner, game_state: gs, event_log: eventsRef.current
    });

    const aUnits = gs.units.filter(u => u.owner === 'agent_a' && u.current_models > 0).length;
    const bUnits = gs.units.filter(u => u.owner === 'agent_b' && u.current_models > 0).length;
    
    await base44.entities.BattleAnalytics.create({
      battle_id: battle.id,
      army_id: battle.army_a_id,
      result: winner === 'agent_a' ? 'won' : winner === 'agent_b' ? 'lost' : 'draw',
      objectives_controlled: aScore,
      units_survived: aUnits,
      successful_actions: actionTracking.agent_a
    });
    
    await base44.entities.BattleAnalytics.create({
      battle_id: battle.id,
      army_id: battle.army_b_id,
      result: winner === 'agent_b' ? 'won' : winner === 'agent_a' ? 'lost' : 'draw',
      objectives_controlled: bScore,
      units_survived: bUnits,
      successful_actions: actionTracking.agent_b
    });
    
    battleLogger?.logRoundSummary({
      round: gs.current_round, objectives: gs.objectives,
      score: { agent_a: aScore, agent_b: bScore }, units: gs.units
    });
    // Embed battle_config and advance_rules in log header (advance rules wiring fix)
    const advRules = gs.advance_rules || {};
    const activeRuleKeys = Object.entries(advRules).filter(([, v]) => v).map(([k]) => k);
    battleLogger?.setBattleConfig({
      scoring_mode: advRules.cumulativeScoring ? 'cumulative' : 'per_round',
      advance_rules: activeRuleKeys,
    });
    battleLogger?.logBattleEnd({ winner, finalScore: { agent_a: aScore, agent_b: bScore } });
    const log = battleLogger?.getFullLog(winner, { agent_a: aScore, agent_b: bScore });
    setFullJsonLog(log);
    console.log('=== BATTLE JSON LOG ===');
    console.log(JSON.stringify(log, null, 2));

    setBattle({ ...battle, status: 'completed', winner });
    setPlaying(false);

    const newEvents = [...eventsRef.current, {
      round: gs.current_round, type: 'victory',
      message: `Battle ended! ${winner === 'draw' ? 'Draw' : winner === 'agent_a' ? 'Agent A wins' : 'Agent B wins'} (${aScore} - ${bScore})`,
      timestamp: new Date().toLocaleTimeString()
    }];
    setEventsAndRef(newEvents);
  };

  if (!battle || !gameState) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white">Loading battle...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4">
      {/* Header */}
      <div className="max-w-[2000px] mx-auto mb-4 flex justify-between items-center">
        <Button
          variant="outline"
          onClick={() => navigate('/Home')}
          className="border-slate-600 text-slate-300"
        >
          <Home className="w-4 h-4 mr-2" />
          Home
        </Button>
        
        <div className="flex gap-2">
              <Button
                onClick={() => setPlaying(!playing)}
                disabled={battle.status === 'completed'}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {playing ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                {playing ? 'Pause' : 'Play'}
              </Button>

              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="border-slate-600 text-slate-300"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>

              {fullJsonLog && (
                <Button
                  variant="outline"
                  className="border-green-600 text-green-400 hover:bg-green-900/20"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(fullJsonLog, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `battle-log-${battle.id}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Log
                </Button>
              )}
            </div>
      </div>

      {/* Main Layout */}
      <div className="max-w-[2000px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Sidebar */}
        <div className="lg:col-span-3 space-y-4">
          <GameStatePanel 
            battle={battle} 
            gameState={gameState}
            armyAName={battle?.armyAName}
            armyBName={battle?.armyBName}
          />
          <DecisionTreeView decision={currentDecision} />
        </div>

        {/* Center - Battlefield */}
        <div className="lg:col-span-6 overflow-x-auto">
          <BattlefieldView 
            gameState={gameState}
            activeUnit={activeUnit}
            onUnitClick={(unit) => console.log('Unit clicked:', unit)}
          />
        </div>

        {/* Right Sidebar */}
        <div className="lg:col-span-3 space-y-4">
          <CombatResolver combatEvent={currentCombat} />
          {fullJsonLog ? (
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 flex flex-col" style={{ maxHeight: '500px' }}>
              <div className="text-slate-300 text-xs font-semibold mb-2">Battle JSON Log (copy below)</div>
              <textarea
                readOnly
                className="flex-1 bg-slate-800 text-green-300 text-xs font-mono rounded p-2 resize-none outline-none border border-slate-600"
                style={{ minHeight: '420px' }}
                value={JSON.stringify(fullJsonLog, null, 2)}
                onFocus={e => e.target.select()}
              />
            </div>
          ) : (
            <ActionLog events={events} />
          )}
        </div>
      </div>
    </div>
  );
}