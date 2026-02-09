import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Swords, Crosshair, Shield, Skull } from "lucide-react";

export default function CombatResolver({ combatEvent }) {
  if (!combatEvent) return null;

  const renderDiceRolls = (rolls) => {
    if (!rolls || rolls.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1">
        {rolls.map((roll, idx) => (
          <div
            key={idx}
            className={`w-6 h-6 flex items-center justify-center text-xs font-bold rounded border-2 ${
              roll.success
                ? 'bg-green-900/50 border-green-500 text-green-300'
                : 'bg-red-900/50 border-red-500 text-red-300'
            }`}
          >
            {roll.value}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-white flex items-center gap-2 text-sm">
          {combatEvent.type === 'shooting' ? <Crosshair className="w-4 h-4" /> : <Swords className="w-4 h-4" />}
          Combat Resolution
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Attacker */}
        <div className="bg-slate-800/50 p-3 rounded border border-slate-700">
          <div className="text-slate-400 text-xs mb-2">Attacker</div>
          <div className="text-white font-semibold mb-2">{combatEvent.attacker?.name}</div>
          <div className="space-y-2">
            <div>
              <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                <Crosshair className="w-3 h-3" />
                Hit Rolls (Q{combatEvent.attacker?.quality}+)
              </div>
              {renderDiceRolls(combatEvent.hit_rolls)}
            </div>
            <div className="text-green-400 text-sm font-bold">
              {combatEvent.hits || 0} Hits
            </div>
          </div>
        </div>

        {/* Defender */}
        <div className="bg-slate-800/50 p-3 rounded border border-slate-700">
          <div className="text-slate-400 text-xs mb-2">Defender</div>
          <div className="text-white font-semibold mb-2">{combatEvent.defender?.name}</div>
          <div className="space-y-2">
            <div>
              <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Defense Rolls (D{combatEvent.defender?.defense}+)
              </div>
              {renderDiceRolls(combatEvent.defense_rolls)}
            </div>
            <div className="text-red-400 text-sm font-bold flex items-center gap-1">
              <Skull className="w-4 h-4" />
              {combatEvent.wounds || 0} Wounds
            </div>
          </div>
        </div>

        {/* Result */}
        {combatEvent.result && (
          <div className="bg-yellow-900/20 border border-yellow-700 p-2 rounded">
            <div className="text-yellow-300 text-xs">{combatEvent.result}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}