/**
 * Agent.js — Base interface for all AI agents.
 *
 * Both DMNAgent (your existing scoring AI) and LLMAgent implement this
 * interface. Battle.jsx only ever calls these four methods, so swapping
 * agents — or mixing them — requires zero changes to game logic.
 *
 * All methods are async so LLMAgent can await API calls without the call
 * site caring which type of agent it's talking to.
 */
export class Agent {
  /**
   * Decide which action to take this activation.
   * @returns {Promise<{action: string, target?: string, reasoning: string, options?: any[]}>}
   *   action   — 'Hold' | 'Advance' | 'Rush' | 'Charge'
   *   target   — unit name, only when action === 'Charge'
   *   reasoning — human-readable string, logged to event stream
   *   options  — full scored list (DMN only, for DecisionTreeView)
   */
  async decideAction(unit, gameState) {
    throw new Error(`${this.constructor.name} must implement decideAction()`);
  }

  /**
   * Decide which enemy unit to target for shooting or spells.
   * @param {object[]} candidates — live enemy units already filtered to range/LOS
   * @returns {Promise<object>} the chosen enemy unit object
   */
  async decideTarget(unit, candidates, gameState) {
    throw new Error(`${this.constructor.name} must implement decideTarget()`);
  }

  /**
   * Decide where to move toward (objective or enemy unit).
   * Used for Advance and Rush actions.
   * @returns {Promise<object|null>} a position/unit/objective, or null
   */
  async decideMovement(unit, objectives, enemies, gameState) {
    throw new Error(`${this.constructor.name} must implement decideMovement()`);
  }

  /**
   * Decide where to deploy a unit during the deployment phase.
   * @param {object} context — { enemyDeployed, myDeployed, objectives, terrain, myUsedZones }
   * @returns {Promise<{x, y, zone, dmnReason, specialRulesApplied}>}
   */
  async decideDeployment(unit, isAgentA, context, gameState) {
    throw new Error(`${this.constructor.name} must implement decideDeployment()`);
  }
}
