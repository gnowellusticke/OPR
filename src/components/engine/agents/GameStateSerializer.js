/**
 * GameStateSerializer.js — Converts game state into plain-language text
 * for the LLM prompt. Kept as pure functions so it's easy to test and tweak.
 *
 * Design goals:
 *  - Token-efficient: no redundant data, numbers rounded
 *  - Spatially informative: distances and directions described verbally
 *  - Rules-aware: special rules surfaced where strategically relevant
 */

// ── Distance helpers ──────────────────────────────────────────────────────────

function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function describeDist(d) {
  if (d <= 1)  return `${d.toFixed(1)}" (base contact)`;
  if (d <= 6)  return `${d.toFixed(1)}" (close)`;
  if (d <= 12) return `${d.toFixed(1)}" (medium)`;
  if (d <= 24) return `${d.toFixed(1)}" (long)`;
  return `${d.toFixed(1)}" (far)`;
}

function describeRelativePos(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d  = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.1) return 'same position';
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const dirs = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
  const idx = Math.round((angle + 180) / 45) % 8;
  return `${describeDist(d)} to the ${dirs[idx]}`;
}

// ── Unit description helpers ──────────────────────────────────────────────────

function healthBar(unit) {
  const pct = Math.round((unit.current_models / Math.max(unit.total_models, 1)) * 100);
  return `${unit.current_models}/${unit.total_models} wounds (${pct}%)`;
}

function describeWeapons(unit) {
  const ws = unit.weapons || [];
  if (ws.length === 0) return 'Fists (melee, A1)';
  return ws.map(w => {
    const range   = (w.range ?? 2) <= 2 ? 'melee' : `${w.range}"`;
    const attacks = `A${w.attacks || 1}`;
    const ap      = w.ap > 0 ? ` AP(${w.ap})` : '';
    const sr      = w.special_rules
      ? ` [${Array.isArray(w.special_rules) ? w.special_rules.join(', ') : w.special_rules}]`
      : '';
    return `${w.name} (${range}, ${attacks}${ap}${sr})`;
  }).join('; ');
}

function describeKeyRules(unit) {
  const sr = Array.isArray(unit.special_rules)
    ? unit.special_rules.join(' ')
    : (unit.special_rules || '');
  if (!sr) return 'none';
  // Surface the rules most relevant to decision-making
  const strategicRules = [
    'Fearless', 'Fear', 'Furious', 'Fast', 'Slow', 'Ambush', 'Teleport',
    'Regeneration', 'Self-Repair', 'Transport', 'Caster', 'Stealth',
    'Strider', 'Flying', 'Immobile', 'Aircraft',
  ];
  const found = strategicRules.filter(r => sr.includes(r));
  // Also include any Tough(X), Impact(X), Blast(X) etc.
  const paramRules = sr.match(/\b(Tough|Impact|Caster|Transport|Deadly|AP|Blast)\(\d+\)/g) || [];
  const combined = [...new Set([...found, ...paramRules])];
  return combined.length > 0 ? combined.join(', ') : 'none';
}

// ── Objective helpers ─────────────────────────────────────────────────────────

function describeObjective(obj, activeUnit) {
  const holder = obj.controlled_by === 'n/a' ? 'not in play'
    : obj.controlled_by === null             ? 'uncontrolled'
    : obj.controlled_by === activeUnit.owner ? 'held by YOU'
    : obj.controlled_by === 'contested'      ? 'CONTESTED'
    : 'held by ENEMY';
  const d = dist(activeUnit, obj);
  return `  ${obj.id}: ${holder}, ${describeDist(d)} away`;
}

// ── Action descriptions ───────────────────────────────────────────────────────

function describeAction(a) {
  switch (a.action) {
    case 'Hold':
      return `  Hold — stay in place, shoot all ranged weapons`;
    case 'Advance':
      return `  Advance — move up to ${a.moveDistance?.toFixed(1) ?? '6'}" then shoot`;
    case 'Rush':
      return `  Rush — move up to ${a.moveDistance?.toFixed(1) ?? '12'}", no shooting`;
    case 'Charge':
      return `  Charge — charge into melee (up to ${a.chargeDistance?.toFixed(1) ?? '12'}"), reachable targets: ${(a.reachableTargets || []).join(', ')}`;
    default:
      return `  ${a.action}`;
  }
}

