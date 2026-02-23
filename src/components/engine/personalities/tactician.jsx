json
{
  "id": "tactician",
  "name": "Tactician",
  "emoji": "🧠",
  "description": "Calculates every move. Focuses on objective control and threat elimination in the right order.",
  "action_weights": {
    "Hold":    { "base_score": 0.5 },
    "Advance": { "base_score": 0.6 },
    "Rush":    { "base_score": 0.5 },
    "Charge":  { "base_score": 1.0, "critically_wounded_penalty": -1.5 }
  },
  "targeting": {
    "opportunity_kill_bonus": 0.7,
    "weakened_target_bonus": 1.0,
    "ap_vs_tough_bonus": 0.6,
    "high_quality_threat_bonus": 0.5
  },
  "attrition_threshold": 0.5,
  "risk_bias": -0.1,
  "tunnel_vision_chance": 0.05
}
