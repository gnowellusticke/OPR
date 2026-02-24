import React from 'react';

// Renders individual model dots for a unit. Each dot is sized independently by its own Tough value:
//   Tough 1-2   →  9px circle
//   Tough 3-5   → 13px circle
//   Tough 6-9   → 18px circle
//   Tough 10+   → 22px rounded square
// Joined characters render as one larger gold-bordered dot among the squad's own-sized dots.

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
// Each model carries its own 'toughValue' so the character dot can be a different size from squad dots.
// For a joined-character unit: first model = the hero (using hero's own Tough), rest = squad models.
export function buildModelList(unit) {
  const isChar = isCharacterUnit(unit);
  const hasSpecial = hasSpecialWeapons(unit);

  if (unit.joined_squad) {
    // Hero merged into a squad:
    // - hero = 1 model with hero's own Tough value (alive if hero wounds > 0)
    // - squad models = squad model count, each with squad Tough
    const heroTough = Math.max(unit.tough_per_model || parseTough(unit.special_rules), 1);
    const squadTough = Math.max(parseTough(unit.joined_squad.special_rules), 1);
    const squadModelCount = unit.joined_squad.models || 0;

    // Hero alive check: hero has heroTough wounds; total wounds minus squad wounds = hero wounds
    const squadWounds = unit.current_models > 0
      ? Math.min(squadModelCount * squadTough, unit.current_models)
      : 0;
    const heroWoundsRemaining = Math.max(0, unit.current_models - squadWounds);
    const heroAlive = heroWoundsRemaining > 0;

    // Alive squad models
    const aliveSquadModels = Math.min(squadModelCount, Math.ceil(squadWounds / squadTough));

    const models = [];
    if (heroAlive) {
      models.push({ index: 0, type: 'character', toughValue: heroTough });
    }
    for (let i = 0; i < aliveSquadModels; i++) {
      const type = hasSpecial && i === aliveSquadModels - 1 ? 'special_weapon' : 'standard';
      models.push({ index: models.length, type, toughValue: squadTough });
    }
    return models;
  }

  // Standard unit (no joined squad)
  const toughPerModel = Math.max(unit.tough_per_model || 1, 1);
  const deployedModels = unit.model_count || Math.ceil((unit.total_models || 1) / toughPerModel);
  const aliveModels = Math.max(0, Math.min(deployedModels, Math.ceil((unit.current_models || 0) / toughPerModel)));
  const total = Math.max(1, aliveModels);

  return Array.from({ length: total }, (_, i) => {
    let type = 'standard';
    if (isChar && i === 0) type = 'character';
    else if (hasSpecial && !isChar && total > 1 && i === total - 1) type = 'special_weapon';
    return { index: i, type, toughValue: toughPerModel };
  });
}

export default function UnitModelDisplay({ unit, owner }) {
  const models = buildModelList(unit);
  const cols = Math.min(COLS, models.length);

  // Use the largest model size to determine the grid step (keeps alignment consistent)
  const maxTough = models.reduce((m, mdl) => Math.max(m, mdl.toughValue || 1), 1);
  const { size: maxSize } = getModelStyle(maxTough);
  const step = maxSize + MODEL_GAP;

  const rows = Math.ceil(models.length / cols);
  const width = cols * step - MODEL_GAP;
  const height = rows * step - MODEL_GAP;

  const baseColor = owner === 'agent_a' ? '#3b82f6' : '#ef4444';

  return (
    <div className="relative" style={{ width, height }}>
      {models.map((model, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);

        const { size, radius } = getModelStyle(model.toughValue || 1);

        let borderColor = baseColor;
        let borderWidth = 1;
        let boxShadow = 'none';

        if (model.type === 'character') {
          borderColor = '#f59e0b';
          borderWidth = 2;
          boxShadow = '0 0 5px rgba(245,158,11,0.9)';
        } else if (model.type === 'special_weapon') {
          borderColor = '#34d399';
          borderWidth = 2;
          boxShadow = '0 0 4px rgba(52,211,153,0.7)';
        }

        // Centre smaller dots within the grid cell so they align neatly with larger ones
        const offset = Math.floor((maxSize - size) / 2);

        return (
          <div
            key={model.index}
            title={model.type === 'character' ? 'Character' : model.type === 'special_weapon' ? 'Special Weapon' : undefined}
            style={{
              position: 'absolute',
              left: col * step + offset,
              top: row * step + offset,
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