// ── Main serialiser ───────────────────────────────────────────────────────────

/**
 * Builds the user-turn prompt for the LLM.
 *
 * @param {object}   unit         — activating unit
 * @param {object}   gameState    — full game state
 * @param {object[]} legalActions — from RulesEngine.getLegalActions()
 * @returns {string}
 */
export function serializeForLLM(unit, gameState, legalActions) {
  const enemies   = gameState.units.filter(u => u.owner !== unit.owner && u.current_models > 0);
  const friends   = gameState.units.filter(u => u.owner === unit.owner && u.current_models > 0 && u.id !== unit.id);
  const objectives = gameState.objectives?.filter(o => o.controlled_by !== 'n/a') || [];

  const myObjectives  = objectives.filter(o => o.controlled_by === unit.owner).length;
  const eneObjectives = objectives.filter(o => o.controlled_by && o.controlled_by !== unit.owner && o.controlled_by !== 'contested').length;

  return `
ROUND ${gameState.current_round} of 4  |  Score: You ${myObjectives} – ${eneObjectives} Enemy

═══ YOUR UNIT ════════════════════════════════
${unit.name}
  Health : ${healthBar(unit)}${unit.status !== 'normal' ? `  [${unit.status.toUpperCase()}]` : ''}
  Quality: ${unit.quality}+   Defense: ${unit.defense}+
  Weapons: ${describeWeapons(unit)}
  Rules  : ${describeKeyRules(unit)}${unit.spell_tokens > 0 ? `\n  Spell tokens: ${unit.spell_tokens}` : ''}

═══ FRIENDLY UNITS ═══════════════════════════
${friends.length === 0 ? '  (none surviving)' : friends.map(u => {
  const d = dist(unit, u);
  const hp = Math.round((u.current_models / Math.max(u.total_models, 1)) * 100);
  return `  ${u.name}: ${hp}% health, ${describeDist(d)} away${u.status !== 'normal' ? ` [${u.status}]` : ''}`;
}).join('\n')}

═══ ENEMY UNITS ══════════════════════════════
${enemies.length === 0 ? '  (none surviving)' : enemies.map(u => {
  const d = dist(unit, u);
  const hp = Math.round((u.current_models / Math.max(u.total_models, 1)) * 100);
  const sr = describeKeyRules(u);
  const wpn = (u.weapons || []).some(w => (w.range ?? 2) > 2) ? ' [has ranged]' : ' [melee only]';
  return `  ${u.name}: ${hp}% health, ${describeRelativePos(unit, u)}${wpn}${sr !== 'none' ? ` rules: ${sr}` : ''}${u.status !== 'normal' ? ` [${u.status}]` : ''}`;
}).join('\n')}

═══ OBJECTIVES ═══════════════════════════════
${objectives.length === 0 ? '  (none)' : objectives.map(o => describeObjective(o, unit)).join('\n')}

═══ LEGAL ACTIONS ════════════════════════════
${legalActions.map(describeAction).join('\n')}

Choose the best action for ${unit.name}. Respond ONLY with valid JSON.
`.trim();
}

/**
 * Builds a shorter prompt for target selection only.
 */
export function serializeTargetPrompt(unit, candidates) {
  const options = candidates.map((c, i) => ({
    index: i,
    id: c.id,
    name: c.name,
    health: healthBar(c),
    distance: describeDist(dist(unit, c)),
    defense: `${c.defense}+`,
    rules: describeKeyRules(c),
    status: c.status || 'normal',
  }));

  return `${unit.name} needs to pick a target.

Options:
${JSON.stringify(options, null, 2)}

Respond ONLY with: {"targetId": "<id>", "reasoning": "<brief reason>"}`;
}
