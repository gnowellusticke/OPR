import React, { useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Scroll } from "lucide-react";
import RuleReference from "../ui/RuleReference";

function RuleMessageFormatter({ message }) {
  const rules = ['Shaken', 'Fear', 'Furious', 'Charge', 'Hold', 'Advance', 'Rush', 'Blast', 'Morale', 'Regeneration', 'Ambush', 'Impact', 'Tough', 'Bane', 'Damage', 'Stealth', 'Indirect', 'Objective'];
  
  let parts = [message];
  rules.forEach(rule => {
    const newParts = [];
    parts.forEach(part => {
      if (typeof part === 'string') {
        const regex = new RegExp(`\\b${rule}\\b`, 'g');
        const split = part.split(regex);
        split.forEach((s, i) => {
          newParts.push(s);
          if (i < split.length - 1) {
            newParts.push(<RuleReference key={`${rule}-${i}`} rule={rule}>{rule}</RuleReference>);
          }
        });
      } else {
        newParts.push(part);
      }
    });
    parts = newParts;
  });
  
  return <>{parts}</>;
}

export default function ActionLog({ events }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  const getEventColor = (type) => {
    switch (type) {
      case 'combat': return 'text-red-400';
      case 'movement': return 'text-blue-400';
      case 'morale': return 'text-yellow-400';
      case 'objective': return 'text-green-400';
      case 'decision': return 'text-purple-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <Card className="bg-slate-900 border-slate-700 h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-white flex items-center gap-2 text-sm">
          <Scroll className="w-4 h-4" />
          Action Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96" ref={scrollRef}>
          <div className="space-y-2 pr-4">
            {events && events.length > 0 ? events.map((event, idx) => (
              <div key={idx} className="text-xs border-l-2 border-slate-600 pl-3 py-1">
                <div className="text-slate-500 text-[10px]">
                  Round {event.round} • {event.timestamp}
                </div>
                <div className={`${getEventColor(event.type)} leading-relaxed`}>
                   <RuleMessageFormatter message={event.message} />
                </div>
                {event.details && (
                  <div className="text-slate-500 text-[10px] mt-1">
                    {event.details}
                  </div>
                )}
              </div>
            )) : (
              <div className="text-slate-500 text-xs text-center py-4">
                No events yet
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}