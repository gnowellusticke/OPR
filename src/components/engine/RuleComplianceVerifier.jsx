import { base44 } from '@/api/base44Client';

export async function verifyRuleCompliance(battleLog) {
  const violations = [];
  const profileIssues = [];
  const recommendations = new Set();
  let totalEventsChecked = 0;

  if (battleLog.events) {
    totalEventsChecked = battleLog.events.length;

    battleLog.events.forEach((event) => {
      const eventType = event.event_type;
      const rr = event.roll_results;

      // ── Shooting ──────────────────────────────────────────────────────────────
      if (eventType === 'shoot') {
        // Blast: attacks > hits means quality roll was used instead of auto-hits
        if (rr?.blast && rr?.attacks > rr?.hits) {
          violations.push({
            event_id: String(event.round),
            event_type: 'shoot',
            units_involved: [event.acting_unit, event.target_unit].filter(Boolean),
            rule_involved: 'Blast',
            description: 'Blast weapon used quality roll instead of automatic hits',
            severity: 'error',
            details: { attacks: rr.attacks, hits: rr.hits }
          });
          recommendations.add('Blast(X) weapons must generate exactly X automatic hits with no quality roll');
        }

        // Bane + Rending on same weapon is a conflict
        const hasBane = rr?.special_rules_applied?.some(r => r.rule === 'Bane');
        const hasRending = rr?.special_rules_applied?.some(r => r.rule === 'Rending');
        if (hasBane && hasRending) {
          violations.push({
            event_id: String(event.round),
            event_type: 'shoot',
            units_involved: [event.acting_unit].filter(Boolean),
            rule_involved: 'Bane/Rending',
            description: 'Both Bane and Rending applied to the same weapon — conflicting auto-wound rules',
            severity: 'warning',
            details: {}
          });
        }
      }

      // ── Melee ─────────────────────────────────────────────────────────────────
      if (eventType === 'melee') {
        const { attacker_hits, defender_saves_made, wounds_dealt } = rr || {};
        const fearBonus = rr?.melee_resolution?.fear_bonus_attacker || 0;

        // Fear bonus must NOT inflate actual wounds_dealt
        if (fearBonus > 0 && wounds_dealt !== undefined) {
          const expectedMax = Math.max(0, (attacker_hits || 0) - (defender_saves_made || 0));
          if (wounds_dealt > expectedMax + fearBonus) {
            violations.push({
              event_id: String(event.round),
              event_type: 'melee',
              units_involved: [event.acting_unit, event.target_unit].filter(Boolean),
              rule_involved: 'Fear',
              description: 'Fear bonus appears to have inflated actual wounds_dealt',
              severity: 'error',
              details: { fear_bonus: fearBonus, wounds_dealt, expected_max: expectedMax }
            });
            recommendations.add('Fear(X) bonus must only affect melee victory comparison, not actual wounds dealt');
          }
        }

        // Deadly multiplier sanity check
        const deadlyRule = rr?.special_rules_applied?.find(r => r.rule === 'Deadly');
        if (deadlyRule && wounds_dealt !== undefined && attacker_hits !== undefined) {
          const multiplier = deadlyRule.value || 1;
          const absoluteMax = (attacker_hits || 0) * multiplier;
          if (wounds_dealt > absoluteMax) {
            violations.push({
              event_id: String(event.round),
              event_type: 'melee',
              units_involved: [event.acting_unit].filter(Boolean),
              rule_involved: 'Deadly',
              description: `Wounds dealt (${wounds_dealt}) exceeds hits × multiplier (${absoluteMax}) — Deadly applied more than once`,
              severity: 'error',
              details: { wounds_dealt, attacker_hits, multiplier, absolute_max: absoluteMax }
            });
            recommendations.add('Deadly multiplier must be applied exactly once per unsaved wound');
          }
        }
      }

      // ── Morale ────────────────────────────────────────────────────────────────
      if (eventType === 'morale') {
        const fearlessRule = rr?.special_rules_applied?.find(r => r.rule === 'Fearless');
        // Fearless re-roll should give a second chance on 4+; shaken despite re-rolling >= 4 is an error
        if (fearlessRule && rr?.outcome === 'shaken' && rr?.reroll >= 4) {
          violations.push({
            event_id: String(event.round),
            event_type: 'morale',
            units_involved: [event.acting_unit].filter(Boolean),
            rule_involved: 'Fearless',
            description: `Fearless unit became Shaken despite re-rolling ${rr.reroll} (should pass on 4+)`,
            severity: 'error',
            details: { roll: rr.roll, reroll: rr.reroll }
          });
          recommendations.add('Fearless re-roll must succeed on 4+; unit must not become Shaken if re-roll >= 4');
        }
      }

      // ── Regeneration ─────────────────────────────────────────────────────────
      if (eventType === 'regeneration') {
        if (rr?.roll && rr.roll <= 4 && rr?.wounds_recovered > 0) {
          violations.push({
            event_id: String(event.round),
            event_type: 'regeneration',
            units_involved: [event.acting_unit].filter(Boolean),
            rule_involved: 'Regeneration',
            description: `Regeneration triggered on roll of ${rr.roll} (requires 5+)`,
            severity: 'error',
            details: { roll: rr.roll, recovered: rr.wounds_recovered }
          });
          recommendations.add('Regeneration/Self-Repair must only recover wounds on a roll of 5+');
        }
      }

      // ── Objective ─────────────────────────────────────────────────────────────
      if (eventType === 'objective') {
        const validValues = ['agent_a', 'agent_b', 'contested', null, undefined];
        if (!validValues.includes(rr?.controlled_by)) {
          violations.push({
            event_id: String(event.round),
            event_type: 'objective',
            units_involved: [],
            rule_involved: 'Objective Control',
            description: `Invalid objective control value: "${rr.controlled_by}"`,
            severity: 'error',
            details: { value: rr.controlled_by }
          });
        }
      }
    });
  }

  // Profile: both armies must be present in the log
  if (!battleLog.agent_a || !battleLog.agent_b) {
    profileIssues.push({
      unit_name: 'Battle Setup',
      issue: 'Missing army profile in battle log',
      details: { agent_a: !!battleLog.agent_a, agent_b: !!battleLog.agent_b }
    });
  }

  const totalViolations = violations.length;
  const complianceScore = Math.max(0, 100 - totalViolations * 10);

  const report = {
    battle_id: battleLog.battle_id,
    summary: {
      total_events_checked: totalEventsChecked,
      total_violations: totalViolations,
      compliance_score: complianceScore
    },
    violations,
    profile_issues: profileIssues,
    recommendations: Array.from(recommendations)
  };

  await base44.entities.RuleComplianceReport.create(report);
  return report;
}