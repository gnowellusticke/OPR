// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
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
import { RuleRegistry } from '../components/engine/RuleRegistry';
import { OPR_RULES } from '../components/engine/rules/opr-rules';
import { BattleLogger } from '../components/engine/BattleLogger';
import { verifyRuleCompliance } from '../components/engine/RuleComplianceVerifier';
import { getPersonality, DEFAULT_PERSONALITY } from '../components/engine/personalities/PersonalityRegistry';
import { DMNAgent } from '../components/engine/agents/DMNAgent';
import NarrativeCommentaryBox from '../components/battle/NarrativeCommentaryBox';
import { Terrain } from '../components/engine/models/Terrain';
import { createArmy } from '../components/engine/UnitFactory';

// Map faction names to their rule modules – dynamically imported
const factionRuleMap = {
  'Alien Hives': () => import('../components/engine/rules/opr-rules-alien-hives'),
  'DAO Union': () => import('../components/engine/rules/opr-rules-dao-union'),
  'Dark Elf Raiders': () => import('../components/engine/rules/opr-rules-dark-elf-raiders'),
  'Dwarf Guilds': () => import('../components/engine/rules/opr-rules-dwarf-guilds'),
  'High Elf Fleets': () => import('../components/engine/rules/opr-rules-high-elf-fleets'),
  'Blessed Sisters': () => import('../components/engine/rules/opr-rules-blessed-sisters'),
  'Plague Disciples': () => import('../components/engine/rules/opr-rules-plague-disciples'),
  'Ratmen Clans': () => import('../components/engine/rules/opr-rules-ratmen-clans'),
  'Robot Legions': () => import('../components/engine/rules/opr-rules-robot-legions'),
  'Saurian Starhost': () => import('../components/engine/rules/opr-rules-saurian-starhost'),
  'Rebel Guerrillas': () => import('../components/engine/rules/opr-rules-rebel-guerrillas'),
  'Soul-Snatcher Cults': () => import('../components/engine/rules/opr-rules-soul-snatcher-cults'),
  'Titan Lords': () => import('../components/engine/rules/opr-rules-titan-lords'),
  'War Disciples': () => import('../components/engine/rules/opr-rules-war-disciples'),
  'Watch Brothers': () => import('../components/engine/rules/opr-rules-watch-brothers'),
  'Wolf Brothers': () => import('../components/engine/rules/opr-rules-wolf-brothers'),
  'Orc Marauders': () => import('../components/engine/rules/opr-rules-orc-marauders'),
  'Custodian Brothers': () => import('../components/engine/rules/opr-rules-custodian-brothers'),
  'Battle Brothers': () => import('../components/engine/rules/opr-rules-battle-brothers'),
  'Blood Brothers': () => import('../components/engine/rules/opr-rules-blood-brothers'),
  'Dark Brothers': () => import('../components/engine/rules/opr-rules-dark-brothers'),
  'Elven Jesters': () => import('../components/engine/rules/opr-rules-elven-jesters'),
  'Eternal Dynasty': () => import('../components/engine/rules/opr-rules-eternal-dynasty'),
  'Change Disciples': () => import('../components/engine/rules/opr-rules-change-disciples'),
  'Human Defense Force': () => import('../components/engine/rules/opr-rules-human-defense-force'),
  'Human Inquisition': () => import('../components/engine/rules/opr-rules-human-inquisition'),
  'Goblin Reclaimers': () => import('../components/engine/rules/opr-rules-goblin-reclaimers'),
  'Havoc Brothers': () => import('../components/engine/rules/opr-rules-havoc-brothers'),
  'Jackals': () => import('../components/engine/rules/opr-rules-jackals'),
  'Machine Cult': () => import('../components/engine/rules/opr-rules-machine-cult'),

  // Add all other factions here
};

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
  const [simulationSpeed, setSimulationSpeed] = useState(800);
  const [commentary, setCommentary] = useState(null);
  const [generatingCommentary, setGeneratingCommentary] = useState(false);

  // Live narrative state
  const [narrativeActive, setNarrativeActive] = useState(false);
  const [narrativeStyle, setNarrativeStyle] = useState('dramatic');
  const [narrativeByActivation, setNarrativeByActivation] = useState({});
  const [currentNarrativeIndex, setCurrentNarrativeIndex] = useState(null);
  const [currentNarrativeText, setCurrentNarrativeText] = useState('');
  const [currentNarrativeSignificance, setCurrentNarrativeSignificance] = useState('standard');
  const [currentNarrativeUnit, setCurrentNarrativeUnit] = useState(null);
  const [currentNarrativeRound, setCurrentNarrativeRound] = useState(null);
  const [narrativeStreaming, setNarrativeStreaming] = useState(false);
  const [activationSummaries, setActivationSummaries] = useState([]);
  const narrativeControllerRef = useRef(null);
  const narrativeCacheRef = useRef({});

  // Engines (stable refs)
  const dmnARef = useRef(new DMNAgent(new DMNEngine()));
  const dmnBRef = useRef(new DMNAgent(new DMNEngine()));
  const bpmnRef = useRef(new BPMNEngine());
  const cmmnRef = useRef(new CMMNEngine());
  const dmnRef = useRef(null); // will be set per-activation
  const rulesRef = useRef(null);  // will be set after registry is built
  const loggerRef = useRef(null);
  const battleRef = useRef(null);
  const actionTrackingRef = useRef({ agent_a: {}, agent_b: {} });
  const playingRef = useRef(false);

  // Game state refs
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

  useEffect(() => {
    if (!playing || !gsRef.current || battleRef.current?.status === 'completed') return;
    if (gsRef.current.pending_deployment) {
      runPendingDeployment();
      return;
    }
    const timer = setTimeout(() => {
        if (playingRef.current) processNextAction();
      }, simulationSpeed);
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
      const battleData = await base44.entities.Battle.get(id);
      console.log('[LOAD] battle status:', battleData.status, 'id:', id);
      
      setLoadingStatus("Loading armies...");
      const armyA = await base44.entities.ArmyList.get(battleData.army_a_id);
      const armyB = await base44.entities.ArmyList.get(battleData.army_b_id);

      setLoadingStatus("Analyzing army performance...");
      await dmnARef.current.loadLearningData(battleData.army_a_id);
      await dmnBRef.current.loadLearningData(battleData.army_b_id);

      const gs = battleData.game_state || {};
      const persA = getPersonality(gs.personality_a) || DEFAULT_PERSONALITY;
      const persB = getPersonality(gs.personality_b) || DEFAULT_PERSONALITY;
      dmnARef.current.setPersonality(persA);
      dmnBRef.current.setPersonality(persB);
      console.log(`[PERSONALITIES] A: ${persA.name}, B: ${persB.name}`);

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
        // Recreate rules engine from saved state? Not necessary if registry is stored.
        // We'll assume the registry is not saved; for simplicity we rebuild it.
        // In a real app you might want to persist the registry or reload it.
        await rebuildRulesEngine(armyA, armyB);
      }
    } catch (err) {
      console.error("Battle load error:", err);
      setLoadingStatus(`Error: ${err.message}`);
      throw err;
    }
  };

  // Helper to rebuild the rules engine (used when loading a saved battle)
  const rebuildRulesEngine = async (armyA, armyB) => {
    const registry = new RuleRegistry();
    registry.registerRules(OPR_RULES);
    for (const army of [armyA, armyB]) {
      const faction = army.faction || army.name;
      const loader = factionRuleMap[faction];
      if (loader) {
        try {
          const module = await loader();
          const rulesKey = faction.replace(/\s+/g, '_').toUpperCase() + '_RULES';
          if (module[rulesKey]) registry.registerRules(module[rulesKey]);
        } catch (e) {
          console.error(`Failed to load ${faction} rules`, e);
        }
      }
    }
    rulesRef.current = new RulesEngine(registry);
  };

  // ─── INIT ────────────────────────────────────────────────────────────────────

  const initializeBattle = async (battleData, armyA, armyB, logger) => {
    const mapTheme = battleData.game_state?.map_theme || 'mixed';
    const terrain = generateTerrain(mapTheme);
    const objectives = generateObjectives();
    const advRules = battleData.game_state?.advance_rules || {};

    // Build rule registry
    const registry = new RuleRegistry();
    registry.registerRules(OPR_RULES);

    for (const army of [armyA, armyB]) {
      const faction = army.faction || army.name;
      const loader = factionRuleMap[faction];
      if (loader) {
        try {
          const module = await loader();
          const rulesKey = faction.replace(/\s+/g, '_').toUpperCase() + '_RULES';
          if (module[rulesKey]) {
            registry.registerRules(module[rulesKey]);
            console.log(`[RULES] Loaded ${faction} rules`);
          }
        } catch (e) {
          console.error(`[RULES] Failed to load ${faction} rules`, e);
        }
      }
    }

    const rulesEngine = new RulesEngine(registry);
    rulesRef.current = rulesEngine;

    const units = deployArmies(armyA, armyB, advRules);

    const activeRuleKeys = Object.entries(advRules).filter(([, v]) => v).map(([k]) => k);
    logger.setBattleConfig({
      scoring_mode: advRules.cumulativeScoring ? 'cumulative' : 'per_round',
      advance_rules: activeRuleKeys,
    });

    const pendingState = {
      units,
      terrain,
      objectives,
      active_agent: 'agent_a',
      current_round: 0,
      units_activated: [],
      advance_rules: advRules,
      cumulative_score: { agent_a: 0, agent_b: 0 },
      pending_deployment: true,
    };

    const log = [{
      round: 0, type: 'setup',
      message: 'Terrain placed, objectives set. Press Play to begin deployment.',
      timestamp: new Date().toLocaleTimeString()
    }];

    commitState(pendingState, log);
    battleRef.current = { ...battleRef.current, status: 'in_progress', current_round: 1 };
    setBattle({ ...battleRef.current });
  };

