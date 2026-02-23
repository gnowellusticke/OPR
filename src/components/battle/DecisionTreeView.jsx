import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Brain, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";

export default function DecisionTreeView({ decision }) {
  const [expandedAction, setExpandedAction] = useState(null);

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

  const selectedOpt = decision.options?.find(o => o.selected);

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-white flex items-center gap-2 text-sm">
          <Brain className="w-4 h-4" />
          AI Decision Process
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">

        <div>
          <div className="text-slate-400 text-xs mb-1">Active Unit</div>
          <div className="text-white font-semibold">{decision.unit?.name}</div>
          <div className="text-slate-500 text-xs">{decision.reasoning}</div>
        </div>

        <div>
          <div className="text-slate-400 text-xs mb-1">Framework</div>
          <span className="px-2 py-1 bg-purple-900/50 text-purple-300 text-xs rounded border border-purple-700">
            DMN: {decision.dmn_phase || 'Action Selection'}
          </span>
        </div>

        {/* Options with expandable breakdowns */}
        <div>
          <div className="text-slate-400 text-xs mb-2">Options Evaluated</div>
          <div className="space-y-1">
            {decision.options?.map((opt, idx) => (
              <div key={idx}>
                <button
                  className={`w-full flex justify-between items-center p-2 rounded text-xs transition-colors ${
                    opt.selected
                      ? 'bg-green-900/30 border border-green-700'
                      : 'bg-slate-800/50 border border-slate-700 hover:border-slate-500'
                  }`}
                  onClick={() => setExpandedAction(expandedAction === opt.action ? null : opt.action)}
                >
                  <div className="flex items-center gap-2">
                    {opt.selected
                      ? <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />
                      : (opt.details?.length > 0
                          ? (expandedAction === opt.action
                              ? <ChevronDown className="w-3 h-3 text-slate-500 flex-shrink-0" />
                              : <ChevronRight className="w-3 h-3 text-slate-500 flex-shrink-0" />)
                          : <span className="w-3 h-3" />)
                    }
                    <span className="text-white">{opt.action}</span>
                  </div>
                  <span className={`font-mono ${opt.selected ? 'text-green-400' : 'text-slate-400'}`}>
                    {opt.score.toFixed(2)}
                  </span>
                </button>

                {/* Score breakdown */}
                {(opt.selected || expandedAction === opt.action) && opt.details?.length > 0 && (
                  <div className="ml-3 mt-1 mb-1 space-y-0.5 border-l border-slate-700 pl-2">
                    {opt.details.map((d, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-slate-400">{d.label}</span>
                        <span className={`font-mono ${d.value > 0 ? 'text-green-500' : d.value < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                          {d.value > 0 ? '+' : ''}{typeof d.value === 'number' ? d.value.toFixed(2) : d.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </CardContent>
    </Card>
  );
}