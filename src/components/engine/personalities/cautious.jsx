{
  "id": "cautious",
  "name": "Cautious",
  "emoji": "🛡️",
  "description": "Defensive player. Holds strong positions, shoots from cover, and avoids unnecessary risks.",
  "action_weights": {
    "Hold":    { "base_score": 0.7,  "on_objective_bonus": 0.6,  "ranged_bonus": 0.5 },
    "Advance": { "base_score": 0.3,  "toward_objective_bonus": 0.2 },
    "Rush":    { "base_score": 0.1,  "into_charge_range_bonus": 0.3 },
    "Charge":  { "base_score": 0.4,  "melee_primary_bonus": 0.8, "critically_wounded_penalty": -2.0 }
  },
  "targeting": {
    "opportunity_kill_bonus": 0.5,
    "weakened_target_bonus": 0.3,
    "ap_vs_tough_bonus": 0.3,
    "high_quality_threat_bonus": 0.5
  },
  "attrition_threshold": 0.6,
  "risk_bias": -0.3,
  "tunnel_vision_chance": 0.05
}