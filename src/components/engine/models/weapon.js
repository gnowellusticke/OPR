export class Weapon {
  constructor({
    name,
    range    = 12,
    attacks  = 1,
    ap       = 0,
    rules    = [],    // string[] or string — normalised on construction
    ruleParams = {}   // NOT used for rule params (those live in the rule string)
                      // used only for UI display overrides if needed
  }) {
    this.name    = name;
    this.range   = range;
    this.attacks = attacks;
    this.ap      = ap;
    // Normalise rules to a single string for RuleRegistry compatibility
    this.special_rules = Array.isArray(rules) ? rules.join(' ') : (rules ?? '');
  }
}