// ─── TERRAIN / OBJECTIVES ────────────────────────────────────────────────────

  const generateTerrain = (theme = 'mixed') => {
    // Theme configs: each entry defines a piece type, its terrain flags, how many
    // to place, and a min/max radius range (in board units).
    const themeConfigs = {
      urban: [
        { name: 'Ruins',    types: ['blocking', 'cover'],            count: 4, radiusRange: [3, 5] },
        { name: 'Building', types: ['impassable', 'cover'],          count: 3, radiusRange: [4, 6] },
        { name: 'Rubble',   types: ['difficult', 'cover'],           count: 3, radiusRange: [2, 4] },
      ],
      forest: [
        { name: 'Dense Forest', types: ['difficult', 'cover', 'blocking'], count: 4, radiusRange: [4, 7] },
        { name: 'Light Forest', types: ['difficult', 'cover'],             count: 4, radiusRange: [3, 5] },
        { name: 'Rocky Ground', types: ['difficult'],                      count: 2, radiusRange: [2, 4] },
      ],
      desert: [
        { name: 'Dunes',        types: ['difficult'],                count: 4, radiusRange: [3, 6] },
        { name: 'Rocky Outcrop',types: ['blocking', 'cover'],        count: 3, radiusRange: [2, 4] },
        { name: 'Oasis',        types: ['difficult', 'cover'],       count: 2, radiusRange: [3, 5] },
      ],
      mixed: [
        { name: 'Woods',        types: ['difficult', 'cover'],       count: 3, radiusRange: [3, 5] },
        { name: 'Ruins',        types: ['blocking', 'cover'],        count: 2, radiusRange: [3, 5] },
        { name: 'Hill',         types: ['cover'],                    count: 2, radiusRange: [4, 6] },
        { name: 'Swamp',        types: ['difficult', 'dangerous'],   count: 1, radiusRange: [3, 4] },
        { name: 'Rocky Ground', types: ['difficult'],                count: 2, radiusRange: [2, 4] },
      ],
    };

    const config = themeConfigs[theme] || themeConfigs.mixed;
    const pieces = [];
    let pieceId = 0;

    // Playable area — keep terrain away from the board edges and deployment strips.
    // Deployment bands are y=4-15 (agent_a) and y=33-44 (agent_b), so we leave a
    // small buffer inside those bands and concentrate terrain in the centre.
    const X_MIN = 7, X_MAX = 63;
    const Y_MIN = 7, Y_MAX = 41;

    for (const terrainType of config) {
      for (let i = 0; i < terrainType.count; i++) {
        const [rMin, rMax] = terrainType.radiusRange;
        const radius = rMin + Math.random() * (rMax - rMin);

        // Try up to 60 times to place without overlapping existing pieces.
        let x, y, placed = false;
        for (let attempt = 0; attempt < 60; attempt++) {
          x = X_MIN + Math.random() * (X_MAX - X_MIN);
          y = Y_MIN + Math.random() * (Y_MAX - Y_MIN);
          const overlaps = pieces.some(
            p => Math.hypot(p.x - x, p.y - y) < p.radius + radius + 2
          );
          if (!overlaps) { placed = true; break; }
        }
        // If we exhausted attempts, place anyway rather than silently drop a piece.
        if (!placed) {
          x = X_MIN + Math.random() * (X_MAX - X_MIN);
          y = Y_MIN + Math.random() * (Y_MAX - Y_MIN);
        }

        pieces.push(new Terrain({
          id: `terrain_${pieceId++}`,
          name: terrainType.name,
          x,
          y,
          radius,
          types: terrainType.types,
        }));
      }
    }

    return pieces;
  };

  const generateObjectives = () => {
    // Three objectives: one central, one on each flank, all in the mid-table strip.
    // Controlled_by starts null — RulesEngine.updateObjectives() sets this each round.
    return [
      { id: 'obj_centre', name: 'Central Objective', x: 35, y: 24, controlled_by: null },
      { id: 'obj_left',   name: 'Left Flank',        x: 14, y: 24, controlled_by: null },
      { id: 'obj_right',  name: 'Right Flank',       x: 56, y: 24, controlled_by: null },
    ];
  };

  // ─── DEPLOY HELPERS ───────────────────────────────────────────────────────────

  // Returns the wounds (Tough value) for a single model in this unit.
  // A unit with Tough(6) has 6 wounds per model; default is 1.
  const resolveMeleeWeaponName = (weapons = []) => {
    const melee = weapons.filter(w => (w.range ?? 0) <= 2);
    if (melee.length === 0) return 'CCW';
    return melee.reduce((a, b) => ((b.attacks ?? 1) > (a.attacks ?? 1) ? b : a)).name || 'CCW';
  };

  // Appends "#1", "#2" etc. to unit names that appear more than once within the
  // same army so that the battle log and UI can tell them apart.
  const disambiguateUnitNames = (units) => {
    const counts  = {};   // "owner:name" → total occurrences
    const indices = {};   // "owner:name" → running index

    units.forEach(u => {
      const key = `${u.owner}:${u.name}`;
      counts[key] = (counts[key] || 0) + 1;
    });

    return units.map(u => {
      const key = `${u.owner}:${u.name}`;
      if (counts[key] > 1) {
        indices[key] = (indices[key] || 0) + 1;
        return { ...u, name: `${u.name} #${indices[key]}` };
      }
      return u;
    });
  };

  // Converts raw army data from the database into the flat unit objects that
  // the game engine works with.  Positions are rough placeholders — the DMN
  // deployment phase will overwrite x/y with its own scored placement.
  const deployArmies = (armyA, armyB, advRules) => {
    const placeFn = (parsed, i, total, owner) => ({
      x: 10 + Math.random() * 50,
      y: owner === 'agent_a' ? 10 : 38,
    });

    const addBattleFields = (unit) => {
      const toughMatch = unit.special_rules.match(/\bTough\((\d+)\)/);
      const toughPerModel = toughMatch ? parseInt(toughMatch[1]) : 1;
      const isReserve = /Ambush|Teleport|Infiltrate/.test(unit.special_rules);
      return {
        ...unit,
        status:                'normal',
        tough_per_model:       toughPerModel,
        model_count:           unit.total_models,
        is_in_reserve:         isReserve,
        rounds_without_offense: 0,
        melee_weapon_name:     resolveMeleeWeaponName(unit.weapons),
      };
    };

    const unitsA = createArmy(
      { units: armyA.units || armyA.roster || [] },
      'agent_a',
      (parsed, i) => placeFn(parsed, i, null, 'agent_a')
    ).map(addBattleFields);

    const unitsB = createArmy(
      { units: armyB.units || armyB.roster || [] },
      'agent_b',
      (parsed, i) => placeFn(parsed, i, null, 'agent_b')
    ).map(addBattleFields);

    return disambiguateUnitNames([...unitsA, ...unitsB]);
  };

  // ─── DEPLOYMENT PHASE ────────────────────────────────────────────────────────

  // Called once at the start of a battle.  Iterates through all non-reserve
  // units in alternating order (agent_a, agent_b, agent_a, …) and asks each
  // side's DMN engine to choose a placement.  Reserve units are flagged and
  // will enter via Ambush/Teleport hooks at the start of later rounds.
  const runDeploymentPhase = async (units, objectives, terrain, logger, advRules) => {
    // Mark reserve units and separate them out.
    const toPlace = [];
    units.forEach(u => {
      if (u.is_in_reserve) {
        const evs = evRef.current;
        const ruleName = (u.special_rules || '').match(/Ambush|Teleport|Infiltrate/)?.[0] || 'Reserve';
        evs.push({
          round: 0, type: 'setup',
          message: `${u.name} (${u.owner}) held in ${ruleName}`,
          timestamp: new Date().toLocaleTimeString(),
        });
        logger?.logAbility({ round: 0, unit: u, ability: ruleName, details: { status: 'in_reserve' } });
      } else {
        toPlace.push(u);
      }
    });

    // Interleave: one agent_a unit, one agent_b unit, repeat.
    const aUnits = toPlace.filter(u => u.owner === 'agent_a');
    const bUnits = toPlace.filter(u => u.owner === 'agent_b');
    const deployOrder = [];
    for (let i = 0; i < Math.max(aUnits.length, bUnits.length); i++) {
      if (i < aUnits.length) deployOrder.push(aUnits[i]);
      if (i < bUnits.length) deployOrder.push(bUnits[i]);
    }

    // Track already-placed units per side for the DMN's spread heuristic.
    const deployedA   = [];
    const deployedB   = [];
    const usedZonesA  = new Set();
    const usedZonesB  = new Set();

    for (const unit of deployOrder) {
      const isAgentA       = unit.owner === 'agent_a';
      const deployedFriends = isAgentA ? deployedA : deployedB;
      const deployedEnemies = isAgentA ? deployedB : deployedA;
      const usedZones       = isAgentA ? usedZonesA : usedZonesB;

      // DMNEngine.decideDeployment lives on the inner engine, not the DMNAgent wrapper.
      // Access it via .engine if DMNAgent exposes it, otherwise fall through to the ref.
      const agentRef  = isAgentA ? dmnARef.current : dmnBRef.current;
      const dmnEngine = agentRef.engine || agentRef;  // DMNAgent wraps DMNEngine as .engine

const placement = await dmnEngine.decideDeployment(
        unit, isAgentA, deployedEnemies, deployedFriends, objectives, terrain, usedZones
      );

      // Hard-clamp to deployment band regardless of what DMN returned.
      const yMin = isAgentA ? 4 : 33;
      const yMax = isAgentA ? 15 : 44;
      unit.x = Math.max(5, Math.min(65, placement.x));
      unit.y = Math.max(yMin, Math.min(yMax, placement.y));

      if (placement.zone) usedZones.add(placement.zone);
      if (isAgentA) deployedA.push(unit); else deployedB.push(unit);

      const evs = [...evRef.current];
      evs.push({
        round: 0, type: 'setup',
        message: `${unit.name} (${unit.owner}) → (${unit.x.toFixed(1)}, ${unit.y.toFixed(1)}) — ${placement.dmnReason}`,
        timestamp: new Date().toLocaleTimeString(),
      });
      logger?.logAbility({
        round: 0, unit, ability: 'Deploy',
        details: {
          x: unit.x.toFixed(1), y: unit.y.toFixed(1),
          zone: placement.zone, reason: placement.dmnReason,
          specialRulesApplied: placement.specialRulesApplied || [],
        },
      });

      // Commit after each unit so the battlefield view updates in real time.
      commitState({ ...gsRef.current, units: [...units] }, evs);
      await new Promise(r => setTimeout(r, 150));
    }

    // Transition BPMN and start Round 1.
    bpmnRef.current.transition('round_start');

    const evs = [...evRef.current];
    evs.push({
      round: 1, type: 'round',
      message: '━━━ Round 1 begins ━━━',
      timestamp: new Date().toLocaleTimeString(),
    });

    commitState({
      ...gsRef.current,
      units:            [...units],
      pending_deployment: false,
      current_round:    1,
      units_activated:  [],
      active_agent:     'agent_a',
    }, evs);
  };

  // Thin wrapper called by the useEffect when pending_deployment is true.
  // Pulls the current units/objectives/terrain out of the ref so the async
  // deployment phase always works on the freshest state.
  const runPendingDeployment = async () => {
    setPlayingBoth(false); // Pause auto-advance while we do deployment
    const gs = gsRef.current;
    await runDeploymentPhase(
      gs.units,
      gs.objectives,
      gs.terrain,
      loggerRef.current,
      gs.advance_rules || {}
    );
    setPlayingBoth(true); // Resume once deployment is done
  };

  // ─── MAIN LOOP ────────────────────────────────────────────────────────────────

  // Called by the useEffect timer on every state update while playing === true.
  // Decides what happens next: start deployment, activate the next unit,
  // end the round, or end the battle.
  const processNextAction = async () => {
    if (!playingRef.current) return;

    const gs = gsRef.current;
    if (!gs) return;

    // Nothing to do if the battle is over.
    if (battleRef.current?.status === 'completed') {
      setPlayingBoth(false);
      return;
    }

    // Deployment hasn't happened yet — hand off to the deployment phase.
    if (gs.pending_deployment) {
      await runPendingDeployment();
      return;
    }

    const round = gs.current_round;
    if (!round || round > 4) {
      await endBattle(gs);
      return;
    }

    // Which units haven't activated yet this round?
    const activatedSet = new Set(gs.units_activated || []);
    const liveUnits = gs.units.filter(u =>
      u.current_models > 0 &&
      u.status !== 'destroyed' &&
      u.status !== 'routed'  &&
      !u.is_in_reserve       &&
      !activatedSet.has(u.id)
    );

    if (liveUnits.length === 0) {
      // Every live unit has activated — close the round.
      await endRound(gs);
      return;
    }

    // Alternate activations: prefer the active agent's units.
    // If they have nothing left to activate, hand priority to the other side.
    const activeAgent = gs.active_agent || 'agent_a';
    const otherAgent  = activeAgent === 'agent_a' ? 'agent_b' : 'agent_a';

    let candidateAgent = activeAgent;
    let candidates = liveUnits.filter(u => u.owner === activeAgent);
    if (candidates.length === 0) {
      candidateAgent = otherAgent;
      candidates = liveUnits.filter(u => u.owner === otherAgent);
    }

    if (candidates.length === 0) {
      await endRound(gs);
      return;
    }

    // Ask the agent's DMN to score each candidate and pick the highest-priority one.
    // This means units with urgent actions (e.g. shaken recovery, charge opportunity)
    // bubble up before passive holders.
    const agentRef = candidateAgent === 'agent_a' ? dmnARef.current : dmnBRef.current;

const scored = candidates.map(u => {
      try {
        const dmnEngine = agentRef.engine || agentRef;
        const options = dmnEngine.evaluateActionOptions
          ? dmnEngine.evaluateActionOptions(u, gs, candidateAgent)
          : [];
        const topScore = options[0]?.score ?? 0;
        return { unit: u, score: topScore };
      } catch {
        return { unit: u, score: 0 };
      }
    });
    scored.sort((a, b) => b.score - a.score);
    const unitToActivate = scored[0].unit;

    // If the active agent changed, update state before activating.
    if (candidateAgent !== activeAgent) {
      commitState({ ...gsRef.current, active_agent: candidateAgent });
    }

    await activateUnit(unitToActivate, gsRef.current);
  };

  // ─── ACTIVATE ─────────────────────────────────────────────────────────────────
  const activateUnit = async (unit, gs) => {
    const alreadyActivated = new Set(gsRef.current.units_activated || []);
    if (alreadyActivated.has(unit.id)) {
      console.warn(`[DOUBLE-ACTIVATION GUARD] ${unit.name} (${unit.id}) already activated this round — skipping`);
      return;
    }

    const liveUnit = gsRef.current.units.find(u => u.id === unit.id);
    if (!liveUnit || liveUnit.current_models <= 0) {
      const newGs = { ...gsRef.current, units_activated: [...(gsRef.current.units_activated || []), unit.id], active_agent: gsRef.current.active_agent === 'agent_a' ? 'agent_b' : 'agent_a' };
      commitState(newGs);
      return;
    }

    setActiveUnit(liveUnit);
    const evs = [...evRef.current];
    const round = gs.current_round;

    const dmn = liveUnit.owner === 'agent_a' ? dmnARef.current : dmnBRef.current;
    dmnRef.current = dmn;
    const rules = rulesRef.current;
    const logger = loggerRef.current;

    const activationFiredSet = new Set();
    liveUnit._firedThisActivation = activationFiredSet;

    if (liveUnit.status === 'shaken') {
      liveUnit.status = 'normal';
      evs.push({ round, type: 'morale', message: `${liveUnit.name} is Shaken — spends activation idle, recovers Shaken status`, timestamp: new Date().toLocaleTimeString() });
      logger?.logMorale({ round, unit: liveUnit, outcome: 'recovered', roll: null, qualityTarget: null, dmnReason: 'Shaken — idle activation, shaken removed' });
      liveUnit.just_charged = false;
      const nextAgentShaken = liveUnit.owner === 'agent_a' ? 'agent_b' : 'agent_a';
      const activatedSetShaken = new Set(gsRef.current.units_activated || []);
      activatedSetShaken.add(liveUnit.id);
      evRef.current = evs;
      commitState({ ...gsRef.current, units_activated: Array.from(activatedSetShaken), active_agent: nextAgentShaken }, evs);
      setActiveUnit(null);
      return;
    }

    const canAct = true;
    evRef.current = evs;
    commitState({ ...gsRef.current }, evs);

    // Heroic Action (Advance Rule)
    const advRules = gs.advance_rules || {};
    const isHero = liveUnit.special_rules?.toLowerCase().includes('hero') || liveUnit.special_rules?.match(/Tough\(\d+\)/);
    const useHeroic = advRules.heroicActions && isHero && !liveUnit.heroic_action_used && liveUnit.current_models <= liveUnit.total_models * 0.5;
    if (useHeroic) {
      liveUnit.heroic_action_used = true;
      evs.push({ round, type: 'ability', message: `${liveUnit.name} uses a Heroic Action — all dice re-rolled this activation!`, timestamp: new Date().toLocaleTimeString() });
      logger?.logAbility({ round, unit: liveUnit, ability: 'Heroic Action', details: { trigger: 'below half wounds' } });
    }

    // Agent action selection
    const agentDecision = await dmn.decideAction(liveUnit, gs);
    let selectedAction = agentDecision.action;

    setCurrentDecision({
      unit: liveUnit,
      options: agentDecision.options || [],
      dmn_phase: 'Action Selection',
      reasoning: agentDecision.reasoning || `(${liveUnit.x.toFixed(0)}, ${liveUnit.y.toFixed(0)}) → ${selectedAction}`
    });

    await new Promise(r => setTimeout(r, 300));
    await executeAction(liveUnit, selectedAction, canAct, gs, evs, agentDecision);

    liveUnit.just_charged = false;
    const nextAgent = liveUnit.owner === 'agent_a' ? 'agent_b' : 'agent_a';
    const latestGs = gsRef.current;
    const activatedSetFinal = new Set(latestGs.units_activated || []);
    activatedSetFinal.add(liveUnit.id);
    const updatedGs = {
      ...latestGs,
      units_activated: Array.from(activatedSetFinal),
      active_agent: nextAgent,
    };
    commitState(updatedGs, evRef.current);
    setActiveUnit(null);
  };

  // ─── EXECUTE ACTION ───────────────────────────────────────────────────────────
  const executeAction = async (unit, action, canAct, gs, evs, agentDecision = null) => {
    const round = gs.current_round;
    const dmn = dmnRef.current;
    const rules = rulesRef.current;
    const logger = loggerRef.current;
    const tracking = actionTrackingRef.current;
    tracking[unit.owner][action] = (tracking[unit.owner][action] || 0) + 1;

    const dmnReason = agentDecision?.reasoning
      ?? (() => {
          const opts = dmn.evaluateActionOptions(unit, gs, unit.owner);
          const top  = opts.sort((a, b) => b.score - a.score)[0];
          return top ? `${top.action} scored ${top.score.toFixed(2)}` : action;
        })();

    if (canAct) await attemptSpellCasting(unit, gs, evs);

    if (action === 'Hold') {
      if (canAct) await attemptShooting(unit, gs, evs, dmnReason);
      else evs.push({ round, type: 'movement', message: `${unit.name} holds (shaken — cannot shoot)`, timestamp: new Date().toLocaleTimeString() });

    } else if (action === 'Advance') {
      const moveTarget = await dmn.decideMovement(
        unit,
        gs.objectives,
        gs.units.filter(u => u.owner !== unit.owner && u.current_models > 0),
        gs
      );
      if (moveTarget) {
        const result = rules.executeMovement(unit, action, moveTarget, gs.terrain, gs);
        const zone = rules.getZone(unit.x, unit.y);
        evs.push({ round, type: 'movement', message: `${unit.name} advanced ${result.distance.toFixed(1)}"`, timestamp: new Date().toLocaleTimeString() });
        logger?.logMove({ round, actingUnit: unit, action, distance: result.distance, zone, dmnReason, specialRulesApplied: result.specialRulesApplied });
      }
      if (canAct) await attemptShooting(unit, gs, evs, dmnReason);

    } else if (action === 'Rush') {
      const rushTarget = await dmn.decideMovement(
        unit,
        gs.objectives,
        gs.units.filter(u => u.owner !== unit.owner && u.current_models > 0),
        gs
      );
      if (rushTarget) {
        const result = rules.executeMovement(unit, action, rushTarget, gs.terrain, gs);
        const zone = rules.getZone(unit.x, unit.y);
        // Dangerous terrain check is already inside executeMovement; we just need to apply wounds if any
        // But executeMovement already applies them via _applyWounds.
        // We'll log the move.
        evs.push({ round, type: 'movement', message: `${unit.name} rushed ${result.distance.toFixed(1)}"`, timestamp: new Date().toLocaleTimeString() });
        logger?.logMove({ round, actingUnit: unit, action, distance: result.distance, zone, dmnReason, specialRulesApplied: result.specialRulesApplied });
      }
      unit.rounds_without_offense = (unit.rounds_without_offense || 0) + 1;

    } else if (action === 'Charge') {
      const enemies = gs.units.filter(u => u.owner !== unit.owner && u.current_models > 0 && u.status !== 'destroyed' && u.status !== 'routed');
      const target = dmn.selectTarget(unit, enemies);
      if (target) {
        unit.just_charged = true;
        const moveResult = rules.executeMovement(unit, action, target, gs.terrain, gs);
        const zone = rules.getZone(unit.x, unit.y);
        evs.push({ round, type: 'movement', message: `${unit.name} charges ${target.name}!`, timestamp: new Date().toLocaleTimeString() });
        logger?.logMove({ round, actingUnit: unit, action: 'Charge', distance: moveResult.distance, zone, dmnReason, chargeTarget: target.name, chargeTargetState: { wounds_remaining: target.current_models, max_wounds: target.total_models, status: target.status || 'normal' }, specialRulesApplied: moveResult.specialRulesApplied });

        // Check if unit survived movement (dangerous terrain could have killed it)
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
        // No target in range – fall back to rush
        const nearest = dmn.findNearestEnemy(unit, enemies);
        if (nearest) {
          const result = rules.executeMovement(unit, 'Rush', nearest, gs.terrain, gs);
          evs.push({ round, type: 'movement', message: `${unit.name} rushes toward ${nearest.name} (no charge target in range)`, timestamp: new Date().toLocaleTimeString() });
          logger?.logMove({ round, actingUnit: unit, action: 'Rush', distance: result.distance, zone: rules.getZone(unit.x, unit.y), dmnReason, specialRulesApplied: result.specialRulesApplied });
        }
      }
    }

    evRef.current = evs;
    rules.updateObjectives(gs);
  };

  // ─── SPELL CASTING ────────────────────────────────────────────────────────────
  const attemptSpellCasting = async (unit, gs, evs) => {
    const rules = rulesRef.current;
    const logger = loggerRef.current;
    const round = gs.current_round;

    if (rules.getCasterTokens(unit) === 0) return;
    const tokens = unit.spell_tokens || 0;
    if (tokens === 0) return;

    const spells = (unit.weapons || [])
      .filter(w => w.spell_cost != null)
      .sort((a, b) => (a.spell_cost || 1) - (b.spell_cost || 1));

    if (spells.length === 0) return;

    const enemies = gs.units.filter(u => u.owner !== unit.owner && u.current_models > 0 && u.status !== 'destroyed');
    if (enemies.length === 0) return;

    const target = enemies.reduce((n, e) => rules.calculateDistance(unit, e) < rules.calculateDistance(unit, n) ? e : n);
    const dist = rules.calculateDistance(unit, target);
    const LOS_RANGE = 18;

    const sortedSpells = [...spells].sort((a, b) => {
      const aHostile = a.range > 2 && (a.ap || 0) >= 0;
      const bHostile = b.range > 2 && (b.ap || 0) >= 0;
      if (aHostile !== bHostile) return aHostile ? -1 : 1;
      return (b.spell_cost || 1) - (a.spell_cost || 1);
    });

    for (const spell of sortedSpells) {
      if ((unit.spell_tokens || 0) <= 0) break;
      const cost = spell.spell_cost || 1;
      if ((unit.spell_tokens || 0) < cost) continue;
      if (dist > (spell.range || LOS_RANGE)) continue;

      // Allied helpers
      let friendlyBonus = 0;
      gs.units.forEach(ally => {
        if (ally.id === unit.id || ally.owner !== unit.owner || ally.current_models <= 0) return;
        if (rules.getCasterTokens(ally) === 0) return;
        if (rules.calculateDistance(unit, ally) > 18) return;
        if ((ally.spell_tokens || 0) > 0) {
          ally.spell_tokens -= 1;
          friendlyBonus += 1;
        }
      });

      // Enemy counters
      let hostileBonus = 0;
      gs.units.forEach(enemy => {
        if (enemy.owner === unit.owner || enemy.current_models <= 0) return;
        if (rules.getCasterTokens(enemy) === 0) return;
        if (rules.calculateDistance(target, enemy) > 18) return;
        if ((enemy.spell_tokens || 0) > 0) {
          enemy.spell_tokens -= 1;
          hostileBonus += 1;
        }
      });

      const castResult = rules.castSpell(unit, spell, target, gs, friendlyBonus, hostileBonus);

      evs.push({
        round, type: 'ability',
        message: `🔮 ${unit.name} casts ${spell.name} (cost ${cost}) at ${target.name}: roll ${castResult.roll}${(friendlyBonus - hostileBonus) !== 0 ? `${(friendlyBonus - hostileBonus) > 0 ? '+' : ''}${friendlyBonus - hostileBonus}` : ''} = ${castResult.modifiedRoll} → ${castResult.success ? '✓ SUCCESS' : '✗ FAIL'} (tokens: ${castResult.tokensAfter} left)`,
        timestamp: new Date().toLocaleTimeString()
      });
      logger?.logAbility({ round, unit, ability: 'Caster', details: { spell: spell.name, cost, target: target.name, roll: castResult.roll, modified_roll: castResult.modifiedRoll, success: castResult.success, tokens_before: tokens, tokens_after: castResult.tokensAfter, friendly_bonus: friendlyBonus, hostile_bonus: hostileBonus } });

      if (castResult.success) {
        const spellWeapon = { name: spell.name, range: spell.range || 18, attacks: 1, ap: spell.ap || 0, special_rules: spell.special_rules || '' };
        const shootResult = rules.resolveShooting(unit, target, spellWeapon, gs);
        const woundsDealt = shootResult.wounds;
        const regenResult = rules.applyRegeneration(target, woundsDealt, false);
        const finalWounds = regenResult.finalWounds;
        if (regenResult.ignored > 0) {
          evs.push({ round, type: 'regen', message: `${target.name} Regeneration: ignored ${regenResult.ignored}/${woundsDealt} spell wounds`, timestamp: new Date().toLocaleTimeString() });
        }

        target.current_models = Math.max(0, target.current_models - finalWounds);
        if (target.current_models <= 0) {
          target.status = 'destroyed';
          evs.push({ round, type: 'combat', message: `${target.name} destroyed by ${spell.name}!`, timestamp: new Date().toLocaleTimeString() });
          logger?.logDestruction({ round, unit: target, cause: `spell (${spell.name}) by ${unit.name}`, actingUnit: unit.name, killedByWeapon: spell.name });
        } else if (finalWounds > 0) {
          evs.push({ round, type: 'combat', message: `${spell.name} deals ${finalWounds} wound(s) to ${target.name}`, timestamp: new Date().toLocaleTimeString() });
        }
      }

      await new Promise(r => setTimeout(r, 400));
      break; // only one spell per activation
    }
  };

  // ─── SHOOTING ─────────────────────────────────────────────────────────────────
  const attemptShooting = async (unit, gs, evs, dmnReason) => {
    const round = gs.current_round;
    const dmn = dmnRef.current;
    const rules = rulesRef.current;
    const logger = loggerRef.current;
    let shotFired = false;

    const firedThisActivation = unit._firedThisActivation;
    if (!firedThisActivation) return false;

    const rangedWeapons = (unit.weapons || []).filter(w => {
      if ((w.range ?? 2) <= 2) return false;
      const key = `${w.name}|${w.range}|${w.attacks}`;
      if (firedThisActivation.has(key)) return false;
      firedThisActivation.add(key);
      return true;
    });

    if (rangedWeapons.length === 0) return false;

    for (const weapon of rangedWeapons) {
      const liveEnemies = gs.units.filter(u =>
        u.owner !== unit.owner &&
        u.current_models > 0 &&
        u.status !== 'destroyed' &&
        u.status !== 'routed'
      );
      if (liveEnemies.length === 0) break;

      const target = dmn.selectTarget(unit, liveEnemies);
      if (!target) continue;

      const liveTarget = gs.units.find(u => u.id === target.id);
      if (!liveTarget || liveTarget.current_models <= 0 || liveTarget.status === 'destroyed') continue;

      const shootStateBefore = {
        acting_unit: { wounds_remaining: unit.current_models, max_wounds: unit.total_models, status: unit.status },
        target_unit: { wounds_remaining: liveTarget.current_models, max_wounds: liveTarget.total_models, status: liveTarget.status }
      };

      // Effective range check
      const dist = rules.calculateDistance(unit, target);
      if (dist > weapon.range) continue; // out of range

      const weaponSpecialStr = Array.isArray(weapon.special_rules)
        ? weapon.special_rules.join(' ')
        : (weapon.special_rules || '');
      const blastMatch = weaponSpecialStr.match(/Blast\((\d+)\)/);
      const isBlast = !!blastMatch;
      const blastCount = isBlast ? parseInt(blastMatch[1]) : 0;
      const normWeapon = { ...weapon, special_rules: weaponSpecialStr };

      // Models in range (simplified: all models if target is in range)
      const modelsInRange = unit.current_models; // better would be to use a footprint check
      const baseAttacks = weapon.attacks || 1;
      const totalAttacks = baseAttacks * modelsInRange;

      let result;
      let loggedAttacks;
      if (isBlast) {
        const blastWeapon = { ...normWeapon, attacks: blastCount };
        result = rules.resolveShooting(unit, target, blastWeapon, gs);
        result = { ...result, hits: blastCount, blast: true };
        loggedAttacks = blastCount;
      } else {
        const shootWeapon = { ...normWeapon, attacks: totalAttacks };
        result = rules.resolveShooting(unit, target, shootWeapon, gs);
        loggedAttacks = totalAttacks;
      }

      let woundsDealt = result.wounds;
      // Regeneration check (the shooting result already includes ON_INCOMING_WOUNDS, so woundsDealt is final)
      // But we still need to log regeneration events if any.
      // The result object may contain specialRulesApplied that we can inspect for Regeneration.
      const regenEvents = result.specialRulesApplied?.filter(r => r.rule === 'Regeneration') || [];
      regenEvents.forEach(re => {
        evs.push({ round, type: 'regen', message: `${target.name} Regeneration: ${re.effect}`, timestamp: new Date().toLocaleTimeString() });
      });

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
      const blastFlagValue = isBlast || result.blast || false;
      evs.push({
        round, type: 'combat',
        message: `${unit.name} fires ${weaponLabel} at ${target.name}: ${result.hits} hits, ${result.saves} saves, ${woundsDealt} wounds`,
        timestamp: new Date().toLocaleTimeString()
      });

      if (target.current_models <= 0) {
        target.status = 'destroyed';
        evs.push({ round, type: 'combat', message: `${target.name} destroyed!`, timestamp: new Date().toLocaleTimeString() });
        logger?.logDestruction({ round, unit: target, cause: `shooting by ${unit.name} (${weaponLabel})`, actingUnit: unit.name, killedByWeapon: weapon.name });
      }

      const topScore = liveEnemies.map(e => dmn.scoreTarget(unit, e)).sort((a, b) => b - a)[0]?.toFixed(2);

      // Deduplicate special rules applied for logging
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
        dmnReason: `${dmnReason} (score ${topScore})`,
        stateBefore: shootStateBefore
      });

      // Morale check (if unit still exists)
      if (target.status !== 'routed' && target.status !== 'destroyed' && woundsDealt > 0) {
        const targetIsSingleModel = (target.model_count || 1) === 1;
        const targetMoraleThreshold = targetIsSingleModel
          ? target.current_models <= target.total_models / 2
          : Math.ceil(target.current_models / Math.max(target.tough_per_model || 1, 1)) <= Math.floor((target.model_count || 1) / 2);
        if (targetMoraleThreshold) {
          const moraleStateBefore = { acting_unit: { wounds_remaining: target.current_models, max_wounds: target.total_models, status: target.status } };
          const moraleResult = rules.checkMorale(target, 'wounds');
          const outcome = rules.applyMoraleResult(target, moraleResult.passed, 'wounds');
          if (outcome !== 'passed') {
            evs.push({ round, type: 'morale', message: `${target.name} morale ${moraleResult.passed ? 'passed' : 'failed'} — ${outcome}`, timestamp: new Date().toLocaleTimeString() });
            logger?.logMorale({ round, unit: target, outcome, roll: moraleResult.roll, qualityTarget: target.quality || 4, specialRulesApplied: moraleResult.specialRulesApplied || [], woundsTaken: woundsDealt, stateBefore: moraleStateBefore });
          }
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

    if (attacker.current_models <= 0 || attacker.status === 'destroyed') return false;
    if (defender.current_models <= 0 || defender.status === 'destroyed') return false;

    const meleeStateBefore = {
      acting_unit: { wounds_remaining: attacker.current_models, max_wounds: attacker.total_models, status: attacker.status },
      target_unit: { wounds_remaining: defender.current_models, max_wounds: defender.total_models, status: defender.status }
    };

    const result = rules.resolveMelee(attacker, defender, gs);

    // The engine already applied wounds, but we need to update local models from the engine's changes?
    // Actually resolveMelee modifies the units in place, so we just need to log.
    // The result contains attacker_wounds and defender_wounds for logging.

    const attackerWoundsDealt = result.attacker_wounds;
    const defenderWoundsDealt = result.defender_wounds;

    evs.push({ round, type: 'combat', message: `⚔ ${attacker.name} vs ${defender.name} — dealt ${attackerWoundsDealt}, took ${defenderWoundsDealt}`, timestamp: new Date().toLocaleTimeString() });

    const atkWpnName = attacker.melee_weapon_name && attacker.melee_weapon_name !== 'CCW' ? attacker.melee_weapon_name : 'Fists';
    logger?.logMelee({
      round, actingUnit: attacker, targetUnit: defender,
      weaponName: atkWpnName,
      rollResults: result.rollResults,
      gameState: gs, dmnReason,
      stateBefore: meleeStateBefore
    });

    // Check for destruction logs
    if (defender.current_models <= 0 && meleeStateBefore.target_unit.wounds_remaining > 0) {
      evs.push({ round, type: 'combat', message: `${defender.name} destroyed in melee!`, timestamp: new Date().toLocaleTimeString() });
      logger?.logDestruction({ round, unit: defender, cause: `melee with ${attacker.name}`, actingUnit: attacker.name, killedByWeapon: atkWpnName });
    }
    if (attacker.current_models <= 0 && meleeStateBefore.acting_unit.wounds_remaining > 0) {
      evs.push({ round, type: 'combat', message: `${attacker.name} destroyed in melee!`, timestamp: new Date().toLocaleTimeString() });
      const defWpnName = defender.melee_weapon_name && defender.melee_weapon_name !== 'CCW' ? defender.melee_weapon_name : 'Fists';
      logger?.logDestruction({ round, unit: attacker, cause: `melee with ${defender.name}`, actingUnit: defender.name, killedByWeapon: defWpnName });
    }

    // Morale for loser (engine doesn't handle this automatically? We'll do it here)
    const loser = attackerWoundsDealt > defenderWoundsDealt ? defender : (defenderWoundsDealt > attackerWoundsDealt ? attacker : null);
    if (loser && loser.status !== 'routed' && loser.status !== 'destroyed') {
      const loserWoundsTaken = loser === defender ? attackerWoundsDealt : defenderWoundsDealt;
      const loserStateBefore = { acting_unit: { wounds_remaining: loser.current_models, max_wounds: loser.total_models, status: loser.status } };
      const moraleResult = rules.checkMorale(loser, 'melee_loss');
      const outcome = rules.applyMoraleResult(loser, moraleResult.passed, 'melee_loss');
      if (outcome !== 'passed') {
        evs.push({ round, type: 'morale', message: `${loser.name} ${outcome} after melee loss (roll: ${moraleResult.roll})`, timestamp: new Date().toLocaleTimeString() });
        logger?.logMorale({ round, unit: loser, outcome, roll: moraleResult.roll, qualityTarget: loser.quality || 4, specialRulesApplied: moraleResult.specialRulesApplied || [], woundsTaken: loserWoundsTaken, stateBefore: loserStateBefore });
      }
    }

    return defender.current_models <= 0; // true if target killed (for Overrun)
  };

  // ─── END ROUND ────────────────────────────────────────────────────────────────
  const endRound = async (gs) => {
    const newRound = gs.current_round + 1;
    if (newRound > 4) { await endBattle(gs); return; }

    const rules = rulesRef.current;
    const logger = loggerRef.current;
    const evs = [...evRef.current];

    const isProgressiveScoring = gs.advance_rules?.progressiveScoring === true;
    const isFinalRound = newRound === 5;

    // Round-end validation and shaken recovery (unchanged)
    const liveUnits = gs.units.filter(u => u.current_models > 0 && u.status !== 'destroyed' && u.status !== 'routed' && !u.is_in_reserve);
    const activatedSetEnd = new Set(gs.units_activated || []);
    const notActivated = liveUnits.filter(u => !activatedSetEnd.has(u.id));
    if (notActivated.length > 0) {
      console.error(`SCHEDULER END-OF-ROUND: ${notActivated.length} unit(s) never activated:`, notActivated.map(u => u.name));
    }
    notActivated.forEach(u => {
      evs.push({ round: gs.current_round, type: 'warning', message: `⚠ SCHEDULING: ${u.name} (${u.owner}) had no activation in round ${gs.current_round}`, timestamp: new Date().toLocaleTimeString() });
      loggerRef.current?.logAbility({ round: gs.current_round, unit: u, ability: 'scheduling_warning', details: { reason: 'no_activation_this_round' } });
      if (u.status === 'shaken') {
        u.status = 'normal';
        const moraleResult = rules.checkMorale(u, 'recovery');
        if (!moraleResult.passed) u.status = 'shaken';
        const outcome = moraleResult.passed ? 'recovered' : 'still_shaken';
        evs.push({ round: gs.current_round, type: 'morale', message: `${u.name} end-of-round Shaken recovery: rolled ${moraleResult.roll} — ${moraleResult.passed ? 'recovered' : 'still shaken'}`, timestamp: new Date().toLocaleTimeString() });
        loggerRef.current?.logMorale({ round: gs.current_round, unit: u, outcome, roll: moraleResult.roll, qualityTarget: u.quality || 4, specialRulesApplied: moraleResult.specialRulesApplied || [], dmnReason: 'end-of-round shaken recovery (unit skipped by scheduler)' });
      }
    });

    // Deploy Ambush/reserve units
    gs.units.forEach(u => {
      if (u.is_in_reserve && u.current_models > 0) {
        const deployed = rules.deployAmbush(u, gs);
        if (deployed) {
          u.is_in_reserve = false;
          u._justDeployed = true;
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

    newState.units = newState.units.map(u => ({
      ...u,
      fatigued: false, just_charged: false,
      status: u.current_models <= 0 ? 'destroyed' : u.status,
    }));

    // Replenish spell tokens
    newState.units.forEach(u => {
      const gained = rules.replenishSpellTokens(u);
      if (gained > 0) {
        evs.push({ round: newRound, type: 'ability', message: `${u.name} gains ${gained} spell token(s) (now ${u.spell_tokens}/6 max)`, timestamp: new Date().toLocaleTimeString() });
        logger?.logAbility({ round: newRound, unit: u, ability: 'Caster', details: { tokens_gained: gained, tokens_total: u.spell_tokens } });
      }
    });

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

let aScore, bScore;
    if (isProgressiveScoring) {
      const cumulative = gs.cumulative_score || { agent_a: 0, agent_b: 0 };
      aScore = cumulative.agent_a + roundA;
      bScore = cumulative.agent_b + roundB;
    } else {
      aScore = roundA;
      bScore = roundB;
    }
    const winner = aScore > bScore ? 'agent_a' : bScore > aScore ? 'agent_b' : 'draw';

    const advRules = gs.advance_rules || {};
    const activeRuleKeys = Object.entries(advRules).filter(([, v]) => v).map(([k]) => k);
    logger?.setBattleConfig({
      scoring_mode: advRules.cumulativeScoring ? 'cumulative' : 'per_round',
      advance_rules: activeRuleKeys,
    });

    const finalScore = { agent_a: aScore, agent_b: bScore };
    logger?.logRoundSummary({ round: gs.current_round, objectives: gs.objectives, score: { agent_a: aScore, agent_b: bScore, mode: isProgressiveScoring ? 'progressive' : 'standard' } });
    logger?.logBattleEnd({ winner, finalScore });

    const log = logger?.getFullLog(winner, { agent_a: aScore, agent_b: bScore });
    setFullJsonLog(log);
    console.log('=== BATTLE JSON LOG ===', JSON.stringify(log, null, 2));

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

  // ─── LIVE NARRATIVE ─────────────────────────────────────────────────────────
  // (Unchanged)
  const startLiveNarrative = async () => { /* ... */ };
  const stopLiveNarrative = () => { /* ... */ };
  const generateCommentary = async () => { /* ... */ };

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
            <>
              <Button variant="outline" className="border-green-600 text-green-400 hover:bg-green-900/20" onClick={() => {
                const blob = new Blob([JSON.stringify(fullJsonLog, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `battle-log-${battle.id}.json`; a.click();
                URL.revokeObjectURL(url);
              }}>
                <Download className="w-4 h-4 mr-2" /> Download Log
              </Button>
              {/* Live Narrative */}
              <div className="flex items-center gap-1">
                <select
                  value={narrativeStyle}
                  onChange={e => setNarrativeStyle(e.target.value)}
                  className="bg-slate-800 border border-slate-600 text-slate-300 text-xs rounded px-2 py-1"
                >
                  <option value="dramatic">Dramatic</option>
                  <option value="tactical">Tactical</option>
                  <option value="humorous">Humorous</option>
                </select>
                {narrativeActive ? (
                  <Button variant="outline" className="border-yellow-600 text-yellow-400 hover:bg-yellow-900/20" onClick={stopLiveNarrative}>
                    ⏹ Stop Narrative
                  </Button>
                ) : (
                  <Button variant="outline" className="border-cyan-600 text-cyan-400 hover:bg-cyan-900/20" disabled={narrativeStreaming} onClick={startLiveNarrative}>
                    {narrativeStreaming ? '⏳ Loading...' : '🎙 Live Narrative'}
                  </Button>
                )}
              </div>
              <Button
                variant="outline"
                className="border-purple-600 text-purple-400 hover:bg-purple-900/20"
                disabled={generatingCommentary}
                onClick={generateCommentary}
              >
                {generatingCommentary ? '🔮 Generating...' : '🎬 Generate Commentary'}
              </Button>
            </>
          )}
          {/* Speed control */}
          <div className="flex items-center gap-2 text-slate-300 text-sm">
            <span>Speed:</span>
            {[{ label: 'Fast', ms: 300 }, { label: 'Normal', ms: 800 }, { label: 'Slow', ms: 2000 }].map(({ label, ms }) => (
              <Button
                key={ms}
                size="sm"
                variant={simulationSpeed === ms ? 'default' : 'outline'}
                className={simulationSpeed === ms ? 'bg-blue-700 text-white' : 'border-slate-600 text-slate-300'}
                onClick={() => setSimulationSpeed(ms)}
              >
                {label}
              </Button>
            ))}
          </div>
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
          {narrativeActive && (
            <div className="bg-slate-900 border border-cyan-800 rounded-lg p-3">
              <div className="text-cyan-400 text-xs font-semibold mb-2 flex items-center justify-between">
                <span>🎙 Live Narrative</span>
                {narrativeStreaming && <span className="text-slate-500 text-xs animate-pulse">Generating...</span>}
                {currentNarrativeIndex != null && !narrativeStreaming && (
                  <span className="text-slate-500 text-xs">#{currentNarrativeIndex + 1} / {activationSummaries.length}</span>
                )}
              </div>
              <NarrativeCommentaryBox
                text={currentNarrativeText}
                significance={currentNarrativeSignificance}
                round={currentNarrativeRound}
                unit={currentNarrativeUnit}
                isStreaming={narrativeStreaming && !currentNarrativeText}
              />
            </div>
          )}
          {commentary ? (
            <div className="bg-slate-900 border border-purple-700 rounded-lg p-3 flex flex-col overflow-y-auto" style={{ maxHeight: '500px' }}>
              <div className="text-purple-300 text-xs font-semibold mb-2">🎬 {commentary.title}</div>
              <div className="text-slate-300 text-xs mb-2 italic">{commentary.intro}</div>
              {commentary.rounds?.map(r => (
                <div key={r.round} className="mb-2">
                  <div className="text-yellow-400 text-xs font-bold">Round {r.round}: {r.headline}</div>
                  <div className="text-slate-300 text-xs">{r.commentary}</div>
                </div>
              ))}
              {commentary.turning_point && <div className="mb-2"><div className="text-red-400 text-xs font-bold">⚡ Turning Point</div><div className="text-slate-300 text-xs">{commentary.turning_point}</div></div>}
              {commentary.outro && <div><div className="text-green-400 text-xs font-bold">🏆 Result</div><div className="text-slate-300 text-xs">{commentary.outro}</div></div>}
              <Button size="sm" variant="outline" className="mt-2 border-slate-600 text-slate-400 text-xs" onClick={() => {
                const text = [commentary.title, '', commentary.intro, '', ...(commentary.rounds?.map(r => `Round ${r.round}: ${r.headline}\n${r.commentary}`) || []), '', `TURNING POINT: ${commentary.turning_point}`, '', commentary.outro].join('\n');
                navigator.clipboard.writeText(text);
              }}>Copy Script</Button>
            </div>
          ) : generatingCommentary ? (
            <div className="bg-slate-900 border border-purple-700 rounded-lg p-6 flex items-center justify-center">
              <div className="text-purple-300 text-sm">🔮 Generating battle commentary...</div>
            </div>
          ) : fullJsonLog ? (
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 flex flex-col" style={{ maxHeight: '500px' }}>
              <div className="text-slate-300 text-xs font-semibold mb-2">Battle JSON Log</div>
              <textarea readOnly className="flex-1 bg-slate-800 text-green-300 text-xs font-mono rounded p-2 resize-none outline-none border border-slate-600" style={{ minHeight: '380px' }} value={JSON.stringify(fullJsonLog, null, 2)} onFocus={e => e.target.select()} />
            </div>
          ) : (
            <ActionLog events={events} />
          )}
        </div>
      </div>
    </div>
  );
}
