import React, { useState } from 'react';

// ── Unit type detection ──────────────────────────────────────────────────────
function getUnitType(unit) {
  const sr = typeof unit.special_rules === 'string' ? unit.special_rules : (unit.special_rules || []).join(' ');
  const name = (unit.name || '').toLowerCase();
  if (sr.includes('Transport')) return 'transport';
  if (/tank|doom tank|vehicle|walker|tripod|spider|mech|golem|titan/i.test(name)) return 'vehicle';
  if (/beast|spawn|creature|monster|horror|daemon|wyrm|hive/i.test(name)) return 'monster';
  const tough = sr.match(/Tough\((\d+)\)/);
  const toughVal = tough ? parseInt(tough[1]) : 0;
  if (toughVal >= 6) return 'vehicle'; // heavy/large unit
  const isHero = sr.toLowerCase().includes('hero');
  if (isHero) return 'hero';
  if ((unit.model_count || 1) >= 3) return 'infantry';
  return 'infantry';
}

// ── Faction icon SVG paths ────────────────────────────────────────────────────
// Returns an SVG element for the faction based on army/unit name keywords
function FactionIcon({ unit, size = 14 }) {
  const name = (unit.name || '').toLowerCase();
  const sr = (typeof unit.special_rules === 'string' ? unit.special_rules : (unit.special_rules || []).join(' ')).toLowerCase();
  const color = unit.owner === 'agent_a' ? '#93c5fd' : '#fca5a5';

  // Custodians / Battle Brothers → cross/shield
  if (/custodian|battle brother|veteran|vigilant|sister|guardian/i.test(name)) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        <path d="M8 1 L10 5 L15 5 L11 8 L13 13 L8 10 L3 13 L5 8 L1 5 L6 5 Z" fill={color} opacity="0.9"/>
      </svg>
    );
  }
  // Robot / Machine → cog
  if (/robot|machine|android|construct|golem|legionnaire|destroyer/i.test(name)) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="3" fill={color} opacity="0.9"/>
        <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M11.54 4.46l-1.41 1.41M4.95 11.54l-1.41 1.41" stroke={color} strokeWidth="1.5" opacity="0.9"/>
      </svg>
    );
  }
  // Elves / Elf → leaf
  if (/elf|eldar|aelf|sylvan/i.test(name)) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        <path d="M8 14 C8 14 2 10 2 5 C2 2 5 1 8 3 C11 1 14 2 14 5 C14 10 8 14 8 14Z" fill={color} opacity="0.9"/>
      </svg>
    );
  }
  // Orcs / Greenskin → fang/skull
  if (/orc|ork|greenskin|warboss|goblin|troll/i.test(name)) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        <path d="M5 2 L5 9 L6 11 L8 12 L10 11 L11 9 L11 2 Z" fill={color} opacity="0.9"/>
        <path d="M6 9 L6 13M10 9 L10 13" stroke={color} strokeWidth="1.5" opacity="0.7"/>
      </svg>
    );
  }
  // Undead → skull
  if (/undead|skeleton|zombie|necro|vampire|lich/i.test(name)) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="7" r="5" fill={color} opacity="0.9"/>
        <rect x="5" y="10" width="2" height="3" rx="0.5" fill={color} opacity="0.7"/>
        <rect x="9" y="10" width="2" height="3" rx="0.5" fill={color} opacity="0.7"/>
        <circle cx="6" cy="7" r="1.2" fill="#1e293b"/>
        <circle cx="10" cy="7" r="1.2" fill="#1e293b"/>
      </svg>
    );
  }
  // Daemons / Chaos → chaos star
  if (/daemon|chaos|demonic|infernal|warp/i.test(name)) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        <path d="M8 1L9.5 6L14 4L10 8L15 9.5L10 10L12 15L8 11L4 15L6 10L1 9.5L6 8L2 4L6.5 6Z" fill={color} opacity="0.9"/>
      </svg>
    );
  }
  // Generic fallback → diamond
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 1L15 8L8 15L1 8Z" fill={color} opacity="0.8"/>
    </svg>
  );
}

