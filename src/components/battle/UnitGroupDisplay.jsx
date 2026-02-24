import React, { useState } from 'react';
import { Users, User } from "lucide-react";
import UnitModelDisplay, { isCharacterUnit, hasSpecialWeapons } from './UnitModelDisplay';

export default function UnitGroupDisplay({ group, activeUnit, onUnitClick, CELL_SIZE, GRID_SIZE }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const displayUnit = group.displayUnit;
  const isTransport = group.isTransport;
  const embarkedCount = isTransport ? group.units.length - 1 : 0;
  const hasActiveUnit = group.units.some(u => u.id === activeUnit?.id);

  // Use pre-computed pixel position from overlap resolution (_px/_py),
  // falling back to raw coordinate conversion if not set.
  const px = group._px ?? (displayUnit.x / GRID_SIZE) * CELL_SIZE;
  const py = group._py ?? (displayUnit.y / GRID_SIZE) * CELL_SIZE;

  return (
    <div
      className="absolute"
      style={{
        left: px - 20,
        top: py - 20,
        zIndex: hasActiveUnit ? 100 : 10
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Main token */}
      <div
        onClick={() => onUnitClick?.(displayUnit)}
        className={`relative rounded-lg border-2 cursor-pointer transition-all
          ${hasActiveUnit ? 'ring-4 ring-yellow-400 scale-110' : ''}
          ${displayUnit.status === 'shaken' ? 'opacity-60' : ''}`}
        style={{
          width: 44,
          minHeight: 44,
          padding: 4,
          backgroundColor: displayUnit.owner === 'agent_a' ? '#1e3a6e' : '#7f1d1d',
          borderColor: isCharacterUnit(displayUnit)
            ? '#f59e0b'
            : hasSpecialWeapons(displayUnit)
              ? '#34d399'
              : displayUnit.owner === 'agent_a' ? '#3b82f6' : '#ef4444',
          borderWidth: isCharacterUnit(displayUnit) || hasSpecialWeapons(displayUnit) ? 2 : 2,
          boxShadow: isCharacterUnit(displayUnit)
            ? '0 0 8px rgba(245,158,11,0.5)'
            : hasSpecialWeapons(displayUnit)
              ? '0 0 8px rgba(52,211,153,0.4)'
              : 'none',
        }}
      >
        {isTransport ? (
          <div className="flex flex-col items-center justify-center w-full h-full text-white" style={{ minHeight: 36 }}>
            <Users className="w-5 h-5 mb-0.5" />
            <div className="text-[10px] font-bold leading-none">
              {embarkedCount > 0 ? `+${embarkedCount}` : 'TR'}
            </div>
          </div>
        ) : (
          <UnitModelDisplay unit={displayUnit} owner={displayUnit.owner} />
        )}

        {/* Transport passenger badge */}
        {isTransport && embarkedCount > 0 && (
          <div className="absolute -top-2 -right-2 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white border-2 border-slate-900">
            {embarkedCount}
          </div>
        )}

        {/* Status indicators */}
        {displayUnit.fatigued && (
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-orange-400 rounded-full border border-slate-900" title="Fatigued" />
        )}
        {displayUnit.status === 'shaken' && (
          <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-red-500 rounded-full border border-slate-900" title="Shaken" />
        )}
      </div>

      {/* Unit name label */}
      <div
        className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-white bg-slate-900/90 px-1.5 py-0.5 rounded whitespace-nowrap"
        style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis' }}
      >
        {isTransport ? `[T] ${displayUnit.name}` : displayUnit.name}
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute left-full ml-2 top-0 bg-slate-900/95 border border-slate-600 rounded-lg p-2 whitespace-nowrap z-50 pointer-events-none min-w-[140px]">
          <div className="text-[10px] font-semibold text-yellow-400 mb-1">{displayUnit.name}</div>
          <div className="text-[10px] text-slate-300">
            Models: {displayUnit.current_models}/{displayUnit.total_models}
          </div>
          {isTransport && (
            <>
              <div className="text-[10px] font-semibold text-cyan-400 mt-2 mb-0.5">
                Embarked ({embarkedCount}):
              </div>
              {group.units.slice(1).map(u => (
                <div key={u.id} className="text-[10px] text-white">
                  • {u.name} ({u.current_models}/{u.total_models})
                </div>
              ))}
              {embarkedCount === 0 && (
                <div className="text-[10px] text-slate-400 italic">Empty transport</div>
              )}
            </>
          )}
          {displayUnit.special_rules && (
            <div className="text-[10px] text-slate-400 mt-1 max-w-[200px] whitespace-normal">
              {displayUnit.special_rules}
            </div>
          )}
        </div>
      )}
    </div>
  );
}