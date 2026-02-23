import React from 'react';
import { Card } from "@/components/ui/card";
import UnitGroupDisplay from './UnitGroupDisplay';

export default function BattlefieldView({ gameState, activeUnit, onUnitClick }) {
  const GRID_SIZE = 6;
  const BATTLEFIELD_WIDTH = 72;
  const BATTLEFIELD_HEIGHT = 48;
  const CELL_SIZE = 60;

  const units = (gameState?.units || []).filter(u => u.current_models > 0);
  const terrain = gameState?.terrain || [];
  const objectives = gameState?.objectives || [];

  // Build render list: transports absorb their passengers; each ground unit is its own token.
  // No two tokens share the same position — if they would, nudge them apart on a grid.
  const renderableUnits = React.useMemo(() => {
    const tokens = [];
    const processed = new Set();

    // First pass: transports + their embarked passengers
    units.forEach(unit => {
      if (processed.has(unit.id)) return;
      if (!unit.special_rules?.includes('Transport')) return;

      const passengers = units.filter(u => u.embarked_in === unit.id);
      tokens.push({
        displayUnit: unit,
        units: [unit, ...passengers],
        owner: unit.owner,
        isTransport: true,
      });
      processed.add(unit.id);
      passengers.forEach(p => processed.add(p.id));
    });

    // Second pass: ground units (not embarked)
    units.forEach(unit => {
      if (processed.has(unit.id)) return;
      if (unit.embarked_in) return; // still inside a transport that may be destroyed — skip
      tokens.push({
        displayUnit: unit,
        units: [unit],
        owner: unit.owner,
        isTransport: false,
      });
      processed.add(unit.id);
    });

    // Resolve overlaps: cluster tokens that land on the same pixel-grid cell and spread them out.
    const SLOT = 48; // pixels between unit tokens (slightly larger than the 40px token)
    const placed = []; // { px, py, token }

    tokens.forEach(token => {
      const rawPx = (token.displayUnit.x / GRID_SIZE) * CELL_SIZE;
      const rawPy = (token.displayUnit.y / GRID_SIZE) * CELL_SIZE;

      // Find a free slot using a spiral search
      let placed_px = rawPx;
      let placed_py = rawPy;
      let found = false;
      for (let radius = 0; radius <= 6 && !found; radius++) {
        const offsets = radius === 0 ? [[0, 0]] : [];
        if (radius > 0) {
          for (let dx = -radius; dx <= radius; dx++) {
            offsets.push([dx * SLOT, -radius * SLOT]);
            offsets.push([dx * SLOT,  radius * SLOT]);
          }
          for (let dy = -radius + 1; dy <= radius - 1; dy++) {
            offsets.push([-radius * SLOT, dy * SLOT]);
            offsets.push([ radius * SLOT, dy * SLOT]);
          }
        }
        for (const [ox, oy] of offsets) {
          const cx = rawPx + ox;
          const cy = rawPy + oy;
          const collision = placed.some(p => Math.abs(p.px - cx) < SLOT - 4 && Math.abs(p.py - cy) < SLOT - 4);
          if (!collision) {
            placed_px = cx;
            placed_py = cy;
            found = true;
            break;
          }
        }
      }

      placed.push({ px: placed_px, py: placed_py, token });
      token._px = placed_px;
      token._py = placed_py;
    });

    return tokens;
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
        {/* Deployment Zone Overlays — shown only during deployment */}
        {gameState?.deployment_in_progress && <>
          <div className="absolute pointer-events-none" style={{
            left: 0, top: 0, width: '100%',
            height: (16 / GRID_SIZE) * CELL_SIZE,
            backgroundColor: 'rgba(59,130,246,0.12)',
            borderBottom: '2px dashed rgba(59,130,246,0.5)'
          }}>
            <span className="absolute bottom-1 left-2 text-blue-400 text-xs font-bold opacity-80">Agent A Deploy Zone</span>
          </div>
          <div className="absolute pointer-events-none" style={{
            left: 0, bottom: 0, width: '100%',
            height: (16 / GRID_SIZE) * CELL_SIZE,
            backgroundColor: 'rgba(239,68,68,0.12)',
            borderTop: '2px dashed rgba(239,68,68,0.5)'
          }}>
            <span className="absolute top-1 left-2 text-red-400 text-xs font-bold opacity-80">Agent B Deploy Zone</span>
          </div>
        </>}

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
              backgroundColor: t.type === 'cover' ? 'rgba(34,197,94,0.18)' : 'rgba(234,179,8,0.18)',
              border: `2px solid ${t.type === 'cover' ? 'rgba(34,197,94,0.5)' : 'rgba(234,179,8,0.5)'}`,
              backdropFilter: 'blur(1px)'
            }}
          >
            <span style={{ fontSize: 9, color: '#cbd5e1', padding: '2px 4px', display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t.type}</span>
          </div>
        ))}

        {/* Objectives */}
        {objectives.map((obj, idx) => {
          const ctrl = obj.controlled_by;
          const ringColor = ctrl === 'agent_a' ? '#3b82f6' : ctrl === 'agent_b' ? '#ef4444' : ctrl === 'contested' ? '#a855f7' : '#94a3b8';
          const bgColor = ctrl === 'agent_a' ? 'rgba(30,58,138,0.85)' : ctrl === 'agent_b' ? 'rgba(127,29,29,0.85)' : 'rgba(15,23,42,0.85)';
          return (
            <div
              key={`obj-${idx}`}
              style={{
                position: 'absolute',
                left: (obj.x / GRID_SIZE) * CELL_SIZE - 18,
                top: (obj.y / GRID_SIZE) * CELL_SIZE - 18,
                width: 36, height: 36,
                borderRadius: '50%',
                border: `3px solid ${ringColor}`,
                backgroundColor: bgColor,
                boxShadow: `0 0 10px ${ringColor}66`,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                zIndex: 5
              }}
            >
              {/* Flag icon */}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginBottom: 1 }}>
                <line x1="2" y1="1" x2="2" y2="11" stroke={ringColor} strokeWidth="1.5"/>
                <path d="M2 1 L10 3 L2 5Z" fill={ringColor} opacity="0.9"/>
              </svg>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#f8fafc', lineHeight: 1 }}>{idx + 1}</span>
            </div>
          );
        })}

        {/* Units */}
        {renderableUnits.map((group, idx) => (
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