json
{
  "id": "opportunist",
  "name": "Opportunist",
  "description": "Adapts to the battlefield. Finishes wounded enemies, captures objectives, exploits gaps.",
  "action_weights": {
    "Hold":    { "base_score": 0.3 },
    "Advance": { "base_score": 0.5 },
    "Rush":    { "base_score": 0.4 },
    "Charge":  { "base_score": 1.2, "critically_wounded_penalty": -1.0 }
  },
  "targeting": {
    "opportunity_kill_bonus": 0.9,
    "weakened_target_bonus": 0.9,
    "ap_vs_tough_bonus": 0.4,
    "high_quality_threat_bonus": 0.25
  },
  "attrition_threshold": 0.4,
  "risk_bias": 0.1,
  "tunnel_vision_chance": 0.1
}
