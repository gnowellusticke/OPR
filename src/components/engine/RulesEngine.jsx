import { DiceRoller } from './GameEngine';

export class RulesEngine {
  constructor() {
    this.dice = new DiceRoller();
    this.limitedWeaponsUsed = new Map();
  }

  trackLimitedWeapon(weapon, unitId) {
    if (!weapon.special_rules?.includes('Limited')) return false;
    const key = `${unitId}_${weapon.name}`;
    const used = this.limitedWeaponsUsed.get(key) || 0;
    if (used > 0) return true;
    this.limitedWeaponsUsed.set(key, 1);
    return false;
  }

  // Transport Management
  getTransportCapacity(transport) {
    const match = transport.special_rules?.match(/Transport\((\d+)\)/);
    return match ? parseInt(match[1]) : 0;
  }

  getUnitTransportSize(unit) {
    const toughMatch = unit.special_rules?.match(/Tough\((\d+)\)/);
    const toughValue = toughMatch ? parseInt(toughMatch[1]) : 0;
    const isHero = unit.special_rules?.includes('Hero');
    if (isHero && toughValue <= 6) return 1;
    if (!isHero && toughValue <= 3) return 1;
    if (!isHero && toughValue > 3) return 3;
    return 1;
  }

  canEmbark(unit, transport, gameState) {
    if (!transport.special_rules?.includes('Transport')) return false;
    if (unit.embarked_in) return false;
    if (this.calculateDistance(unit, transport) > 1) return false;
    const capacity = this.getTransportCapacity(transport);
    const currentLoad = this.getTransportCurrentLoad(transport, gameState);
    const unitSize = this.getUnitTransportSize(unit);
    return currentLoad + unitSize <= capacity;
  }

  getTransportCurrentLoad(transport, gameState) {
    const embarked = gameState.units.filter(u => u.embarked_in === transport.id);
    return embarked.reduce((sum, u) => sum + this.getUnitTransportSize(u), 0);
  }

  embark(unit, transport, gameState) {
    if (!this.canEmbark(unit, transport, gameState)) return false;
    unit.embarked_in = transport.id;
    unit.x = transport.x;
    unit.y = transport.y;
    return true;
  }

  disembark(unit, transport, gameState) {
    if (unit.embarked_in !== transport.id) return false;
    const angle = Math.random() * Math.PI * 2;
    const distance = 3 + Math.random() * 3;
    unit.x = transport.x + Math.cos(angle) * distance;
    unit.y = transport.y + Math.sin(angle) * distance;
    unit.embarked_in = null;
    return true;
  }

  handleTransportDestruction(transport, gameState, events) {
    const embarked = gameState.units.filter(u => u.embarked_in === transport.id);
    embarked.forEach(unit => {
      const roll = this.dice.roll();
      if (roll <= 1) {
        unit.current_models = Math.max(0, unit.current_models - 1);
        events.push({ round: gameState.current_round, type: 'transport', message: `${unit.name} lost 1 model from transport destruction`, timestamp: new Date().toLocaleTimeString() });
      }
      unit.status = 'shaken';
      const angle = Math.random() * Math.PI * 2;
      unit.x = transport.x + Math.cos(angle) * Math.random() * 6;
      unit.y = transport.y + Math.sin(angle) * Math.random() * 6;
      unit.embarked_in = null;
      events.push({ round: gameState.current_round, type: 'transport', message: `${unit.name} disembarked from destroyed transport and is Shaken`, timestamp: new Date().toLocaleTimeString() });
    });
  }

  // Movement
  executeMovement(unit, action, targetPosition, terrain) {
    const moveDistance = this.getMoveDistance(unit, action, terrain);
    const distance = this.calculateDistance(unit, targetPosition);
    if (distance <= moveDistance) {
      unit.x = targetPosition.x;
      unit.y = targetPosition.y;
      return { success: true, distance };
    }
    const ratio = moveDistance / distance;
    unit.x = unit.x + (targetPosition.x - unit.x) * ratio;
    unit.y = unit.y + (targetPosition.y - unit.y) * ratio;
    return { success: true, distance: moveDistance };
  }

  isAmbushUnit(unit) {
    return unit.special_rules?.includes('Ambush');
  }

  deployAmbush(unit, gameState) {
    const enemies = gameState.units.filter(u => u.owner !== unit.owner && u.current_models > 0);
    let attempts = 0;
    while (attempts < 100) {
      const x = Math.random() * 66 + 3;
      const y = Math.random() * 42 + 3;
      const tooClose = enemies.some(e => {
        const dx = e.x - x; const dy = e.y - y;
        return Math.sqrt(dx * dx + dy * dy) < 9;
      });
      if (!tooClose) {
        unit.x = x;
        unit.y = y;
        unit.is_in_reserve = false;
        return true;
      }
      attempts++;
    }
    return false;
  }

