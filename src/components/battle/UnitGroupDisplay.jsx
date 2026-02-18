import React, { useState } from 'react';
import { Users, User } from "lucide-react";

export default function UnitGroupDisplay({ group, activeUnit, onUnitClick, CELL_SIZE, GRID_SIZE }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const isGroup = group.units.length > 1;
  const hasActiveUnit = group.units.some(u => u.id === activeUnit?.id);

  return (
    <div
      className="absolute"
      style={{
        left: (group.x / GRID_SIZE) * CELL_SIZE - 20,
        top: (group.y / GRID_SIZE) * CELL_SIZE - 20,
        zIndex: hasActiveUnit ? 100 : 10
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        onClick={() => onUnitClick?.(group.units[0])}
        className={`rounded-lg border-2 cursor-pointer transition-all ${hasActiveUnit ? 'ring-4 ring-yellow-400 scale-110' : ''} ${group.units[0].status === 'shaken' ? 'opacity-60' : ''}`}
        style={{
          width: 40,
          height: 40,
          backgroundColor: group.owner === 'agent_a' ? '#1e40af' : '#991b1b',
          borderColor: group.owner === 'agent_a' ? '#3b82f6' : '#ef4444'
        }}
      >
        <div className="flex flex-col items-center justify-center h-full text-white">
          {group.units[0].current_models > 1 ? (
            <Users className="w-5 h-5 mb-0.5" />
          ) : (
            <User className="w-5 h-5 mb-0.5" />
          )}
          <div className="text-[10px] font-bold">
            {group.units[0].current_models > 1 ? group.units[0].current_models : '1'}
          </div>
        </div>

        {isGroup && (
          <div className="absolute -top-2 -right-2 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center text-[10px] font-bold text-black border-2 border-slate-900">
            {group.units.length}
          </div>
        )}

        {group.units[0].fatigued && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full" title="Fatigued" />
        )}
        {group.units[0].status === 'shaken' && (
          <div className="absolute -top-1 -left-1 w-3 h-3 bg-red-500 rounded-full" title="Shaken" />
        )}
      </div>

      {showTooltip && isGroup && (
        <div className="absolute left-full ml-2 top-0 bg-slate-900/95 border border-slate-600 rounded-lg p-2 whitespace-nowrap z-50 pointer-events-none">
          <div className="text-[10px] font-semibold text-yellow-400 mb-1">{group.units.length} Units:</div>
          {group.units.map(u => (
            <div key={u.id} className="text-[10px] text-white">• {u.name} ({u.current_models}/{u.total_models})</div>
          ))}
        </div>
      )}

      <div
        className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-[9px] font-semibold text-white bg-slate-900/90 px-1.5 py-0.5 rounded whitespace-nowrap"
        style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis' }}
      >
        {isGroup ? `${group.units.length} units` : group.units[0].name}
      </div>
    </div>
  );
}