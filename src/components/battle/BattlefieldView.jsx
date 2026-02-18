import React from 'react';
import { Card } from "@/components/ui/card";
import { Users, User } from "lucide-react";
import UnitGroupDisplay from './UnitGroupDisplay';

export default function BattlefieldView({ gameState, activeUnit, onUnitClick }) {
  const GRID_SIZE = 6;
  const BATTLEFIELD_WIDTH = 72;
  const BATTLEFIELD_HEIGHT = 48;
  const CELL_SIZE = 60;

  const units = (gameState?.units || []).filter(u => u.current_models > 0);
  const terrain = gameState?.terrain || [];
  const objectives = gameState?.objectives || [];

  const groupedUnits = React.useMemo(() => {
    const groups = [];
    const processed = new Set();

    units.forEach(unit => {
      if (processed.has(unit.id)) return;
      const group = units.filter(other =>
        Math.abs(unit.x - other.x) < 3 && Math.abs(unit.y - other.y) < 3
      );
      group.forEach(u => processed.add(u.id));
      groups.push({ x: unit.x, y: unit.y, units: group, owner: group[0].owner });
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
        {groupedUnits.map((group, idx) => (
          <UnitGroupDisplay
            key={`group-${idx}`}
            group={group}
            activeUnit={activeUnit}
            onUnitClick={onUnitClick}
            CELL_SIZE={CELL_SIZE}
            GRID_SIZE={GRID_SIZE}
          />
        ))}
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