/**
 * DMNAgent.js — Wraps the existing DMNEngine to implement the Agent interface.
 *
 * This is a thin adapter — it delegates every call to DMNEngine unchanged.
 * Drop-in replacement: swapping new DMNAgent(dmnEngine) for dmnEngine at the
 * two instantiation sites in Battle.jsx is the only change needed to wire it up.
 *
 * DMNEngine itself is not modified at all.
 */
import { Agent } from './Agent';

export class DMNAgent extends Agent {
  /**
   * @param {DMNEngine} dmnEngine — your existing DMNEngine instance
   */
  constructor(dmnEngine) {
    super();
    this.dmn = dmnEngine;
  }

  // ── Passthrough helpers so Battle.jsx can still call these directly ─────────
  // (used in deployment phase and a few other places that bypass decideAction)
  get learningData() { return this.dmn.learningData; }
  findNearestEnemy(unit, enemies) { return this.dmn.findNearestEnemy(unit, enemies); }
  findNearestObjective(unit, objectives) { return this.dmn.findNearestObjective(unit, objectives); }
  evaluateActionOptions(unit, gs, owner) { return this.dmn.evaluateActionOptions(unit, gs, owner); }
  async loadLearningData(armyId) { return this.dmn.loadLearningData(armyId); }
  setPersonality(p) { return this.dmn.setPersonality(p); }

  // ── Agent interface ──────────────────────────────────────────────────────────

  async decideAction(unit, gameState) {
    const options = this.dmn.evaluateActionOptions(unit, gameState, unit.owner);
    const sorted  = [...options].sort((a, b) => b.score - a.score);
    const selected = sorted[0];

    // Build the reasoning string the same way Battle.jsx did inline before
    const topDetails = selected?.details
      ?.map(d => `${d.label} (${d.value > 0 ? '+' : ''}${typeof d.value === 'number' ? d.value.toFixed(2) : d.value})`)
      .join('; ') || '';
    const reasoning = selected
      ? `${selected.action} scored ${selected.score.toFixed(2)}${topDetails ? ': ' + topDetails : ''}`
      : 'Hold (fallback)';

    return {
      action:    selected?.action || 'Hold',
      reasoning,
      options,   // passed through so DecisionTreeView still works
    };
  }

  async decideTarget(unit, candidates, gameState) {
    return this.dmn.selectTarget(unit, candidates);
  }

  async decideMovement(unit, objectives, enemies, gameState) {
    return this.dmn.findNearestObjective(unit, objectives)
      || this.dmn.findNearestEnemy(unit, enemies)
      || null;
  }

  async decideDeployment(unit, isAgentA, context, gameState) {
    return this.dmn.decideDeployment(
      unit,
      isAgentA,
      context.enemyDeployed,
      context.myDeployed,
      context.objectives,
      context.terrain,
      context.myUsedZones,
    );
  }
}
