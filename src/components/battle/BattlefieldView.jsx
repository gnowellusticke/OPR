import React from 'react';
import { Card } from "@/components/ui/card";
import { Users, User } from "lucide-react";

export default function BattlefieldView({ gameState, activeUnit, onUnitClick }) {
  const GRID_SIZE = 6; // inches per grid cell
  const BATTLEFIELD_WIDTH = 72; // 6 feet = 72 inches
  const BATTLEFIELD_HEIGHT = 48; // 4 feet = 48 inches
  const CELL_SIZE = 60; // pixels

  const units = (gameState?.units || []).filter(u => u.current_models > 0);
  const terrain = gameState?.terrain || [];
  const objectives = gameState?.objectives || [];

  // Detect overlapping units and adjust positions
  const adjustedUnits = units.map((unit, idx) => {
    const overlaps = units.slice(0, idx).filter(other => 
      Math.abs(unit.x - other.x) < 6 && Math.abs(unit.y - other.y) < 6
    );
    
    const offsetX = overlaps.length > 0 ? (overlaps.length * 4) : 0;
    const offsetY = overlaps.length > 0 ? (overlaps.length * 4) : 0;
    
    return { ...unit, displayX: unit.x + offsetX, displayY: unit.y + offsetY };
  });

  return (
    <Card className="bg-slate-900 border-slate-700 p-4">
      <div 
        className="relative bg-slate-800 border-2 border-slate-600 rounded-lg overflow-hidden"
        style={{ 
          width: (BATTLEFIELD_WIDTH / GRID_SIZE) * CELL_SIZE,
          height: (BATTLEFIELD_HEIGHT / GRID_SIZE) * CELL_SIZE 
        }}
      >
        {/* Grid overlay */}
        <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
          <defs>
            <pattern id="grid" width={CELL_SIZE} height={CELL_SIZE} patternUnits="userSpaceOnUse">
              <path d={`M ${CELL_SIZE} 0 L 0 0 0 ${CELL_SIZE}`} fill="none" stroke="rgba(100,116,139,0.2)" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Terrain */}
        {terrain.map((t, idx) => (
          <div
            key={`terrain-${idx}`}
            className="absolute rounded"
            style={{
              left: (t.x / GRID_SIZE) * CELL_SIZE,
              top: (t.y / GRID_SIZE) * CELL_SIZE,
              width: (t.width / GRID_SIZE) * CELL_SIZE,
              height: (t.height / GRID_SIZE) * CELL_SIZE,
              backgroundColor: t.type === 'cover' ? 'rgba(34,197,94,0.3)' : 'rgba(234,179,8,0.3)',
              border: '2px solid rgba(148,163,184,0.5)'
            }}
          >
            <span className="text-xs text-slate-300 p-1">{t.type}</span>
          </div>
        ))}

        {/* Objectives */}
        {objectives.map((obj, idx) => (
          <div
            key={`obj-${idx}`}
            className="absolute rounded-full border-4 flex items-center justify-center font-bold"
            style={{
              left: (obj.x / GRID_SIZE) * CELL_SIZE - 15,
              top: (obj.y / GRID_SIZE) * CELL_SIZE - 15,
              width: 30,
              height: 30,
              borderColor: obj.controlled_by === 'agent_a' ? '#3b82f6' : obj.controlled_by === 'agent_b' ? '#ef4444' : '#64748b',
              backgroundColor: 'rgba(0,0,0,0.7)',
              color: '#fff',
              fontSize: 12
            }}
          >
            {idx + 1}
          </div>
        ))}

        {/* Units */}
        {adjustedUnits.map((unit) => {
          const isMultiModel = unit.current_models > 1;
          return (
            <div
              key={unit.id}
              onClick={() => onUnitClick?.(unit)}
              className={`absolute rounded-lg border-2 cursor-pointer transition-all ${
                activeUnit?.id === unit.id ? 'ring-4 ring-yellow-400 scale-110' : ''
              } ${
                unit.status === 'shaken' ? 'opacity-60' : ''
              }`}
              style={{
                left: (unit.displayX / GRID_SIZE) * CELL_SIZE - 20,
                top: (unit.displayY / GRID_SIZE) * CELL_SIZE - 20,
                width: 40,
                height: 40,
                backgroundColor: unit.owner === 'agent_a' ? '#1e40af' : '#991b1b',
                borderColor: unit.owner === 'agent_a' ? '#3b82f6' : '#ef4444',
                zIndex: activeUnit?.id === unit.id ? 100 : unit.status === 'shaken' ? 1 : 10
              }}
              title={`${unit.name} (${unit.current_models}/${unit.total_models})`}
            >
              <div className="flex flex-col items-center justify-center h-full text-white">
                {isMultiModel ? (
                  <Users className="w-5 h-5 mb-0.5" />
                ) : (
                  <User className="w-5 h-5 mb-0.5" />
                )}
                <div className="text-[10px] font-bold">
                  {isMultiModel ? unit.current_models : '1'}
                </div>
              </div>
              <div 
                className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-[9px] font-semibold text-white bg-slate-900/90 px-1.5 py-0.5 rounded whitespace-nowrap"
                style={{ 
                  maxWidth: '80px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {unit.name}
              </div>
              {unit.fatigued && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full" title="Fatigued" />
              )}
              {unit.status === 'shaken' && (
                <div className="absolute -top-1 -left-1 w-3 h-3 bg-red-500 rounded-full" title="Shaken" />
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 sm:gap-6 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-700 border-2 border-blue-500 rounded" />
          <span>Agent A</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-700 border-2 border-red-500 rounded" />
          <span>Agent B</span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          <span>Multi-Model Unit</span>
        </div>
        <div className="flex items-center gap-2">
          <User className="w-4 h-4" />
          <span>Single Model</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-500 rounded-full" />
          <span>Fatigued</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-full" />
          <span>Shaken</span>
        </div>
      </div>
    </Card>
  );
}