{
  "id": "aggressive",
  "name": "Aggressive",
  "emoji": "⚔️",
  "description": "Charges headlong into melee. Prioritises killing over holding ground. High risk, high reward.",
  "action_weights": {
    "Hold":    { "base_score": 0.1,  "on_objective_bonus": 0.2,  "ranged_bonus": 0.1 },
    "Advance": { "base_score": 0.5,  "toward_objective_bonus": 0.2 },
    "Rush":    { "base_score": 0.6,  "into_charge_range_bonus": 1.0 },
    "Charge":  { "base_score": 2.0,  "melee_primary_bonus": 2.0, "critically_wounded_penalty": -0.4 }
  },
  "targeting": {
    "opportunity_kill_bonus": 0.8,
    "weakened_target_bonus": 0.6,
    "ap_vs_tough_bonus": 0.5,
    "high_quality_threat_bonus": 0.2
  },
  "attrition_threshold": 0.25,
  "risk_bias": 0.4,
  "tunnel_vision_chance": 0.3
}