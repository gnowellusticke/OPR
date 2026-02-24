import React from 'react';

// Renders the individual model dots for a unit, with special borders for characters and special weapon models.
// Size and shape scale with highest Tough value present in the unit (including joined characters):
//   no Tough (1 wound)  → 9px circle
//   Tough(1-2)          → 9px circle
//   Tough(3-5)          → 13px circle
//   Tough(6-9)          → 18px circle (large circle — not yet a vehicle)
//   Tough(10+)          → 22px rounded square (vehicle/monster)

const MODEL_GAP = 2;
const COLS = 5;

function getModelStyle(toughPerModel) {
  if (toughPerModel >= 10) return { size: 22, radius: '4px', isSquare: true };
  if (toughPerModel >= 6)  return { size: 18, radius: '50%', isSquare: false };
  if (toughPerModel >= 3)  return { size: 13, radius: '50%', isSquare: false };
  return                          { size: 9,  radius: '50%', isSquare: false };
}

// Extract the highest Tough(X) value from a special_rules string/array
function parseTough(special_rules) {
  const str = Array.isArray(special_rules) ? special_rules.join(' ') : (special_rules || '');
  const m = str.match(/Tough\((\d+)\)/);
  return m ? parseInt(m[1]) : 1;
}

// Resolve the effective tough-per-model for display sizing,
// considering that a joined character may have a higher Tough value than the squad.
function resolveEffectiveTough(unit) {
  const ownTough = unit.tough_per_model || parseTough(unit.special_rules);
  // joined_squad means this unit IS the character merged into a squad — check squad tough too
  if (unit.joined_squad) {
    const squadTough = parseTough(unit.joined_squad.special_rules);
    return Math.max(ownTough, squadTough);
  }
  return Math.max(ownTough, 1);
}

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
// Uses actual model count (not wounds) and shows remaining alive models proportionally.
export function buildModelList(unit) {
  // model_count = deployed number of models, total_models = max wounds
  // tough_per_model = wounds per model
  const toughPerModel = Math.max(unit.tough_per_model || 1, 1);
  const deployedModels = unit.model_count || Math.ceil((unit.total_models || 1) / toughPerModel);
  // Remaining alive models = ceil(current wounds / wounds-per-model)
  const aliveModels = Math.max(0, Math.min(deployedModels, Math.ceil((unit.current_models || 0) / toughPerModel)));
  const total = Math.max(1, aliveModels);

  const isChar = isCharacterUnit(unit);
  const hasSpecial = hasSpecialWeapons(unit);

  return Array.from({ length: total }, (_, i) => {
    let type = 'standard';
    if (isChar && i === 0) type = 'character';
    else if (hasSpecial && !isChar && total > 1 && i === total - 1) type = 'special_weapon';
    return { index: i, type };
  });
}

export default function UnitModelDisplay({ unit, owner }) {
  const effectiveTough = resolveEffectiveTough(unit);
  const { size, radius } = getModelStyle(effectiveTough);
  const step = size + MODEL_GAP;

  const models = buildModelList(unit);
  const cols = Math.min(COLS, models.length);
  const rows = Math.ceil(models.length / cols);

  const width = cols * step - MODEL_GAP;
  const height = rows * step - MODEL_GAP;

  const baseColor = owner === 'agent_a' ? '#3b82f6' : '#ef4444';

  return (
    <div className="relative" style={{ width, height }}>
      {models.map((model, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);

        let borderColor = baseColor;
        let borderWidth = 1;
        let boxShadow = 'none';

        if (model.type === 'character') {
          borderColor = '#f59e0b';
          borderWidth = 2;
          boxShadow = '0 0 4px rgba(245,158,11,0.8)';
        } else if (model.type === 'special_weapon') {
          borderColor = '#34d399';
          borderWidth = 2;
          boxShadow = '0 0 4px rgba(52,211,153,0.7)';
        }

        return (
          <div
            key={model.index}
            title={model.type === 'character' ? 'Character' : model.type === 'special_weapon' ? 'Special Weapon' : undefined}
            style={{
              position: 'absolute',
              left: col * step,
              top: row * step,
              width: size,
              height: size,
              borderRadius: radius,
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