  executeTeleport(unit, gameState) {
    const enemies = gameState.units.filter(u => u.owner !== unit.owner && u.current_models > 0);
    let attempts = 0;
    while (attempts < 50) {
      const x = Math.random() * 66 + 3;
      const y = Math.random() * 42 + 3;
      const tooClose = enemies.some(e => {
        const dx = e.x - x; const dy = e.y - y;
        return Math.sqrt(dx * dx + dy * dy) < 9;
      });
      if (!tooClose) {
        unit.x = x;
        unit.y = y;
        return true;
      }
      attempts++;
    }
    return false;
  }

  getMoveDistance(unit, action, terrain) {
    if (unit.special_rules?.includes('Immobile') && action !== 'Hold') return 0;
    if (unit.special_rules?.includes('Aircraft')) {
      if (action !== 'Advance') return 0;
      return 36;
    }
    let base = 0;
    switch (action) {
      case 'Hold': base = 0; break;
      case 'Advance': base = 6; break;
      case 'Rush': base = 12; break;
      case 'Charge': base = 12; break;
    }
    if (terrain && !unit.special_rules?.includes('Strider') && !unit.special_rules?.includes('Flying')) {
      const unitTerrain = this.getTerrainAtPosition(unit.x, unit.y, terrain);
      if (unitTerrain && unitTerrain.type === 'difficult') base = Math.max(0, base - 2);
    }
    if (unit.special_rules?.includes('Fast')) base += (action === 'Advance' ? 2 : 4);
    if (unit.special_rules?.includes('Slow')) base -= (action === 'Advance' ? 2 : 4);
    return Math.max(0, base);
  }

  hasStealth(unit, gameState) {
    if (unit.special_rules?.includes('Stealth')) return true;
    if (!gameState) return false;
    return gameState.units.some(u =>
      u.owner === unit.owner &&
      u.id !== unit.id &&
      u.current_models > 0 &&
      u.special_rules?.includes('Stealth Aura') &&
      this.calculateDistance(unit, u) <= 6
    );
  }

  // ─── HELPER: normalise special_rules to a plain string ──────────────────────
  _rulesStr(special_rules) {
    if (!special_rules) return '';
    if (Array.isArray(special_rules)) {
      return special_rules.map(r => (typeof r === 'string' ? r : (r?.rule || ''))).join(' ');
    }
    return typeof special_rules === 'string' ? special_rules : '';
  }

  // ─── HELPER: parse AP value from weapon ─────────────────────────────────────
  // Uses weapon.ap field first, then looks for AP(X) in special_rules.
  // STRICT: only matches the AP rule, never Deadly or other rules.
  _parseAP(weapon) {
    if (weapon.ap && weapon.ap > 0) return weapon.ap;
    const rulesStr = this._rulesStr(weapon.special_rules);
    // Match AP( followed by digits — strict prefix so it won't catch other rules
    const apMatch = rulesStr.match(/\bAP\((\d+)\)?/i);
    return apMatch ? parseInt(apMatch[1]) : 0;
  }

  // ─── HELPER: parse Deadly(X) value from weapon ──────────────────────────────
  // STRICT: only matches the exact word "Deadly" followed by "(X)".
  // Never matches substrings of other rules. Returns 1 if not present.
  _parseDeadly(weapon) {
    const rulesStr = this._rulesStr(weapon.special_rules);
    // Must be a whole-word match for "Deadly" followed immediately by "("
    const deadlyMatch = rulesStr.match(/\bDeadly\((\d+)\)/);
    const value = deadlyMatch ? parseInt(deadlyMatch[1]) : 1;
    // Sanity check: log if Deadly was somehow detected from a rules string that also has AP
    if (value > 1) {
      console.log(`[DEADLY] Weapon "${weapon.name}" has Deadly(${value}). Rules string: "${rulesStr}"`);
    }
    return value;
  }

  // Shooting
  resolveShooting(attacker, defender, weapon, terrain, gameState) {
    if (this.trackLimitedWeapon(weapon, attacker.id)) {
      return {
        weapon: weapon.name, hit_rolls: [], hits: 0,
        defense_rolls: [], saves: 0, wounds: 0,
        blast: false, baneProcs: 0,
        specialRulesApplied: [{ rule: 'Limited', value: null, effect: 'weapon already used once this game' }]
      };
    }

    const hits = this.rollToHit(attacker, weapon, defender, gameState);

    // Blast: hits are already the blast count from rollToHit — cap them at the number of models in the target.
    // No multiplication: rollToHit already returned blastX automatic hits; we only cap against model count.
    let finalHits = hits.successes;
    const rulesStrBlast = this._rulesStr(weapon.special_rules);
    const blastMultMatch = rulesStrBlast.match(/\bBlast\((\d+)\)/);
    if (blastMultMatch && hits.blast) {
      const blastX = parseInt(blastMultMatch[1]);
      const modelCount = defender.model_count || Math.ceil((defender.current_models || 1) / Math.max(defender.tough_per_model || 1, 1));
      finalHits = Math.min(blastX, modelCount);
      hits.specialRulesApplied.push({ rule: 'Blast', value: finalHits, effect: `${blastX} automatic hits capped at ${modelCount} model(s) in target` });
    }

    const saves = this.rollDefense(defender, finalHits, weapon, terrain, hits.rolls);
    const allRules = [...(hits.specialRulesApplied || []), ...(saves.specialRulesApplied || [])];

    const seenRules = new Set();
    const specialRulesApplied = allRules.filter(rule => {
      if (seenRules.has(rule.rule)) return false;
      seenRules.add(rule.rule);
      return true;
    });

    return {
      weapon: weapon.name,
      hit_rolls: hits.rolls,
      hits: finalHits,
      defense_rolls: saves.rolls,
      saves: saves.saves,
      wounds: saves.wounds,
      blast: hits.blast || false,
      baneProcs: saves.baneProcs || 0,
      specialRulesApplied
    };
  }

