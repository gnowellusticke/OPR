import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Swords, Zap } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { ArmyTextParser } from '../components/army/ArmyTextParser';
import { base44 } from "@/api/base44Client";


export default function Home() {
  const navigate = useNavigate();
  const [armyA, setArmyA] = useState(null);
  const [armyB, setArmyB] = useState(null);
  const [creating, setCreating] = useState(false);
  const [armyTextA, setArmyTextA] = useState('');
  const [armyTextB, setArmyTextB] = useState('');
  const [errorA, setErrorA] = useState('');
  const [errorB, setErrorB] = useState('');

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
      // Create battle
      const battle = await base44.entities.Battle.create({
        army_a_id: armyA.id,
        army_b_id: armyB.id,
        status: 'setup',
        current_round: 0,
        game_state: {
          units: [],
          terrain: [],
          objectives: [],
          active_agent: 'agent_a'
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