import React from 'react';
import { Card } from "@/components/ui/card";
import { Users, User } from "lucide-react";
import UnitGroupDisplay from './UnitGroupDisplay';

// Sprite assets for ruins and buildings — randomly assigned per terrain piece using a seeded index
const CRATER_SPRITES = [
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69893b802f4b06e77826bf31/e52994782_Rocks.png',
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69893b802f4b06e77826bf31/d9c17a5e3_Rocks1.png',
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69893b802f4b06e77826bf31/ef88135e7_Rocks7.png',
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69893b802f4b06e77826bf31/db51e2d68_Rocks9.png',
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69893b802f4b06e77826bf31/e43153a05_Rocks10.png',
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69893b802f4b06e77826bf31/92f2842f4_Rocks13.png',
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69893b802f4b06e77826bf31/703da782f_Rocks17.png',
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69893b802f4b06e77826bf31/0abb97707_Rocks19.png',
];

const HILL_SPRITES = [
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69893b802f4b06e77826bf31/1c0c23085_Big_Hills.png',
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69893b802f4b06e77826bf31/1aa5be922_Big_Hills2.png',
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69893b802f4b06e77826bf31/677633854_Big_Hills3.png',
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69893b802f4b06e77826bf31/df9b96fcd_Big_Hills4.png',
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69893b802f4b06e77826bf31/4e8a26efe_Big_Hills1.png',
];

const FOREST_SPRITES = [
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69893b802f4b06e77826bf31/43bb12b83_Rocks11.png',
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69893b802f4b06e77826bf31/a1b19589e_Rocks12.png',
];

const RUINS_SPRITES = [
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69893b802f4b06e77826bf31/7c2e0d007__Big_Buildings1.png',
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69893b802f4b06e77826bf31/5a74f3a50__Big_Buildings5.png',
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69893b802f4b06e77826bf31/6808aaf7e__Big_Buildings.png',
];
const BUILDING_SPRITES = [
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69893b802f4b06e77826bf31/972a4c6cf__Big_Buildings2.png',
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69893b802f4b06e77826bf31/367423a26__Big_Buildings3.png',
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69893b802f4b06e77826bf31/85e70e9cf__Big_Buildings6.png',
];

// Visual style map for each terrain type
const TERRAIN_STYLES = {
  barricade:        { bg: 'rgba(120,113,108,0.55)', border: '#a8a29e', icon: '🧱', textColor: '#fef3c7' },
  crater:           { bg: 'transparent', border: 'transparent', icon: '', textColor: '#fef9c3', useSprite: true, sprites: CRATER_SPRITES },
  forest:           { bg: 'transparent', border: 'transparent', icon: '', textColor: '#d1fae5', useSprite: true, sprites: FOREST_SPRITES },
  hill:             { bg: 'transparent', border: 'transparent', icon: '', textColor: '#fef3c7', useSprite: true, sprites: HILL_SPRITES },
  minefield:        { bg: 'rgba(220,38,38,0.25)',   border: '#dc2626', icon: '💣', textColor: '#fee2e2' },
  pond:             { bg: 'rgba(14,165,233,0.35)',  border: '#0284c7', icon: '💧', textColor: '#e0f2fe', round: true },
  ruins:            { bg: 'transparent',            border: 'transparent', icon: '', textColor: '#e2e8f0', useSprite: true, sprites: RUINS_SPRITES },
  solid_building:   { bg: 'transparent',            border: 'transparent', icon: '', textColor: '#cbd5e1', useSprite: true, sprites: BUILDING_SPRITES },
  vehicle_wreckage: { bg: 'rgba(239,68,68,0.30)',   border: '#b91c1c', icon: '🔥', textColor: '#fee2e2' },
  wall_open:        { bg: 'rgba(148,163,184,0.35)', border: '#94a3b8', icon: '🧱', textColor: '#f1f5f9' },
  wall_solid:       { bg: 'rgba(51,65,85,0.70)',    border: '#1e293b', icon: '🪨', textColor: '#cbd5e1' },
  // Legacy fallback
  cover:            { bg: 'rgba(34,197,94,0.30)',   border: '#22c55e', icon: '🌿', textColor: '#dcfce7' },
  difficult:        { bg: 'rgba(234,179,8,0.30)',   border: '#eab308', icon: '⚠',  textColor: '#fef9c3' },
  default:          { bg: 'rgba(100,116,139,0.30)', border: '#64748b', icon: '▪',  textColor: '#e2e8f0' },
};

