/**
 * RuleRegistry — game-agnostic special rule plugin system.
 *
 * Rules are registered as objects with named hooks. The engine calls
 * runHook() at key moments (before hit roll, after saves, etc.) and
 * only the rules actually present on a unit/weapon fire.
 *
 * To support a new game: create a new rules file (e.g. rules/my-game.js),
 * register its rules into a fresh RuleRegistry instance, and pass that
 * registry into RulesEngine. Zero engine changes required.
 */
export class RuleRegistry {
  constructor() {
    // name → rule definition
    this._rules = new Map();
    // hookName → [{ ruleName, fn, priority }]
    this._hooks = new Map();
  }

  // ─── Registration ──────────────────────────────────────────────────────────

  /**
   * Register a rule with the registry.
   *
   * definition shape:
   * {
   *   description: string,            // human-readable, for docs/UI
   *   priority: number,               // higher fires first (default 0)
   *   hooks: {
   *     [hookName]: (context) => partialUpdate | void
   *   }
   * }
   *
   * Each hook receives a context object and may return an object with
   * fields to merge back into that context. Returning nothing / undefined
   * is valid (side-effect-only hooks, e.g. logging).
   */
  register(name, definition) {
    if (this._rules.has(name)) {
      console.warn(`[RuleRegistry] Overwriting existing rule: ${name}`);
    }
    this._rules.set(name, definition);

    for (const [hookName, fn] of Object.entries(definition.hooks ?? {})) {
      if (!this._hooks.has(hookName)) this._hooks.set(hookName, []);
      this._hooks.get(hookName).push({
        ruleName: name,
        fn,
        priority: definition.priority ?? 0,
      });
      // Keep sorted highest-priority-first so runHook doesn't re-sort each time
      this._hooks.get(hookName).sort((a, b) => b.priority - a.priority);
    }
  }

  registerAll(definitions) {
    for (const [name, def] of Object.entries(definitions)) {
      this.register(name, def);
    }
  }

  // ─── Parsing ───────────────────────────────────────────────────────────────

  /**
   * Parse special_rules (string, array of strings, or array of objects)
   * into a canonical array: [{ name: string, params: string|null }]
   *
   * Handles all the formats that appear in your current data:
   *   "Tough(6) Fast Fearless"
   *   ["Tough(6)", "Fast"]
   *   [{ rule: "Tough(6)" }, "Fast"]
   */
  parse(special_rules) {
    if (!special_rules) return [];

    let str;
    if (Array.isArray(special_rules)) {
      str = special_rules
        .map(r => (typeof r === 'string' ? r : r?.rule ?? ''))
        .join(' ');
    } else {
      str = typeof special_rules === 'string' ? special_rules : '';
    }

    const result = [];
    // Match "RuleName" or "RuleName(params)" — supports multi-word params like "Transport(10)"
    const pattern = /([A-Za-z][A-Za-z0-9-]*)(?:\(([^)]*)\))?/g;
    let match;
    while ((match = pattern.exec(str)) !== null) {
      result.push({
        name: match[1],
        params: match[2] ?? null,            // null if no parens
        paramValue: match[2] ? parseInt(match[2]) || match[2] : null,
      });
    }
    return result;
  }

  /** Returns true if special_rules contains ruleName. */
  has(special_rules, ruleName) {
    return this.parse(special_rules).some(r => r.name === ruleName);
  }

  /** Returns the parsed params for ruleName, or null if absent. */
  getParam(special_rules, ruleName) {
    const rule = this.parse(special_rules).find(r => r.name === ruleName);
    return rule?.params ?? null;
  }

  getParamValue(special_rules, ruleName) {
    const rule = this.parse(special_rules).find(r => r.name === ruleName);
    return rule?.paramValue ?? null;
  }

  // ─── Hook Execution ────────────────────────────────────────────────────────

  /**
   * Run all registered handlers for `hookName` that are present in
   * `special_rules`. Each handler may mutate `context` via its return value.
   *
   * @param {string}   hookName       - e.g. 'beforeHitQuality'
   * @param {object}   context        - mutable context passed through all handlers
   * @param {*}        special_rules  - raw special_rules from unit or weapon
   * @returns {object}                - the final context (same reference, mutated)
   */
  runHook(hookName, context, special_rules) {
    const handlers = this._hooks.get(hookName);
    if (!handlers || handlers.length === 0) return context;

    const parsedRules = this.parse(special_rules);
    const ruleMap = new Map(parsedRules.map(r => [r.name, r]));

    for (const handler of handlers) {
      const parsedRule = ruleMap.get(handler.ruleName);
      if (!parsedRule) continue; // rule not present on this entity

      const enrichedContext = {
        ...context,
        _ruleName: handler.ruleName,
        _ruleParams: parsedRule.params,
        _ruleParamValue: parsedRule.paramValue,
      };

      const updates = handler.fn(enrichedContext);
      if (updates && typeof updates === 'object') {
        Object.assign(context, updates);
      }
    }

    return context;
  }

  /**
   * Convenience: run a hook on BOTH unit and weapon rules, merging results.
   * Useful for hooks where either the unit OR the weapon can provide the rule
   * (e.g. Furious can be on a unit, a weapon, or both).
   */
  runHookOn(hookName, context, ...ruleSources) {
    for (const src of ruleSources) {
      this.runHook(hookName, context, src);
    }
    return context;
  }

  // ─── Introspection ─────────────────────────────────────────────────────────

  getDefinition(ruleName) {
    return this._rules.get(ruleName) ?? null;
  }

  listRules() {
    return [...this._rules.keys()];
  }

  listHooks() {
    return [...this._hooks.keys()];
  }
}

