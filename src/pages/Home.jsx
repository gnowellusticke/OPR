import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Swords, Zap, ChevronDown, ChevronRight } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { ArmyTextParser } from '../components/army/ArmyTextParser';
import { base44 } from "@/api/base44Client";
import RulesReference from '../components/rules/RulesReference';
import PersonalityPicker from '../components/battle/PersonalityPicker';
import { PERSONALITIES, getRandomPersonality, DEFAULT_PERSONALITY } from '../components/engine/personalities/PersonalityRegistry';


export default function Home() {
  const navigate = useNavigate();
  const [armyA, setArmyA] = useState(null);
  const [armyB, setArmyB] = useState(null);
  const [creating, setCreating] = useState(false);
  const [armyTextA, setArmyTextA] = useState('');
  const [armyTextB, setArmyTextB] = useState('');
  const [errorA, setErrorA] = useState('');
  const [errorB, setErrorB] = useState('');
  const [advanceRulesOpen, setAdvanceRulesOpen] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState('city_fight');
  const [advanceRules, setAdvanceRules] = useState({
    cumulativeScoring: false,
    scoutingDeployment: false,
    overrun: false,
    heroicActions: false,
  });
  const [personalityA, setPersonalityA] = useState(DEFAULT_PERSONALITY.id);
  const [personalityB, setPersonalityB] = useState(DEFAULT_PERSONALITY.id);

  const MAP_THEMES = [
    { key: 'city_fight', label: '🏙 City Fight', desc: 'Dense urban terrain — ruins, solid buildings, barricades, and open walls create tight lanes of fire.' },
    { key: 'forest', label: '🌲 Forest', desc: 'Heavy woodland — forests and hills dominate with scattered ruins and ponds.' },
    { key: 'wasteland', label: '🌋 Wasteland', desc: 'Open ground with craters, vehicle wreckage, and scattered barricades.' },
    { key: 'mixed', label: '⚔️ Mixed', desc: 'Balanced terrain mix — good for competitive play.' },
  ];

  const toggleAdvanceRule = (key) => setAdvanceRules(prev => ({ ...prev, [key]: !prev[key] }));

  const handlePersonalityA = (id) => {
    setPersonalityA(id);
    if (id === personalityB) {
      const others = PERSONALITIES.filter(p => p.id !== id);
      setPersonalityB(others[Math.floor(Math.random() * others.length)].id);
    }
  };

  const handlePersonalityB = (id) => {
    setPersonalityB(id);
    if (id === personalityA) {
      const others = PERSONALITIES.filter(p => p.id !== id);
      setPersonalityA(others[Math.floor(Math.random() * others.length)].id);
    }
  };

  const handleParseArmy = async (text, setArmy, setError) => {
    setError('');
    try {
      const parsed = ArmyTextParser.parse(text);
      const army = await base44.entities.ArmyList.create(parsed);
      setArmy(army);
    } catch (err) {
      setError(err.message || 'Failed to parse army list');
    }
  };

  const handleStartBattle = async () => {
    if (!armyA || !armyB) return;
    
    setCreating(true);
    try {
      const activeRules = Object.entries(advanceRules)
        .filter(([, v]) => v)
        .map(([k]) => k);

      const battle = await base44.entities.Battle.create({
        army_a_id: armyA.id,
        army_b_id: armyB.id,
        status: 'setup',
        current_round: 0,
        game_state: {
          units: [],
          terrain: [],
          objectives: [],
          active_agent: 'agent_a',
          advance_rules: advanceRules,
          map_theme: selectedTheme,
        },
        event_log: []
      });
      
      navigate(`/Battle?id=${battle.id}`);
    } catch (err) {
      console.error('Failed to create battle:', err);
    } finally {
      setCreating(false);
    }
  };



  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="text-center space-y-3 sm:space-y-4">
          <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
            <Swords className="w-8 h-8 sm:w-12 sm:h-12 text-blue-500" />
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white">
              Grimdark Future AI Battle Simulator
            </h1>
            <Swords className="w-8 h-8 sm:w-12 sm:h-12 text-red-500" />
          </div>
          <p className="text-slate-400 text-sm sm:text-base lg:text-lg px-4">
            Watch two AI agents battle using BPMN, DMN, and CMMN frameworks
          </p>
        </div>

        {/* Info Card */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 text-base sm:text-lg">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm sm:text-base text-slate-300">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-900/50 border border-blue-600 flex items-center justify-center flex-shrink-0 text-blue-400 font-bold">
                1
              </div>
              <div>
                <strong className="text-white">Paste Army Lists:</strong> Provide text army lists for both armies with units, weapons, and stats
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-900/50 border border-blue-600 flex items-center justify-center flex-shrink-0 text-blue-400 font-bold">
                2
              </div>
              <div>
                <strong className="text-white">BPMN Engine:</strong> Controls game flow through preparation, deployment, and combat rounds
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-900/50 border border-blue-600 flex items-center justify-center flex-shrink-0 text-blue-400 font-bold">
                3
              </div>
              <div>
                <strong className="text-white">DMN Decision Tables:</strong> AI agents evaluate tactical options and select optimal actions
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-900/50 border border-blue-600 flex items-center justify-center flex-shrink-0 text-blue-400 font-bold">
                4
              </div>
              <div>
                <strong className="text-white">CMMN Case Management:</strong> Handles complex game states like morale, fatigue, and melee resolution
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Army Input Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-base sm:text-lg">Army A (Blue)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Paste army list text here..."
                value={armyTextA}
                onChange={(e) => setArmyTextA(e.target.value)}
                className="min-h-[200px] bg-slate-900/50 border-slate-600 text-white font-mono text-xs sm:text-sm"
              />
              <Button
                onClick={() => handleParseArmy(armyTextA, setArmyA, setErrorA)}
                disabled={!armyTextA.trim() || !!armyA}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {armyA ? '✓ Army Loaded' : 'Parse Army List'}
              </Button>
              {errorA && <p className="text-red-400 text-sm">{errorA}</p>}
              {armyA && (
                <div className="text-slate-300 text-sm bg-slate-900/50 p-3 rounded border border-slate-700">
                  <p className="font-semibold text-white">{armyA.name}</p>
                  <p>{armyA.total_points} pts - {armyA.units.length} units</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-base sm:text-lg">Army B (Red)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Paste army list text here..."
                value={armyTextB}
                onChange={(e) => setArmyTextB(e.target.value)}
                className="min-h-[200px] bg-slate-900/50 border-slate-600 text-white font-mono text-xs sm:text-sm"
              />
              <Button
                onClick={() => handleParseArmy(armyTextB, setArmyB, setErrorB)}
                disabled={!armyTextB.trim() || !!armyB}
                className="w-full bg-red-600 hover:bg-red-700"
              >
                {armyB ? '✓ Army Loaded' : 'Parse Army List'}
              </Button>
              {errorB && <p className="text-red-400 text-sm">{errorB}</p>}
              {armyB && (
                <div className="text-slate-300 text-sm bg-slate-900/50 p-3 rounded border border-slate-700">
                  <p className="font-semibold text-white">{armyB.name}</p>
                  <p>{armyB.total_points} pts - {armyB.units.length} units</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Map Theme Selector */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-base sm:text-lg">🗺 Battle Map Theme</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MAP_THEMES.map(({ key, label, desc }) => (
              <button
                key={key}
                onClick={() => setSelectedTheme(key)}
                className={`text-left p-3 rounded-lg border-2 transition-colors ${selectedTheme === key ? 'border-yellow-500 bg-yellow-500/10' : 'border-slate-600 bg-slate-900/40 hover:border-slate-400'}`}
              >
                <p className="text-white font-semibold text-sm">{label}</p>
                <p className="text-slate-400 text-xs mt-1">{desc}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Advance Rules */}
        <Card className="bg-slate-800/50 border-slate-700">
          <button
            className="w-full flex items-center justify-between px-6 py-4 text-left"
            onClick={() => setAdvanceRulesOpen(o => !o)}
          >
            <span className="text-white font-semibold text-base sm:text-lg flex items-center gap-2">
              ⚔️ Advance Rules <span className="text-slate-400 font-normal text-sm">(optional)</span>
            </span>
            {advanceRulesOpen ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
          </button>
          {advanceRulesOpen && (
            <CardContent className="pt-0 space-y-4 border-t border-slate-700">
              {[
                {
                  key: 'cumulativeScoring',
                  label: 'Cumulative Scoring',
                  desc: 'Victory Points accumulate each round instead of resetting. A 2–0 round followed by a 1–1 round gives A: 3 pts, B: 1 pt total.'
                },
                {
                  key: 'scoutingDeployment',
                  label: 'Scouting Deployment',
                  desc: 'Units with the Scout rule may deploy anywhere on the table before Round 1, as long as they stay 12"+ from all enemies.'
                },
                {
                  key: 'overrun',
                  label: 'Overrun',
                  desc: 'After destroying an enemy in melee, the attacker may immediately move up to 3" in any direction.'
                },
                {
                  key: 'heroicActions',
                  label: 'Heroic Actions',
                  desc: 'Hero units (Tough(X)) may use one Heroic Action per battle to re-roll all dice for a single action.'
                },
              ].map(({ key, label, desc }) => (
                <label key={key} className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative mt-0.5">
                    <input
                      type="checkbox"
                      checked={advanceRules[key]}
                      onChange={() => toggleAdvanceRule(key)}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${advanceRules[key] ? 'bg-yellow-500 border-yellow-500' : 'border-slate-500 bg-slate-800 group-hover:border-yellow-500'}`}>
                      {advanceRules[key] && <span className="text-black text-xs font-bold">✓</span>}
                    </div>
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{label}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{desc}</p>
                  </div>
                </label>
              ))}
            </CardContent>
          )}
        </Card>

        {/* Rules Reference */}
        <RulesReference />

        {/* Start Button */}
        <div className="flex justify-center pt-4">
          <Button
            size="lg"
            disabled={!armyA || !armyB || creating}
            onClick={handleStartBattle}
            className="bg-gradient-to-r from-blue-600 to-red-600 hover:from-blue-700 hover:to-red-700 text-white px-6 sm:px-12 py-4 sm:py-6 text-base sm:text-xl w-full sm:w-auto"
          >
            {creating ? (
              <>
                <div className="animate-spin w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full mr-2 sm:mr-3" />
                <span className="hidden sm:inline">Preparing Battle...</span>
                <span className="sm:hidden">Preparing...</span>
              </>
            ) : (
              <>
                <Swords className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3" />
                <span className="hidden sm:inline">Start Battle Simulation</span>
                <span className="sm:hidden">Start Battle</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}