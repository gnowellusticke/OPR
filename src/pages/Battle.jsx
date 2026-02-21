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

  useEffect(() => { loadBattle(); }, []);

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

    const battleData = await base44.entities.Battle.get(id);
    const armyA = await base44.entities.ArmyList.get(battleData.army_a_id);
    const armyB = await base44.entities.ArmyList.get(battleData.army_b_id);

    await dmnRef.current.loadLearningData(battleData.army_a_id);

    const logger = new BattleLogger(battleData.id, armyA, armyB);
    loggerRef.current = logger;
    battleRef.current = { ...battleData, armyAName: armyA.name, armyBName: armyB.name };
    setBattle(battleRef.current);

    if (battleData.status === 'setup') {
      await initializeBattle(battleData, armyA, armyB, logger);
    } else {
      commitState(battleData.game_state, battleData.event_log || []);
    }
  };

  // ─── INIT ────────────────────────────────────────────────────────────────────

  const initializeBattle = async (battleData, armyA, armyB, logger) => {
    const terrain = generateTerrain();
    const objectives = generateObjectives();
    const advRules = battleData.game_state?.advance_rules || {};
    const units = deployArmies(armyA, armyB, advRules);

    // Wire advance_rules into logger header immediately
    const activeRuleKeys = Object.entries(advRules).filter(([, v]) => v).map(([k]) => k);
    logger.setBattleConfig({
      scoring_mode: advRules.cumulativeScoring ? 'cumulative' : 'per_round',
      advance_rules: activeRuleKeys,
    });

    // Run alternating deployment phase (mutates unit positions, logs coin toss + deploy events)
    const { firstActivation } = runDeploymentPhase(units, objectives, terrain, logger);

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

  const generateTerrain = () => {
    const terrain = [];
    let attempts = 0;
    while (terrain.length < 8 && attempts < 50) {
      const t = { type: Math.random() > 0.5 ? 'cover' : 'difficult', x: Math.random() * 60 + 6, y: Math.random() * 36 + 6, width: 6 + Math.random() * 6, height: 6 + Math.random() * 6 };
      if (!terrain.some(e => t.x < e.x + e.width && t.x + t.width > e.x && t.y < e.y + e.height && t.y + t.height > e.y)) terrain.push(t);
      attempts++;
    }
    return terrain;
  };

  const generateObjectives = () => {
    const objectives = [];
    const count = Math.floor(Math.random() * 3) + 3;
    while (objectives.length < count) {
      for (let a = 0; a < 100; a++) {
        const o = { x: Math.random() * 54 + 9, y: Math.random() * 18 + 15, controlled_by: null };
        if (!objectives.some(e => Math.hypot(o.x - e.x, o.y - e.y) < 9)) { objectives.push(o); break; }
      }
      if (objectives.length < count && objectives.length === objectives.length) break; // safety
    }
    return objectives;
  };

  // ─── DEPLOY ──────────────────────────────────────────────────────────────────

  const computeWounds = (unit) => {
    const toughMatch = unit.special_rules?.match(/Tough\((\d+)\)/);
    const toughValue = toughMatch ? parseInt(toughMatch[1]) : 0;
    const isHero = unit.special_rules?.toLowerCase().includes('hero');
    if (isHero && toughValue > 0) return Math.max(0, unit.models - 1) + toughValue;
    if (toughValue > 0) return toughValue;
    return unit.models;
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
  const ranged_weapons = (unit.weapons || []).filter(w => (w.range ?? 2) > 2);
  // Placeholder positions — real positions set during alternating deployment phase
  return {
  ...unit,
  id: `${owner === 'agent_a' ? 'a' : 'b'}_${id++}`,
  owner,
  x: owner === 'agent_a' ? 10 : 60,
  y: owner === 'agent_a' ? 10 : 38,
  current_models: maxWounds, total_models: maxWounds,
  status: 'normal', fatigued: false, just_charged: false, rounds_without_offense: 0,
  melee_weapon_name: resolveMeleeWeaponName(unit),
  ranged_weapons,
  heroic_action_used: false,
  is_scout: isScout,
  is_in_reserve: isAmbush,
  };
  });

  const aUnits = disambiguateUnitNames(build(armyA, 'agent_a'));
  const bUnits = disambiguateUnitNames(build(armyB, 'agent_b'));
  return [...aUnits, ...bUnits];
  };

  // Alternating deployment phase — one unit per agent per turn, with DMN placement decisions
  const runDeploymentPhase = (units, objectives, terrain, logger) => {
  const dmn = dmnRef.current;

  // Coin toss
  const tossWinner = Math.random() > 0.5 ? 'agent_a' : 'agent_b';
  const tossLoser = tossWinner === 'agent_a' ? 'agent_b' : 'agent_a';
  // Winner almost always deploys second (activates first R1) unless majority are reserve units
  const winnerReserveCount = units.filter(u => u.owner === tossWinner && u.is_in_reserve).length;
  const winnerTotal = units.filter(u => u.owner === tossWinner).length;
  const preferDeployFirst = winnerReserveCount / Math.max(winnerTotal, 1) > 0.5;
  const winnerChoice = preferDeployFirst ? 'deploy_first' : 'deploy_second';
  const deployFirst = winnerChoice === 'deploy_first' ? tossWinner : tossLoser;
  const deploySecond = deployFirst === tossWinner ? tossLoser : tossWinner;
  const firstActivation = deploySecond; // who finishes deploying last activates first

  logger?.logCoinToss({
  winner: tossWinner,
  choice: winnerChoice,
  reason: `${tossWinner} wins toss and chooses to ${winnerChoice === 'deploy_second' ? 'deploy second, activating first in Round 1' : 'deploy first for faster board control'}`,
  firstActivation
  });

  // Separate and interleave: deployFirst's units then deploySecond's, alternating
  const queueA = units.filter(u => u.owner === deployFirst);
  const queueB = units.filter(u => u.owner === deploySecond);
  const order = [];
  const maxLen = Math.max(queueA.length, queueB.length);
  for (let i = 0; i < maxLen; i++) {
  if (i < queueA.length) order.push(queueA[i]);
  if (i < queueB.length) order.push(queueB[i]);
  }

  const deployedByOwner = { agent_a: [], agent_b: [] };
  const summaryDeployed = { agent_a: [], agent_b: [], reserves: [] };

  for (const unit of order) {
  const isAgentA = unit.owner === 'agent_a';
  const myDeployed = deployedByOwner[unit.owner];
  const enemyDeployed = deployedByOwner[unit.owner === 'agent_a' ? 'agent_b' : 'agent_a'];

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
  const decision = dmn.decideDeployment(unit, isAgentA, enemyDeployed, myDeployed, objectives, terrain);
  unit.x = decision.x;
  unit.y = decision.y;
  myDeployed.push({ x: unit.x, y: unit.y, name: unit.name, special_rules: unit.special_rules });
  (isAgentA ? summaryDeployed.agent_a : summaryDeployed.agent_b).push(unit.name);
  logger?.logDeploy({
    unit,
    zone: decision.zone,
    deploymentType: 'standard',
    dmnReason: decision.dmnReason,
    specialRulesApplied: decision.specialRulesApplied
  });
  }
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
    const gs = gsRef.current;
    const bat = battleRef.current;
    if (!gs || !bat || bat.status === 'completed') return;

    const activated = gs.units_activated || [];

    // All living units not yet activated this round (exclude units still in reserve)
    const remaining = gs.units.filter(u =>
      u.current_models > 0 &&
      u.status !== 'destroyed' && u.status !== 'routed' &&
      !activated.includes(u.id) &&
      !u.is_in_reserve
    );

    if (remaining.length === 0) {
      // Validation: emit warning for any unit that had models but 0 activations (ghost check)
      await endRound(gs);
      return;
    }

    // Alternate activations: pick from active_agent; if none left, switch
    const agentRemaining = remaining.filter(u => u.owner === gs.active_agent);
    const otherRemaining = remaining.filter(u => u.owner !== gs.active_agent);

    let unit;
    if (agentRemaining.length > 0) {
      unit = agentRemaining[0];
    } else {
      // Current agent exhausted — flip and take from other
      const flipped = gs.active_agent === 'agent_a' ? 'agent_b' : 'agent_a';
      const flippedRemaining = otherRemaining.filter(u => u.owner === flipped);
      if (flippedRemaining.length === 0) { await endRound(gs); return; }
      unit = flippedRemaining[0];
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

    // ── Shaken recovery ──────────────────────────────────────────────────────
    let canAct = true;
    if (liveUnit.status === 'shaken') {
      const quality = liveUnit.quality || 4;
      const roll = rules.dice.roll();
      const recovered = roll >= quality;
      if (recovered) liveUnit.status = 'normal';
      else canAct = false;
      evs.push({ round, type: 'morale', message: `${liveUnit.name} Shaken recovery: ${roll} vs ${quality}+ — ${recovered ? 'recovered' : 'still shaken'}`, timestamp: new Date().toLocaleTimeString() });
      logger?.logMorale({ round, unit: liveUnit, outcome: recovered ? 'recovered' : 'failed', roll, qualityTarget: quality, dmnReason: 'shaken recovery' });
    }

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
    if (!canAct && (selectedAction === 'Charge')) selectedAction = 'Advance';

    setCurrentDecision({
      unit: liveUnit, options, dmn_phase: 'Action Selection',
      reasoning: `${liveUnit.name} at (${liveUnit.x.toFixed(0)},${liveUnit.y.toFixed(0)}) → ${selectedAction}`
    });

    await new Promise(r => setTimeout(r, 300));
    await executeAction(liveUnit, selectedAction, canAct, gs, evs);

    // ── Overrun (Advance Rule) ────────────────────────────────────────────────
    // (handled inside executeAction after melee kill)

    // ── Mark activated, flip agent ────────────────────────────────────────────
    const nextAgent = liveUnit.owner === 'agent_a' ? 'agent_b' : 'agent_a';
    const updatedGs = {
      ...gsRef.current, // use ref — executeAction may have mutated it
      units_activated: [...(gsRef.current.units_activated || []), liveUnit.id],
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
    const dmnReason = topOption ? `${topOption.action} scored ${topOption.score.toFixed(2)}` : action;

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
      evs.push({ round, type: 'movement', message: `${unit.name} charges ${target.name}!`, timestamp: new Date().toLocaleTimeString() });
      logger?.logMove({ round, actingUnit: unit, action: 'Charge', distance: null, zone, dmnReason, chargeTarget: target.name });
      // Guard: if charger somehow died before melee (should not happen — no overwatch in OPR), skip melee
      if (unit.current_models <= 0 || unit.status === 'destroyed') {
        evs.push({ round, type: 'warning', message: `${unit.name} destroyed before melee — skipping combat`, timestamp: new Date().toLocaleTimeString() });
      } else {
        // Also guard: target may have been killed by earlier events this activation
        const liveTarget = gs.units.find(u => u.id === target.id);
        if (!liveTarget || liveTarget.current_models <= 0) {
          evs.push({ round, type: 'movement', message: `${unit.name} charge target ${target.name} already destroyed — no melee`, timestamp: new Date().toLocaleTimeString() });
        } else {
          const killedTarget = await resolveMelee(unit, liveTarget, gs, evs, dmnReason);
      unit.rounds_without_offense = 0;

        // Overrun (Advance Rule)
        if (killedTarget && gs.advance_rules?.overrun) {
          const dx = (Math.random() - 0.5) * 6;
          const dy = (Math.random() - 0.5) * 6;
          unit.x = Math.max(2, Math.min(70, unit.x + dx));
          unit.y = Math.max(2, Math.min(46, unit.y + dy));
          evs.push({ round, type: 'ability', message: `${unit.name} Overrun — moved 3" after kill`, timestamp: new Date().toLocaleTimeString() });
          logger?.logAbility({ round, unit, ability: 'Overrun', details: { dx: dx.toFixed(1), dy: dy.toFixed(1) } });
        }
        } // end liveTarget guard
        } // end charger alive guard
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

  // ─── SHOOTING ─────────────────────────────────────────────────────────────────
  // Iterates unit.ranged_weapons exactly once — one shoot event per distinct weapon,
  // never the same weapon twice. Blast(X) uses X automatic hits with no quality roll.

  const attemptShooting = async (unit, gs, evs, dmnReason) => {
  const round = gs.current_round;
  const dmn = dmnRef.current;
  const rules = rulesRef.current;
  const logger = loggerRef.current;
  let shotFired = false;

  // Deduplicate weapons by name to guarantee one event per distinct weapon, not per attack
  const seen = new Set();
  const rangedWeapons = (unit.weapons || []).filter(w => {
  if ((w.range ?? 2) <= 2) return false;
  if (seen.has(w.name)) return false;
  seen.add(w.name);
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

      const dist = rules.calculateDistance(unit, target);
      if (dist > weapon.range) continue;

      // ── Blast(X): X automatic hits, no quality roll ────────────────────────
      const blastMatch = weapon.special_rules?.match(/Blast\((\d+)\)/);
      const isBlast = !!blastMatch;
      const blastCount = isBlast ? parseInt(blastMatch[1]) : 0;

      let result;
      if (isBlast) {
        // Override weapon attacks to blastCount and resolve — RulesEngine.rollToHit
        // already handles Blast by returning blastCount auto-hits when it detects the rule,
        // but we also force attacks = blastCount here for clarity in the log.
        const blastWeapon = { ...weapon, attacks: blastCount };
        result = rules.resolveShooting(unit, target, blastWeapon, gs.terrain, gs);
        // Ensure logged values reflect X attacks / X hits regardless of RulesEngine internals
        result = { ...result, hits: blastCount };
      } else {
        result = rules.resolveShooting(unit, target, weapon, gs.terrain, gs);
      }

      const loggedAttacks = isBlast ? blastCount : (weapon.attacks || 1);
      const woundsDealt = result.wounds;
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
      evs.push({
        round, type: 'combat',
        message: `${unit.name} fires ${weaponLabel} at ${target.name}: ${result.hits} hits, ${result.saves} saves, ${woundsDealt} wounds`,
        timestamp: new Date().toLocaleTimeString()
      });

      if (target.current_models <= 0) {
        evs.push({ round, type: 'combat', message: `${target.name} destroyed!`, timestamp: new Date().toLocaleTimeString() });
        logger?.logDestruction({ round, unit: target, cause: `shooting by ${unit.name} (${weaponLabel})` });
      }

      const topScore = liveEnemies.map(e => dmn.scoreTarget(unit, e)).sort((a, b) => b - a)[0]?.toFixed(2);
      logger?.logShoot({
        round, actingUnit: unit, targetUnit: target,
        weapon: weapon.name,
        zone: rules.getZone(unit.x, unit.y), rangeDist: dist,
        rollResults: {
          attacks: loggedAttacks,
          hits: result.hits,
          saves: result.saves,
          wounds_dealt: woundsDealt,
          blast: isBlast,
          special_rules_applied: result.specialRulesApplied || []
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
          logger?.logMorale({ round, unit: target, outcome, roll: moraleResult.roll, qualityTarget: target.quality || 4 });
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

    const result = rules.resolveMelee(attacker, defender, gs);

    defender.current_models = Math.max(0, defender.current_models - result.attacker_wounds);
    attacker.current_models = Math.max(0, attacker.current_models - result.defender_wounds);
    if (defender.current_models <= 0) defender.status = 'destroyed';
    if (attacker.current_models <= 0) attacker.status = 'destroyed';

    evs.push({ round, type: 'combat', message: `⚔ ${attacker.name} vs ${defender.name} — dealt ${result.attacker_wounds}, took ${result.defender_wounds}`, timestamp: new Date().toLocaleTimeString() });

    if (defender.current_models <= 0) {
      evs.push({ round, type: 'combat', message: `${defender.name} destroyed in melee!`, timestamp: new Date().toLocaleTimeString() });
      logger?.logDestruction({ round, unit: defender, cause: `melee with ${attacker.name}` });
    }
    if (attacker.current_models <= 0) {
      evs.push({ round, type: 'combat', message: `${attacker.name} destroyed in melee!`, timestamp: new Date().toLocaleTimeString() });
      logger?.logDestruction({ round, unit: attacker, cause: `melee with ${defender.name}` });
    }

    // Use stored melee_weapon_name (never 'CCW') — falls back to Fists
    const atkWpnName = attacker.melee_weapon_name && attacker.melee_weapon_name !== 'CCW' ? attacker.melee_weapon_name : 'Fists';
    const aRes = result.attacker_results?.results?.[0];
    const dRes = result.defender_results?.results?.[0];
    logger?.logMelee({
      round, actingUnit: attacker, targetUnit: defender,
      weaponName: atkWpnName,
      rollResults: {
        attacker_attacks: aRes?.attacks || 1, attacker_hits: aRes?.hits ?? 0,
        defender_saves_made: aRes?.saves ?? 0, wounds_dealt: result.attacker_wounds,
        wounds_taken: result.defender_wounds
      },
      gameState: gs, dmnReason
    });

    // Morale on loser
    const loser = result.winner === attacker ? defender : (result.winner === defender ? attacker : null);
    if (loser && loser.current_models > 0 && loser.status === 'normal') {
      const moraleResult = rules.checkMorale(loser, 'melee_loss');
      const outcome = rules.applyMoraleResult(loser, moraleResult.passed, 'melee_loss');
      evs.push({ round, type: 'morale', message: `${loser.name} ${outcome} after melee loss (roll: ${moraleResult.roll})`, timestamp: new Date().toLocaleTimeString() });
      logger?.logMorale({ round, unit: loser, outcome, roll: moraleResult.roll, qualityTarget: loser.quality || 4 });
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

    // Validation pass: every unit alive at round start must have had exactly one activation.
    // Log a structured warning event for any that were missed (scheduling bug detection).
    const liveUnits = gs.units.filter(u => u.current_models > 0 && u.status !== 'destroyed' && u.status !== 'routed' && !u.is_in_reserve);
    const activated = gs.units_activated || [];
    const notActivated = liveUnits.filter(u => !activated.includes(u.id));
    notActivated.forEach(u => {
      evs.push({ round: gs.current_round, type: 'warning', message: `⚠ SCHEDULING: ${u.name} (${u.owner}) had no activation in round ${gs.current_round}`, timestamp: new Date().toLocaleTimeString() });
      loggerRef.current?.logAbility({ round: gs.current_round, unit: u, ability: 'scheduling_warning', details: { reason: 'no_activation_this_round' } });
    });

    // Deploy Ambush units from reserve at the start of each new round
    gs.units.forEach(u => {
      if (u.is_in_reserve && u.current_models > 0) {
        const deployed = rules.deployAmbush(u, gs);
        if (deployed) {
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

    // Reset per-round flags, clear shaken
    newState.units = newState.units.map(u => ({
      ...u,
      fatigued: false, just_charged: false,
      status: u.current_models <= 0 ? 'destroyed' : (u.status === 'shaken' ? 'normal' : u.status),
    }));

    // Regeneration / Self-Repair / Repair
    const REGEN_RULES = ['Regeneration', 'Self-Repair', 'Repair'];
    newState.units.forEach(u => {
      const rule = REGEN_RULES.find(r => u.special_rules?.includes(r));
      if (u.current_models > 0 && rule && u.current_models < u.total_models) {
        const { recovered, roll } = rules.applyRegeneration(u);
        evs.push({ round: gs.current_round, type: 'regen', message: `${u.name} ${rule}: roll ${roll} — ${recovered ? 'recovered 1 wound' : 'no recovery'}`, timestamp: new Date().toLocaleTimeString() });
        logger?.logRegeneration({ round: gs.current_round, unit: u, recovered, roll, ruleName: rule });
      }
    });

    // Objectives
    rules.updateObjectives(newState);
    const roundA = newState.objectives.filter(o => o.controlled_by === 'agent_a').length;
    const roundB = newState.objectives.filter(o => o.controlled_by === 'agent_b').length;
    const isCumulative = newState.advance_rules?.cumulativeScoring;
    const prevScore = newState.cumulative_score || { agent_a: 0, agent_b: 0 };
    if (isCumulative) {
      newState.cumulative_score = { agent_a: prevScore.agent_a + roundA, agent_b: prevScore.agent_b + roundB };
    }
    // Round summary always shows both per-round and running totals when cumulative is enabled
    const scoreToLog = isCumulative
      ? { agent_a: newState.cumulative_score.agent_a, agent_b: newState.cumulative_score.agent_b, this_round_a: roundA, this_round_b: roundB, mode: 'cumulative' }
      : { agent_a: roundA, agent_b: roundB, mode: 'per_round' };

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
    const isCumulative = gs.advance_rules?.cumulativeScoring;
    const roundA = gs.objectives.filter(o => o.controlled_by === 'agent_a').length;
    const roundB = gs.objectives.filter(o => o.controlled_by === 'agent_b').length;
    // Final cumulative score = running total (already includes all previous rounds) + this round
    const finalCumA = (gs.cumulative_score?.agent_a || 0) + roundA;
    const finalCumB = (gs.cumulative_score?.agent_b || 0) + roundB;
    const aScore = isCumulative ? finalCumA : roundA;
    const bScore = isCumulative ? finalCumB : roundB;
    const winner = aScore > bScore ? 'agent_a' : bScore > aScore ? 'agent_b' : 'draw';

    // Bake battle_config into logger — scoring_mode + full advance_rules key list
    const advRules = gs.advance_rules || {};
    const activeRuleKeys = Object.entries(advRules).filter(([, v]) => v).map(([k]) => k);
    logger?.setBattleConfig({
      scoring_mode: advRules.cumulativeScoring ? 'cumulative' : 'per_round',
      advance_rules: activeRuleKeys,   // top-level array of all enabled rule keys
    });

    logger?.logRoundSummary({ round: gs.current_round, objectives: gs.objectives, score: { agent_a: aScore, agent_b: bScore } });
    logger?.logBattleEnd({ winner, finalScore: { agent_a: aScore, agent_b: bScore } });

    const log = logger?.getFullLog(winner, { agent_a: aScore, agent_b: bScore });
    setFullJsonLog(log);
    console.log('=== BATTLE JSON LOG ===');
    console.log(JSON.stringify(log, null, 2));

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
        <div className="text-white text-lg">Loading battle...</div>
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