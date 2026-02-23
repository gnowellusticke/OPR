import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Brain, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PERSONALITIES } from '../engine/personalities/PersonalityRegistry';

export default function PersonalityPicker({ value, onChange, label, color }) {
  const selected = PERSONALITIES.find(p => p.id === value);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-300 flex items-center gap-2">
          <Brain className="w-4 h-4" />
          {label} AI Personality
        </p>
        <Button
          size="sm"
          variant="outline"
          className="border-slate-600 text-slate-400 hover:text-white text-xs h-7 px-2"
          onClick={() => {
            const random = PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
            onChange(random.id);
          }}
        >
          <Shuffle className="w-3 h-3 mr-1" /> Random
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {PERSONALITIES.map(p => (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            className={`text-left p-3 rounded-lg border-2 transition-all ${
              value === p.id
                ? color === 'blue'
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-red-500 bg-red-500/10'
                : 'border-slate-700 bg-slate-900/40 hover:border-slate-500'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{p.emoji}</span>
              <span className="text-white font-semibold text-sm">{p.name}</span>
              {value === p.id && (
                <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${color === 'blue' ? 'bg-blue-500/20 text-blue-300' : 'bg-red-500/20 text-red-300'}`}>
                  Selected
                </span>
              )}
            </div>
            <p className="text-slate-400 text-xs mt-1 ml-7">{p.description}</p>
          </button>
        ))}
      </div>

      {selected && (
        <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 text-xs text-slate-400 space-y-1">
          <div className="text-slate-300 font-medium mb-1">Key tendencies:</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            <span>Charge bias: <span className="text-white">{selected.action_weights.Charge.base_score.toFixed(1)}</span></span>
            <span>Hold bias: <span className="text-white">{selected.action_weights.Hold.base_score.toFixed(1)}</span></span>
            <span>Rush bias: <span className="text-white">{selected.action_weights.Rush.base_score.toFixed(1)}</span></span>
            <span>Risk tolerance: <span className="text-white">{selected.risk_bias >= 0 ? '+' : ''}{selected.risk_bias.toFixed(1)}</span></span>
            <span>Attrition threshold: <span className="text-white">{Math.round(selected.attrition_threshold * 100)}%</span></span>
            <span>Tunnel vision: <span className="text-white">{Math.round(selected.tunnel_vision_chance * 100)}%</span></span>
          </div>
        </div>
      )}
    </div>
  );
}