  rollToHit(unit, weapon, target, gameState) {
    let quality = unit.quality || 4;
    const specialRulesApplied = [];
    const rulesStr = this._rulesStr(weapon.special_rules);

    if (unit.just_charged && rulesStr.includes('Thrust')) {
      quality = Math.max(2, quality - 1);
      specialRulesApplied.push({ rule: 'Thrust', value: null, effect: 'quality -1 (easier) on charge' });
    }
    if (unit.status === 'shaken') {
      quality = Math.min(6, quality + 1);
      specialRulesApplied.push({ rule: 'Shaken', value: null, effect: 'quality +1 (harder to hit)' });
    }
    if (target?.special_rules?.includes('Machine-Fog')) {
      quality = Math.min(6, quality + 1);
      specialRulesApplied.push({ rule: 'Machine-Fog', value: null, effect: 'quality +1 vs target' });
    }
    if (target && this.hasStealth(target, gameState) && weapon.range > 2) {
      quality = Math.min(6, quality + 1);
      specialRulesApplied.push({ rule: 'Stealth', value: null, effect: 'quality +1 vs stealthed target' });
    }
    if (rulesStr.includes('Indirect')) {
      quality = Math.min(6, quality + 1);
      specialRulesApplied.push({ rule: 'Indirect', value: null, effect: 'quality +1 after moving' });
    }
    if (rulesStr.includes('Artillery') && this.calculateDistance(unit, target) > 9) {
      quality = Math.max(2, quality - 1);
      specialRulesApplied.push({ rule: 'Artillery', value: null, effect: 'quality -1 at 9"+ range' });
    }
    if (rulesStr.includes('Reliable')) {
      quality = 2;
      specialRulesApplied.push({ rule: 'Reliable', value: null, effect: 'attacks at Quality 2+' });
    }

    // Blast(X) — X automatic hits, no quality roll (works in both melee and ranged)
    const blastMatch = rulesStr.match(/\bBlast\((\d+)\)/)
      || (weapon.blast === true && weapon.blast_x ? [``, weapon.blast_x] : null)
      || (weapon.name || '').match(/Blast[\s-]?(\d+)/i);
    if (blastMatch) {
      const blastCount = parseInt(blastMatch[1]);
      const autoHitRolls = Array.from({ length: blastCount }, () => ({ value: 6, success: true, auto: true }));
      specialRulesApplied.push({ rule: 'Blast', value: blastCount, effect: `${blastCount} automatic hits, no quality roll` });
      return { rolls: autoHitRolls, successes: blastCount, specialRulesApplied, blast: true };
    }

    const attacks = weapon.attacks || 1;
    const rolls = this.dice.rollQualityTest(quality, attacks);
    let successes = rolls.filter(r => r.success).length;

    // Furious: +1 hit per unmodified 6
    if (unit.special_rules?.includes('Furious') && !rulesStr.includes('Furious')) {
      const naturalSixes = rolls.filter(r => r.value === 6 && r.success).length;
      if (naturalSixes > 0) {
        successes += naturalSixes;
        specialRulesApplied.push({ rule: 'Furious', value: null, effect: `${naturalSixes} unmodified 6s generated ${naturalSixes} extra hits` });
      }
    }

    // Relentless: unmodified 6s to hit at 9"+ range deal 1 extra hit each.
    // The extra hit does NOT itself count as a 6 for any other special rules.
    if (rulesStr.includes('Relentless') && target && this.calculateDistance(unit, target) > 9) {
      const natureSixes = rolls.filter(r => r.value === 6 && r.success).length;
      if (natureSixes > 0) {
        // Add extra hits as value=1 rolls (explicitly not 6s) so Furious/Surge/Rending don't trigger on them
        for (let i = 0; i < natureSixes; i++) {
          rolls.push({ value: 1, success: true, relentless: true });
        }
        successes += natureSixes;
        specialRulesApplied.push({ rule: 'Relentless', value: null, effect: `${natureSixes} extra hits from natural 6s at 9"+ range (extra hits don't count as 6s)` });
      }
    }

    // Surge: extra hit on natural 6
    if (rulesStr.includes('Surge')) {
      const natureSixes = rolls.filter(r => r.value === 6 && r.success).length;
      successes += natureSixes;
      if (natureSixes > 0) specialRulesApplied.push({ rule: 'Surge', value: null, effect: `${natureSixes} extra hits from natural 6s` });
    }

    // Crack: unmodified 6s to hit generate +2 hits instead of 1 (net +1 extra hit each)
    if (rulesStr.includes('Crack')) {
      const natureSixes = rolls.filter(r => r.value === 6 && r.success && !r.relentless).length;
      if (natureSixes > 0) {
        successes += natureSixes; // +1 extra per natural 6 (the original hit already counted)
        specialRulesApplied.push({ rule: 'Crack', value: null, effect: `${natureSixes} natural 6s each count as 2 hits (+${natureSixes} extra)` });
      }
    }

    return { rolls, successes, specialRulesApplied };
  }

