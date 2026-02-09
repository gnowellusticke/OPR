import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Brain, CheckCircle2 } from "lucide-react";

export default function DecisionTreeView({ decision }) {
  if (!decision) {
    return (
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white flex items-center gap-2 text-sm">
            <Brain className="w-4 h-4" />
            AI Decision Process
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-slate-500 text-xs text-center py-4">
            Waiting for next decision...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-white flex items-center gap-2 text-sm">
          <Brain className="w-4 h-4" />
          AI Decision Process
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Current Unit */}
        <div>
          <div className="text-slate-400 text-xs mb-1">Active Unit</div>
          <div className="text-white font-semibold">{decision.unit?.name}</div>
        </div>

        {/* Decision Method */}
        <div>
          <div className="text-slate-400 text-xs mb-1">Decision Framework</div>
          <div className="flex gap-2 flex-wrap">
            <span className="px-2 py-1 bg-purple-900/50 text-purple-300 text-xs rounded border border-purple-700">
              DMN: {decision.dmn_phase || 'Action Selection'}
            </span>
            {decision.cmmn_active && (
              <span className="px-2 py-1 bg-orange-900/50 text-orange-300 text-xs rounded border border-orange-700">
                CMMN: Case Active
              </span>
            )}
          </div>
        </div>

        {/* Options Evaluated */}
        <div>
          <div className="text-slate-400 text-xs mb-2">Options Evaluated</div>
          <div className="space-y-1">
            {decision.options?.map((opt, idx) => (
              <div 
                key={idx} 
                className={`flex justify-between items-center p-2 rounded text-xs ${
                  opt.selected 
                    ? 'bg-green-900/30 border border-green-700' 
                    : 'bg-slate-800/50 border border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  {opt.selected && <CheckCircle2 className="w-3 h-3 text-green-400" />}
                  <span className="text-white">{opt.action}</span>
                </div>
                <span className={`font-mono ${opt.selected ? 'text-green-400' : 'text-slate-400'}`}>
                  {opt.score.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Reasoning */}
        {decision.reasoning && (
          <div>
            <div className="text-slate-400 text-xs mb-1">Reasoning</div>
            <div className="text-slate-300 text-xs leading-relaxed bg-slate-800/50 p-2 rounded border border-slate-700">
              {decision.reasoning}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}