// ── Token shape by unit type ──────────────────────────────────────────────────
function TokenShape({ unitType, owner, isActive, isShaken, children }) {
  const baseColor = owner === 'agent_a' ? '#1e3a8a' : '#7f1d1d';
  const borderColor = owner === 'agent_a' ? '#3b82f6' : '#ef4444';
  const activeRing = isActive ? '0 0 0 3px #facc15' : 'none';

  const shared = {
    backgroundColor: baseColor,
    border: `2px solid ${borderColor}`,
    boxShadow: activeRing !== 'none' ? `0 0 0 3px #facc15, inset 0 1px 0 rgba(255,255,255,0.15)` : 'inset 0 1px 0 rgba(255,255,255,0.1)',
    opacity: isShaken ? 0.65 : 1,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'transform 0.15s',
    transform: isActive ? 'scale(1.15)' : 'scale(1)',
  };

  if (unitType === 'vehicle' || unitType === 'transport') {
    // Hexagonal shape via clip-path
    return (
      <div style={{ ...shared, width: 52, height: 44, clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' }}>
        {children}
      </div>
    );
  }
  if (unitType === 'monster') {
    // Larger circle
    return (
      <div style={{ ...shared, width: 48, height: 48, borderRadius: '50%', borderWidth: 3 }}>
        {children}
      </div>
    );
  }
  if (unitType === 'hero') {
    // Diamond/rotated square
    return (
      <div style={{ ...shared, width: 38, height: 38, transform: `rotate(45deg) ${isActive ? 'scale(1.15)' : 'scale(1)'}`, borderRadius: 4 }}>
        <div style={{ transform: 'rotate(-45deg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
          {children}
        </div>
      </div>
    );
  }
  // Infantry — rectangle/square
  return (
    <div style={{ ...shared, width: 40, height: 40, borderRadius: 5 }}>
      {children}
    </div>
  );
}

// ── SVG unit type glyphs ──────────────────────────────────────────────────────
function UnitGlyph({ unitType, color = '#fff' }) {
  if (unitType === 'vehicle') {
    return (
      <svg width="20" height="16" viewBox="0 0 20 16" fill="none">
        <rect x="2" y="4" width="14" height="7" rx="1" fill={color} opacity="0.9"/>
        <rect x="5" y="1" width="8" height="5" rx="1" fill={color} opacity="0.7"/>
        <rect x="14" y="5" width="4" height="2" rx="0.5" fill={color} opacity="0.8"/>
        <circle cx="5" cy="12.5" r="2" fill={color} opacity="0.9"/>
        <circle cx="13" cy="12.5" r="2" fill={color} opacity="0.9"/>
      </svg>
    );
  }
  if (unitType === 'transport') {
    return (
      <svg width="20" height="16" viewBox="0 0 20 16" fill="none">
        <rect x="1" y="4" width="16" height="8" rx="1" fill={color} opacity="0.9"/>
        <rect x="3" y="2" width="5" height="4" rx="0.5" fill={color} opacity="0.6"/>
        <rect x="4" y="6" width="3" height="3" rx="0.5" stroke={color} strokeWidth="0.8" fill="none" opacity="0.7"/>
        <rect x="9" y="6" width="3" height="3" rx="0.5" stroke={color} strokeWidth="0.8" fill="none" opacity="0.7"/>
        <circle cx="5" cy="13" r="1.8" fill={color} opacity="0.9"/>
        <circle cx="13" cy="13" r="1.8" fill={color} opacity="0.9"/>
      </svg>
    );
  }
  if (unitType === 'monster') {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 3 C6 3 3 6 3 9 C3 12 5 14 7 15 L7 17 L9 16 L10 18 L11 16 L13 17 L13 15 C15 14 17 12 17 9 C17 6 14 3 10 3Z" fill={color} opacity="0.85"/>
        <circle cx="7.5" cy="9" r="1.2" fill="#1e293b"/>
        <circle cx="12.5" cy="9" r="1.2" fill="#1e293b"/>
        <path d="M4 5L2 2M16 5L18 2" stroke={color} strokeWidth="1.2" opacity="0.8"/>
      </svg>
    );
  }
  if (unitType === 'hero') {
    return (
      <svg width="16" height="18" viewBox="0 0 16 18" fill="none">
        <circle cx="8" cy="5" r="3" fill={color} opacity="0.9"/>
        <path d="M3 18 C3 13 13 13 13 18" fill={color} opacity="0.9"/>
        <path d="M5 1 L8 0 L11 1" stroke="#facc15" strokeWidth="1.2" fill="none"/>
      </svg>
    );
  }
  // Infantry
  return (
    <svg width="16" height="18" viewBox="0 0 16 18" fill="none">
      <circle cx="8" cy="5" r="3" fill={color} opacity="0.9"/>
      <path d="M3 18 C3 13 13 13 13 18" fill={color} opacity="0.9"/>
    </svg>
  );
}

// ── Health bar ────────────────────────────────────────────────────────────────
function HealthBar({ current, max, width = 40 }) {
  const pct = Math.max(0, Math.min(1, current / Math.max(max, 1)));
  const barColor = pct > 0.6 ? '#22c55e' : pct > 0.3 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ width, height: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 2, overflow: 'hidden', marginTop: 1 }}>
      <div style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: barColor, borderRadius: 2, transition: 'width 0.3s' }} />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function UnitGroupDisplay({ group, activeUnit, onUnitClick, CELL_SIZE, GRID_SIZE }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const displayUnit = group.displayUnit;
  const isTransport = group.isTransport;
  const embarkedCount = isTransport ? group.units.length - 1 : 0;
  const hasActiveUnit = group.units.some(u => u.id === activeUnit?.id);
  const unitType = getUnitType(displayUnit);
  const isShaken = displayUnit.status === 'shaken';
  const isHero = displayUnit.special_rules?.toLowerCase?.().includes('hero');

  const px = group._px ?? (displayUnit.x / GRID_SIZE) * CELL_SIZE;
  const py = group._py ?? (displayUnit.y / GRID_SIZE) * CELL_SIZE;

  // Token size for centering offset
  const tokenW = (unitType === 'vehicle' || unitType === 'transport') ? 52 : unitType === 'monster' ? 48 : 40;
  const tokenH = (unitType === 'vehicle' || unitType === 'transport') ? 44 : unitType === 'monster' ? 48 : 40;

  return (
    <div
      className="absolute"
      style={{ left: px - tokenW / 2, top: py - tokenH / 2, zIndex: hasActiveUnit ? 100 : 10 }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <TokenShape unitType={isTransport ? 'transport' : unitType} owner={displayUnit.owner} isActive={hasActiveUnit} isShaken={isShaken}>
        {/* Glyph */}
        <div style={{ pointerEvents: 'none' }} onClick={() => onUnitClick?.(displayUnit)}>
          <UnitGlyph unitType={isTransport ? 'transport' : unitType} />
        </div>

        {/* Faction icon — bottom-left corner */}
        <div style={{ position: 'absolute', bottom: 2, left: 2 }}>
          <FactionIcon unit={displayUnit} size={12} />
        </div>

        {/* Shaken overlay */}
        {isShaken && (
          <div style={{
            position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'inherit'
          }}>
            <span style={{ fontSize: 8, fontWeight: 'bold', color: '#fca5a5', letterSpacing: 1 }}>SHAKEN</span>
          </div>
        )}

        {/* Hero star badge */}
        {isHero && !isTransport && (
          <div style={{
            position: 'absolute', top: -6, right: -6,
            width: 14, height: 14, borderRadius: '50%',
            backgroundColor: '#854d0e', border: '1.5px solid #facc15',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9
          }}>⭐</div>
        )}

        {/* Transport passenger badge */}
        {isTransport && embarkedCount > 0 && (
          <div style={{
            position: 'absolute', top: -6, right: -6,
            width: 16, height: 16, borderRadius: '50%',
            backgroundColor: '#0e7490', border: '1.5px solid #67e8f9',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 'bold', color: '#fff'
          }}>{embarkedCount}</div>
        )}

        {/* Fatigue dot */}
        {displayUnit.fatigued && (
          <div style={{
            position: 'absolute', bottom: -4, right: -4,
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: '#f97316', border: '1px solid #1e293b'
          }} title="Fatigued" />
        )}
      </TokenShape>

      {/* Health bar beneath token */}
      <div style={{ marginTop: 2, display: 'flex', justifyContent: 'center' }}>
        <HealthBar current={displayUnit.current_models} max={displayUnit.total_models} width={tokenW} />
      </div>

      {/* Unit name label */}
      <div style={{
        marginTop: 2, textAlign: 'center',
        fontSize: 8, fontWeight: 600, color: '#e2e8f0',
        backgroundColor: 'rgba(15,23,42,0.85)',
        paddingLeft: 3, paddingRight: 3, paddingTop: 1, paddingBottom: 1,
        borderRadius: 3, maxWidth: 72, overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        marginLeft: 'auto', marginRight: 'auto',
      }}>
        {displayUnit.name}
      </div>

      {/* Wound count */}
      <div style={{ textAlign: 'center', fontSize: 8, color: '#94a3b8', lineHeight: 1 }}>
        {displayUnit.current_models}/{displayUnit.total_models}w
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div style={{
          position: 'absolute', left: tokenW + 6, top: 0,
          backgroundColor: 'rgba(15,23,42,0.97)', border: '1px solid #334155',
          borderRadius: 8, padding: '8px 10px', whiteSpace: 'nowrap',
          zIndex: 200, pointerEvents: 'none', minWidth: 160,
          boxShadow: '0 4px 20px rgba(0,0,0,0.7)'
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>{displayUnit.name}</div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>
            Type: <span style={{ color: '#e2e8f0' }}>{isTransport ? 'Transport' : unitType}</span>
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>
            Wounds: <span style={{ color: '#4ade80' }}>{displayUnit.current_models}</span>/{displayUnit.total_models}
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>
            Quality: {displayUnit.quality}+ &nbsp; Defense: {displayUnit.defense}+
          </div>
          {displayUnit.status !== 'normal' && (
            <div style={{ fontSize: 10, color: '#f87171', marginBottom: 2 }}>
              Status: {displayUnit.status}
            </div>
          )}
          {isTransport && embarkedCount > 0 && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#67e8f9', marginBottom: 2 }}>
                Passengers ({embarkedCount}):
              </div>
              {group.units.slice(1).map(u => (
                <div key={u.id} style={{ fontSize: 10, color: '#e2e8f0' }}>
                  • {u.name} ({u.current_models}/{u.total_models}w)
                </div>
              ))}
            </div>
          )}
          {displayUnit.special_rules && (
            <div style={{ fontSize: 9, color: '#64748b', marginTop: 4, maxWidth: 200, whiteSpace: 'normal' }}>
              {typeof displayUnit.special_rules === 'string' ? displayUnit.special_rules : displayUnit.special_rules.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}