  rollDefense(unit, hitCount, weapon, terrain, hitRolls) {
    let defense = unit.defense || 5;
    const specialRulesApplied = [];

    const ap = this._parseAP(weapon);
    const deadlyMultiplier = this._parseDeadly(weapon);
    const rulesStr = this._rulesStr(weapon.special_rules);
    const hasBane = rulesStr.includes('Bane');
    const hasBlast = rulesStr.includes('Blast') || (weapon.blast === true);

    // Blast: ignores cover
    if (!hasBlast && terrain) {
      const coverBonus = this.getCoverBonus(unit, terrain);
      if (coverBonus > 0) {
        defense -= coverBonus;
        specialRulesApplied.push({ rule: 'Cover', value: coverBonus, effect: `save improved by ${coverBonus} from terrain` });
      }
    } else if (hasBlast && terrain) {
      const coverBonus = this.getCoverBonus(unit, terrain);
      if (coverBonus > 0) {
        specialRulesApplied.push({ rule: 'Blast', value: null, effect: 'Blast ignores cover bonus' });
      }
    }

    // Unstoppable: ignores negative AP modifiers
    let effectiveAp = ap;
    if (rulesStr.includes('Unstoppable') && ap < 0) {
      effectiveAp = 0;
      specialRulesApplied.push({ rule: 'Unstoppable', value: null, effect: 'ignores negative AP modifiers' });
    }
    if (effectiveAp > 0) {
      specialRulesApplied.push({ rule: 'AP', value: effectiveAp, effect: `defense reduced by ${effectiveAp}` });
    }

    const modifiedDefense = Math.min(6, Math.max(2, defense - effectiveAp));

    // ── Deadly: resolve Deadly hits first, separately from normal hits ───────────
    // Deadly hits come from the first N unsaved saves; each unsaved Deadly hit deals
    // deadlyMultiplier wounds to ONE model (no carry-over — capped at toughPerModel or 1).
    const toughPerModel = unit.tough_per_model || 1;

    // Split hits: if Deadly, ALL hits from this weapon are Deadly hits
    let deadlyWounds = 0;
    let normalWounds = 0;
    let rolls = [];
    let saves = 0;

    if (deadlyMultiplier > 1) {
      // Roll defense for each hit individually to honour no-carry-over rule
      // Bane: defender must re-roll unmodified 6s on defense
      let remainingHits = hitCount;
      for (let i = 0; i < remainingHits; i++) {
        let defRoll = this.dice.roll();
        // Bane: re-roll unmodified 6s on defense
        if (hasBane && defRoll === 6) {
          const reroll = this.dice.roll();
          rolls.push({ value: defRoll, success: defRoll >= modifiedDefense, baneReroll: reroll, finalValue: reroll });
          defRoll = reroll;
        } else {
          rolls.push({ value: defRoll, success: defRoll >= modifiedDefense });
        }
        const saved = defRoll >= modifiedDefense;
        if (saved) {
          saves++;
        } else {
          // Unsaved Deadly hit: deals deadlyMultiplier wounds to one model, capped at that model's wounds
          deadlyWounds += Math.min(deadlyMultiplier, toughPerModel);
        }
      }
      if (deadlyMultiplier > 1) {
        specialRulesApplied.push({ rule: 'Deadly', value: deadlyMultiplier, effect: `each unsaved hit deals ${Math.min(deadlyMultiplier, toughPerModel)} wounds to one model (no carry-over)` });
      }
    } else {
      // Normal hits — roll defense for all at once
      // Bane: defender must re-roll unmodified 6s on defense
      if (hasBane) {
        for (let i = 0; i < hitCount; i++) {
          let defRoll = this.dice.roll();
          if (defRoll === 6) {
            const reroll = this.dice.roll();
            rolls.push({ value: defRoll, success: reroll >= modifiedDefense, baneReroll: reroll, finalValue: reroll });
            if (reroll >= modifiedDefense) saves++;
          } else {
            const success = defRoll >= modifiedDefense;
            rolls.push({ value: defRoll, success });
            if (success) saves++;
          }
        }
        if (hitCount > 0) specialRulesApplied.push({ rule: 'Bane', value: null, effect: 'defender must re-roll unmodified defense 6s' });
      } else {
        rolls = this.dice.rollDefense(modifiedDefense, hitCount);
        saves = rolls.filter(r => r.success).length;
      }

      // Rending: unmodified 6s on hit rolls auto-wound (bypass saves)
      if (rulesStr.includes('Rending') && hitRolls) {
        const rendingAutoWounds = hitRolls.filter(r => r.value === 6 && r.success && !r.auto).length;
        saves = Math.max(0, saves - rendingAutoWounds);
        if (rendingAutoWounds > 0) specialRulesApplied.push({ rule: 'Rending', value: null, effect: `${rendingAutoWounds} natural 6s bypass saves` });
      }

      normalWounds = Math.max(0, hitCount - saves);
    }

    const wounds = deadlyWounds + normalWounds;

    console.log(`[DMG] weapon="${weapon.name}" hits=${hitCount} saves=${saves} deadlyWounds=${deadlyWounds} normalWounds=${normalWounds} → wounds=${wounds}`);
    return { rolls, saves, wounds, wounds_dealt: wounds, baneProcs: 0, deadlyMultiplier, hasBane, specialRulesApplied };
  }

