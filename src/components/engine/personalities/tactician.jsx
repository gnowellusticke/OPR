{
  "id": "tactician",
  "name": "Tactician",
  "emoji": "🧠",
  "description": "Methodical and objective-focused. Prioritises board control, maintains formation, and never overcommits.",
  "action_weights": {
    "Hold":    { "base_score": 0.5,  "on_objective_bonus": 0.7,  "ranged_bonus": 0.4 },
    "Advance": { "base_score": 0.6,  "toward_objective_bonus": 0.6 },
    "Rush":    { "base_score": 0.4,  "into_charge_range_bonus": 0.4 },
    "Charge":  { "base_score": 0.8,  "melee_primary_bonus": 1.0, "critically_wounded_penalty": -1.5 }
  },
  "targeting": {
    "opportunity_kill_bonus": 0.4,
    "weakened_target_bonus": 0.5,
    "ap_vs_tough_bonus": 0.6,
    "high_quality_threat_bonus": 0.4
  },
  "attrition_threshold": 0.45,
  "risk_bias": -0.1,
  "tunnel_vision_chance": 0.05
}