export default function BattlefieldView({ gameState, activeUnit, onUnitClick }) {
  const GRID_SIZE = 6;
  const BATTLEFIELD_WIDTH = 72;
  const BATTLEFIELD_HEIGHT = 48;
  const CELL_SIZE = 60;

  // Hide all units before Play is pressed; during/after deployment show placed units normally
  const isPendingDeployment = gameState?.pending_deployment === true;
  const isDeploying = gameState?.deployment_in_progress === true;
  const units = (gameState?.units || []).filter(u => {
    if (u.current_models <= 0) return false;
    if (isPendingDeployment) return false; // nothing shown before Play
    if (isDeploying) return u.is_deployed === true; // show units one by one as they deploy
    return true; // combat phase — show everything alive
  });
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
        {terrain.map((t, idx) => {
          const style = TERRAIN_STYLES[t.type] || TERRAIN_STYLES.default;
          const angle = t.angle || 0;
          const w = (t.width / GRID_SIZE) * CELL_SIZE;
          const h = (t.height / GRID_SIZE) * CELL_SIZE;
          const cx = (t.x / GRID_SIZE) * CELL_SIZE + w / 2;
          const cy = (t.y / GRID_SIZE) * CELL_SIZE + h / 2;
          // Pick a deterministic sprite from the pool using the terrain index
          const spriteUrl = style.useSprite && style.sprites
            ? style.sprites[idx % style.sprites.length]
            : null;
          return (
            <div
              key={`terrain-${idx}`}
              className="absolute flex items-start justify-start overflow-hidden"
              style={{
                left: cx - w / 2,
                top: cy - h / 2,
                width: w,
                height: h,
                backgroundColor: spriteUrl ? 'transparent' : style.bg,
                border: spriteUrl ? 'none' : `2px solid ${style.border}`,
                borderRadius: style.round ? '50%' : '4px',
                transform: `rotate(${angle}deg)`,
                transformOrigin: 'center center',
              }}
            >
              {spriteUrl ? (
                <img
                  src={spriteUrl}
                  alt={t.label || t.type}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
                  draggable={false}
                />
              ) : (
                <span style={{ fontSize: 9, color: style.textColor || '#e2e8f0', padding: '1px 3px', lineHeight: 1.2, fontWeight: 600, textShadow: '0 0 3px #000' }}>
                  {style.icon} {t.label || t.type}
                </span>
              )}
            </div>
          );
        })}

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
      <div className="mt-4 space-y-2">
        <div className="flex flex-wrap gap-3 sm:gap-4 text-xs text-slate-300">
          <div className="flex items-center gap-1"><div className="w-4 h-4 bg-blue-900 border-2 border-blue-500 rounded" /><span>Agent A</span></div>
          <div className="flex items-center gap-1"><div className="w-4 h-4 bg-red-900 border-2 border-red-500 rounded" /><span>Agent B</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-amber-400" style={{ boxShadow: '0 0 4px rgba(245,158,11,0.8)' }} /><span>Character</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-emerald-400" style={{ boxShadow: '0 0 4px rgba(52,211,153,0.7)' }} /><span>Special Weapon</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-orange-400 rounded-full" /><span>Fatigued</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded-full" /><span>Shaken</span></div>
        </div>
        {terrain.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs text-slate-400 border-t border-slate-700 pt-2">
            {[...new Set(terrain.map(t => t.type))].map(type => {
              const TERRAIN_LABELS = {
                barricade: 'Barricade (Cover, -3" Mv)',
                crater: 'Crater (Cover+Difficult)',
                forest: 'Forest (Cover+Difficult, LOS)',
                hill: 'Hill (Cover+Difficult uphill)',
                minefield: 'Minefield (Dangerous)',
                pond: 'Pond (Difficult+Dangerous)',
                ruins: 'Ruins (Cover)',
                solid_building: 'Building (Impassable, Blocks LOS)',
                vehicle_wreckage: 'Wreckage (Rush/Charge Dangerous)',
                wall_open: 'Wall Open (Cover)',
                wall_solid: 'Wall Solid (Blocking/Impassable)',
              };
              const style = TERRAIN_STYLES[type] || TERRAIN_STYLES.default;
              const label = TERRAIN_LABELS[type] || type;
              return (
                <div key={type} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: style.bg, border: `1px solid ${style.border}` }} />
                  <span>{style.icon} {label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}