  // applyRegeneration: rolls one die per incoming wound; each 5+ ignores that wound.
  // Returns { finalWounds, ignored, rolls } — caller must use finalWounds instead of original wounds.
  // Bane suppresses Regeneration entirely.
  applyRegeneration(unit, incomingWounds = 1, suppressedByBane = false) {
    const REGEN_RULES = ['Regeneration', 'Self-Repair', 'Repair'];
    const rulesStr = this._rulesStr(unit.special_rules);
    const hasRule = REGEN_RULES.some(r => rulesStr.includes(r));
    if (!hasRule) return { finalWounds: incomingWounds, ignored: 0, rolls: [] };
    if (suppressedByBane) return { finalWounds: incomingWounds, ignored: 0, rolls: [], suppressedByBane: true };

    const rolls = [];
    let ignored = 0;
    for (let i = 0; i < incomingWounds; i++) {
      const roll = this.dice.roll();
      rolls.push(roll);
      if (roll >= 5) ignored++;
    }
    return { finalWounds: Math.max(0, incomingWounds - ignored), ignored, rolls };
  }

  // Melee
  resolveMelee(attacker, defender, gameState) {
    const attackerResults = this.resolveMeleeStrikes(attacker, defender, false, gameState);
    let defenderResults = null;
    if (defender.status !== 'shaken' && defender.current_models > 0) {
      defenderResults = this.resolveMeleeStrikes(defender, attacker, true, gameState);
    }

    let attackerRealWounds = attackerResults.total_wounds;
    let defenderRealWounds = defenderResults?.total_wounds || 0;

    let attackerFearBonus = 0;
    if (attacker.special_rules?.includes('Fear')) {
      const fearMatch = attacker.special_rules.match(/Fear\((\d+)\)/);
      attackerFearBonus = fearMatch ? parseInt(fearMatch[1]) : 0;
    }
    let defenderFearBonus = 0;
    if (defender.special_rules?.includes('Fear')) {
      const fearMatch = defender.special_rules.match(/Fear\((\d+)\)/);
      defenderFearBonus = fearMatch ? parseInt(fearMatch[1]) : 0;
    }

    const attackerWoundsForComparison = attackerRealWounds + attackerFearBonus;
    const defenderWoundsForComparison = defenderRealWounds + defenderFearBonus;

    const winner = attackerWoundsForComparison > defenderWoundsForComparison ? attacker :
                   defenderWoundsForComparison > attackerWoundsForComparison ? defender : null;

    const aRes = attackerResults.results?.[0] || {};
    const dRes = defenderResults?.results?.[0] || null;
    const specialRulesApplied = [
      ...(attackerResults.specialRulesApplied || []),
      ...(defenderResults?.specialRulesApplied || [])
    ];

    const seenRules = new Set();
    const deduplicatedRules = specialRulesApplied.filter(rule => {
      if (seenRules.has(rule.rule)) return false;
      seenRules.add(rule.rule);
      return true;
    });

    const rollResults = {
      attacker_attacks: aRes.attacks || 1,
      attacker_hits: aRes.hits ?? 0,
      attacker_saves_forced: aRes.hits ?? 0,
      defender_saves_made: aRes.saves ?? 0,
      wounds_dealt: attackerRealWounds,
      defender_attacks: dRes ? (dRes.attacks || 1) : 0,
      defender_hits: dRes ? (dRes.hits ?? 0) : 0,
      defender_saves_forced: dRes ? (dRes.hits ?? 0) : 0,
      attacker_saves_made: dRes ? (dRes.saves ?? 0) : 0,
      wounds_taken: defenderRealWounds,
      melee_resolution: {
        attacker_wounds_for_comparison: attackerWoundsForComparison,
        fear_bonus_attacker: attackerFearBonus,
        defender_wounds_for_comparison: defenderWoundsForComparison,
        fear_bonus_defender: defenderFearBonus,
        winner: winner?.name || 'tie'
      },
      special_rules_applied: deduplicatedRules
    };

    return {
      attacker_results: attackerResults,
      defender_results: defenderResults,
      winner,
      attacker_wounds: attackerRealWounds,
      defender_wounds: defenderRealWounds,
      rollResults
    };
  }

