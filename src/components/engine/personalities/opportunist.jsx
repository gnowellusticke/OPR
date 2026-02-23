{
  "id": "opportunist",
  "name": "Opportunist",
  "emoji": "🎯",
  "description": "Reads the battle and adapts. Finishes wounded units, grabs uncontested objectives, and exploits weaknesses.",
  "action_weights": {
    "Hold":    { "base_score": 0.4,  "on_objective_bonus": 0.5,  "ranged_bonus": 0.3 },
    "Advance": { "base_score": 0.5,  "toward_objective_bonus": 0.4 },
    "Rush":    { "base_score": 0.5,  "into_charge_range_bonus": 0.6 },
    "Charge":  { "base_score": 1.0,  "melee_primary_bonus": 1.2, "critically_wounded_penalty": -1.0 }
  },
  "targeting": {
    "opportunity_kill_bonus": 1.2,
    "weakened_target_bonus": 1.0,
    "ap_vs_tough_bonus": 0.4,
    "high_quality_threat_bonus": 0.3
  },
  "attrition_threshold": 0.4,
  "risk_bias": 0.1,
  "tunnel_vision_chance": 0.1
}