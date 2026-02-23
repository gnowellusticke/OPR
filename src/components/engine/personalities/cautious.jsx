
const cautious = {
  id: "cautious",
  name: "Cautious",
  emoji: "🛡️",
  description: "Defensive and measured. Prefers holding objectives and shooting from safety.",
  action_weights: {
    Hold:    { base_score: 0.7 },
    Advance: { base_score: 0.5 },
    Rush:    { base_score: 0.2 },
    Charge:  { base_score: 0.6, critically_wounded_penalty: -2.0 }
  },
  targeting: {
    opportunity_kill_bonus: 0.5,
    weakened_target_bonus: 0.7,
    ap_vs_tough_bonus: 0.3,
    high_quality_threat_bonus: 0.4
  },
  attrition_threshold: 0.6,
  risk_bias: -0.4,
  tunnel_vision_chance: 0.0
};

export default cautious;
