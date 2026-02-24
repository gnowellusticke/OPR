import React from 'react';

// Renders the individual model dots for a unit, with special borders for characters and special weapon models.
// Each model is a small circle; positioned relative to the unit token's top-left corner.

const MODEL_SIZE = 10; // px diameter of each model dot
const MODEL_GAP = 2;   // px gap between dots
const COLS = 5;        // max models per row

// Detect if a unit is a character (Hero rule or solo Tough model treated as hero)
export function isCharacterUnit(unit) {
  const rules = typeof unit.special_rules === 'string'
    ? unit.special_rules
    : (Array.isArray(unit.special_rules) ? unit.special_rules.join(' ') : '');
  return rules.toLowerCase().includes('hero');
}

// Detect if a unit carries special weapons (weapons with range > 18" or blast or ap >= 2)
export function hasSpecialWeapons(unit) {
  return (unit.weapons || []).some(w =>
    (w.range > 18) ||
    (typeof w.special_rules === 'string' && (w.special_rules.includes('Blast') || w.special_rules.includes('Deadly'))) ||
    (Array.isArray(w.special_rules) && w.special_rules.some(r => ['Blast', 'Deadly'].includes(r))) ||
    (w.ap && w.ap >= 2)
  );
}

// Build a list of model descriptors for a unit.
// Models are typed: 'character', 'special_weapon', or 'standard'.
export function buildModelList(unit) {
  const total = unit.current_models || 1;
  const isChar = isCharacterUnit(unit);
  const hasSpecial = hasSpecialWeapons(unit);

  return Array.from({ length: total }, (_, i) => {
    let type = 'standard';
    // The first model of a character unit is always the character
    if (isChar && i === 0) type = 'character';
    // Special weapon bearer: last model of multi-model units that have special weapons
    else if (hasSpecial && !isChar && total > 1 && i === total - 1) type = 'special_weapon';
    return { index: i, type };
  });
}

export default function UnitModelDisplay({ unit, owner }) {
  const models = buildModelList(unit);
  const cols = Math.min(COLS, models.length);
  const rows = Math.ceil(models.length / cols);

  const width = cols * (MODEL_SIZE + MODEL_GAP) - MODEL_GAP;
  const height = rows * (MODEL_SIZE + MODEL_GAP) - MODEL_GAP;

  const baseColor = owner === 'agent_a' ? '#3b82f6' : '#ef4444';

  return (
    <div
      className="relative"
      style={{ width, height }}
    >
      {models.map((model, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = col * (MODEL_SIZE + MODEL_GAP);
        const y = row * (MODEL_SIZE + MODEL_GAP);

        let borderColor = baseColor;
        let borderWidth = 1;
        let boxShadow = 'none';

        if (model.type === 'character') {
          borderColor = '#f59e0b'; // amber-400 gold
          borderWidth = 2;
          boxShadow = '0 0 4px rgba(245,158,11,0.8)';
        } else if (model.type === 'special_weapon') {
          borderColor = '#34d399'; // emerald-400
          borderWidth = 2;
          boxShadow = '0 0 4px rgba(52,211,153,0.7)';
        }

        return (
          <div
            key={model.index}
            title={model.type === 'character' ? 'Character' : model.type === 'special_weapon' ? 'Special Weapon' : undefined}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: MODEL_SIZE,
              height: MODEL_SIZE,
              borderRadius: '50%',
              backgroundColor: baseColor,
              border: `${borderWidth}px solid ${borderColor}`,
              boxShadow,
              opacity: unit.status === 'shaken' ? 0.5 : 1,
            }}
          />
        );
      })}
    </div>
  );
}