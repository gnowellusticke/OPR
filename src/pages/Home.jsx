import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Swords, Zap, Download } from "lucide-react";
import ArmyUploader from '../components/army/ArmyUploader';
import { base44 } from "@/api/base44Client";


export default function Home() {
  const navigate = useNavigate();
  const [armyA, setArmyA] = useState(null);
  const [armyB, setArmyB] = useState(null);
  const [creating, setCreating] = useState(false);

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

  const downloadExampleArmy = () => {
    const example = {
      name: "Example Space Marines",
      faction: "Space Marines",
      units: [
        {
          name: "Captain",
          quality: 3,
          defense: 3,
          models: 1,
          total_models: 1,
          points: 100,
          weapons: [
            { name: "Plasma Pistol", range: 12, attacks: 2, ap: -2 },
            { name: "Power Sword", range: 1, attacks: 3, ap: -1 }
          ],
          special_rules: ["Hero", "Fearless"]
        },
        {
          name: "Tactical Squad",
          quality: 4,
          defense: 4,
          models: 10,
          total_models: 10,
          points: 150,
          weapons: [
            { name: "Bolters", range: 18, attacks: 1, ap: 0 }
          ],
          special_rules: []
        },
        {
          name: "Devastator Squad",
          quality: 4,
          defense: 4,
          models: 5,
          total_models: 5,
          points: 120,
          weapons: [
            { name: "Heavy Bolters", range: 36, attacks: 3, ap: -1 }
          ],
          special_rules: ["Relentless"]
        }
      ]
    };
    
    const blob = new Blob([JSON.stringify(example, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'example_army.json';
    a.click();
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
                <strong className="text-white">Upload Army Lists:</strong> Provide JSON files for both armies with units, weapons, and stats
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

        {/* Example Download */}
        <div className="flex justify-center">
          <Button 
            variant="outline" 
            onClick={downloadExampleArmy}
            className="border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Example Army List
          </Button>
        </div>

        {/* Army Uploaders */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <ArmyUploader 
            label="Agent A Army (Blue)" 
            color="blue"
            onArmyUploaded={setArmyA}
          />
          <ArmyUploader 
            label="Agent B Army (Red)" 
            color="red"
            onArmyUploaded={setArmyB}
          />
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