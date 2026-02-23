{
  "id": "berserker",
  "name": "Berserker",
  "emoji": "🔥",
  "description": "Pure aggression — ignores wounds, never retreats. Gets stronger the more damage it takes.",
  "action_weights": {
    "Hold":    { "base_score": 0.0,  "on_objective_bonus": 0.1,  "ranged_bonus": 0.0 },
    "Advance": { "base_score": 0.4,  "toward_objective_bonus": 0.1 },
    "Rush":    { "base_score": 0.8,  "into_charge_range_bonus": 1.5 },
    "Charge":  { "base_score": 3.0,  "melee_primary_bonus": 2.5, "critically_wounded_penalty": 0.5 }
  },
  "targeting": {
    "opportunity_kill_bonus": 0.5,
    "weakened_target_bonus": 0.4,
    "ap_vs_tough_bonus": 0.3,
    "high_quality_threat_bonus": 0.6
  },
  "attrition_threshold": 0.05,
  "risk_bias": 1.0,
  "tunnel_vision_chance": 0.5
}