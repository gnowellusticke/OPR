/**
 * LLMAgent.js — AI agent powered by Claude via the Anthropic API.
 *
 * Implements the Agent interface. Drop in as a replacement for DMNAgent
 * at either or both agent slots in Battle.jsx. Can be mixed — e.g. one
 * side uses LLMAgent, the other uses DMNAgent.
 *
 * Strategy:
 *  - Action + charge target decisions → LLM (high strategic value)
 *  - Shooting target decisions        → LLM (personality-driven)
 *  - Movement destination             → simple heuristic (LLM overkill here)
 *  - Deployment                       → simple heuristic (pre-game, low impact)
 *
 * This keeps API calls to roughly 2 per activation rather than 4,
 * which matters across a 4-round game with 20 units per side.
 */
import { Agent } from './Agent';
import { serializeForLLM, serializeTargetPrompt } from './GameStateSerializer';

// ── Fallback helpers (used when LLM call fails or returns illegal response) ───

function nearestTo(unit, list) {
  if (!list || list.length === 0) return null;
  return list.reduce((best, item) => {
    const db = Math.hypot(best.x - unit.x, best.y - unit.y);
    const di = Math.hypot(item.x - unit.x, item.y - unit.y);
    return di < db ? item : best;
  });
}

// ── LLMAgent ──────────────────────────────────────────────────────────────────

export class LLMAgent extends Agent {
  /**
   * @param {string} faction      — army name shown in system prompt
   * @param {object} personality  — PersonalityRegistry entry ({ name, description, strategicPrinciples })
   * @param {object} apiClient    — Anthropic client with a messages.create() method.
   *                               In your codebase this is the base44 integration or
   *                               a raw Anthropic SDK client.
   * @param {object} [options]
   * @param {string} [options.model]     — defaults to claude-sonnet-4-20250514
   * @param {number} [options.maxTokens] — defaults to 300
   * @param {boolean}[options.verbose]   — log prompts + responses to console
   */
  constructor(faction, personality, apiClient, options = {}) {
    super();
    this.faction     = faction;
    this.personality = personality;
    this.api         = apiClient;
    this.model       = options.model     ?? 'claude-sonnet-4-20250514';
    this.maxTokens   = options.maxTokens ?? 300;
    this.verbose     = options.verbose   ?? false;
    this.systemPrompt = this._buildSystemPrompt();
  }

  _buildSystemPrompt() {
    const p = this.personality;
    const principles = Array.isArray(p?.strategicPrinciples)
      ? p.strategicPrinciples.map(s => `  - ${s}`).join('\n')
      : '  - Play to win objectives\n  - Protect wounded units\n  - Focus fire on weakened enemies';

    return `You are the AI commander of a ${this.faction} army in a tabletop wargame (OPR Grimdark Future).
The game lasts 4 rounds. Victory goes to the side holding the most objectives at the end.

PERSONALITY: ${p?.name ?? 'Balanced'} — ${p?.description ?? 'Play solid, opportunistic wargaming.'}

STRATEGIC PRINCIPLES:
${principles}

RESPONSE FORMAT:
You must respond with ONLY a JSON object. No markdown, no explanation outside the JSON.

For action decisions:
{"action": "Hold"|"Advance"|"Rush"|"Charge", "target": "<enemy unit name, only for Charge>", "reasoning": "<1-2 sentences>"}

For target decisions:
{"targetId": "<unit id string>", "reasoning": "<1 sentence>"}

RULES REMINDERS:
- Shaken units spend their activation idle (they recover automatically — do not charge or shoot)
- Fatigued units only hit on unmodified 6s
- Charging grants the first strike; defenders can only strike back
- Objectives are held by non-shaken units within 3" with no enemy contest
- Only choose from the LEGAL ACTIONS provided — never invent actions`;
  }

  // ── Core API call ─────────────────────────────────────────────────────────

