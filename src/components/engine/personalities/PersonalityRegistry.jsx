const aggressive = {
  id: "aggressive",
  name: "Aggressive",
  description: "All-out offense. Prioritises charges and closing with the enemy at all costs.",
  action_weights: {
    Hold:    { base_score: 0.1 },
    Advance: { base_score: 0.6 },
    Rush:    { base_score: 0.7 },
    Charge:  { base_score: 1.8, critically_wounded_penalty: -0.3 }
  },
  targeting: {
    opportunity_kill_bonus: 0.8,
    weakened_target_bonus: 0.8,
    ap_vs_tough_bonus: 0.5,
    high_quality_threat_bonus: 0.2
  },
  attrition_threshold: 0.2,
  risk_bias: 0.4,
  tunnel_vision_chance: 0.3
};

const cautious = {
  id: "cautious",
  name: "Cautious",
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

const opportunist = {
  id: "opportunist",
  name: "Opportunist",
  description: "Adapts to the battlefield. Finishes wounded enemies, captures objectives, exploits gaps.",
  action_weights: {
    Hold:    { base_score: 0.3 },
    Advance: { base_score: 0.5 },
    Rush:    { base_score: 0.4 },
    Charge:  { base_score: 1.2, critically_wounded_penalty: -1.0 }
  },
  targeting: {
    opportunity_kill_bonus: 0.9,
    weakened_target_bonus: 0.9,
    ap_vs_tough_bonus: 0.4,
    high_quality_threat_bonus: 0.25
  },
  attrition_threshold: 0.4,
  risk_bias: 0.1,
  tunnel_vision_chance: 0.1
};

const berserker = {
  id: "berserker",
  name: "Berserker",
  description: "Ignore pain, ignore strategy — charge everything. Gets stronger when wounded.",
  action_weights: {
    Hold:    { base_score: 0.0 },
    Advance: { base_score: 0.5 },
    Rush:    { base_score: 0.9 },
    Charge:  { base_score: 2.2, critically_wounded_penalty: 0.5 }
  },
  targeting: {
    opportunity_kill_bonus: 0.4,
    weakened_target_bonus: 0.4,
    ap_vs_tough_bonus: 0.6,
    high_quality_threat_bonus: 0.5
  },
  attrition_threshold: 0.1,
  risk_bias: 0.8,
  tunnel_vision_chance: 0.5
};

const tactician = {
  id: "tactician",
  name: "Tactician",
  description: "Calculates every move. Focuses on objective control and threat elimination in the right order.",
  action_weights: {
    Hold:    { base_score: 0.5 },
    Advance: { base_score: 0.6 },
    Rush:    { base_score: 0.5 },
    Charge:  { base_score: 1.0, critically_wounded_penalty: -1.5 }
  },
  targeting: {
    opportunity_kill_bonus: 0.7,
    weakened_target_bonus: 1.0,
    ap_vs_tough_bonus: 0.6,
    high_quality_threat_bonus: 0.5
  },
  attrition_threshold: 0.5,
  risk_bias: -0.1,
  tunnel_vision_chance: 0.05
};

export const PERSONALITIES = [aggressive, cautious, opportunist, berserker, tactician];

export const PERSONALITIES_MAP = Object.fromEntries(PERSONALITIES.map(p => [p.id, p]));

export function getPersonality(id) {
  return PERSONALITIES_MAP[id] || null;
}

export function getRandomPersonality() {
  return PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
}

export const DEFAULT_PERSONALITY = opportunist;