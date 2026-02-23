import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { verifyRuleCompliance } from '../components/engine/RuleComplianceVerifier';
import { attachFactionSpells } from '../components/engine/spells/SpellRegistry';

export default function Battle() {
  const navigate = useNavigate();
  const [battle, setBattle] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [events, setEvents] = useState([]);
  const [activeUnit, setActiveUnit] = useState(null);
  const [currentDecision, setCurrentDecision] = useState(null);
  const [currentCombat, setCurrentCombat] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [fullJsonLog, setFullJsonLog] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState("Initializing...");

  // Engines (stable refs, never recreated)
  const dmnRef = useRef(new DMNEngine());
  const rulesRef = useRef(new RulesEngine());
  const loggerRef = useRef(null);
  const battleRef = useRef(null);
  const actionTrackingRef = useRef({ agent_a: {}, agent_b: {} });
  const playingRef = useRef(false);

  // CRITICAL: gameState and events live in refs so async closures always see latest values
  const gsRef = useRef(null);
  const evRef = useRef([]);

  const commitState = (newGs, newEvs) => {
    gsRef.current = newGs;
    evRef.current = newEvs ?? evRef.current;
    setGameState({ ...newGs });
    if (newEvs) setEvents([...newEvs]);
  };

  useEffect(() => { 
    setLoadingStatus("Loading battle data...");
    loadBattle().catch(err => {
      console.error("Battle load error:", err);
      setLoadingStatus(`Error: ${err.message}`);
    });
  }, []);

  // Play loop — triggers on playing flag change or after each state update
  useEffect(() => {
    if (!playing || !gsRef.current || battleRef.current?.status === 'completed') return;
    const timer = setTimeout(() => {
      if (playingRef.current) processNextAction();
    }, 800);
    return () => clearTimeout(timer);
  }, [playing, gameState]);

  const setPlayingBoth = (val) => {
    playingRef.current = val;
    setPlaying(val);
  };

  // ─── LOAD ────────────────────────────────────────────────────────────────────

  const loadBattle = async () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) { navigate('/Home'); return; }

    try {
      setLoadingStatus("Fetching battle data...");
      const battleData = await base44.entities.Battle.get(id);
      
      setLoadingStatus("Loading armies...");
      const armyA = await base44.entities.ArmyList.get(battleData.army_a_id);
      const armyB = await base44.entities.ArmyList.get(battleData.army_b_id);

      setLoadingStatus("Analyzing army performance...");
      await dmnRef.current.loadLearningData(battleData.army_a_id);

      const logger = new BattleLogger(battleData.id, armyA, armyB);
      loggerRef.current = logger;
      battleRef.current = { ...battleData, armyAName: armyA.name, armyBName: armyB.name };
      setBattle(battleRef.current);

      if (battleData.status === 'setup') {
        setLoadingStatus("Initializing battle...");
        await initializeBattle(battleData, armyA, armyB, logger);
      } else {
        setLoadingStatus("Loading saved battle state...");
        commitState(battleData.game_state, battleData.event_log || []);
      }
    } catch (err) {
      console.error("Battle load error:", err);
      setLoadingStatus(`Error: ${err.message}`);
      throw err;
    }
  };

  // ─── INIT ────────────────────────────────────────────────────────────────────

  const initializeBattle = async (battleData, armyA, armyB, logger) => {
    const mapTheme = battleData.game_state?.map_theme || 'mixed';
    const terrain = generateTerrain(mapTheme);
    const objectives = generateObjectives();
    const advRules = battleData.game_state?.advance_rules || {};
    const units = deployArmies(armyA, armyB, advRules);

    // Wire advance_rules into logger header immediately
    const activeRuleKeys = Object.entries(advRules).filter(([, v]) => v).map(([k]) => k);
    logger.setBattleConfig({
      scoring_mode: advRules.cumulativeScoring ? 'cumulative' : 'per_round',
      advance_rules: activeRuleKeys,
    });

    // Log objectives_placed event (Bug 4 fix)
    const diceRoll = objectives._diceRoll || 3;
    const numObjectives = objectives._numObjectives || objectives.length;
    logger.logObjectivesPlaced({ diceRoll, numObjectives, objectives });

    // Run alternating deployment phase (mutates unit positions, logs coin toss + deploy events)
    const { firstActivation } = await runDeploymentPhase(units, objectives, terrain, logger, advRules);

    // Grant initial spell tokens to all Caster units before round 1
    const rules = rulesRef.current;
    units.forEach(u => rules.replenishSpellTokens(u));

    const initialState = {
    units,
    terrain,
    objectives,
    active_agent: firstActivation,
    current_round: 1,
    units_activated: [],
    advance_rules: advRules,
    cumulative_score: { agent_a: 0, agent_b: 0 },
    };

    const log = [{
      round: 0, type: 'setup',
      message: 'Battle initialized. Terrain placed, objectives set, armies deployed.',
      timestamp: new Date().toLocaleTimeString()
    }];

    commitState(initialState, log);

    await base44.entities.Battle.update(battleData.id, {
      status: 'in_progress', current_round: 1,
      game_state: initialState, event_log: log
    });

    battleRef.current = { ...battleRef.current, status: 'in_progress', current_round: 1 };
    setBattle({ ...battleRef.current });
  };

  // ─── TERRAIN / OBJECTIVES ────────────────────────────────────────────────────

  const generateTerrain = (theme = 'mixed') => {
    // Core terrain type definitions
    const TERRAIN_TYPES = {
      barricade:        { cover: true,  difficult: true,  dangerous: false, blocking: false, impassable: false, movePenalty: 3,  label: 'Barricade' },
      crater:           { cover: true,  difficult: true,  dangerous: false, blocking: false, impassable: false, movePenalty: 0,  label: 'Crater' },
      forest:           { cover: true,  difficult: true,  dangerous: false, blocking: true,  impassable: false, movePenalty: 0,  label: 'Forest', blocksThroughLOS: true },
      hill:             { cover: true,  difficult: true,  dangerous: false, blocking: false, impassable: false, movePenalty: 0,  label: 'Hill', elevation: true },
      pond:             { cover: false, difficult: true,  dangerous: true,  blocking: false, impassable: false, movePenalty: 0,  label: 'Pond' },
      ruins:            { cover: true,  difficult: false, dangerous: false, blocking: false, impassable: false, movePenalty: 0,  label: 'Ruins' },
      solid_building:   { cover: false, difficult: false, dangerous: false, blocking: true,  impassable: true,  movePenalty: 0,  label: 'Building' },
      vehicle_wreckage: { cover: false, difficult: false, dangerous: true,  blocking: false, impassable: false, movePenalty: 0,  label: 'Wreckage', rushChargeDangerous: true },
      wall_open:        { cover: true,  difficult: false, dangerous: false, blocking: false, impassable: false, movePenalty: 0,  label: 'Wall (Open)' },
      wall_solid:       { cover: false, difficult: false, dangerous: false, blocking: true,  impassable: true,  movePenalty: 0,  label: 'Wall (Solid)' },
    };

    const THEME_WEIGHTS = {
      city_fight: [
        'solid_building','solid_building','solid_building',
        'ruins','ruins','ruins',
        'barricade','barricade','wall_open','wall_open','wall_solid',
        'crater','vehicle_wreckage',
      ],
      forest: [
        'forest','forest','forest','forest',
        'hill','hill','pond','pond',
        'ruins','barricade','crater',
      ],
      wasteland: [
        'crater','crater','crater',
        'vehicle_wreckage','vehicle_wreckage',
        'barricade','barricade','ruins','ruins',
        'hill','wall_open',
      ],
      mixed: [
        'ruins','ruins','crater','crater',
        'forest','forest','barricade','barricade',
        'hill','wall_open','pond','vehicle_wreckage',
        'solid_building','wall_solid',
      ],
    };

    const WEIGHTED = THEME_WEIGHTS[theme] || THEME_WEIGHTS.mixed;

    const terrain = [];
    let attempts = 0;
    while (terrain.length < 15 && attempts < 150) {
      const pick = WEIGHTED[Math.floor(Math.random() * WEIGHTED.length)];
      const def = TERRAIN_TYPES[pick];
      if (!def) { attempts++; continue; }
      const isLinear = pick === 'barricade' || pick === 'wall_open' || pick === 'wall_solid';
      const isBuilding = pick === 'solid_building';
      const w = isLinear ? 8 + Math.random() * 4 : isBuilding ? 4 + Math.random() * 5 : 5 + Math.random() * 6;
      const h = isLinear ? 1.5 + Math.random() * 1.5 : isBuilding ? 4 + Math.random() * 4 : 4 + Math.random() * 5;
      const t = {
        ...def,
        type: pick,
        x: Math.random() * 54 + 6,
        y: Math.random() * 34 + 6,
        width: w,
        height: h,
      };
      const overlaps = terrain.some(e =>
        t.x < e.x + e.width + 1 && t.x + t.width > e.x - 1 &&
        t.y < e.y + e.height + 1 && t.y + t.height > e.y - 1
      );
      if (!overlaps) terrain.push(t);
      attempts++;
    }
    return terrain;
  };

  const generateObjectives = () => {
    // Roll d3+2 for objective count (3–5).
    const diceRoll = Math.floor(Math.random() * 3) + 1; // 1, 2, or 3
    const numObjectives = diceRoll + 2; // 3, 4, or 5

    // Fixed canonical spread positions per count — small jitter (±2) for visual variety only.
    // All pairwise distances >= 15 units guaranteed by these coordinates.
    // y-coordinates capped to [14, 46] to keep objectives out of deployment strips (y<16, y>48).
    const jitter = () => (Math.random() - 0.5) * 4;
    // All y-values in [16, 44] — well inside the contested band.
    // Deployment strips: south y<12 (Agent A), north y>48 (Agent B).
    // x-values in [12, 48] — away from table edges.
    const SPREAD_POSITIONS = {
      3: [
        { id: 'obj_1', x: 15, y: 30 },
        { id: 'obj_2', x: 40, y: 18 },
        { id: 'obj_3', x: 40, y: 42 },
      ],
      4: [
        { id: 'obj_1', x: 15, y: 18 },
        { id: 'obj_2', x: 15, y: 42 },
        { id: 'obj_3', x: 40, y: 18 },
        { id: 'obj_4', x: 40, y: 42 },
      ],
      5: [
        { id: 'obj_1', x: 12, y: 30 },
        { id: 'obj_2', x: 28, y: 18 },
        { id: 'obj_3', x: 28, y: 42 },
        { id: 'obj_4', x: 46, y: 18 },
        { id: 'obj_5', x: 46, y: 42 },
      ],
    };

    const positions = SPREAD_POSITIONS[numObjectives] || SPREAD_POSITIONS[3];
    const selected = positions.map(pos => ({
      ...pos,
      // Clamp after jitter: x in [10,50], y in [16,44] — always inside contested band
      x: Math.max(10, Math.min(50, pos.x + jitter())),
      y: Math.max(16, Math.min(44, pos.y + jitter())),
      controlled_by: null
    }));

    console.log(`[OBJECTIVES] d3(${diceRoll})+2 = ${numObjectives} objectives placed`);
    selected._diceRoll = diceRoll;
    selected._numObjectives = numObjectives;
    return selected;
  };

  // ─── DEPLOY ──────────────────────────────────────────────────────────────────

  const computeWounds = (unit) => {
    // Bug 1 fix: Multi-model units have wounds = models × tough per model
    const toughMatch = unit.special_rules?.match(/Tough\((\d+)\)/);
    const toughValue = toughMatch ? parseInt(toughMatch[1]) : 0;
    const modelCount = unit.models || 1;
    const isHero = unit.special_rules?.toLowerCase().includes('hero');
    
    if (isHero && toughValue > 0) {
      // Hero: 1 hero model + toughValue wounds
      return 1 + toughValue;
    }
    if (toughValue > 0) {
      // Multi-model unit: each model has toughValue wounds
      return modelCount * toughValue;
    }
    // No tough value: each model is 1 wound (degenerate, but handle it)
    return modelCount;
  };

  const resolveMeleeWeaponName = (unit) => {
    const melee = (unit.weapons || []).filter(w => w.range <= 2);
    if (melee.length === 0) return 'Fists';
    const best = [...melee].sort((a, b) => (b.ap || 0) - (a.ap || 0) || (b.attacks || 1) - (a.attacks || 1))[0];
    return best.name && best.name !== 'CCW' ? best.name : (melee[0]?.name && melee[0].name !== 'CCW' ? melee[0].name : 'Fists');
  };

  const disambiguateUnitNames = (units) => {
    const counts = {};
    units.forEach(u => { counts[u.name] = (counts[u.name] || 0) + 1; });
    const idx = {};
    return units.map(u => {
      if (counts[u.name] > 1) {
        idx[u.name] = idx[u.name] || 0;
        const suffix = String.fromCharCode(65 + idx[u.name]++);
        return { ...u, name: `${u.name} ${suffix}` };
      }
      return u;
    });
  };

  const deployArmies = (armyA, armyB, advRules) => {
  let id = 0;
  const build = (army, owner) => army.units.map((unit) => {
  const maxWounds = computeWounds(unit);
  const isAmbush = unit.special_rules?.includes('Ambush') || unit.special_rules?.includes('Teleport') || unit.special_rules?.includes('Infiltrate');
  const isScout = unit.special_rules?.includes('Scout') && advRules?.scoutingDeployment;

  // Deduplicate weapons by name AND by (name+range+attacks) fingerprint to catch
  // parser duplicates where the same weapon appears twice with slightly different objects.
  // Use a canonical key so Doom Tank's Gauss Rifle Array / Heavy Doom Cannon are deduped at source.
  const seenWeaponKeys = new Set();
  const deduplicatedWeapons = (unit.weapons || []).filter(w => {
    const key = `${w.name}|${w.range}|${w.attacks}`;
    if (seenWeaponKeys.has(key)) return false;
    seenWeaponKeys.add(key);
    return true;
  });
  const ranged_weapons = deduplicatedWeapons.filter(w => (w.range ?? 2) > 2);

  // tough_per_model = wounds per model (for scaling attacks and model count)
  // Heroes with Tough(X): 1 model with X+1 wounds → tough_per_model = X+1
  // Multi-model with Tough(X): each model has X wounds → tough_per_model = X
  // Standard units (no Tough): each model = 1 wound → tough_per_model = 1
  const toughMatch = unit.special_rules?.match(/Tough\((\d+)\)/);
  const toughValue = toughMatch ? parseInt(toughMatch[1]) : 0;
  const isHero = unit.special_rules?.toLowerCase?.().includes('hero');
  const modelCount = unit.models || 1;
  // toughPerModel is wounds-per-model for attack scaling purposes
  let toughPerModel;
  if (isHero && toughValue > 0) {
    toughPerModel = toughValue + 1; // hero has 1+toughValue total wounds, 1 model
  } else if (toughValue > 0) {
    toughPerModel = toughValue; // multi-model: X wounds each
  } else {
    toughPerModel = 1; // standard: 1 wound per model
  }

  // Placeholder positions — real positions set during alternating deployment phase
  return {
  ...unit,
  weapons: deduplicatedWeapons, // use deduplicated weapon list everywhere
  id: `${owner === 'agent_a' ? 'a' : 'b'}_${id++}`,
  owner,
  x: owner === 'agent_a' ? 10 : 60,
  y: owner === 'agent_a' ? 10 : 38,
  current_models: maxWounds, total_models: maxWounds,
  model_count: modelCount,
  tough_per_model: toughPerModel,
  status: 'normal', fatigued: false, just_charged: false, rounds_without_offense: 0,
  spell_tokens: 0,
  melee_weapon_name: resolveMeleeWeaponName(unit),
  ranged_weapons,
  heroic_action_used: false,
  is_scout: isScout,
  is_in_reserve: isAmbush,
  quality: unit.quality || 4,
  defense: unit.defense || 5,
  special_rules: unit.special_rules || []
  };
  });

  const rawA = disambiguateUnitNames(build(armyA, 'agent_a'));
  const rawB = disambiguateUnitNames(build(armyB, 'agent_b'));
  const aUnits = attachFactionSpells(rawA, armyA.faction || armyA.name);
  const bUnits = attachFactionSpells(rawB, armyB.faction || armyB.name);
  return [...aUnits, ...bUnits];
  };

  // Alternating deployment phase — one unit per agent per turn, with DMN placement decisions
  // Returns a Promise so we can await staggered timestamps (Bug 1 fix)
  const runDeploymentPhase = async (units, objectives, terrain, logger, advRules) => {
  const dmn = dmnRef.current;

  // Coin toss
  const tossWinner = Math.random() > 0.5 ? 'agent_a' : 'agent_b';
  const tossLoser = tossWinner === 'agent_a' ? 'agent_b' : 'agent_a';
  const winnerReserveCount = units.filter(u => u.owner === tossWinner && u.is_in_reserve).length;
  const winnerTotal = units.filter(u => u.owner === tossWinner).length;
  const preferDeployFirst = winnerReserveCount / Math.max(winnerTotal, 1) > 0.5;
  const winnerChoice = preferDeployFirst ? 'deploy_first' : 'deploy_second';
  const deployFirst = winnerChoice === 'deploy_first' ? tossWinner : tossLoser;
  const deploySecond = deployFirst === tossWinner ? tossLoser : tossWinner;
  const firstActivation = deploySecond;

  logger?.logCoinToss({
    winner: tossWinner,
    choice: winnerChoice,
    reason: `${tossWinner} wins toss and chooses to ${winnerChoice === 'deploy_second' ? 'deploy second, activating first in Round 1' : 'deploy first for faster board control'}`,
    firstActivation
  });

  const queueA = units.filter(u => u.owner === deployFirst);
  const queueB = units.filter(u => u.owner === deploySecond);
  const order = [];
  const maxLen = Math.max(queueA.length, queueB.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < queueA.length) order.push(queueA[i]);
    if (i < queueB.length) order.push(queueB[i]);
  }

  const deployedByOwner = { agent_a: [], agent_b: [] };
  const zonesUsedByOwner = { agent_a: new Set(), agent_b: new Set() };
  const summaryDeployed = { agent_a: [], agent_b: [], reserves: [] };

  for (const unit of order) {
    const isAgentA = unit.owner === 'agent_a';
    const myDeployed = deployedByOwner[unit.owner];
    const enemyDeployed = deployedByOwner[unit.owner === 'agent_a' ? 'agent_b' : 'agent_a'];
    const myUsedZones = zonesUsedByOwner[unit.owner];

    // Bug 7 fix: Count units per zone per agent to prevent stacking more than 2
    const zoneUnitCounts = {};
    myDeployed.forEach(u => {
      const fZoneCol = u.x < 24 ? 'left' : u.x < 48 ? 'centre' : 'right';
      const fZoneRow = isAgentA ? 'south' : 'north';
      const zone = `${fZoneRow}-${fZoneCol}`;
      zoneUnitCounts[zone] = (zoneUnitCounts[zone] || 0) + 1;
    });

    if (unit.is_in_reserve) {
      summaryDeployed.reserves.push(unit.name);
      logger?.logDeploy({
        unit,
        zone: 'reserve',
        deploymentType: 'reserve',
        reserveRule: unit.special_rules?.match(/Ambush|Teleport|Infiltrate/)?.[0] || 'Reserve',
        dmnReason: `${unit.special_rules?.match(/Ambush|Teleport|Infiltrate/)?.[0] || 'Reserve'} rule: unit enters from reserve mid-battle`,
        specialRulesApplied: []
      });
    } else {
      const decision = dmn.decideDeployment(unit, isAgentA, enemyDeployed, myDeployed, objectives, terrain, myUsedZones);

      // Enforce max 2 units per zone at deployment time.
      // Count which zone the DMN decision lands in, then find a free zone if needed.
      const zoneRow = isAgentA ? 'south' : 'north';
      const yMin = isAgentA ? 3 : 32;
      const yMax = isAgentA ? 16 : 45;

      const getZoneCol = (x) => x < 24 ? 'left' : x < 48 ? 'centre' : 'right';
      const countInZone = (col) => myDeployed.filter(u => getZoneCol(u.x) === col).length;

      const ZONE_X = { left: 10, centre: 34, right: 58 };
      const decidedCol = getZoneCol(decision.x);
      const decidedZone = `${zoneRow}-${decidedCol}`;

      let finalCol = decidedCol;
      let finalZone = decidedZone;

      if (countInZone(decidedCol) >= 2) {
        // Try each zone in preference order: desired, then others
        const ordered = ['left', 'centre', 'right'].filter(c => c !== decidedCol);
        ordered.unshift(decidedCol); // put preferred first (already full, will skip)
        for (const col of ['left', 'centre', 'right']) {
          if (countInZone(col) < 2) {
            finalCol = col;
            finalZone = `${zoneRow}-${col}`;
            break;
          }
        }
        // If all zones are full (> 6 units per side), just use the least-full zone
        if (finalCol === decidedCol) {
          finalCol = ['left', 'centre', 'right'].reduce((best, col) =>
            countInZone(col) < countInZone(best) ? col : best, 'left');
          finalZone = `${zoneRow}-${finalCol}`;
        }
      }

      // Place within chosen zone — jitter within x-band + random y in deployment strip
      const baseX = ZONE_X[finalCol];
      const finalX = Math.max(4, Math.min(68, baseX + (Math.random() - 0.5) * 10));
      const finalY = yMin + Math.random() * (yMax - yMin);

      unit.x = finalX;
      unit.y = finalY;
      myDeployed.push({ x: unit.x, y: unit.y, name: unit.name, special_rules: unit.special_rules });
      myUsedZones.add(finalZone);
      (isAgentA ? summaryDeployed.agent_a : summaryDeployed.agent_b).push(unit.name);
      logger?.logDeploy({
        unit,
        zone: decision.zone,
        deploymentType: 'standard',
        dmnReason: decision.dmnReason,
        specialRulesApplied: decision.specialRulesApplied
      });
    }

    // Show each unit appearing on the battlefield one at a time
    const deploySnapshot = [...units];
    const deployLog = [{
      round: 0, type: 'setup',
      message: `Deploying ${unit.is_in_reserve ? `${unit.name} → Reserve` : `${unit.name} (${unit.owner === 'agent_a' ? 'A' : 'B'})`}`,
      timestamp: new Date().toLocaleTimeString()
    }];
    commitState({
      units: deploySnapshot,
      terrain,
      objectives,
      active_agent: firstActivation,
      current_round: 0,
      units_activated: [],
      advance_rules: advRules,
      cumulative_score: { agent_a: 0, agent_b: 0 },
      deployment_in_progress: true,
    }, deployLog);
    await new Promise(r => setTimeout(r, 400));
  }

  logger?.logDeploymentSummary({
    agentADeployed: summaryDeployed.agent_a,
    agentBDeployed: summaryDeployed.agent_b,
    reserves: summaryDeployed.reserves,
    firstActivation,
    dmnReason: `${tossWinner} won coin toss and chose to ${winnerChoice}, making ${firstActivation} first to activate in Round 1`
  });

  return { firstActivation };
  };

  // ─── MAIN LOOP ────────────────────────────────────────────────────────────────

  const processNextAction = async () => {
    // Always read from ref — never use a stale closure variable.
    const gs = gsRef.current;
    const bat = battleRef.current;
    if (!gs || !bat || bat.status === 'completed') return;

    // Build activation queue fresh from the live unit list every single call.
    // Source of truth is gsRef.current.units, re-read here to catch any mid-turn mutations.
    const activatedSet = new Set(gsRef.current.units_activated || []);

    // Deduplicate by id: each unit appears at most once in the living pool.
    const seenIds = new Set();
    const allLiving = gsRef.current.units.filter(u => {
      if (seenIds.has(u.id)) { 
        console.warn(`SCHEDULER: duplicate unit id ${u.id} (${u.name}) in gs.units — skipped`);
        return false; 
      }
      seenIds.add(u.id);
      return (
        u.current_models > 0 &&
        u.status !== 'destroyed' && u.status !== 'routed' &&
        !u.is_in_reserve
      );
    });

    // Safety net: log any living unit not yet activated this round
    const notYetActivated = allLiving.filter(u => !activatedSet.has(u.id));
    console.log(`[SCHEDULER R${gsRef.current.current_round}] living=${allLiving.length} activated=${activatedSet.size} remaining=${notYetActivated.length}`);

    const remaining = notYetActivated;

    if (remaining.length === 0) {
      await endRound(gs);
      return;
    }

    // Alternate activations: pick from active_agent; if none left, switch
    const agentRemaining = remaining.filter(u => u.owner === gs.active_agent);
    const otherRemaining = remaining.filter(u => u.owner !== gs.active_agent);

    let unit;
    if (agentRemaining.length > 0) {
      unit = agentRemaining[0];
    } else if (otherRemaining.length > 0) {
      unit = otherRemaining[0];
    } else {
      await endRound(gs);
      return;
    }

    await activateUnit(unit, gs);
  };

  // ─── ACTIVATE ─────────────────────────────────────────────────────────────────

  const activateUnit = async (unit, gs) => {
    // Always work on a fresh copy of the unit from gs
    const liveUnit = gs.units.find(u => u.id === unit.id);
    if (!liveUnit || liveUnit.current_models <= 0) {
      // Unit died before activation — just mark it and move on
      const newGs = { ...gs, units_activated: [...(gs.units_activated || []), unit.id], active_agent: gs.active_agent === 'agent_a' ? 'agent_b' : 'agent_a' };
      commitState(newGs);
      return;
    }

    setActiveUnit(liveUnit);
    const evs = [...evRef.current];
    const round = gs.current_round;
    const dmn = dmnRef.current;
    const rules = rulesRef.current;
    const logger = loggerRef.current;

    // Bug 2 fix: initialise firedThisActivation at very top of activation — before ANY action resolution
    liveUnit._firedThisActivation = new Set();

    // Bug 6 fix: Shaken recovery roll fires at START of unit's own activation, FIRST event
    let canAct = true;
    if (liveUnit.status === 'shaken') {
    const quality = liveUnit.quality || 4;
    const roll = rules.dice.roll();
    const recovered = roll >= quality;
    if (recovered && liveUnit.current_models > 0) {
      // Bug 2 fix: only clear shaken if still alive — destroyed units always stay 'destroyed'
      liveUnit.status = 'normal';
    } else {
      canAct = false;
    }
    const outcome = recovered ? 'recovered' : 'still_shaken';
    evs.push({ round, type: 'morale', message: `${liveUnit.name} Shaken recovery: rolled ${roll} vs ${quality}+ — ${recovered ? 'recovered' : 'still shaken, cannot act'}`, timestamp: new Date().toLocaleTimeString() });
    logger?.logMorale({ round, unit: liveUnit, outcome, roll, qualityTarget: quality, dmnReason: 'shaken recovery check at activation start' });
    }

    // Bug 4 fix: Failed shaken recovery ends activation immediately
    if (!canAct) {
      liveUnit.just_charged = false;
      const nextAgent = liveUnit.owner === 'agent_a' ? 'agent_b' : 'agent_a';
      const updatedGs = {
        ...gsRef.current,
        units_activated: [...(gsRef.current.units_activated || []), liveUnit.id],
        active_agent: nextAgent,
      };
      evRef.current = evs;
      commitState(updatedGs, evs);
      setActiveUnit(null);
      return;
    }

    // Commit state immediately after shaken check so recovery is logged before any target actions
    evRef.current = evs;
    const tempGs = { ...gsRef.current };
    commitState(tempGs, evs);

    // ── Heroic Action (Advance Rule) ──────────────────────────────────────────
    const advRules = gs.advance_rules || {};
    const isHero = liveUnit.special_rules?.toLowerCase().includes('hero') || liveUnit.special_rules?.match(/Tough\(\d+\)/);
    const useHeroic = advRules.heroicActions && isHero && !liveUnit.heroic_action_used && liveUnit.current_models <= liveUnit.total_models * 0.5;
    if (useHeroic) {
      liveUnit.heroic_action_used = true;
      evs.push({ round, type: 'ability', message: `${liveUnit.name} uses a Heroic Action — all dice re-rolled this activation!`, timestamp: new Date().toLocaleTimeString() });
      logger?.logAbility({ round, unit: liveUnit, ability: 'Heroic Action', details: { trigger: 'below half wounds' } });
    }

    // ── DMN action selection ──────────────────────────────────────────────────
    const options = dmn.evaluateActionOptions(liveUnit, gs, liveUnit.owner);
    let selectedAction = options.find(o => o.selected)?.action || 'Hold';
    // Bug 6 fix: shaken unit may only move (no Charge, no Hold+Shoot, no Advance+Shoot)
    if (!canAct && (selectedAction === 'Charge' || selectedAction === 'Hold')) selectedAction = 'Advance';

    setCurrentDecision({
      unit: liveUnit,
      options,
      dmn_phase: 'Action Selection',
      reasoning: `(${liveUnit.x.toFixed(0)}, ${liveUnit.y.toFixed(0)}) → ${selectedAction}`
    });

    await new Promise(r => setTimeout(r, 300));
    await executeAction(liveUnit, selectedAction, canAct, gs, evs);

    // ── Overrun (Advance Rule) ────────────────────────────────────────────────
    // (handled inside executeAction after melee kill)

    // ── Mark activated, flip agent ────────────────────────────────────────────
    liveUnit.just_charged = false;
    const nextAgent = liveUnit.owner === 'agent_a' ? 'agent_b' : 'agent_a';
    // Always read the very latest gs from ref to avoid losing activations written
    // by concurrent state updates (e.g. melee targeting the same unit mid-turn).
    const latestGs = gsRef.current;
    const activatedSetFinal = new Set(latestGs.units_activated || []);
    activatedSetFinal.add(liveUnit.id);
    // Also ensure every unit that was in a charge/melee during this activation
    // is NOT re-added to the queue — they were already registered as targets, not activators.
    const updatedGs = {
      ...latestGs,
      units_activated: Array.from(activatedSetFinal),
      active_agent: nextAgent,
    };
    commitState(updatedGs, evRef.current);
    setActiveUnit(null);
  };

  // ─── EXECUTE ACTION ───────────────────────────────────────────────────────────

  const executeAction = async (unit, action, canAct, gs, evs) => {
    const round = gs.current_round;
    const dmn = dmnRef.current;
    const rules = rulesRef.current;
    const logger = loggerRef.current;
    const tracking = actionTrackingRef.current;
    tracking[unit.owner][action] = (tracking[unit.owner][action] || 0) + 1;

    const dmnOptions = dmn.evaluateActionOptions(unit, gs, unit.owner);
    const topOption = dmnOptions.sort((a, b) => b.score - a.score)[0];
    const topDetails = topOption?.details?.map(d => `${d.label} (${d.value > 0 ? '+' : ''}${typeof d.value === 'number' ? d.value.toFixed(2) : d.value})`).join('; ') || '';
    const dmnReason = topOption ? `${topOption.action} scored ${topOption.score.toFixed(2)}${topDetails ? ': ' + topDetails : ''}` : action;

    if (canAct) await attemptSpellCasting(unit, gs, evs);

    if (action === 'Hold') {
      if (canAct) await attemptShooting(unit, gs, evs, dmnReason);
      else evs.push({ round, type: 'movement', message: `${unit.name} holds (shaken — cannot shoot)`, timestamp: new Date().toLocaleTimeString() });

    } else if (action === 'Advance') {
      const moveTarget = dmn.findNearestObjective(unit, gs.objectives) || dmn.findNearestEnemy(unit, gs.units.filter(u => u.owner !== unit.owner && u.current_models > 0));
      if (moveTarget) {
        const result = rules.executeMovement(unit, action, moveTarget, gs.terrain);
        const zone = rules.getZone(unit.x, unit.y);
        evs.push({ round, type: 'movement', message: `${unit.name} advanced ${result.distance.toFixed(1)}"`, timestamp: new Date().toLocaleTimeString() });
        logger?.logMove({ round, actingUnit: unit, action, distance: result.distance, zone, dmnReason });
      }
      if (canAct) await attemptShooting(unit, gs, evs, dmnReason);

    } else if (action === 'Rush') {
      const rushTarget = dmn.findNearestObjective(unit, gs.objectives) || dmn.findNearestEnemy(unit, gs.units.filter(u => u.owner !== unit.owner && u.current_models > 0));
      if (rushTarget) {
        const result = rules.executeMovement(unit, action, rushTarget, gs.terrain);
        const zone = rules.getZone(unit.x, unit.y);
        // Dangerous terrain check after moving
        const dangerWounds = rules.checkDangerousTerrain(unit, gs.terrain, 'Rush');
        if (dangerWounds > 0) {
          unit.current_models = Math.max(0, unit.current_models - dangerWounds);
          evs.push({ round, type: 'combat', message: `⚠ ${unit.name} hit dangerous terrain during Rush! -${dangerWounds} wound(s)`, timestamp: new Date().toLocaleTimeString() });
          if (unit.current_models <= 0) unit.status = 'destroyed';
        }
        evs.push({ round, type: 'movement', message: `${unit.name} rushed ${result.distance.toFixed(1)}"`, timestamp: new Date().toLocaleTimeString() });
        logger?.logMove({ round, actingUnit: unit, action, distance: result.distance, zone, dmnReason });
      }
      unit.rounds_without_offense = (unit.rounds_without_offense || 0) + 1;

    } else if (action === 'Charge') {
      const enemies = gs.units.filter(u => u.owner !== unit.owner && u.current_models > 0 && u.status !== 'destroyed' && u.status !== 'routed');
      const target = dmn.selectTarget(unit, enemies);
      if (target) {
        unit.just_charged = true;
        rules.executeMovement(unit, action, target, gs.terrain);
        const zone = rules.getZone(unit.x, unit.y);
        // Dangerous terrain check on charge move
        const chargeDangerWounds = rules.checkDangerousTerrain(unit, gs.terrain, 'Charge');
        if (chargeDangerWounds > 0) {
          unit.current_models = Math.max(0, unit.current_models - chargeDangerWounds);
          evs.push({ round, type: 'combat', message: `⚠ ${unit.name} hit dangerous terrain during Charge! -${chargeDangerWounds} wound(s)`, timestamp: new Date().toLocaleTimeString() });
          if (unit.current_models <= 0) { unit.status = 'destroyed'; }
        }
        // Bug 3+4 fix: capture target state BEFORE melee; add special_rules_applied to charge event
        const chargeSpecialRules = [];
        if (unit.special_rules?.includes('Furious')) chargeSpecialRules.push({ rule: 'Furious', value: null, effect: 'extra attack in melee on charge' });
        if (unit.special_rules?.includes('Rage')) chargeSpecialRules.push({ rule: 'Rage', value: null, effect: 'charge modifier' });
        evs.push({ round, type: 'movement', message: `${unit.name} charges ${target.name}!`, timestamp: new Date().toLocaleTimeString() });
        logger?.logMove({ round, actingUnit: unit, action: 'Charge', distance: null, zone, dmnReason, chargeTarget: target.name, chargeTargetState: { wounds_remaining: target.current_models, max_wounds: target.total_models, status: target.status || 'normal' }, chargeSpecialRules });
        // Guard: no overwatch in OPR — charger should never be dead here, but be safe
        if (unit.current_models <= 0 || unit.status === 'destroyed') {
          evs.push({ round, type: 'warning', message: `${unit.name} destroyed before melee — skipping combat`, timestamp: new Date().toLocaleTimeString() });
        } else {
          const liveTarget = gs.units.find(u => u.id === target.id);
          if (!liveTarget || liveTarget.current_models <= 0) {
            evs.push({ round, type: 'movement', message: `${unit.name} charge target ${target.name} already destroyed — no melee`, timestamp: new Date().toLocaleTimeString() });
          } else {
            const killedTarget = await resolveMelee(unit, liveTarget, gs, evs, dmnReason);
            unit.rounds_without_offense = 0;
            if (killedTarget && gs.advance_rules?.overrun) {
              const dx = (Math.random() - 0.5) * 6;
              const dy = (Math.random() - 0.5) * 6;
              unit.x = Math.max(2, Math.min(70, unit.x + dx));
              unit.y = Math.max(2, Math.min(46, unit.y + dy));
              evs.push({ round, type: 'ability', message: `${unit.name} Overrun — moved 3" after kill`, timestamp: new Date().toLocaleTimeString() });
              logger?.logAbility({ round, unit, ability: 'Overrun', details: { dx: dx.toFixed(1), dy: dy.toFixed(1) } });
            }
          }
        }
      } else {
        // No target in range — fall back to rush toward nearest enemy
        const nearest = dmn.findNearestEnemy(unit, enemies);
        if (nearest) {
          const result = rules.executeMovement(unit, 'Rush', nearest, gs.terrain);
          evs.push({ round, type: 'movement', message: `${unit.name} rushes toward ${nearest.name} (no charge target in range)`, timestamp: new Date().toLocaleTimeString() });
          logger?.logMove({ round, actingUnit: unit, action: 'Rush', distance: result.distance, zone: rules.getZone(unit.x, unit.y), dmnReason });
        }
      }
    }

    evRef.current = evs;
    rules.updateObjectives(gs);
  };

  // ─── SPELL CASTING ────────────────────────────────────────────────────────────
  // Called before attacking for any unit with Caster(X) that has enough tokens.
  // AI strategy: cast any spell whose cost <= available tokens, targeting nearest enemy.
  // Allied units within 18" spend their own tokens to boost the roll (+1 each).
  // Enemy units within 18" of their own caster spend tokens to counter (-1 each).

  const attemptSpellCasting = async (unit, gs, evs) => {
    const rules = rulesRef.current;
    const logger = loggerRef.current;
    const round = gs.current_round;

    if (rules.getCasterTokens(unit) === 0) return; // not a caster
    const tokens = unit.spell_tokens || 0;
    if (tokens === 0) return; // no tokens to spend

    // Derive spells from unit weapons with spell_cost field, or a default cost-1 spell
    const spells = (unit.weapons || [])
      .filter(w => w.spell_cost != null)
      .sort((a, b) => (a.spell_cost || 1) - (b.spell_cost || 1));

    // Fallback: treat any remaining tokens as a generic cost-1 offensive spell
    if (spells.length === 0) spells.push({ name: 'Spell', spell_cost: 1, range: 18, attacks: 1, ap: 0, special_rules: '' });

    const enemies = gs.units.filter(u => u.owner !== unit.owner && u.current_models > 0 && u.status !== 'destroyed');
    if (enemies.length === 0) return;

    const target = enemies.reduce((n, e) => rules.calculateDistance(unit, e) < rules.calculateDistance(unit, n) ? e : n);
    const dist = rules.calculateDistance(unit, target);
    const LOS_RANGE = 18;

    for (const spell of spells) {
      const cost = spell.spell_cost || 1;
      if ((unit.spell_tokens || 0) < cost) continue;
      if (dist > (spell.range || LOS_RANGE)) continue;

      // Allied helpers: friendly Casters within 18" — AI spends all their spare tokens to help
      let friendlyBonus = 0;
      gs.units.forEach(ally => {
        if (ally.id === unit.id || ally.owner !== unit.owner || ally.current_models <= 0) return;
        if (rules.getCasterTokens(ally) === 0) return;
        if (rules.calculateDistance(unit, ally) > 18) return;
        const spend = ally.spell_tokens || 0;
        if (spend > 0) {
          ally.spell_tokens = 0;
          friendlyBonus += spend;
        }
      });

      // Enemy counters: enemy Casters within 18" of the target — AI spends all their spare tokens to block
      let hostileBonus = 0;
      gs.units.forEach(enemy => {
        if (enemy.owner === unit.owner || enemy.current_models <= 0) return;
        if (rules.getCasterTokens(enemy) === 0) return;
        if (rules.calculateDistance(target, enemy) > 18) return;
        const spend = enemy.spell_tokens || 0;
        if (spend > 0) {
          enemy.spell_tokens = 0;
          hostileBonus += spend;
        }
      });

      const castResult = rules.castSpell(unit, target, cost, friendlyBonus, hostileBonus);

      evs.push({
        round, type: 'ability',
        message: `🔮 ${unit.name} casts ${spell.name} (cost ${cost}) at ${target.name}: roll ${castResult.roll}${castResult.helpBonus !== 0 ? `${castResult.helpBonus >= 0 ? '+' : ''}${castResult.helpBonus}` : ''} = ${castResult.modifiedRoll} → ${castResult.success ? '✓ SUCCESS' : '✗ FAIL'} (tokens: ${castResult.tokensAfter} left)`,
        timestamp: new Date().toLocaleTimeString()
      });
      logger?.logAbility({ round, unit, ability: 'Caster', details: { spell: spell.name, cost, target: target.name, roll: castResult.roll, modified_roll: castResult.modifiedRoll, success: castResult.success, tokens_before: castResult.tokensBefore, tokens_after: castResult.tokensAfter, friendly_bonus: friendlyBonus, hostile_bonus: hostileBonus } });

      if (castResult.success) {
        // Resolve spell as a ranged attack (1 automatic hit, AP from spell)
        const spellWeapon = { name: spell.name, range: spell.range || 18, attacks: 1, ap: spell.ap || 0, special_rules: spell.special_rules || '' };
        const shootResult = rules.resolveShooting(unit, target, spellWeapon, gs.terrain, gs);
        const woundsDealt = shootResult.wounds;

        // Regeneration check
        const regenResult = rules.applyRegeneration(target, woundsDealt, false);
        const finalWounds = regenResult.finalWounds;
        if (regenResult.ignored > 0) {
          evs.push({ round, type: 'regen', message: `${target.name} Regeneration: ignored ${regenResult.ignored}/${woundsDealt} spell wounds`, timestamp: new Date().toLocaleTimeString() });
        }

        target.current_models = Math.max(0, target.current_models - finalWounds);
        if (target.current_models <= 0) {
          target.status = 'destroyed';
          evs.push({ round, type: 'combat', message: `${target.name} destroyed by ${spell.name}!`, timestamp: new Date().toLocaleTimeString() });
          logger?.logDestruction({ round, unit: target, cause: `spell (${spell.name}) by ${unit.name}` });
        } else if (finalWounds > 0) {
          evs.push({ round, type: 'combat', message: `${spell.name} deals ${finalWounds} wound(s) to ${target.name}`, timestamp: new Date().toLocaleTimeString() });
        }
      }

      await new Promise(r => setTimeout(r, 400));
    }
  };

  // ─── SHOOTING ─────────────────────────────────────────────────────────────────
  // Iterates unit.ranged_weapons exactly once — one shoot event per distinct weapon,
  // never the same weapon twice. Blast(X) uses X automatic hits with no quality roll.

  const attemptShooting = async (unit, gs, evs, dmnReason) => {
  const round = gs.current_round;
  const dmn = dmnRef.current;
  const rules = rulesRef.current;
  const logger = loggerRef.current;
  let shotFired = false;

  // Use activation-level set (initialised at top of activateUnit — Bug 2 fix).
    const firedThisActivation = unit._firedThisActivation || new Set();
    unit._firedThisActivation = firedThisActivation;
    const rangedWeapons = (unit.weapons || []).filter(w => {
      if ((w.range ?? 2) <= 2) return false;
      const key = w.name || w.id || JSON.stringify(w);
      if (firedThisActivation.has(key)) return false;
      firedThisActivation.add(key);
      return true;
    });

  if (rangedWeapons.length === 0) return false;

  for (const weapon of rangedWeapons) {
      // Re-query live enemies before each weapon — never target a destroyed unit
      const liveEnemies = gs.units.filter(u =>
      u.owner !== unit.owner &&
      u.current_models > 0 &&
      u.status !== 'destroyed' &&
      u.status !== 'routed'
      );
      if (liveEnemies.length === 0) break;

      const target = dmn.selectTarget(unit, liveEnemies);
      if (!target) continue;

      // Bug 7 fix: Skip destroyed targets entirely
      const liveTarget = gs.units.find(u => u.id === target.id);
      if (!liveTarget || liveTarget.current_models <= 0 || liveTarget.status === 'destroyed') continue;

      const dist = rules.calculateDistance(unit, target);
      if (dist > weapon.range) continue;

      // ── Blast(X): X automatic hits, no quality roll ────────────────────────
      // Normalise special_rules to a string regardless of whether it came in as array or string
      const weaponSpecialStr = Array.isArray(weapon.special_rules)
        ? weapon.special_rules.join(' ')
        : (weapon.special_rules || '');
      const blastMatch = weaponSpecialStr.match(/Blast\((\d+)\)/);
      const isBlast = !!blastMatch;
      const blastCount = isBlast ? parseInt(blastMatch[1]) : 0;

      // Ensure the weapon object always has special_rules as a string for RulesEngine
      const normWeapon = { ...weapon, special_rules: weaponSpecialStr };

      // Model count for attack scaling = floor(current wounds / wounds-per-model).
      // tough_per_model is set correctly at deploy time (1 for standard, X for multi-Tough, X+1 for heroes).
      const effectiveTpm = Math.max(unit.tough_per_model || 1, 1);
      const currentModelCount = Math.max(1, Math.floor(unit.current_models / effectiveTpm));
      const baseAttacks = weapon.attacks || 1;
      const totalAttacks = baseAttacks * currentModelCount;

      let result;
      let loggedAttacks;
      if (isBlast) {
        const blastWeapon = { ...normWeapon, attacks: blastCount };
        result = rules.resolveShooting(unit, target, blastWeapon, gs.terrain, gs);
        result = { ...result, hits: blastCount, blast: true };
        loggedAttacks = blastCount;
      } else {
        const shootWeapon = { ...normWeapon, attacks: totalAttacks };
        result = rules.resolveShooting(unit, target, shootWeapon, gs.terrain, gs);
        loggedAttacks = totalAttacks;
      }
      let woundsDealt = result.wounds;
      // Regeneration: roll one die per incoming wound, 5+ ignores it (suppressed by Bane)
      const hasBaneWeapon = result.specialRulesApplied?.some(r => r.rule === 'Bane');
      const regenResult = rules.applyRegeneration(target, woundsDealt, hasBaneWeapon);
      if (regenResult.ignored > 0) {
        evs.push({ round, type: 'regen', message: `${target.name} Regeneration: ignored ${regenResult.ignored}/${woundsDealt} wounds (rolls: ${regenResult.rolls.join(',')})`, timestamp: new Date().toLocaleTimeString() });
        woundsDealt = regenResult.finalWounds;
      }
      const targetWasPreviouslyAlive = target.current_models > 0;
      target.current_models = Math.max(0, target.current_models - woundsDealt);
      if (target.current_models <= 0 && targetWasPreviouslyAlive) target.status = 'destroyed';
      shotFired = true;
      unit.rounds_without_offense = 0;

      setCurrentCombat({
        type: 'shooting', attacker: unit, defender: target, weapon: weapon.name,
        hit_rolls: result.hit_rolls, hits: result.hits,
        defense_rolls: result.defense_rolls, saves: result.saves,
        result: `${result.hits} hits, ${result.saves} saves`
      });

      const weaponLabel = isBlast ? `${weapon.name} [Blast(${blastCount})]` : weapon.name;
      // Bug 8 fix: Set blast flag when Blast rule fires
      const blastFlagValue = isBlast || result.blast || false;
      evs.push({
        round, type: 'combat',
        message: `${unit.name} fires ${weaponLabel} at ${target.name}: ${result.hits} hits, ${result.saves} saves, ${woundsDealt} wounds`,
        timestamp: new Date().toLocaleTimeString()
      });

      if (target.current_models <= 0) {
        target.status = 'destroyed';
        evs.push({ round, type: 'combat', message: `${target.name} destroyed!`, timestamp: new Date().toLocaleTimeString() });
        logger?.logDestruction({ round, unit: target, cause: `shooting by ${unit.name} (${weaponLabel})` });
      }

      const topScore = liveEnemies.map(e => dmn.scoreTarget(unit, e)).sort((a, b) => b - a)[0]?.toFixed(2);

      // Bug 6 fix: Deduplicate special_rules_applied by rule name
      const seenRules = new Set();
      const deduplicatedRules = (result.specialRulesApplied || []).filter(rule => {
        if (seenRules.has(rule.rule)) return false;
        seenRules.add(rule.rule);
        return true;
      });

      logger?.logShoot({
        round, actingUnit: unit, targetUnit: target,
        weapon: weapon.name,
        zone: rules.getZone(unit.x, unit.y), rangeDist: dist,
        rollResults: {
          attacks: loggedAttacks,
          hits: result.hits,
          saves: result.saves,
          wounds_dealt: woundsDealt,
          blast: blastFlagValue,
          special_rules_applied: deduplicatedRules
        },
        gameState: gs,
        dmnReason: `${dmnReason} (score ${topScore})`
      });

      // Morale on wounded survivor
      if (target.current_models > 0 && target.status === 'normal' && target.current_models <= target.total_models / 2) {
        const moraleResult = rules.checkMorale(target, 'wounds');
        if (!moraleResult.passed) {
          const outcome = rules.applyMoraleResult(target, false, 'wounds');
          evs.push({ round, type: 'morale', message: `${target.name} morale failed — ${outcome}`, timestamp: new Date().toLocaleTimeString() });
          logger?.logMorale({ round, unit: target, outcome, roll: moraleResult.roll, qualityTarget: target.quality || 4, specialRulesApplied: moraleResult.specialRulesApplied || [] });
        }
      }

      await new Promise(r => setTimeout(r, 500));
    }

    setCurrentCombat(null);
    return shotFired;
  };

  // ─── MELEE ────────────────────────────────────────────────────────────────────

  const resolveMelee = async (attacker, defender, gs, evs, dmnReason) => {
  const round = gs.current_round;
  const rules = rulesRef.current;
  const logger = loggerRef.current;

  // Guard: attacker must be alive (no zombie melee from destroyed or at-zero-wounds units)
  if (attacker.current_models <= 0 || attacker.status === 'destroyed') return false;
  // Also check defender is alive at melee start
  if (defender.current_models <= 0 || defender.status === 'destroyed') return false;

  const result = rules.resolveMelee(attacker, defender, gs);

  const defenderWasAlive = defender.current_models > 0;
  const attackerWasAlive = attacker.current_models > 0;

  // Regeneration on defender (check if attacker's weapon had Bane)
  const atkHasBane = result.attacker_results?.results?.some(r => r.specialRulesApplied?.some(s => s.rule === 'Bane'));
  let attackerWoundsToApply = result.attacker_wounds;
  const defRegenResult = rules.applyRegeneration(defender, attackerWoundsToApply, atkHasBane);
  if (defRegenResult.ignored > 0) {
    evs.push({ round, type: 'regen', message: `${defender.name} Regeneration: ignored ${defRegenResult.ignored}/${attackerWoundsToApply} wounds`, timestamp: new Date().toLocaleTimeString() });
    attackerWoundsToApply = defRegenResult.finalWounds;
  }

  // Regeneration on attacker (check if defender's weapon had Bane)
  const defHasBane = result.defender_results?.results?.some(r => r.specialRulesApplied?.some(s => s.rule === 'Bane'));
  let defenderWoundsToApply = result.defender_wounds;
  const atkRegenResult = rules.applyRegeneration(attacker, defenderWoundsToApply, defHasBane);
  if (atkRegenResult.ignored > 0) {
    evs.push({ round, type: 'regen', message: `${attacker.name} Regeneration: ignored ${atkRegenResult.ignored}/${defenderWoundsToApply} wounds`, timestamp: new Date().toLocaleTimeString() });
    defenderWoundsToApply = atkRegenResult.finalWounds;
  }

  defender.current_models = Math.max(0, defender.current_models - attackerWoundsToApply);
  attacker.current_models = Math.max(0, attacker.current_models - defenderWoundsToApply);
  // Bug 2 fix: wounds=0 always means destroyed — no other status can override this
  if (defender.current_models <= 0) defender.status = 'destroyed';
  if (attacker.current_models <= 0) attacker.status = 'destroyed';

  evs.push({ round, type: 'combat', message: `⚔ ${attacker.name} vs ${defender.name} — dealt ${result.attacker_wounds}, took ${result.defender_wounds}`, timestamp: new Date().toLocaleTimeString() });

  const atkWpnName = attacker.melee_weapon_name && attacker.melee_weapon_name !== 'CCW' ? attacker.melee_weapon_name : 'Fists';
  logger?.logMelee({
  round, actingUnit: attacker, targetUnit: defender,
  weaponName: atkWpnName,
  rollResults: result.rollResults,
  gameState: gs, dmnReason
  });

  if (defender.current_models <= 0 && defenderWasAlive) {
  evs.push({ round, type: 'combat', message: `${defender.name} destroyed in melee!`, timestamp: new Date().toLocaleTimeString() });
  logger?.logDestruction({ round, unit: defender, cause: `melee with ${attacker.name}` });
  }
  if (attacker.current_models <= 0 && attackerWasAlive) {
  evs.push({ round, type: 'combat', message: `${attacker.name} destroyed in melee!`, timestamp: new Date().toLocaleTimeString() });
  logger?.logDestruction({ round, unit: attacker, cause: `melee with ${defender.name}` });
  }

    // Morale on loser — based on Fear-adjusted wound comparison
    const loser = result.winner === attacker ? defender : (result.winner === defender ? attacker : null);
    if (loser && loser.current_models > 0 && loser.status === 'normal') {
      const moraleResult = rules.checkMorale(loser, 'melee_loss');
      const outcome = rules.applyMoraleResult(loser, moraleResult.passed, 'melee_loss');
      evs.push({ round, type: 'morale', message: `${loser.name} ${outcome} after melee loss (roll: ${moraleResult.roll})`, timestamp: new Date().toLocaleTimeString() });
      logger?.logMorale({ round, unit: loser, outcome, roll: moraleResult.roll, qualityTarget: loser.quality || 4, specialRulesApplied: moraleResult.specialRulesApplied || [] });
    }

    return defender.current_models <= 0; // returns true if target was killed (for Overrun)
  };

  // ─── END ROUND ────────────────────────────────────────────────────────────────

  const endRound = async (gs) => {
        const newRound = gs.current_round + 1;
        if (newRound > 4) { await endBattle(gs); return; }

        const rules = rulesRef.current;
        const logger = loggerRef.current;
        const evs = [...evRef.current];

        // Bug 9 fix: Check if progressive scoring is enabled
        const isProgressiveScoring = gs.advance_rules?.progressiveScoring === true;
        const isFinalRound = newRound === 5; // After round 4

        // Round-end validation: every living unit must have activated exactly once.
        // Any unit found missing here is a scheduler bug — log it and give shaken units their recovery.
        const liveUnits = gs.units.filter(u => u.current_models > 0 && u.status !== 'destroyed' && u.status !== 'routed' && !u.is_in_reserve);
        const activatedSetEnd = new Set(gs.units_activated || []);
        // Round-start assertion: log any living unit not in the activated set
        const notActivated = liveUnits.filter(u => !activatedSetEnd.has(u.id));
        if (notActivated.length > 0) {
          console.error(`SCHEDULER END-OF-ROUND: ${notActivated.length} unit(s) never activated:`, notActivated.map(u => u.name));
        }
        notActivated.forEach(u => {
          evs.push({ round: gs.current_round, type: 'warning', message: `⚠ SCHEDULING: ${u.name} (${u.owner}) had no activation in round ${gs.current_round}`, timestamp: new Date().toLocaleTimeString() });
          loggerRef.current?.logAbility({ round: gs.current_round, unit: u, ability: 'scheduling_warning', details: { reason: 'no_activation_this_round' } });
          // Bug 3 fix: Shaken unit skipped by scheduler must still get a recovery roll at round end
          if (u.status === 'shaken') {
            const quality = u.quality || 4;
            const roll = rules.dice.roll();
            const recovered = roll >= quality;
            if (recovered) u.status = 'normal';
            const outcome = recovered ? 'recovered' : 'still_shaken';
            evs.push({ round: gs.current_round, type: 'morale', message: `${u.name} end-of-round Shaken recovery (not activated): rolled ${roll} vs ${quality}+ — ${recovered ? 'recovered' : 'still shaken'}`, timestamp: new Date().toLocaleTimeString() });
            loggerRef.current?.logMorale({ round: gs.current_round, unit: u, outcome, roll, qualityTarget: quality, dmnReason: 'end-of-round shaken recovery (unit skipped by scheduler)' });
          }
        });

        // Deploy Ambush/reserve units at the start of each new round.
        gs.units.forEach(u => {
          if (u.is_in_reserve && u.current_models > 0) {
            const deployed = rules.deployAmbush(u, gs);
            if (deployed) {
              u.is_in_reserve = false;
              evs.push({ round: newRound, type: 'ability', message: `${u.name} deploys from Ambush!`, timestamp: new Date().toLocaleTimeString() });
              loggerRef.current?.logAbility({ round: newRound, unit: u, ability: 'Ambush', details: { x: u.x.toFixed(1), y: u.y.toFixed(1) } });
            }
          }
        });

            const newState = {
          ...gs,
          current_round: newRound,
          units_activated: [],
          active_agent: 'agent_a',
        };

        // Reset per-round flags — NEVER clear shaken here (only morale recovery rolls can do that)
        newState.units = newState.units.map(u => ({
          ...u,
          fatigued: false, just_charged: false,
          status: u.current_models <= 0 ? 'destroyed' : u.status,
        }));

        // Replenish Caster spell tokens (capped at 6)
        newState.units.forEach(u => {
          const gained = rules.replenishSpellTokens(u);
          if (gained > 0) {
            evs.push({ round: newRound, type: 'ability', message: `${u.name} gains ${gained} spell token(s) (now ${u.spell_tokens}/6)`, timestamp: new Date().toLocaleTimeString() });
            logger?.logAbility({ round: newRound, unit: u, ability: 'Caster', details: { tokens_gained: gained, tokens_total: u.spell_tokens } });
          }
        });

        // Objectives
        rules.updateObjectives(newState);
        const roundA = newState.objectives.filter(o => o.controlled_by === 'agent_a').length;
        const roundB = newState.objectives.filter(o => o.controlled_by === 'agent_b').length;

        let scoreToLog;
        if (isProgressiveScoring) {
          const prevScore = newState.cumulative_score || { agent_a: 0, agent_b: 0 };
          newState.cumulative_score = { agent_a: prevScore.agent_a + roundA, agent_b: prevScore.agent_b + roundB };
          scoreToLog = { agent_a: newState.cumulative_score.agent_a, agent_b: newState.cumulative_score.agent_b, this_round_a: roundA, this_round_b: roundB, mode: 'progressive' };
        } else {
          if (isFinalRound) {
            scoreToLog = { agent_a: roundA, agent_b: roundB, mode: 'standard' };
          } else {
            scoreToLog = { agent_a: 0, agent_b: 0, mode: 'standard', note: 'score counted at Round 4 only' };
          }
        }

        logger?.logRoundSummary({ round: gs.current_round, objectives: newState.objectives, score: scoreToLog });

        evs.push({ round: newRound, type: 'round', message: `━━━ Round ${newRound} begins ━━━`, timestamp: new Date().toLocaleTimeString() });
        commitState(newState, evs);
  };

  // ─── END BATTLE ───────────────────────────────────────────────────────────────

  const endBattle = async (gs) => {
    const rules = rulesRef.current;
    const logger = loggerRef.current;
    const evs = [...evRef.current];

    rules.updateObjectives(gs);
    const isProgressiveScoring = gs.advance_rules?.progressiveScoring === true;
    const roundA = gs.objectives.filter(o => o.controlled_by === 'agent_a').length;
    const roundB = gs.objectives.filter(o => o.controlled_by === 'agent_b').length;

    // Bug 9 fix: Final score calculation — standard vs progressive
    let aScore, bScore;
    if (isProgressiveScoring) {
      // Progressive: accumulate all round scores
      aScore = 0;
      bScore = 0;
      evRef.current.forEach(ev => {
        if (ev.event_type === 'round_summary' && ev.score) {
          aScore += ev.score.agent_a || 0;
          bScore += ev.score.agent_b || 0;
        }
      });
      // Add final round
      aScore += roundA;
      bScore += roundB;
    } else {
      // Standard: only final round (after R4) counts
      aScore = roundA;
      bScore = roundB;
    }
    const winner = aScore > bScore ? 'agent_a' : bScore > aScore ? 'agent_b' : 'draw';

    // Bake battle_config into logger — scoring_mode + full advance_rules key list
    const advRules = gs.advance_rules || {};
    const activeRuleKeys = Object.entries(advRules).filter(([, v]) => v).map(([k]) => k);
    logger?.setBattleConfig({
      scoring_mode: advRules.cumulativeScoring ? 'cumulative' : 'per_round',
      advance_rules: activeRuleKeys,   // top-level array of all enabled rule keys
    });

    // Bug 9 fix: final_score must be cumulative total across all rounds (progressive only)
    const finalScore = { agent_a: aScore, agent_b: bScore };
    logger?.logRoundSummary({ round: gs.current_round, objectives: gs.objectives, score: { agent_a: aScore, agent_b: bScore, mode: isProgressiveScoring ? 'progressive' : 'standard' } });
    logger?.logBattleEnd({ winner, finalScore });

    const log = logger?.getFullLog(winner, { agent_a: aScore, agent_b: bScore });
      setFullJsonLog(log);
      console.log('=== BATTLE JSON LOG ===');
      console.log(JSON.stringify(log, null, 2));

      // Trigger rule compliance verification
      try {
        const complianceReport = await verifyRuleCompliance(log);
        console.log('=== COMPLIANCE REPORT ===', complianceReport);
        evs.push({ 
          round: 4, type: 'system', 
          message: `✅ Compliance check: ${complianceReport.summary.total_violations} violation(s) | Score: ${complianceReport.summary.compliance_score}/100`,
          timestamp: new Date().toLocaleTimeString()
        });
      } catch (err) {
        console.error('Compliance verification failed:', err);
        evs.push({ 
          round: 4, type: 'system', 
          message: `⚠ Compliance check failed: ${err.message}`,
          timestamp: new Date().toLocaleTimeString()
        });
      }

    const aUnits = gs.units.filter(u => u.owner === 'agent_a' && u.current_models > 0).length;
    const bUnits = gs.units.filter(u => u.owner === 'agent_b' && u.current_models > 0).length;

    await base44.entities.Battle.update(battleRef.current.id, {
      status: 'completed', winner, game_state: gs, event_log: evs
    });

    await Promise.all([
      base44.entities.BattleAnalytics.create({ battle_id: battleRef.current.id, army_id: battleRef.current.army_a_id, result: winner === 'agent_a' ? 'won' : winner === 'agent_b' ? 'lost' : 'draw', objectives_controlled: aScore, units_survived: aUnits, successful_actions: actionTrackingRef.current.agent_a }),
      base44.entities.BattleAnalytics.create({ battle_id: battleRef.current.id, army_id: battleRef.current.army_b_id, result: winner === 'agent_b' ? 'won' : winner === 'agent_a' ? 'lost' : 'draw', objectives_controlled: bScore, units_survived: bUnits, successful_actions: actionTrackingRef.current.agent_b }),
    ]);

    battleRef.current = { ...battleRef.current, status: 'completed', winner };
    setBattle({ ...battleRef.current });
    setPlayingBoth(false);

    evs.push({ round: 4, type: 'victory', message: `Battle over! ${winner === 'draw' ? 'Draw' : winner === 'agent_a' ? 'Agent A wins' : 'Agent B wins'} (${aScore}–${bScore})`, timestamp: new Date().toLocaleTimeString() });
    commitState(gs, evs);
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────────

  if (!battle || !gameState) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-lg mb-4">Loading battle...</div>
          <div className="text-slate-400 text-sm">{loadingStatus}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4">
      <div className="max-w-[2000px] mx-auto mb-4 flex justify-between items-center">
        <Button variant="outline" onClick={() => navigate('/Home')} className="border-slate-600 text-slate-300">
          <Home className="w-4 h-4 mr-2" /> Home
        </Button>
        <div className="flex gap-2">
          <Button onClick={() => setPlayingBoth(!playing)} disabled={battle.status === 'completed'} className="bg-blue-600 hover:bg-blue-700">
            {playing ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            {playing ? 'Pause' : 'Play'}
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()} className="border-slate-600 text-slate-300">
            <RotateCcw className="w-4 h-4 mr-2" /> Reset
          </Button>
          {fullJsonLog && (
            <Button variant="outline" className="border-green-600 text-green-400 hover:bg-green-900/20" onClick={() => {
              const blob = new Blob([JSON.stringify(fullJsonLog, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = `battle-log-${battle.id}.json`; a.click();
              URL.revokeObjectURL(url);
            }}>
              <Download className="w-4 h-4 mr-2" /> Download Log
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-[2000px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <GameStatePanel battle={battle} gameState={gameState} armyAName={battle?.armyAName} armyBName={battle?.armyBName} />
          <DecisionTreeView decision={currentDecision} />
        </div>
        <div className="lg:col-span-6 overflow-x-auto">
          <BattlefieldView gameState={gameState} activeUnit={activeUnit} onUnitClick={() => {}} />
        </div>
        <div className="lg:col-span-3 space-y-4">
          <CombatResolver combatEvent={currentCombat} />
          {fullJsonLog ? (
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 flex flex-col" style={{ maxHeight: '500px' }}>
              <div className="text-slate-300 text-xs font-semibold mb-2">Battle JSON Log</div>
              <textarea readOnly className="flex-1 bg-slate-800 text-green-300 text-xs font-mono rounded p-2 resize-none outline-none border border-slate-600" style={{ minHeight: '420px' }} value={JSON.stringify(fullJsonLog, null, 2)} onFocus={e => e.target.select()} />
            </div>
          ) : (
            <ActionLog events={events} />
          )}
        </div>
      </div>
    </div>
  );
}