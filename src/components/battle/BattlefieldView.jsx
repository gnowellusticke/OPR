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

  // Group overlapping units
  const groupedUnits = React.useMemo(() => {
    const groups = [];
    const processed = new Set();
    
    units.forEach(unit => {
      if (processed.has(unit.id)) return;
      
      // Find all units at the same position (within 3 inches)
      const group = units.filter(other => 
        Math.abs(unit.x - other.x) < 3 && Math.abs(unit.y - other.y) < 3
      );
      
      group.forEach(u => processed.add(u.id));
      groups.push({
        x: unit.x,
        y: unit.y,
        units: group,
        owner: group[0].owner
      });
    });
    
    return groups;
  }, [units]);

  return (
    <Card className="bg-slate-900 border-slate-700 p-4">
      <div 
        className="relative bg-slate-800 border-2 border-slate-600 rounded-lg overflow-hidden mx-auto"
        style={{ 
          width: (BATTLEFIELD_WIDTH / GRID_SIZE) * CELL_SIZE,
          height: (BATTLEFIELD_HEIGHT / GRID_SIZE) * CELL_SIZE,
          minWidth: (BATTLEFIELD_WIDTH / GRID_SIZE) * CELL_SIZE
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
        {groupedUnits.map((group, idx) => {
          const isGroup = group.units.length > 1;
          const hasActiveUnit = group.units.some(u => u.id === activeUnit?.id);
          const [showTooltip, setShowTooltip] = React.useState(false);

          return (
            <div
              key={`group-${idx}`}
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
                className={`rounded-lg border-2 cursor-pointer transition-all ${
                  hasActiveUnit ? 'ring-4 ring-yellow-400 scale-110' : ''
                } ${
                  group.units[0].status === 'shaken' ? 'opacity-60' : ''
                }`}
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

                {/* Unit count badge */}
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

              {/* Tooltip showing all units */}
              {showTooltip && isGroup && (
                <div className="absolute left-full ml-2 top-0 bg-slate-900/95 border border-slate-600 rounded-lg p-2 whitespace-nowrap z-50 pointer-events-none">
                  <div className="text-[10px] font-semibold text-yellow-400 mb-1">
                    {group.units.length} Units:
                  </div>
                  {group.units.map(u => (
                    <div key={u.id} className="text-[10px] text-white">
                      • {u.name} ({u.current_models}/{u.total_models})
                    </div>
                  ))}
                </div>
              )}

              {/* Unit name label */}
              <div 
                className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-[9px] font-semibold text-white bg-slate-900/90 px-1.5 py-0.5 rounded whitespace-nowrap"
                style={{ 
                  maxWidth: '80px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {isGroup ? `${group.units.length} units` : group.units[0].name}
              </div>
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