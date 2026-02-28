import { DiceRoller } from './GameEngine';

export class RulesEngine {
  /**
   * Self-contained — no external rule registry required.
   * All special-rule lookups use fast string matching on the normalised
   * special_rules field, identical to the original engine's approach.
   *
   * The registry parameter is accepted but ignored, so code that passes
   * one won't break. When you later add RuleRegistry.js and opr-rules.js
   * you can re-enable the registry path without touching anything else.
   */
  constructor(_registry = null) {
    this.dice = new DiceRoller();
    this.limitedWeaponsUsed = new Map();
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  /** Normalise special_rules to a plain string (handles arrays, objects, strings). */
  _rulesStr(special_rules) {
    if (!special_rules) return '';
    if (Array.isArray(special_rules)) {
      return special_rules.map(r => (typeof r === 'string' ? r : (r?.rule || ''))).join(' ');
    }
    return typeof special_rules === 'string' ? special_rules : '';
  }

  /**
   * True if special_rules contains the named rule.
   * Accepts arrays, objects, or plain strings — same as _rulesStr.
   */
  _has(special_rules, ruleName) {
    return this._rulesStr(special_rules).includes(ruleName);
  }

  /**
   * Returns the numeric parameter from a rule like Tough(6) → 6.
   * Returns null if the rule is absent.
   * Works for any Rule(N) pattern.
   */
  _param(special_rules, ruleName) {
    const str = this._rulesStr(special_rules);
    // Escape any regex special chars in the rule name, then match (digits)
    const escaped = ruleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = str.match(new RegExp(`\\b${escaped}\\((\\d+)\\)`));
    return match ? parseInt(match[1], 10) : null;
  }

  /** Parse AP value: weapon.ap field first, then AP(X) in special_rules. */
  _parseAP(weapon) {
    if (weapon.ap && weapon.ap > 0) return weapon.ap;
    return this._param(weapon.special_rules, 'AP') ?? 0;
  }

  /**
   * Parse Deadly(X): returns multiplier (1 = no Deadly).
   * STRICT: only matches the exact word "Deadly" followed by "(X)".
   */
  _parseDeadly(weapon) {
    const value = this._param(weapon.special_rules, 'Deadly');
    if (value == null) return 1;
    console.log(`[DEADLY] Weapon "${weapon.name}" has Deadly(${value}).`);
    return value;
  }

  _dedup(rules) {
    const seen = new Set();
    return rules.filter(r => {
      if (seen.has(r.rule)) return false;
      seen.add(r.rule);
      return true;
    });
  }

  _noAttackResult(weapon, effect, rule) {
    return {
      weapon: weapon.name, hit_rolls: [], hits: 0,
      defense_rolls: [], saves: 0, wounds: 0,
      blast: false, baneProcs: 0,
      specialRulesApplied: [{ rule, value: null, effect }],
    };
  }

  // ─── Limited Weapon Tracking ──────────────────────────────────────────────

  trackLimitedWeapon(weapon, unitId) {
    if (!this._has(weapon.special_rules, 'Limited')) return false;
    const key = `${unitId}_${weapon.name}`;
    const used = this.limitedWeaponsUsed.get(key) || 0;
    if (used > 0) return true;
    this.limitedWeaponsUsed.set(key, 1);
    return false;
  }

  // ─── Transport Management ─────────────────────────────────────────────────

  getTransportCapacity(transport) {
    return this._param(transport.special_rules, 'Transport') ?? 0;
  }

  getUnitTransportSize(unit) {
    const toughValue = this._param(unit.special_rules, 'Tough') ?? 0;
    const isHero = this._has(unit.special_rules, 'Hero');

    if (isHero) {
      // Heroes with Tough(7+) are large — treat as size 3
      return toughValue <= 6 ? 1 : 3;
    }
    // Multi-model units: small squads = 1, large/tough squads = 3
    return toughValue <= 3 ? 1 : 3;
  }

  canEmbark(unit, transport, gameState) {
    if (!this._has(transport.special_rules, 'Transport')) return false;
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
    const distance = 3 + Math.random() * 3; // always 3–6" away, never 0
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
        events.push({
          round: gameState.current_round, type: 'transport',
          message: `${unit.name} lost 1 model from transport destruction`,
          timestamp: new Date().toLocaleTimeString(),
        });
      }
      unit.status = 'shaken';
      // FIX: use 3–6" scatter so units never land exactly on the transport
      const angle = Math.random() * Math.PI * 2;
      const dist = 3 + Math.random() * 3;
      unit.x = transport.x + Math.cos(angle) * dist;
      unit.y = transport.y + Math.sin(angle) * dist;
      unit.embarked_in = null;
      events.push({
        round: gameState.current_round, type: 'transport',
        message: `${unit.name} disembarked from destroyed transport and is Shaken`,
        timestamp: new Date().toLocaleTimeString(),
      });
    });
  }

  // ─── Movement ─────────────────────────────────────────────────────────────

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
    return this._has(unit.special_rules, 'Ambush');
  }

  deployAmbush(unit, gameState) {
    // Valid board area: x in [5,55], y in [12,48] — excludes deployment strips and table edges.
    const enemies = gameState.units.filter(u => u.owner !== unit.owner && u.current_models > 0);
    let attempts = 0;
    while (attempts < 100) {
      const x = Math.random() * 50 + 5;
      const y = Math.random() * 36 + 12;
      const tooClose = enemies.some(e => Math.hypot(e.x - x, e.y - y) < 9);
      if (!tooClose) {
        unit.x = x;
        unit.y = y;
        unit.is_in_reserve = false;
        return true;
      }
      attempts++;
    }
    // Fallback: centre of board
    unit.x = 30 + (Math.random() - 0.5) * 10;
    unit.y = 30 + (Math.random() - 0.5) * 10;
    unit.is_in_reserve = false;
    return true;
  }

  executeTeleport(unit, gameState) {
    const enemies = gameState.units.filter(u => u.owner !== unit.owner && u.current_models > 0);
    let attempts = 0;
    while (attempts < 50) {
      const x = Math.random() * 66 + 3;
      const y = Math.random() * 42 + 3;
      const tooClose = enemies.some(e => Math.hypot(e.x - x, e.y - y) < 9);
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
    const sr = unit.special_rules;

    // ── Speed overrides (Immobile, Aircraft) ─────────────────────────────────
    if (this._has(sr, 'Immobile') && action !== 'Hold') return 0;
    if (this._has(sr, 'Aircraft')) return action === 'Advance' ? 36 : 0;

    // ── Base speed by action ─────────────────────────────────────────────────
    const baseSpeeds = { Hold: 0, Advance: 6, Rush: 12, Charge: 12 };
    let base = baseSpeeds[action] ?? 0;

    // ── Terrain penalties (ignored by Strider/Flying) ────────────────────────
    const ignoresTerrain = this._has(sr, 'Strider') || this._has(sr, 'Flying');
    if (!ignoresTerrain && terrain) {
      const unitTerrain = this.getTerrainAtPosition(unit.x, unit.y, terrain);
      if (unitTerrain) {
        if (unitTerrain.difficult) base = Math.max(0, base - 2);
        if (unitTerrain.movePenalty > 0) base = Math.max(0, base - unitTerrain.movePenalty);
        // Impassable (rooftops): blocked unless Flying
        if (unitTerrain.impassable && !this._has(sr, 'Flying')) base = 0;
        // Tank Traps: -2" only for vehicles (Tough(6+))
        if (unitTerrain.vehicleOnly) {
          const toughVal = this._param(sr, 'Tough') ?? 0;
          if (toughVal >= 6) base = Math.max(0, base - 2);
        }
      }
    }

    // ── Speed modifiers (Fast, Slow) ─────────────────────────────────────────
    if (this._has(sr, 'Fast'))  base += action === 'Advance' ? 2 : 4;
    if (this._has(sr, 'Slow'))  base -= action === 'Advance' ? 2 : 4;

    return Math.max(0, base);
  }

  // ─── Terrain ──────────────────────────────────────────────────────────────

  /**
   * Returns wounds from dangerous terrain (0 if safe).
   * Call during Rush/Charge resolution.
   */
  checkDangerousTerrain(unit, terrain, action) {
    const unitTerrain = this.getTerrainAtPosition(unit.x, unit.y, terrain);
    if (!unitTerrain) return 0;
    // Minefields/Ponds: always dangerous on entry
    if (unitTerrain.dangerous && !unitTerrain.rushChargeDangerous) {
      return this.dice.roll() === 1 ? 1 : 0;
    }
    // Vehicle Wreckage: only dangerous on Rush or Charge
    if (unitTerrain.rushChargeDangerous && (action === 'Rush' || action === 'Charge')) {
      return this.dice.roll() === 1 ? 1 : 0;
    }
    return 0;
  }

  /** Units on a hill can ignore one terrain feature for LOS. */
  isOnHill(unit, terrain) {
    const t = this.getTerrainAtPosition(unit.x, unit.y, terrain);
    return t?.type === 'hill';
  }

  /** LOS check with hill elevation rule. */
  checkLineOfSightTerrain(from, to, terrain) {
    if (!terrain || terrain.length === 0) return true;
    const attackerOnHill = this.isOnHill(from, terrain);
    let hillIgnoreUsed = false;
    for (const t of terrain) {
      if (!t.blocking && !t.blocksThroughLOS) continue;
      if (this._lineIntersectsRect(from.x, from.y, to.x, to.y, t.x, t.y, t.x + t.width, t.y + t.height)) {
        if (attackerOnHill && !hillIgnoreUsed) { hillIgnoreUsed = true; continue; }
        return false;
      }
    }
    return true;
  }

  /** Liang-Barsky line/rect intersection. */
  _lineIntersectsRect(x1, y1, x2, y2, rx1, ry1, rx2, ry2) {
    const dx = x2 - x1; const dy = y2 - y1;
    const p = [-dx, dx, -dy, dy];
    const q = [x1 - rx1, rx2 - x1, y1 - ry1, ry2 - y1];
    let tMin = 0; let tMax = 1;
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return false; }
      else {
        const t = q[i] / p[i];
        if (p[i] < 0) tMin = Math.max(tMin, t);
        else tMax = Math.min(tMax, t);
      }
    }
    return tMin < tMax;
  }

  hasStealth(unit, gameState) {
    if (this._has(unit.special_rules, 'Stealth')) return true;
    if (!gameState) return false;
    return gameState.units.some(u =>
      u.owner === unit.owner &&
      u.id !== unit.id &&
      u.current_models > 0 &&
      this._has(u.special_rules, 'Stealth Aura') &&
      this.calculateDistance(unit, u) <= 6
    );
  }

  // ─── Shooting ─────────────────────────────────────────────────────────────

  resolveShooting(attacker, defender, weapon, terrain, gameState) {
    // Indirect weapons ignore LOS entirely; all others need effective LOS
    if (!this._has(weapon.special_rules, 'Indirect') && terrain) {
      if (!this.checkEffectiveLOS(attacker, defender, terrain)) {
        return this._noAttackResult(weapon, 'no line of sight from unit footprint to target', 'LOS');
      }
    }
    if (this.trackLimitedWeapon(weapon, attacker.id)) {
      return this._noAttackResult(weapon, 'weapon already used once this game', 'Limited');
    }

    const hits = this.rollToHit(attacker, weapon, defender, gameState);

    // Blast: cap automatic hits at model count
    let finalHits = hits.successes;
    if (hits.blast) {
      const blastX = this._param(weapon.special_rules, 'Blast') ?? finalHits;
      const modelCount = defender.model_count ||
        Math.ceil((defender.current_models || 1) / Math.max(defender.tough_per_model || 1, 1));
      finalHits = Math.min(blastX, modelCount);
      hits.specialRulesApplied.push({
        rule: 'Blast', value: finalHits,
        effect: `${blastX} automatic hits capped at ${modelCount} model(s) in target`,
      });
    }

    const saves = this.rollDefense(defender, finalHits, weapon, terrain, hits.rolls);
    return {
      weapon: weapon.name,
      hit_rolls: hits.rolls,
      hits: finalHits,
      defense_rolls: saves.rolls,
      saves: saves.saves,
      wounds: saves.wounds,
      blast: hits.blast || false,
      baneProcs: saves.baneProcs || 0,
      specialRulesApplied: this._dedup([...(hits.specialRulesApplied || []), ...(saves.specialRulesApplied || [])]),
    };
  }

  rollToHit(unit, weapon, target, gameState) {
    let quality = unit.quality || 4;
    const specialRulesApplied = [];
    const rulesStr = this._rulesStr(weapon.special_rules);

    // ── FIX (Spec Bug #3): Fatigue — only unmodified 6s hit ──────────────────
    // Applies to: units that have already fought in melee this round (charged or
    // struck back). Shaken units striking back also count as fatigued (spec sb_r2).
    if (unit.fatigued) {
      // Force quality to 7 so rollQualityTest succeeds only on natural 6s
      quality = 7;
      specialRulesApplied.push({ rule: 'Fatigued', value: null, effect: 'only unmodified 6s hit' });
      const attacks = weapon.attacks || 1;
      const rolls = this.dice.rollQualityTest(quality, attacks);
      // Natural 6s still succeed even though quality > 6
      rolls.forEach(r => { r.success = r.value === 6; });
      const successes = rolls.filter(r => r.success).length;
      return { rolls, successes, specialRulesApplied, blast: false };
    }

    // ── Quality modifiers ─────────────────────────────────────────────────────

    // Shaken: quality +1 when shooting during own activation.
    // Per spec, shaken units should be idle — but as a safety net for edge cases:
    if (unit.status === 'shaken') {
      quality = Math.min(6, quality + 1);
      specialRulesApplied.push({ rule: 'Shaken', value: null, effect: 'quality +1 (harder to hit)' });
    }

    if (this._has(target?.special_rules, 'Machine-Fog')) {
      quality = Math.min(6, quality + 1);
      specialRulesApplied.push({ rule: 'Machine-Fog', value: null, effect: 'quality +1 vs target' });
    }

    if (target && this.hasStealth(target, gameState) && weapon.range > 2) {
      quality = Math.min(6, quality + 1);
      specialRulesApplied.push({ rule: 'Stealth', value: null, effect: 'quality +1 vs stealthed target' });
    }

    if (unit.just_charged && rulesStr.includes('Thrust')) {
      quality = Math.max(2, quality - 1);
      specialRulesApplied.push({ rule: 'Thrust', value: null, effect: 'quality -1 (easier) on charge' });
    }

    if (rulesStr.includes('Indirect')) {
      quality = Math.min(6, quality + 1);
      specialRulesApplied.push({ rule: 'Indirect', value: null, effect: 'quality +1 (indirect fire penalty)' });
    }

    if (rulesStr.includes('Artillery') && target && this.calculateDistance(unit, target) > 9) {
      quality = Math.max(2, quality - 1);
      specialRulesApplied.push({ rule: 'Artillery', value: null, effect: 'quality -1 at 9"+ range' });
    }

    if (rulesStr.includes('Reliable')) {
      quality = 2;
      specialRulesApplied.push({ rule: 'Reliable', value: null, effect: 'attacks at Quality 2+' });
    }

    // ── Blast(X): X automatic hits, no quality roll ───────────────────────────
    const blastMatch = rulesStr.match(/\bBlast\((\d+)\)/)
      || (weapon.blast === true && weapon.blast_x ? ['', weapon.blast_x] : null)
      || (weapon.name || '').match(/Blast[\s-]?(\d+)/i);
    if (blastMatch) {
      const blastCount = parseInt(blastMatch[1]);
      const autoHitRolls = Array.from({ length: blastCount }, () => ({ value: 6, success: true, auto: true }));
      specialRulesApplied.push({ rule: 'Blast', value: blastCount, effect: `${blastCount} automatic hits, no quality roll` });
      return { rolls: autoHitRolls, successes: blastCount, specialRulesApplied, blast: true };
    }

    // ── Roll to hit ───────────────────────────────────────────────────────────
    const attacks = weapon.attacks || 1;
    const rolls = this.dice.rollQualityTest(quality, attacks);
    let successes = rolls.filter(r => r.success).length;

    // ── Furious (unit rule): +1 hit per unmodified 6 ─────────────────────────
    // Guard: skip if the weapon itself already has Furious (prevents double-counting)
    if (unit.special_rules?.includes('Furious') && !rulesStr.includes('Furious')) {
      const naturalSixes = rolls.filter(r => r.value === 6 && r.success).length;
      if (naturalSixes > 0) {
        successes += naturalSixes;
        specialRulesApplied.push({ rule: 'Furious', value: null, effect: `${naturalSixes} natural 6s → ${naturalSixes} extra hits` });
      }
    }

    // ── Relentless: extra hit from 6s at 9"+ range (extras don't count as 6s) ─
    if (rulesStr.includes('Relentless') && target && this.calculateDistance(unit, target) > 9) {
      const naturalSixes = rolls.filter(r => r.value === 6 && r.success).length;
      if (naturalSixes > 0) {
        for (let i = 0; i < naturalSixes; i++) rolls.push({ value: 1, success: true, relentless: true });
        successes += naturalSixes;
        specialRulesApplied.push({ rule: 'Relentless', value: null, effect: `${naturalSixes} extra hits from natural 6s at 9"+ (extras don't count as 6s)` });
      }
    }

    // ── Surge: extra hit per natural 6 ────────────────────────────────────────
    if (rulesStr.includes('Surge')) {
      const naturalSixes = rolls.filter(r => r.value === 6 && r.success).length;
      if (naturalSixes > 0) {
        successes += naturalSixes;
        specialRulesApplied.push({ rule: 'Surge', value: null, effect: `${naturalSixes} extra hits from natural 6s` });
      }
    }

    // ── Crack: natural 6s count as 2 hits ────────────────────────────────────
    if (rulesStr.includes('Crack')) {
      const naturalSixes = rolls.filter(r => r.value === 6 && r.success && !r.relentless).length;
      if (naturalSixes > 0) {
        successes += naturalSixes;
        specialRulesApplied.push({ rule: 'Crack', value: null, effect: `${naturalSixes} natural 6s each count as 2 hits (+${naturalSixes} extra)` });
      }
    }

    return { rolls, successes, specialRulesApplied, blast: false };
  }

  rollDefense(unit, hitCount, weapon, terrain, hitRolls) {
    const specialRulesApplied = [];
    if (hitCount <= 0) return { rolls: [], saves: 0, wounds: 0, wounds_dealt: 0, baneProcs: 0, specialRulesApplied };

    let defense = unit.defense || 5;
    const ap = this._parseAP(weapon);
    const deadlyMultiplier = this._parseDeadly(weapon);
    const rulesStr = this._rulesStr(weapon.special_rules);
    const hasBane    = rulesStr.includes('Bane');
    const hasBlast   = rulesStr.includes('Blast') || weapon.blast === true;
    const hasRending = rulesStr.includes('Rending');
    const toughPerModel = Math.max(unit.tough_per_model || 1, 1);

    // ── Cover (Blast ignores it) ──────────────────────────────────────────────
    if (!hasBlast && terrain) {
      const coverBonus = this.getCoverBonus(unit, terrain);
      if (coverBonus > 0) {
        defense -= coverBonus;
        specialRulesApplied.push({ rule: 'Cover', value: coverBonus, effect: `save improved by ${coverBonus} from terrain` });
      }
    } else if (hasBlast && terrain && this.getCoverBonus(unit, terrain) > 0) {
      specialRulesApplied.push({ rule: 'Blast', value: null, effect: 'Blast ignores cover bonus' });
    }

    // ── AP (Unstoppable ignores negative AP) ──────────────────────────────────
    let effectiveAp = ap;
    if (rulesStr.includes('Unstoppable') && ap < 0) {
      effectiveAp = 0;
      specialRulesApplied.push({ rule: 'Unstoppable', value: null, effect: 'ignores negative AP modifiers' });
    }
    if (effectiveAp > 0) {
      specialRulesApplied.push({ rule: 'AP', value: effectiveAp, effect: `defense reduced by ${effectiveAp}` });
    }

    // ── Per-hit processing ────────────────────────────────────────────────────
    const rolls = [];
    let saves = 0;
    let wounds = 0;
    let rendingCount = 0;

    for (let i = 0; i < hitCount; i++) {
      const hitRoll = hitRolls?.[i];

      // Rending: natural 6 to hit → AP(+4) for this specific hit
      const isRendingHit = hasRending && hitRoll && hitRoll.value === 6 && hitRoll.success && !hitRoll.auto;
      const hitAp = isRendingHit ? effectiveAp + 4 : effectiveAp;
      const modifiedDefense = Math.min(6, Math.max(2, defense - hitAp));
      if (isRendingHit) rendingCount++;

      let defRoll = this.dice.roll();
      let finalRoll = defRoll;

      // Bane: defender must re-roll unmodified 6s
      if (hasBane && defRoll === 6) {
        const reroll = this.dice.roll();
        rolls.push({ value: defRoll, success: reroll >= modifiedDefense, baneReroll: reroll, finalValue: reroll });
        finalRoll = reroll;
      } else {
        rolls.push({ value: defRoll, success: defRoll >= modifiedDefense });
      }

      if (finalRoll >= modifiedDefense) {
        saves++;
      } else {
        // Deadly(X): min(X, toughPerModel) wounds per unsaved hit. No Deadly: exactly 1.
        wounds += deadlyMultiplier > 1 ? Math.min(deadlyMultiplier, toughPerModel) : 1;
      }
    }

    if (hasBane && hitCount > 0)
      specialRulesApplied.push({ rule: 'Bane', value: null, effect: 'defender must re-roll unmodified defense 6s' });
    if (hasRending && rendingCount > 0)
      specialRulesApplied.push({ rule: 'Rending', value: null, effect: `${rendingCount} natural 6s to hit gained AP(+4)` });
    if (deadlyMultiplier > 1)
      specialRulesApplied.push({ rule: 'Deadly', value: deadlyMultiplier, effect: `each unsaved hit deals ${Math.min(deadlyMultiplier, toughPerModel)} wounds (no carry-over)` });

    console.log(`[DMG] weapon="${weapon.name}" hits=${hitCount} saves=${saves} wounds=${wounds}`);
    return { rolls, saves, wounds, wounds_dealt: wounds, baneProcs: 0, deadlyMultiplier, hasBane, specialRulesApplied };
  }

  // ─── Regeneration ─────────────────────────────────────────────────────────

  /**
   * Rolls one die per incoming wound; each 5+ ignores that wound.
   * Bane suppresses Regeneration entirely.
   */
  applyRegeneration(unit, incomingWounds = 1, suppressedByBane = false) {
    const REGEN_RULES = ['Regeneration', 'Self-Repair', 'Repair'];
    const hasRule = REGEN_RULES.some(r => this._has(unit.special_rules, r));
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

  // ─── Melee ────────────────────────────────────────────────────────────────

  resolveMelee(attacker, defender, gameState) {
    // Attacker always strikes
    const attackerResults = this.resolveMeleeStrikes(attacker, defender, false, gameState);

    // ── FIX (Spec Bug #2): Shaken defenders CAN strike back, but count as Fatigued ──
    // Per spec shakenBehaviour sb_r2: "May strike back counting as Fatigued (only 6s hit)"
    // Previously hard-blocked shaken defenders. Now we let them through with fatigued flag set.
    let defenderResults = null;
    if (defender.current_models > 0) {
      const defenderIsShaken = defender.status === 'shaken';
      if (defenderIsShaken) {
        // Temporarily mark as fatigued so rollToHit applies the 6-only rule
        const wasAlreadyFatigued = defender.fatigued;
        defender.fatigued = true;
        defenderResults = this.resolveMeleeStrikes(defender, attacker, true, gameState);
        // Restore fatigued flag (don't permanently change state here)
        defender.fatigued = wasAlreadyFatigued;
      } else {
        defenderResults = this.resolveMeleeStrikes(defender, attacker, true, gameState);
      }
    }

    let attackerRealWounds = attackerResults.total_wounds;
    let defenderRealWounds = defenderResults?.total_wounds || 0;

    // Fear(X): adds X to wound total for melee resolution comparison only
    const attackerFearBonus = this._param(attacker.special_rules, 'Fear') ?? 0;
    const defenderFearBonus = this._param(defender.special_rules, 'Fear') ?? 0;

    const attackerWoundsForComparison = attackerRealWounds + attackerFearBonus;
    const defenderWoundsForComparison = defenderRealWounds + defenderFearBonus;

    const winner = attackerWoundsForComparison > defenderWoundsForComparison ? attacker
                 : defenderWoundsForComparison > attackerWoundsForComparison ? defender
                 : null;

    const atkTotalAttacks = (attackerResults.results || []).reduce((s, r) => s + (r.attacks || 0), 0);
    const atkTotalHits    = (attackerResults.results || []).reduce((s, r) => s + (r.hits ?? 0), 0);
    const atkTotalSaves   = (attackerResults.results || []).reduce((s, r) => s + (r.saves ?? 0), 0);
    const defTotalAttacks = (defenderResults?.results || []).reduce((s, r) => s + (r.attacks || 0), 0);
    const defTotalHits    = (defenderResults?.results || []).reduce((s, r) => s + (r.hits ?? 0), 0);
    const defTotalSaves   = (defenderResults?.results || []).reduce((s, r) => s + (r.saves ?? 0), 0);

    const specialRulesApplied = this._dedup([
      ...(attackerResults.specialRulesApplied || []),
      ...(defenderResults?.specialRulesApplied || []),
    ]);

    const rollResults = {
      attacker_attacks:       atkTotalAttacks,
      attacker_hits:          atkTotalHits,
      attacker_saves_forced:  atkTotalHits,
      defender_saves_made:    atkTotalSaves,
      wounds_dealt:           attackerRealWounds,
      defender_attacks:       defTotalAttacks,
      defender_hits:          defTotalHits,
      defender_saves_forced:  defTotalHits,
      attacker_saves_made:    defTotalSaves,
      wounds_taken:           defenderRealWounds,
      melee_resolution: {
        attacker_wounds_for_comparison: attackerWoundsForComparison,
        fear_bonus_attacker:            attackerFearBonus,
        defender_wounds_for_comparison: defenderWoundsForComparison,
        fear_bonus_defender:            defenderFearBonus,
        winner:                         winner?.name || 'tie',
      },
      special_rules_applied: specialRulesApplied,
    };

    return { attacker_results: attackerResults, defender_results: defenderResults, winner, attacker_wounds: attackerRealWounds, defender_wounds: defenderRealWounds, rollResults };
  }

  resolveMeleeStrikes(attacker, defender, isStrikeBack = false, gameState = null) {
    const results = [];
    let totalWounds = 0;
    const allSpecialRules = [];

    const meleeWeapons = (attacker.weapons || []).filter(w => (w.range ?? 2) <= 2);
    const weaponsToUse = meleeWeapons.length > 0
      ? meleeWeapons
      : [{ name: 'Fists', range: 1, attacks: 1, ap: 0 }];

    // Model count = floor(current wounds / wounds-per-model). Always at least 1.
    const effectiveToughPerModel = Math.max(attacker.tough_per_model || 1, 1);
    const currentModelCount = Math.max(1, Math.floor(attacker.current_models / effectiveToughPerModel));

    weaponsToUse.forEach(weapon => {
      const normWeaponSr = Array.isArray(weapon.special_rules)
        ? weapon.special_rules.join(' ')
        : (weapon.special_rules || '');
      let modifiedWeapon = { ...weapon, special_rules: normWeaponSr };
      const weaponSpecialRules = [];
      const rulesStr = normWeaponSr;

      // Thrust: +AP(1) and quality bonus on charge (quality handled in rollToHit)
      if (attacker.just_charged && rulesStr.includes('Thrust')) {
        modifiedWeapon.ap = (weapon.ap || 0) + 1;
        weaponSpecialRules.push({ rule: 'Thrust', value: null, effect: '+1 to hit and AP(+1) on charge' });
      }

      // Impact is resolved at CHARGE time in Battle.js — not here.

      const scaledAttacks = (modifiedWeapon.attacks || 1) * Math.max(currentModelCount, 1);
      const scaledWeapon = { ...modifiedWeapon, attacks: scaledAttacks };

      // rollToHit reads attacker.fatigued — set before this call if needed
      const hitResult = this.rollToHit(attacker, scaledWeapon, defender, gameState);
      const actualHits = hitResult.successes;
      const defResult  = this._resolveMeleeDefense(defender, actualHits, scaledWeapon, hitResult.rolls);
      const wounds     = defResult.wounds;

      console.log(`[MELEE] ${attacker.name} → ${defender.name} | weapon=${scaledWeapon.name} attacks=${scaledAttacks} hits=${actualHits} saves=${defResult.saves} wounds=${wounds}`);

      const result = {
        weapon: scaledWeapon.name,
        hit_rolls: hitResult.rolls,
        hits: actualHits,
        defense_rolls: defResult.rolls,
        saves: defResult.saves,
        wounds,
        attacks: scaledAttacks,
        specialRulesApplied: [...(hitResult.specialRulesApplied || []), ...(defResult.specialRulesApplied || [])],
      };

      // Fear bonus recorded per result for UI; actual comparison in resolveMelee
      if (this._has(attacker.special_rules, 'Fear')) {
        const fearBonus = this._param(attacker.special_rules, 'Fear') ?? 1;
        result.fearBonus = fearBonus;
        weaponSpecialRules.push({ rule: 'Fear', value: fearBonus, effect: `+${fearBonus} wounds for melee victory check` });
      }

      // Filter ranged-only rules from melee results
      const rangedOnlyRules = ['Blast', 'Relentless', 'Indirect', 'Artillery'];
      result.specialRulesApplied = this._dedup([
        ...weaponSpecialRules,
        ...result.specialRulesApplied.filter(r => !rangedOnlyRules.includes(r.rule)),
      ]);

      allSpecialRules.push(...result.specialRulesApplied);
      results.push(result);
      totalWounds += Math.max(0, wounds);
    });

    // Mark attacker as fatigued after striking (spec: fatigue applies after first melee action)
    if (isStrikeBack || attacker.just_charged) {
      attacker.fatigued = true;
    }

    return { results, total_wounds: totalWounds, specialRulesApplied: allSpecialRules };
  }

  /**
   * Dedicated melee defense resolver.
   * Each unsaved hit = 1 wound (or Deadly(X) wounds). No other multipliers.
   * Rending: natural 6s to hit give AP(+4) for that hit. Still requires a save.
   */
  _resolveMeleeDefense(defender, hitCount, weapon, hitRolls) {
    if (hitCount <= 0) return { rolls: [], saves: 0, wounds: 0, specialRulesApplied: [] };

    const specialRulesApplied = [];
    const ap = this._parseAP(weapon);
    const deadlyMultiplier = this._parseDeadly(weapon);
    const rulesStr = this._rulesStr(weapon.special_rules);
    const hasBane    = rulesStr.includes('Bane');
    const hasRending = rulesStr.includes('Rending');
    const toughPerModel = Math.max(defender.tough_per_model || 1, 1);
    const defense = defender.defense || 5;

    if (ap > 0) specialRulesApplied.push({ rule: 'AP', value: ap, effect: `defense reduced by ${ap}` });

    const rolls = [];
    let saves = 0;
    let wounds = 0;
    let rendingCount = 0;

    for (let i = 0; i < hitCount; i++) {
      const hitRoll = hitRolls?.[i];
      const isRendingHit = hasRending && hitRoll && hitRoll.value === 6 && hitRoll.success && !hitRoll.auto;
      const hitAp = isRendingHit ? ap + 4 : ap;
      const modifiedDefense = Math.min(6, Math.max(2, defense - hitAp));
      if (isRendingHit) rendingCount++;

      let defRoll = this.dice.roll();
      let finalRoll = defRoll;

      if (hasBane && defRoll === 6) {
        const reroll = this.dice.roll();
        rolls.push({ value: defRoll, success: reroll >= modifiedDefense, baneReroll: reroll, finalValue: reroll });
        finalRoll = reroll;
      } else {
        rolls.push({ value: defRoll, success: defRoll >= modifiedDefense });
      }

      if (finalRoll >= modifiedDefense) {
        saves++;
      } else {
        wounds += deadlyMultiplier > 1 ? Math.min(deadlyMultiplier, toughPerModel) : 1;
      }
    }

    if (hasBane && hitCount > 0)
      specialRulesApplied.push({ rule: 'Bane', value: null, effect: 'defender must re-roll unmodified defense 6s' });
    if (hasRending && rendingCount > 0)
      specialRulesApplied.push({ rule: 'Rending', value: null, effect: `${rendingCount} natural 6s to hit gained AP(+4)` });
    if (deadlyMultiplier > 1)
      specialRulesApplied.push({ rule: 'Deadly', value: deadlyMultiplier, effect: `each unsaved hit deals ${Math.min(deadlyMultiplier, toughPerModel)} wounds (no carry-over)` });

    const unsavedHits = hitCount - saves;
    console.log(`[MELEE-DEF] weapon=${weapon.name} ap=${ap} def=${defense} hits=${hitCount} saves=${saves} unsaved=${unsavedHits} deadly=${deadlyMultiplier} rending=${rendingCount} wounds=${wounds}`);
    return { rolls, saves, wounds, specialRulesApplied };
  }

  // ─── Morale ───────────────────────────────────────────────────────────────

  checkMorale(unit, reason = 'wounds') {
    const quality = unit.quality || 4;
    const specialRulesApplied = [];

    // Shaken units always fail morale (spec sb_r3)
    if (unit.status === 'shaken') {
      return { passed: false, roll: null, reason: 'Already Shaken', specialRulesApplied };
    }

    const roll = this.dice.roll();
    const initialPassed = roll >= quality;

    // Fearless: re-roll failed morale tests on a 4+
    if (!initialPassed && this._has(unit.special_rules, 'Fearless')) {
      const reroll = this.dice.roll();
      specialRulesApplied.push({ rule: 'Fearless', value: null, effect: `re-rolled on 4+ (re-roll: ${reroll})` });
      if (reroll >= 4) {
        return { passed: true, roll, reroll, reason: 'Fearless reroll', specialRulesApplied };
      }
    }

    return { passed: initialPassed, roll, reason, specialRulesApplied };
  }

  /**
   * Apply the result of a morale test to a unit.
   *
   * FIX (Spec Bug #4): Routing can ONLY happen as a result of losing melee
   * (reason === 'melee_loss'). General morale tests from shooting casualties
   * can only result in Shaken, never Rout. This matches spec decisions 13/14.
   */
  applyMoraleResult(unit, passed, reason) {
    if (!passed) {
      const isSingleModel = (unit.model_count || 1) === 1;
      const belowHalf = isSingleModel
        ? unit.current_models <= unit.total_models / 2
        : Math.ceil(unit.current_models / Math.max(unit.tough_per_model || 1, 1)) <= Math.floor((unit.model_count || 1) / 2);

      // Only melee losses can cause routing (spec Decision 13 vs Decision 14)
      if (reason === 'melee_loss' && belowHalf) {
        unit.current_models = 0;
        unit.status = 'routed';
        return 'routed';
      }

      // All other failed morale tests (including general morale from shooting) = Shaken only
      unit.status = 'shaken';
      return 'shaken';
    }
    return 'passed';
  }

  applyCounterToCharger(charger, defender) {
    if (this._has(defender.special_rules, 'Counter')) {
      return defender.current_models || 0;
    }
    return 0;
  }

  // ─── Caster / Spell System ────────────────────────────────────────────────

  /** Returns how many tokens Caster(X) grants per round (0 if not a caster). */
  getCasterTokens(unit) {
    return this._param(unit.special_rules, 'Caster') ?? 0;
  }

  /** Replenish spell tokens at the start of a round. Tokens cap at 6. */
  replenishSpellTokens(unit) {
    const gain = this.getCasterTokens(unit);
    if (gain === 0) return 0;
    const current = unit.spell_tokens || 0;
    const after = Math.min(6, current + gain);
    unit.spell_tokens = after;
    return after - current;
  }

  /**
   * Cast one spell.
   *   spellCost     — token cost
   *   friendlyBonus — allied tokens spent to boost roll (+1 each)
   *   hostileBonus  — enemy tokens spent to counter roll (-1 each)
   * Returns { success, roll, modifiedRoll, tokensBefore, tokensAfter, helpBonus, specialRulesApplied }
   */
  castSpell(caster, target, spellCost, friendlyBonus = 0, hostileBonus = 0) {
    const specialRulesApplied = [];
    const tokensBefore = caster.spell_tokens || 0;

    if (tokensBefore < spellCost) {
      return { success: false, roll: null, modifiedRoll: null, tokensBefore, tokensAfter: tokensBefore, helpBonus: 0, reason: 'not enough tokens', specialRulesApplied };
    }

    caster.spell_tokens = tokensBefore - spellCost;

    const roll = this.dice.roll();
    const helpBonus = friendlyBonus - hostileBonus;
    const modifiedRoll = roll + helpBonus;
    const success = modifiedRoll >= 4;

    specialRulesApplied.push({
      rule: 'Caster', value: spellCost,
      effect: `spent ${spellCost} token(s), rolled ${roll}${helpBonus !== 0 ? ` ${helpBonus >= 0 ? '+' : ''}${helpBonus} (helpers)` : ''} = ${modifiedRoll} → ${success ? 'SUCCESS' : 'FAIL'}`,
    });
    if (friendlyBonus > 0) specialRulesApplied.push({ rule: 'Caster helper', value: friendlyBonus, effect: `${friendlyBonus} allied token(s) spent for +${friendlyBonus} to cast roll` });
    if (hostileBonus > 0) specialRulesApplied.push({ rule: 'Caster counter', value: hostileBonus, effect: `${hostileBonus} enemy token(s) spent for -${hostileBonus} to cast roll` });

    return { success, roll, modifiedRoll, tokensBefore, tokensAfter: caster.spell_tokens, helpBonus, specialRulesApplied };
  }

  canCast(unit, spellValue, currentTokens) {
    return (currentTokens ?? unit.spell_tokens ?? 0) >= spellValue;
  }

  canUseTakedown(unit, weapon) {
    return this._has(weapon.special_rules, 'Takedown');
  }

  // ─── Objectives ───────────────────────────────────────────────────────────

  updateObjectives(gameState) {
    gameState.objectives?.forEach(obj => {
      if (obj.controlled_by === 'n/a') return;
      const unitsNear = gameState.units.filter(u =>
        this.calculateDistance(u, obj) <= 3 && u.current_models > 0 && !u.embarked_in
      );
      // Shaken units cannot seize or contest (spec sb_r4)
      const agentANear = unitsNear.some(u => u.owner === 'agent_a' && u.status !== 'shaken');
      const agentBNear = unitsNear.some(u => u.owner === 'agent_b' && u.status !== 'shaken');
      if      (agentANear && !agentBNear) obj.controlled_by = 'agent_a';
      else if (agentBNear && !agentANear) obj.controlled_by = 'agent_b';
      else if (agentANear && agentBNear)  obj.controlled_by = 'contested';
    });
  }

  // ─── Geometry ─────────────────────────────────────────────────────────────

  calculateDistance(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  /**
   * Estimates the physical radius (in inches) of a unit's model spread on the board.
   * Based on model count and size (tough_per_model determines model base size).
   */
  getUnitFootprintRadius(unit) {
    const modelCount = unit.model_count || Math.ceil((unit.total_models || 1) / Math.max(unit.tough_per_model || 1, 1));
    const tpm = unit.tough_per_model || 1;
    const modelSpacing = tpm >= 6 ? 1.5 : tpm >= 3 ? 1.0 : 0.6;
    const cols = Math.min(5, modelCount);
    const rows = Math.ceil(modelCount / cols);
    const w = cols * modelSpacing;
    const h = rows * modelSpacing;
    return Math.sqrt(w * w + h * h) / 2;
  }

  /** Returns the position of the furthest model in the direction of the target. */
  getFurthestModelPosition(unit, target) {
    const dx = target.x - unit.x;
    const dy = target.y - unit.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return { x: unit.x, y: unit.y };
    const radius = this.getUnitFootprintRadius(unit);
    return { x: unit.x + (dx / dist) * radius, y: unit.y + (dy / dist) * radius };
  }

  /** True if at least one model in the unit's footprint is within weapon range. */
  checkEffectiveRange(attacker, target, weaponRange) {
    const furthest = this.getFurthestModelPosition(attacker, target);
    const dist = Math.sqrt((target.x - furthest.x) ** 2 + (target.y - furthest.y) ** 2);
    return dist <= weaponRange;
  }

  /** True if any sightline from the attacker's footprint to the target is clear. */
  checkEffectiveLOS(attacker, target, terrain) {
    const furthest = this.getFurthestModelPosition(attacker, target);
    if (this.checkLineOfSightTerrain(furthest, target, terrain)) return true;
    return this.checkLineOfSightTerrain(attacker, target, terrain);
  }

  /**
   * Estimates how many models in the unit can contribute attacks to a target.
   * Returns at least 1 if any LOS/range exists at all.
   */
  getModelsInRange(unit, target, weaponRange) {
    const totalModels = unit.model_count || Math.ceil((unit.total_models || 1) / Math.max(unit.tough_per_model || 1, 1));
    const currentModels = Math.min(totalModels, Math.max(1, Math.ceil((unit.current_models || 1) / Math.max(unit.tough_per_model || 1, 1))));

    const distToCenter = this.calculateDistance(unit, target);
    const radius = this.getUnitFootprintRadius(unit);
    const distFurthest = Math.max(0, distToCenter - radius);
    if (distFurthest > weaponRange) return 0;

    const distNearest = distToCenter + radius;
    const footprintDiameter = radius * 2;
    if (footprintDiameter <= 0) return currentModels;

    const rangeOverlap = Math.min(distNearest, weaponRange) - distFurthest;
    const fraction = Math.min(1, Math.max(0, rangeOverlap / footprintDiameter));
    return Math.max(1, Math.round(currentModels * fraction));
  }

  // Alias kept for backward compatibility
  checkLineOfSight(from, to, terrain) { return this.checkLineOfSightTerrain(from, to, terrain); }

  getTerrainAtPosition(x, y, terrain) {
    if (!terrain) return null;
    return terrain.find(t => x >= t.x && x <= t.x + t.width && y >= t.y && y <= t.y + t.height) ?? null;
  }

  getCoverBonus(unit, terrain) {
    const unitTerrain = this.getTerrainAtPosition(unit.x, unit.y, terrain);
    return (unitTerrain && (unitTerrain.cover || unitTerrain.type === 'cover')) ? 1 : 0;
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

  // ─── Legal Move Generation (required by LLMAgent) ─────────────────────────
  //
  // These two methods make implicit legality explicit so agents can reason
  // about options without needing to know game rules internally.
  // DMNAgent doesn't use them (it scores implicitly), but they don't hurt.

  /**
   * Returns the list of legal actions for a unit this activation.
   * Used by LLMAgent to populate the prompt and validate responses.
   *
   * @param {object} unit
   * @param {object} gameState
   * @returns {Array<{action, moveDistance?, chargeDistance?, reachableTargets?, canShoot?}>}
   */
  getLegalActions(unit, gameState) {
    const actions = [];
    const sr = unit.special_rules;

    // Immobile units can only Hold
    if (this._has(sr, 'Immobile')) {
      return [{ action: 'Hold', canShoot: true }];
    }

    // Aircraft can only Advance (their special move)
    if (this._has(sr, 'Aircraft')) {
      return [{ action: 'Advance', canShoot: true, moveDistance: 36 }];
    }

    // Hold — always legal
    actions.push({ action: 'Hold', canShoot: true });

    // Advance — always legal
    const advanceDist = this.getMoveDistance(unit, 'Advance', gameState.terrain);
    actions.push({ action: 'Advance', canShoot: true, moveDistance: advanceDist });

    // Rush — always legal (but no shooting after)
    const rushDist = this.getMoveDistance(unit, 'Rush', gameState.terrain);
    actions.push({ action: 'Rush', canShoot: false, moveDistance: rushDist });

    // Charge — only if a reachable enemy exists
    // Cannot charge if already charged this activation, or if unit is a transport
    const canAttemptCharge =
      !unit.just_charged &&
      !this._has(sr, 'Transport') &&
      !this._has(sr, 'Indirect') &&
      !(/artillery|gun|cannon|mortar|support/i.test(unit.name));

    if (canAttemptCharge) {
      const chargeDist = this.getMoveDistance(unit, 'Charge', gameState.terrain);
      const enemies = (gameState.units || []).filter(u =>
        u.owner !== unit.owner &&
        u.current_models > 0 &&
        u.status !== 'destroyed' &&
        u.status !== 'routed'
      );
      const reachable = enemies.filter(e => this.checkEffectiveRange(unit, e, chargeDist));

      // Need at least one melee weapon or Impact rule to charge meaningfully
      const hasMelee = (unit.weapons || []).some(w => (w.range ?? 2) <= 2);
      const hasImpact = this._has(sr, 'Impact') ||
        (typeof sr === 'string' && sr.match(/Impact\(\d+\)/));

      if (reachable.length > 0 && (hasMelee || hasImpact)) {
        actions.push({
          action: 'Charge',
          canShoot: false,
          chargeDistance: chargeDist,
          reachableTargets: reachable.map(e => e.name),
        });
      }
    }

    return actions;
  }

  /**
   * Returns all valid shooting target+weapon combinations for a unit.
   * Filters by range AND line of sight. Used by LLMAgent for informed
   * target selection; also useful for validation.
   *
   * @param {object} unit
   * @param {object} gameState
   * @returns {Array<{target, targetId, weapon, weaponName, range}>}
   */
  getShootingTargets(unit, gameState) {
    const enemies = (gameState.units || []).filter(u =>
      u.owner !== unit.owner &&
      u.current_models > 0 &&
      u.status !== 'destroyed' &&
      u.status !== 'routed'
    );

    const results = [];
    for (const enemy of enemies) {
      for (const weapon of (unit.weapons || [])) {
        if ((weapon.range ?? 2) <= 2) continue; // melee-only weapon
        if (!this.checkEffectiveRange(unit, enemy, weapon.range)) continue;

        const isIndirect = this._has(weapon.special_rules, 'Indirect');
        if (!isIndirect && !this.checkEffectiveLOS(unit, enemy, gameState.terrain)) continue;

        results.push({
          target:     enemy,
          targetId:   enemy.id,
          targetName: enemy.name,
          weapon,
          weaponName: weapon.name,
          range:      this.calculateDistance(unit, enemy),
        });
      }
    }

    return results;
  }
}
