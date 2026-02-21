import { base44 } from '@/api/base44Client';

export default async function verifyRuleCompliance(battleLog) {
  const violations = [];
  const profileIssues = [];
  const recommendations = new Set();
  let totalEventsChecked = 0;

  // Analyze each event in the battle log
  if (battleLog.events) {
    totalEventsChecked = battleLog.events.length;

    battleLog.events.forEach((event) => {
      const eventType = event.event_type;

      // Shooting validation
      if (eventType === 'shoot') {
        const { roll_results, acting_unit, target_unit } = event;
        
        // Check if Blast weapons used multiple shots (Bug 1)
        if (roll_results?.blast && roll_results?.attacks > roll_results?.hits) {
          violations.push({
            event_id: event.round.toString(),
            event_type: 'shoot',
            units_involved: [acting_unit, target_unit],
            rule_involved: 'Blast',
            description: 'Blast weapon fired with quality roll instead of automatic hits',
            severity: 'error',
            details: {
              attacks: roll_results.attacks,
              hits: roll_results.hits,
              expected_hits: roll_results.hits
            }
          });
          recommendations.add('Ensure Blast(X) weapons always generate X automatic hits with no quality roll');
        }

        // Check AP application (Bug 3)
        if (roll_results?.special_rules_applied) {
          const apRule = roll_results.special_rules_applied.find(r => r.rule === 'AP');
          if (apRule && roll_results.wounds_dealt === 0 && roll_results.hits > 0) {
            // AP might not have been properly applied if there are hits but no wounds
            recommendations.add('Verify AP is correctly reducing defense values, not being applied post-save');
          }
        }

        // Check Bane vs Rending conflict (Bug 1)
        const hasBane = roll_results?.special_rules_applied?.some(r => r.rule === 'Bane');
        const hasRending = roll_results?.special_rules_applied?.some(r => r.rule === 'Rending');
        if (hasBane && hasRending) {
          violations.push({
            event_id: event.round.toString(),
            event_type: 'shoot',
            units_involved: [acting_unit],
            rule_involved: 'Bane/Rending',
            description: 'Both Bane and Rending rules applied to same weapon (conflict)',
            severity: 'warning',
            details: { bane_procs: roll_results.baneProcs }
          });
        }
      }

      // Melee validation
      if (eventType === 'melee') {
        const { roll_results } = event;
        
        // Check wound calculation consistency
        if (roll_results?.wounds_dealt !== undefined) {
          const { attacker_hits, defender_saves_made, attacker_wounds, defender_wounds } = roll_results;
          
          // Validate wounds_dealt calculation
          const expectedWounds = Math.max(0, (attacker_hits || 0) - (defender_saves_made || 0));
          if (expectedWounds > 0 && attacker_wounds !== expectedWounds) {
            // Allow for multipliers (Deadly) but flag if there's a major discrepancy
            if (attacker_wounds > expectedWounds * 3) {
              violations.push({
                event_id: event.round.toString(),
                event_type: 'melee',
                units_involved: [event.acting_unit, event.target_unit],
                rule_involved: 'Wound Calculation',
                description: 'Melee wounds dealt exceeds expected value (potential multiplier over-application)',
                severity: 'warning',
                details: {
                  hits: attacker_hits,
                  saves: defender_saves_made,
                  expected_wounds: expectedWounds,
                  actual_wounds: attacker_wounds
                }
              });
              recommendations.add('Review Deadly multiplier application - ensure applied only once per unsaved wound');
            }
          }

          // Check Fear bonus application (Bug 1)
          const fearBonus = roll_results.melee_resolution?.fear_bonus_attacker || 0;
          if (fearBonus > 0 && attacker_wounds < expectedWounds + fearBonus) {
            violations.push({
              event_id: event.round.toString(),
              event_type: 'melee',
              units_involved: [event.acting_unit],
              rule_involved: 'Fear',
              description: 'Fear bonus applied to actual wounds instead of melee resolution only',
              severity: 'error',
              details: {
                fear_bonus: fearBonus,
                wounds_dealt: attacker_wounds
              }
            });
            recommendations.add('Fear bonuses should only affect melee victory comparison, not actual wound count');
          }
        }
      }

      // Morale validation
      if (eventType === 'morale') {
        const { roll_results } = event;
        
        // Check Fearless re-roll usage
        if (roll_results?.special_rules_applied) {
          const fearlessRule = roll_results.special_rules_applied.find(r => r.rule === 'Fearless');
          if (fearlessRule && roll_results.outcome === 'shaken') {
            // Fearless should prevent shaken, flag if it didn't
            violations.push({
              event_id: event.round.toString(),
              event_type: 'morale',
              units_involved: [event.acting_unit],
              rule_involved: 'Fearless',
              description: 'Fearless unit failed morale after re-roll',
              severity: 'warning',
              details: { roll: roll_results.roll, reroll: roll_results.reroll }
            });
          }
        }
      }

      // Charge validation
      if (eventType === 'charge') {
        const { roll_results } = event;
        
        // Check for special rules on charge
        if (roll_results?.special_rules_applied) {
          const impactRule = roll_results.special_rules_applied.find(r => r.rule === 'Impact');
          if (impactRule && !event.acting_unit.includes('charged')) {
            recommendations.add('Verify Impact rule is only applied on charging units with the rule');
          }
        }
      }

      // Objective validation
      if (eventType === 'objective') {
        // Objectives should only be controlled by one side or contested
        if (roll_results?.controlled_by && !['agent_a', 'agent_b', 'contested', null].includes(roll_results.controlled_by)) {
          violations.push({
            event_id: event.round.toString(),
            event_type: 'objective',
            units_involved: [],
            rule_involved: 'Objective Control',
            description: `Invalid objective control value: ${roll_results.controlled_by}`,
            severity: 'error',
            details: { value: roll_results.controlled_by }
          });
        }
      }

      // Regeneration validation
      if (eventType === 'regeneration') {
        const { roll_results } = event;
        
        // Regeneration should only trigger on 5-6
        if (roll_results?.roll && roll_results.roll <= 4 && roll_results?.wounds_recovered > 0) {
          violations.push({
            event_id: event.round.toString(),
            event_type: 'regeneration',
            units_involved: [event.acting_unit],
            rule_involved: 'Regeneration',
            description: 'Regeneration triggered on roll below 5',
            severity: 'error',
            details: { roll: roll_results.roll, recovered: roll_results.wounds_recovered }
          });
          recommendations.add('Ensure Regeneration/Self-Repair only recovers on rolls of 5+');
        }
      }
    });
  }

  // Check for profile inconsistencies
  if (battleLog.agent_a || battleLog.agent_b) {
    // Basic validation that armies are present
    if (!battleLog.agent_a || !battleLog.agent_b) {
      profileIssues.push({
        unit_name: 'Battle Setup',
        issue: 'Missing army profile in battle log',
        details: { agent_a: !!battleLog.agent_a, agent_b: !!battleLog.agent_b }
      });
    }
  }

  // Calculate compliance score (0-100)
  const totalViolations = violations.length;
  const complianceScore = Math.max(0, 100 - totalViolations * 10);

  // Create report
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

  // Store in database
  try {
    await base44.entities.RuleComplianceReport.create(report);
    return report;
  } catch (err) {
    console.error('Failed to store compliance report:', err);
    throw err;
  }
}