  async _call(userContent) {
    if (this.verbose) {
      console.log('[LLMAgent] PROMPT →', userContent.slice(0, 300), '...');
    }

    try {
      // Support both the raw Anthropic SDK and base44's InvokeLLM wrapper
      let text;
      if (typeof this.api?.messages?.create === 'function') {
        // Raw Anthropic SDK
        const response = await this.api.messages.create({
          model:      this.model,
          max_tokens: this.maxTokens,
          system:     this.systemPrompt,
          messages:   [{ role: 'user', content: userContent }],
        });
        text = response.content?.[0]?.text ?? '';
      } else if (typeof this.api?.InvokeLLM === 'function') {
        // base44 integration (already wired in your codebase)
        text = await this.api.InvokeLLM({
          prompt: userContent,
          system_prompt: this.systemPrompt,
        });
        if (typeof text === 'object') text = JSON.stringify(text);
      } else {
        throw new Error('LLMAgent: apiClient must have messages.create() or InvokeLLM()');
      }

      if (this.verbose) console.log('[LLMAgent] RESPONSE ←', text);

      // Strip accidental markdown fences
      const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      return JSON.parse(clean);
    } catch (err) {
      console.warn('[LLMAgent] API call failed:', err.message);
      return null;
    }
  }

  // ── Agent interface ───────────────────────────────────────────────────────

  async decideAction(unit, gameState) {
    const VALID_ACTIONS = ['Hold', 'Advance', 'Rush', 'Charge'];

    // Get legal actions from the rules engine (injected onto gameState by Battle.jsx)
    const rules = gameState._rulesEngine;
    const legalActions = rules?.getLegalActions(unit, gameState) ?? [
      { action: 'Hold' }, { action: 'Advance' }, { action: 'Rush' },
    ];
    const legalSet = new Set(legalActions.map(a => a.action));

    const prompt = serializeForLLM(unit, gameState, legalActions);
    const decision = await this._call(prompt);

    // Validate — never trust raw LLM output
    if (
      decision &&
      VALID_ACTIONS.includes(decision.action) &&
      legalSet.has(decision.action)
    ) {
      return {
        action:    decision.action,
        target:    decision.target ?? null,
        reasoning: `[LLM] ${decision.reasoning ?? decision.action}`,
        options:   null, // LLMAgent doesn't produce a scored options list
      };
    }

    // Fallback — log and default to Hold
    console.warn(`[LLMAgent] Illegal or missing action "${decision?.action}" — defaulting to Hold`);
    return {
      action:    'Hold',
      reasoning: '[LLM fallback] illegal response — defaulting to Hold',
      options:   null,
    };
  }

  async decideTarget(unit, candidates, gameState) {
    if (!candidates || candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    const prompt   = serializeTargetPrompt(unit, candidates);
    const decision = await this._call(prompt);

    if (decision?.targetId) {
      const found = candidates.find(c => c.id === decision.targetId);
      if (found) return found;
    }

    console.warn('[LLMAgent] Target decision invalid — falling back to nearest');
    return nearestTo(unit, candidates);
  }

  // Movement: LLM adds little value here — simple heuristic is fine.
  async decideMovement(unit, objectives, enemies, gameState) {
    // Prefer uncontrolled or enemy-held objectives; fall back to nearest enemy
    const contested = (objectives || [])
      .filter(o => o.controlled_by !== unit.owner && o.controlled_by !== 'n/a')
      .sort((a, b) =>
        Math.hypot(a.x - unit.x, a.y - unit.y) -
        Math.hypot(b.x - unit.x, b.y - unit.y)
      );
    return contested[0] || nearestTo(unit, objectives) || nearestTo(unit, enemies) || null;
  }

  // Deployment: pre-game, low impact — simple heuristic is fine.
  async decideDeployment(unit, isAgentA, context, gameState) {
    const yMin = isAgentA ? 5  : 34;
    const yMax = isAgentA ? 14 : 43;
    const x = 15 + Math.random() * 42; // spread across board width
    const y = yMin + Math.random() * (yMax - yMin);
    const col  = x < 24 ? 'left' : x < 48 ? 'centre' : 'right';
    const zone = `${isAgentA ? 'south' : 'north'}-${col}`;
    return {
      x, y, zone,
      dmnReason: `LLM agent default deployment — ${zone}`,
      specialRulesApplied: [],
    };
  }
}
