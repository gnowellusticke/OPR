import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, Users, Flag } from "lucide-react";

export default function GameStatePanel({ battle, gameState, armyAName, armyBName }) {
  if (!gameState) return null;

  const agentAScore = gameState.objectives?.filter(o => o.controlled_by === 'agent_a').length || 0;
  const agentBScore = gameState.objectives?.filter(o => o.controlled_by === 'agent_b').length || 0;

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-white flex items-center gap-2">
          <Flag className="w-5 h-5" />
          Game State
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Round */}
        <div>
          <div className="text-slate-400 text-sm mb-1">Round</div>
          <div className="text-2xl font-bold text-white">
            {gameState.current_round} / 4
          </div>
        </div>

        {/* Active Player */}
        <div>
          <div className="text-slate-400 text-sm mb-1">Active Player</div>
          <Badge className={gameState.active_agent === 'agent_a' ? 'bg-blue-600' : 'bg-red-600'}>
            {gameState.active_agent === 'agent_a' ? 'Agent A' : 'Agent B'}
          </Badge>
        </div>

        {/* Objectives */}
        <div>
          <div className="text-slate-400 text-sm mb-2 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Objectives Controlled
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-blue-400 font-semibold">Agent A</span>
              <span className="text-white text-lg font-bold">{agentAScore}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-red-400 font-semibold">Agent B</span>
              <span className="text-white text-lg font-bold">{agentBScore}</span>
            </div>
          </div>
        </div>

        {/* Units Remaining */}
        <div>
          <div className="text-slate-400 text-sm mb-2 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Units Remaining
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-blue-400">Agent A</span>
              <span className="text-white">{gameState.units?.filter(u => u.owner === 'agent_a' && u.current_models > 0).length || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-red-400">Agent B</span>
              <span className="text-white">{gameState.units?.filter(u => u.owner === 'agent_b' && u.current_models > 0).length || 0}</span>
            </div>
          </div>
        </div>

        {/* Phase */}
        <div>
          <div className="text-slate-400 text-sm mb-1">Phase</div>
          <Badge variant="outline" className="text-white border-slate-600">
            {battle.status}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}