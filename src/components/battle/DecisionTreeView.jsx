import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Brain, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";

function FactorBar({ delta }) {
  const isPositive = delta >= 0;
  const width = Math.min(Math.abs(delta) * 40, 100);
  return (
    <div className="flex items-center gap-1 w-16">
      <div className="flex-1 h-1.5 bg-slate-700 rounded overflow-hidden">
        <div
          className={`h-full rounded ${isPositive ? 'bg-green-500' : 'bg-red-500'}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className={`text-xs font-mono w-10 text-right ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
        {isPositive ? '+' : ''}{delta.toFixed(2)}
      </span>
    </div>
  );
}

function OptionRow({ opt }) {
  const [expanded, setExpanded] = useState(opt.selected);
  const hasFactors = opt.factors && opt.factors.length > 0;

  return (
    <div className={`rounded text-xs border ${opt.selected ? 'bg-green-900/30 border-green-700' : 'bg-slate-800/50 border-slate-700'}`}>
      <button
        className="w-full flex justify-between items-center p-2 text-left"
        onClick={() => hasFactors && setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2">
          {opt.selected
            ? <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />
            : <div className="w-3 h-3" />}
          <span className="text-white font-medium">{opt.action}</span>
          {hasFactors && (expanded
            ? <ChevronDown className="w-3 h-3 text-slate-400" />
            : <ChevronRight className="w-3 h-3 text-slate-400" />)}
        </div>
        <span className={`font-mono ${opt.selected ? 'text-green-400' : 'text-slate-400'}`}>
          {opt.score.toFixed(2)}
        </span>
      </button>

      {expanded && hasFactors && (
        <div className="border-t border-slate-700/60 px-2 pb-2 pt-1 space-y-1">
          {opt.factors.map((f, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className="text-slate-400 truncate flex-1">{f.label}</span>
              <FactorBar delta={f.delta} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
        {/* Active Unit */}
        <div>
          <div className="text-slate-400 text-xs mb-1">Active Unit</div>
          <div className="text-white font-semibold">{decision.unit?.name}</div>
        </div>

        {/* Decision Framework */}
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

        {/* Options with expandable factor breakdowns */}
        <div>
          <div className="text-slate-400 text-xs mb-2">
            Options Evaluated <span className="text-slate-600">(click to expand)</span>
          </div>
          <div className="space-y-1">
            {decision.options?.map((opt, idx) => (
              <OptionRow key={idx} opt={opt} />
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