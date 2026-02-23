json
{
  "id": "aggressive",
  "name": "Aggressive",
  "emoji": "⚔️",
  "description": "All-out offense. Prioritises charges and closing with the enemy at all costs.",
  "action_weights": {
    "Hold":    { "base_score": 0.1 },
    "Advance": { "base_score": 0.6 },
    "Rush":    { "base_score": 0.7 },
    "Charge":  { "base_score": 1.8, "critically_wounded_penalty": -0.3 }
  },
  "targeting": {
    "opportunity_kill_bonus": 0.8,
    "weakened_target_bonus": 0.8,
    "ap_vs_tough_bonus": 0.5,
    "high_quality_threat_bonus": 0.2
  },
  "attrition_threshold": 0.2,
  "risk_bias": 0.4,
  "tunnel_vision_chance": 0.3
}