  resolveMeleeStrikes(attacker, defender, isStrikeBack = false, gameState = null) {
    const results = [];
    let totalWounds = 0;
    const allSpecialRules = [];

    const meleeWeapons = attacker.weapons?.filter(w => w.range <= 2) || [];
    const weaponsToUse = meleeWeapons.length > 0 ? meleeWeapons : [{ name: 'Fists', range: 1, attacks: 1, ap: 0 }];

    const currentModelCount = Math.ceil(attacker.current_models / Math.max(attacker.tough_per_model || 1, 1));

    weaponsToUse.forEach(weapon => {
      let modifiedWeapon = { ...weapon };
      const weaponSpecialRules = [];
      const rulesStr = this._rulesStr(weapon.special_rules);

      if (attacker.just_charged && rulesStr.includes('Thrust')) {
        modifiedWeapon.ap = (weapon.ap || 0) + 1;
        weaponSpecialRules.push({ rule: 'Thrust', value: null, effect: '+1 to hit and AP(+1) on charge' });
      }

      if (attacker.just_charged && !attacker.fatigued && rulesStr.includes('Impact')) {
        const impactMatch = rulesStr.match(/Impact\((\d+)\)/);
        const impactDice = impactMatch ? parseInt(impactMatch[1]) : 1;
        const impactHits = Array.from({ length: impactDice }, () => this.dice.roll()).filter(r => r >= 2).length;
        modifiedWeapon.attacks = (weapon.attacks || 1) + impactHits;
        weaponSpecialRules.push({ rule: 'Impact', value: impactDice, effect: `${impactHits} extra hits from Impact(${impactDice})` });
      }

      const baseAttacks = modifiedWeapon.attacks || 1;
      const scaledAttacks = baseAttacks * Math.max(currentModelCount, 1);
      const scaledWeapon = { ...modifiedWeapon, attacks: scaledAttacks };

      // ── Step 1: Roll to hit (returns actual hit count) ─────────────────────
      const hitResult = this.rollToHit(attacker, scaledWeapon, defender, gameState);
      const actualHits = hitResult.successes;

      // ── Step 2: Roll defense against ACTUAL hits only ──────────────────────
      const defResult = this._resolveMeleeDefense(defender, actualHits, scaledWeapon, hitResult.rolls);

      const wounds = defResult.wounds;

      console.log(`[MELEE] ${attacker.name} → ${defender.name} | weapon=${scaledWeapon.name} attacks=${scaledAttacks} hits=${actualHits} saves=${defResult.saves} wounds=${wounds}`);

      const result = {
        weapon: scaledWeapon.name,
        hit_rolls: hitResult.rolls,
        hits: actualHits,
        defense_rolls: defResult.rolls,
        saves: defResult.saves,
        wounds,
        attacks: scaledAttacks,
        specialRulesApplied: [...(hitResult.specialRulesApplied || []), ...(defResult.specialRulesApplied || [])]
      };

      if (attacker.special_rules?.includes('Fear')) {
        const fearMatch = attacker.special_rules.match(/Fear\((\d+)\)/);
        const fearBonus = fearMatch ? parseInt(fearMatch[1]) : 1;
        result.fearBonus = fearBonus;
        weaponSpecialRules.push({ rule: 'Fear', value: fearBonus, effect: `+${fearBonus} wounds for melee victory check` });
      }

      const rangedOnlyRules = ['Blast', 'Relentless', 'Indirect', 'Artillery'];
      const filtered = result.specialRulesApplied.filter(rule => !rangedOnlyRules.includes(rule.rule));
      const combined = [...weaponSpecialRules, ...filtered];
      const seenRules = new Set();
      result.specialRulesApplied = combined.filter(rule => {
        if (seenRules.has(rule.rule)) return false;
        seenRules.add(rule.rule);
        return true;
      });

      allSpecialRules.push(...result.specialRulesApplied);
      results.push(result);
      totalWounds += Math.max(0, wounds);
    });

    if (isStrikeBack || attacker.just_charged) {
      attacker.fatigued = true;
    }

    return { results, total_wounds: totalWounds, specialRulesApplied: allSpecialRules };
  }