// ─── Canonical Hook Names ──────────────────────────────────────────────────
// Reference these constants in both rule definitions and the engine
// so a typo in a string doesn't silently break things.
export const HOOKS = {
  // Shooting & Melee — hit phase
  BEFORE_HIT_QUALITY:   'beforeHitQuality',   // modify quality before rolling
  AFTER_HIT_ROLLS:      'afterHitRolls',       // generate extra hits after rolling

  // Shooting & Melee — save phase
  BEFORE_SAVE_DEFENSE:  'beforeSaveDefense',   // modify defense before rolling
  ON_PER_HIT:           'onPerHit',            // per-hit processing (Rending, Bane)
  ON_WOUND_CALC:        'onWoundCalc',         // wounds per unsaved hit (Deadly)

  // Post-damage
  ON_INCOMING_WOUNDS:   'onIncomingWounds',    // reduce incoming wounds (Regeneration)

  // Movement
  GET_BASE_SPEED:       'getBaseSpeed',        // override base speed (Aircraft, Immobile)
  MODIFY_SPEED:         'modifySpeed',         // add/subtract from speed (Fast, Slow)
  ON_TERRAIN_MOVE:      'onTerrainMove',       // terrain speed penalties
  ON_DANGEROUS_TERRAIN: 'onDangerousTerrain',  // roll for wounds in terrain

  // Morale
  ON_MORALE_TEST:       'onMoraleTest',        // modify or override morale result

  // Deployment & Special Entry
  ON_DEPLOY:            'onDeploy',            // custom deployment logic
  ON_RESERVE_ENTRY:     'onReserveEntry',      // Ambush, Teleport mid-game placement

  // Transport
  ON_TRANSPORT_DESTROY: 'onTransportDestroy',  // passengers when transport dies

  // Objective / Turn
  ON_OBJECTIVE_CHECK:   'onObjectiveCheck',    // can this unit claim an objective?

  // Spell / Caster
  ON_SPELL_CAST:        'onSpellCast',         // modify cast roll
  ON_TOKEN_GAIN:        'onTokenGain',         // modify token gain
};
