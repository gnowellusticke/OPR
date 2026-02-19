import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Home } from "lucide-react";
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

  useEffect(() => {
    loadBattle();
  }, []);

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

      setBattle(battleData);
      
      if (battleData.status === 'setup') {
        await initializeBattle(battleData, armyA, armyB);
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

  const initializeBattle = async (battleData, armyA, armyB) => {
    const terrain = generateTerrain();
    const objectives = generateObjectives();
    const units = deployArmies(armyA, armyB);
    
    const initialState = {
      units,
      terrain,
      objectives,
      active_agent: 'agent_a',
      current_round: 1,
      units_activated: []
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

  const deployArmies = (armyA, armyB) => {
    const units = [];
    let idCounter = 0;
    
    armyA.units.forEach((unit, idx) => {
      units.push({
        ...unit,
        id: `a_${idCounter++}`,
        owner: 'agent_a',
        x: (idx * 12) % 60 + 6,
        y: 6 + (Math.floor(idx / 5) * 3),
        current_models: unit.models,
        total_models: unit.models,
        status: 'normal',
        fatigued: false,
        just_charged: false
      });
    });
    
    armyB.units.forEach((unit, idx) => {
      units.push({
        ...unit,
        id: `b_${idCounter++}`,
        owner: 'agent_b',
        x: (idx * 12) % 60 + 6,
        y: 42 - (Math.floor(idx / 5) * 3),
        current_models: unit.models,
        total_models: unit.models,
        status: 'normal',
        fatigued: false,
        just_charged: false
      });
    });
    
    return units;
  };

  const processNextAction = async () => {
    if (!gameState || !battle) return;

    const activeUnits = gameState.units.filter(u => 
      u.current_models > 0 && !gameState.units_activated?.includes(u.id)
    );
    
    if (activeUnits.length === 0) {
      await endRound();
      return;
    }

    const agentUnits = activeUnits.filter(u => u.owner === gameState.active_agent);
    
    if (agentUnits.length === 0) {
      const newState = {
        ...gameState,
        active_agent: gameState.active_agent === 'agent_a' ? 'agent_b' : 'agent_a'
      };
      setGameState(newState);
      return;
    }

    const unit = agentUnits[0];
    await activateUnit(unit);
  };

  const activateUnit = async (unit) => {
    setActiveUnit(unit);
    
    const options = dmn.evaluateActionOptions(unit, gameState, unit.owner);
    const selectedAction = options.find(o => o.selected).action;
    
    setCurrentDecision({
      unit,
      options,
      dmn_phase: 'Action Selection',
      reasoning: `Unit at (${unit.x.toFixed(0)}, ${unit.y.toFixed(0)}) selected ${selectedAction} based on tactical evaluation.`
    });
    
    await new Promise(resolve => setTimeout(resolve, 500));
    await executeAction(unit, selectedAction);
    
    const newState = {
      ...gameState,
      units_activated: [...(gameState.units_activated || []), unit.id],
      active_agent: gameState.active_agent === 'agent_a' ? 'agent_b' : 'agent_a'
    };
    setGameState(newState);
    setActiveUnit(null);
  };

  const executeAction = async (unit, action) => {
    const newEvents = [...events];
    
    const tracking = { ...actionTracking };
    tracking[unit.owner][action] = (tracking[unit.owner][action] || 0) + 1;
    setActionTracking(tracking);
    
    if (action === 'Hold') {
      if (unit.status === 'shaken') {
        unit.status = 'normal';
        newEvents.push({
          round: gameState.current_round,
          type: 'morale',
          message: `${unit.name} recovered from Shaken status`,
          timestamp: new Date().toLocaleTimeString()
        });
      }
      await attemptShooting(unit, newEvents);
      
    } else if (action === 'Advance') {
      const target = dmn.findNearestObjective(unit, gameState.objectives);
      if (target) {
        const result = rules.executeMovement(unit, action, target, gameState.terrain);
        newEvents.push({
          round: gameState.current_round,
          type: 'movement',
          message: `${unit.name} advanced ${result.distance.toFixed(1)}" toward objective`,
          timestamp: new Date().toLocaleTimeString()
        });
      }
      await attemptShooting(unit, newEvents);
      
    } else if (action === 'Rush') {
      const target = dmn.findNearestObjective(unit, gameState.objectives);
      if (target) {
        const result = rules.executeMovement(unit, action, target, gameState.terrain);
        newEvents.push({
          round: gameState.current_round,
          type: 'movement',
          message: `${unit.name} rushed ${result.distance.toFixed(1)}" toward objective`,
          timestamp: new Date().toLocaleTimeString()
        });
      }
      
    } else if (action === 'Charge') {
      const enemies = gameState.units.filter(u => u.owner !== unit.owner && u.current_models > 0);
      const target = dmn.selectTarget(unit, enemies);
      
      if (target) {
        unit.just_charged = true;
        rules.executeMovement(unit, action, target, gameState.terrain);
        
        newEvents.push({
          round: gameState.current_round,
          type: 'movement',
          message: `${unit.name} charged ${target.name}!`,
          timestamp: new Date().toLocaleTimeString()
        });
        
        await resolveMelee(unit, target, newEvents);
      }
    }
    
    setEvents(newEvents);
    rules.updateObjectives(gameState);
  };

  const attemptShooting = async (unit, newEvents) => {
    const enemies = gameState.units.filter(u => u.owner !== unit.owner && u.current_models > 0);
    const target = dmn.selectTarget(unit, enemies);
    
    if (target && unit.weapons) {
      for (const weapon of unit.weapons) {
        if (weapon.range > 2) {
          const dist = rules.calculateDistance(unit, target);
          if (dist <= weapon.range) {
            const result = rules.resolveShooting(unit, target, weapon, gameState.terrain);
            
            // Apply wounds to remove models
            target.current_models = Math.max(0, target.current_models - result.wounds);
            
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
              round: gameState.current_round,
              type: 'combat',
              message: `${unit.name} shot at ${target.name} with ${weapon.name}: ${result.hits} hits, ${result.saves} saves`,
              timestamp: new Date().toLocaleTimeString()
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
    }
    
    setCurrentCombat(null);
  };

  const resolveMelee = async (attacker, defender, newEvents) => {
    const result = rules.resolveMelee(attacker, defender, gameState);
    
    defender.current_models = Math.max(0, defender.current_models - result.attacker_wounds);
    attacker.current_models = Math.max(0, attacker.current_models - result.defender_wounds);
    
    newEvents.push({
      round: gameState.current_round,
      type: 'combat',
      message: `Melee: ${attacker.name} vs ${defender.name} — ${result.attacker_wounds} wounds dealt, ${result.defender_wounds} wounds taken`,
      timestamp: new Date().toLocaleTimeString()
    });
    
    const loser = result.winner === attacker ? defender : attacker;
    if (loser.current_models > 0) {
      const moraleResult = rules.checkMorale(loser, 'melee_loss');
      const outcome = rules.applyMoraleResult(loser, moraleResult.passed, 'melee_loss');
      
      newEvents.push({
        round: gameState.current_round,
        type: 'morale',
        message: `${loser.name} ${outcome === 'routed' ? 'routed!' : outcome === 'shaken' ? 'is Shaken' : 'passed morale'}`,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  };

  const endRound = async () => {
    const newRound = gameState.current_round + 1;
    
    if (newRound > 4) {
      await endBattle();
      return;
    }
    
    const newState = {
      ...gameState,
      current_round: newRound,
      units_activated: [],
      active_agent: 'agent_a'
    };
    
    newState.units.forEach(u => {
      u.fatigued = false;
      u.just_charged = false;
    });
    
    setGameState(newState);
    
    const newEvents = [...events, {
      round: newRound,
      type: 'round',
      message: `--- Round ${newRound} begins ---`,
      timestamp: new Date().toLocaleTimeString()
    }];
    setEvents(newEvents);
  };

  const endBattle = async () => {
    const aScore = gameState.objectives.filter(o => o.controlled_by === 'agent_a').length;
    const bScore = gameState.objectives.filter(o => o.controlled_by === 'agent_b').length;
    const winner = aScore > bScore ? 'agent_a' : bScore > aScore ? 'agent_b' : 'draw';
    
    await base44.entities.Battle.update(battle.id, {
      status: 'completed',
      winner,
      game_state: gameState,
      event_log: events
    });
    
    const aUnits = gameState.units.filter(u => u.owner === 'agent_a' && u.current_models > 0).length;
    const bUnits = gameState.units.filter(u => u.owner === 'agent_b' && u.current_models > 0).length;
    
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
    
    setBattle({ ...battle, status: 'completed', winner });
    setPlaying(false);
    
    const newEvents = [...events, {
      round: 4,
      type: 'victory',
      message: `Battle ended! ${winner === 'draw' ? 'Draw' : winner === 'agent_a' ? 'Agent A wins' : 'Agent B wins'} (${aScore} - ${bScore})`,
      timestamp: new Date().toLocaleTimeString()
    }];
    setEvents(newEvents);
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
          <ActionLog events={events} />
        </div>
      </div>
    </div>
  );
}