  // ── Dedicated melee defense resolver ──────────────────────────────────────
  // Rolls defense for exactly `hitCount` hits. Returns { rolls, saves, wounds }.
  // wounds = sum of per-hit damage after failed saves, applying Deadly(X) if present.
  _resolveMeleeDefense(defender, hitCount, weapon, hitRolls) {
    if (hitCount <= 0) return { rolls: [], saves: 0, wounds: 0, specialRulesApplied: [] };

    const specialRulesApplied = [];
    const ap = this._parseAP(weapon);
    const deadlyMultiplier = this._parseDeadly(weapon);
    const rulesStr = this._rulesStr(weapon.special_rules);
    const hasBane = rulesStr.includes('Bane');
    const toughPerModel = defender.tough_per_model || 1;

    let defense = defender.defense || 5;
    const modifiedDefense = Math.min(6, Math.max(2, defense - ap));

    if (ap > 0) specialRulesApplied.push({ rule: 'AP', value: ap, effect: `defense reduced by ${ap}` });

    // Rending: natural 6s on hit rolls auto-wound regardless of save — track them upfront
    const rendingHitIndices = new Set();
    if (rulesStr.includes('Rending') && hitRolls) {
      hitRolls.forEach((r, idx) => {
        if (r.value === 6 && r.success && !r.auto) rendingHitIndices.add(idx);
      });
    }

    const rolls = [];
    let saves = 0;
    let wounds = 0;

    // Process each hit individually — this is the ONLY place wounds are generated
    for (let i = 0; i < hitCount; i++) {
      const isRendingHit = rendingHitIndices.has(i);

      if (isRendingHit) {
        // Rending natural 6: auto-wound, no defense roll
        rolls.push({ value: 6, success: false, rending: true });
        wounds += 1; // Rending always 1 wound (not multiplied by Deadly)
      } else {
        let defRoll = this.dice.roll();
        let finalRoll = defRoll;

        if (hasBane && defRoll === 6) {
          const reroll = this.dice.roll();
          rolls.push({ value: defRoll, success: reroll >= modifiedDefense, baneReroll: reroll, finalValue: reroll });
          finalRoll = reroll;
        } else {
          rolls.push({ value: defRoll, success: defRoll >= modifiedDefense });
        }

        const saved = finalRoll >= modifiedDefense;
        if (saved) {
          saves++;
        } else {
          // Deadly(X): each unsaved hit = min(X, toughPerModel) wounds (no carry-over per model)
          // No Deadly: each unsaved hit = EXACTLY 1 wound — toughPerModel is never a multiplier here
          if (deadlyMultiplier > 1) {
            wounds += Math.min(deadlyMultiplier, toughPerModel);
          } else {
            wounds += 1;
          }
        }
      }
    }

    if (hasBane && hitCount > 0) specialRulesApplied.push({ rule: 'Bane', value: null, effect: 'defender must re-roll unmodified defense 6s' });
    if (deadlyMultiplier > 1) specialRulesApplied.push({ rule: 'Deadly', value: deadlyMultiplier, effect: `each unsaved hit deals ${Math.min(deadlyMultiplier, toughPerModel)} wounds (no carry-over)` });
    if (rendingHitIndices.size > 0) specialRulesApplied.push({ rule: 'Rending', value: null, effect: `${rendingHitIndices.size} natural 6s auto-wounded (bypassed saves)` });

    const unsavedHits = hitCount - saves - rendingHitIndices.size;
    console.log(`[MELEE-DEF] weapon=${weapon.name} ap=${ap} def=${defender.defense}→${modifiedDefense} hits=${hitCount} rending=${rendingHitIndices.size} saves=${saves} unsaved=${unsavedHits} deadly=${deadlyMultiplier} wounds=${wounds}`);

    return { rolls, saves, wounds, specialRulesApplied };
  }

  checkMorale(unit, reason = 'wounds') {
    const quality = unit.quality || 4;
    const roll = this.dice.roll();
    const specialRulesApplied = [];

    if (unit.status === 'shaken') {
      return { passed: false, roll, reason: 'Already Shaken', specialRulesApplied };
    }
    const passed = roll >= quality;

    if (!passed && unit.special_rules?.includes('Fearless')) {
      const reroll = this.dice.roll();
      specialRulesApplied.push({ rule: 'Fearless', value: null, effect: `re-rolled on 4+ (re-roll: ${reroll})` });
      if (reroll >= 4) {
        return { passed: true, roll, reroll, reason: 'Fearless reroll', specialRulesApplied };
      }
    }

    return { passed, roll, reason, specialRulesApplied };
  }

  applyCounterToCharger(charger, defender) {
    let penalty = 0;
    if (defender.special_rules?.includes('Counter')) {
      penalty = defender.current_models || 0;
    }
    return penalty;
  }

  // ─── CASTER ──────────────────────────────────────────────────────────────────

  // Returns how many tokens Caster(X) grants per round (0 if not a caster).
  getCasterTokens(unit) {
    const rulesStr = this._rulesStr(unit.special_rules);
    const casterMatch = rulesStr.match(/\bCaster\((\d+)\)/);
    return casterMatch ? parseInt(casterMatch[1]) : 0;
  }

