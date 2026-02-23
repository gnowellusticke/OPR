json
{
  "id": "berserker",
  "name": "Berserker",
  "emoji": "🔥",
  "description": "Ignore pain, ignore strategy — charge everything. Gets stronger when wounded.",
  "action_weights": {
    "Hold":    { "base_score": 0.0 },
    "Advance": { "base_score": 0.5 },
    "Rush":    { "base_score": 0.9 },
    "Charge":  { "base_score": 2.2, "critically_wounded_penalty": 0.5 }
  },
  "targeting": {
    "opportunity_kill_bonus": 0.4,
    "weakened_target_bonus": 0.4,
    "ap_vs_tough_bonus": 0.6,
    "high_quality_threat_bonus": 0.5
  },
  "attrition_threshold": 0.1,
  "risk_bias": 0.8,
  "tunnel_vision_chance": 0.5
}
