import React from 'react';
import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getRule } from "@/data/rulebook";

/**
 * RuleReference — wraps text with an inline rule tooltip
 * If the rule exists in the rulebook, displays a tooltip on hover
 * Otherwise, just displays the text as-is
 * 
 * Usage: <RuleReference rule="Shaken">shaken</RuleReference>
 */
export default function RuleReference({ rule, children, className = "" }) {
  const ruleData = getRule(rule);

  if (!ruleData) {
    // Rule not found, just return the text
    return <span className={className}>{children}</span>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`border-b border-dotted border-blue-400 cursor-help hover:border-blue-300 transition-colors ${className}`}>
            {children}
            <HelpCircle className="inline-block w-3 h-3 ml-1 text-blue-400" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm bg-slate-800 border border-slate-600 text-slate-100 p-3">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-blue-300">{ruleData.title}</p>
                <p className="text-xs text-slate-400">{ruleData.category}</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-slate-200">{ruleData.text}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}