  // Replenish spell tokens at the start of a round. Tokens cap at 6.
  replenishSpellTokens(unit) {
    const gain = this.getCasterTokens(unit);
    if (gain === 0) return 0;
    const current = unit.spell_tokens || 0;
    const after = Math.min(6, current + gain);
    unit.spell_tokens = after;
    return after - current; // actual amount gained
  }

  // Cast one spell:
  //   spellCost   — token cost of the spell
  //   alliedHelpers — array of friendly units within 18" that spend tokens to boost the roll
  //                   Each helper can spend any number of their own spell_tokens;
  //                   positive spend = +1/token to roll, negative spend = -1/token (opposing).
  //                   In AI context we pass friendly spend as positive, enemy as negative.
  //   Returns { success, roll, modifiedRoll, tokensBefore, tokensAfter, helpBonus, specialRulesApplied }
  castSpell(caster, target, spellCost, friendlyBonus = 0, hostileBonus = 0) {
    const specialRulesApplied = [];
    const tokensBefore = caster.spell_tokens || 0;

    if (tokensBefore < spellCost) {
      return { success: false, roll: null, modifiedRoll: null, tokensBefore, tokensAfter: tokensBefore, helpBonus: 0, reason: 'not enough tokens', specialRulesApplied };
    }

    // Spend tokens
    caster.spell_tokens = tokensBefore - spellCost;

    // Roll one die, apply helper modifiers (+1 per friendly token spent, -1 per enemy token spent)
    const roll = this.dice.roll();
    const helpBonus = friendlyBonus - hostileBonus;
    const modifiedRoll = roll + helpBonus;
    const success = modifiedRoll >= 4;

    specialRulesApplied.push({ rule: 'Caster', value: spellCost, effect: `spent ${spellCost} token(s), rolled ${roll}${helpBonus !== 0 ? ` ${helpBonus >= 0 ? '+' : ''}${helpBonus} (helpers)` : ''} = ${modifiedRoll} → ${success ? 'SUCCESS' : 'FAIL'}` });

    if (friendlyBonus > 0) specialRulesApplied.push({ rule: 'Caster helper', value: friendlyBonus, effect: `${friendlyBonus} allied token(s) spent for +${friendlyBonus} to cast roll` });
    if (hostileBonus > 0) specialRulesApplied.push({ rule: 'Caster counter', value: hostileBonus, effect: `${hostileBonus} enemy token(s) spent for -${hostileBonus} to cast roll` });

    return { success, roll, modifiedRoll, tokensBefore, tokensAfter: caster.spell_tokens, helpBonus, specialRulesApplied };
  }

  canCast(unit, spellValue, currentTokens) {
    return (currentTokens ?? unit.spell_tokens ?? 0) >= spellValue;
  }

  canUseTakedown(unit, weapon) {
    return weapon.special_rules?.includes('Takedown');
  }

  applyMoraleResult(unit, passed, reason) {
    if (!passed) {
      const atHalfStrength = unit.current_models <= unit.total_models / 2;
      if (reason === 'melee_loss' && atHalfStrength) {
        unit.current_models = 0;
        unit.status = 'routed';
        return 'routed';
      } else {
        unit.status = 'shaken';
        return 'shaken';
      }
    }
    return 'passed';
  }

  updateObjectives(gameState) {
    gameState.objectives?.forEach(obj => {
      const unitsNear = gameState.units.filter(u =>
        this.calculateDistance(u, obj) <= 3 && u.current_models > 0 && !u.embarked_in
      );
      const agentANear = unitsNear.filter(u => u.owner === 'agent_a' && u.status !== 'shaken').length > 0;
      const agentBNear = unitsNear.filter(u => u.owner === 'agent_b' && u.status !== 'shaken').length > 0;
      if (agentANear && !agentBNear) obj.controlled_by = 'agent_a';
      else if (agentBNear && !agentANear) obj.controlled_by = 'agent_b';
      else if (agentANear && agentBNear) obj.controlled_by = 'contested';
    });
  }

  calculateDistance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  checkLineOfSight(from, to, terrain) { return true; }

  getTerrainAtPosition(x, y, terrain) {
    if (!terrain) return null;
    return terrain.find(t => x >= t.x && x <= t.x + t.width && y >= t.y && y <= t.y + t.height);
  }

  getCoverBonus(unit, terrain) {
    const unitTerrain = this.getTerrainAtPosition(unit.x, unit.y, terrain);
    return (unitTerrain && unitTerrain.type === 'cover') ? 1 : 0;
  }

  getZone(x, y) {
    const col = x < 24 ? 'left' : x < 48 ? 'centre' : 'right';
    const row = y < 16 ? 'north' : y < 32 ? 'centre' : 'south';
    return row === 'centre' && col === 'centre' ? 'centre' : `${row}-${col}`;
  }

  getRangeBracket(dist) {
    if (dist <= 12) return 'close';
    if (dist <= 24) return 'mid';
    return 'long';
  }
}