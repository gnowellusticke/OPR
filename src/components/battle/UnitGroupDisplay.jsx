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
      {/* Models — rendered directly, no box wrapper */}
      <div
        onClick={() => onUnitClick?.(displayUnit)}
        className={`relative cursor-pointer transition-all
          ${hasActiveUnit ? 'drop-shadow-[0_0_6px_rgba(250,204,21,0.9)]' : ''}
          ${displayUnit.status === 'shaken' ? 'opacity-60' : ''}`}
      >
        {/* All units — transports and infantry — render as model dots */}
        <UnitModelDisplay unit={displayUnit} owner={displayUnit.owner} />
        {/* Embarked passenger count badge on transports */}
        {isTransport && embarkedCount > 0 && (
          <div className="absolute -top-2 -right-2 w-4 h-4 bg-cyan-500 rounded-full flex items-center justify-center text-[8px] font-bold text-white border border-slate-900">
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