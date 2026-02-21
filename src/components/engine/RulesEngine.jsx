import { DiceRoller } from './GameEngine';

export class RulesEngine {
  constructor() {
    this.dice = new DiceRoller();
    this.limitedWeaponsUsed = new Map(); // Track Limited(1) weapons: weaponId -> used count
  }

  trackLimitedWeapon(weapon, unitId) {
    if (!weapon.special_rules?.includes('Limited')) return false;
    const key = `${unitId}_${weapon.name}`;
    const used = this.limitedWeaponsUsed.get(key) || 0;
    if (used > 0) return true; // already used
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

  // Ambush: check if a unit has the Ambush rule and is currently in reserve
  isAmbushUnit(unit) {
    return unit.special_rules?.includes('Ambush');
  }

  // Deploy an Ambush unit from reserve — places it anywhere on the table > 9" from all enemies.
  // Returns true if a valid position was found and the unit was placed, false otherwise.
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

  // Teleport: redeploy anywhere outside 9" of all enemies
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
    // Immobile: can only use Hold
    if (unit.special_rules?.includes('Immobile') && action !== 'Hold') {
      return 0;
    }

    // Aircraft: can only use Advance, add 30" bonus
    if (unit.special_rules?.includes('Aircraft')) {
      if (action !== 'Advance') return 0;
      return 6 + 30; // 36" total
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

  // Check if any friendly unit within 6" has Stealth Aura
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

  // Shooting
  resolveShooting(attacker, defender, weapon, terrain, gameState) {
  // Limited: may only be used once per game
  if (this.trackLimitedWeapon(weapon, attacker.id)) {
    return {
      weapon: weapon.name,
      hit_rolls: [],
      hits: 0,
      defense_rolls: [],
      saves: 0,
      wounds: 0,
      blast: false,
      baneProcs: 0,
      specialRulesApplied: [{ rule: 'Limited', value: null, effect: 'weapon already used once this game' }]
    };
  }

  const hits = this.rollToHit(attacker, weapon, defender, gameState);
  const saves = this.rollDefense(defender, hits.successes, weapon, terrain, hits.rolls);
  const allRules = [...(hits.specialRulesApplied || []), ...(saves.specialRulesApplied || [])];

  // Global deduplication: max one entry per rule name
  const seenRules = new Set();
  const specialRulesApplied = allRules.filter(rule => {
    if (seenRules.has(rule.rule)) return false;
    seenRules.add(rule.rule);
    return true;
  });

  return {
  weapon: weapon.name,
  hit_rolls: hits.rolls,
  hits: hits.successes,
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
  let bonusHitsFromFurious = 0;

  // Thrust: +1 to hit when charging (and +1 AP, handled in melee)
  if (unit.just_charged && weapon.special_rules?.includes('Thrust')) {
  quality = Math.max(2, quality - 1);
  specialRulesApplied.push({ rule: 'Thrust', value: null, effect: 'quality -1 (easier) on charge' });
  }

  // Shaken: -1 to Quality (higher number = harder to hit)
  if (unit.status === 'shaken') {
  quality = Math.min(6, quality + 1);
  specialRulesApplied.push({ rule: 'Shaken', value: null, effect: 'quality +1 (harder to hit)' });
  }

  // Machine-Fog on target: +1 to quality needed to hit
  if (target?.special_rules?.includes('Machine-Fog')) {
  quality = Math.min(6, quality + 1);
  specialRulesApplied.push({ rule: 'Machine-Fog', value: null, effect: 'quality +1 vs target' });
  }

  // Stealth on target (direct or via Stealth Aura): +1 to quality needed
  if (target && this.hasStealth(target, gameState) && weapon.range > 2) {
  quality = Math.min(6, quality + 1);
  specialRulesApplied.push({ rule: 'Stealth', value: null, effect: 'quality +1 vs stealthed target' });
  }

  // Indirect: -1 to hit after moving
  if (weapon.special_rules?.includes('Indirect')) {
  quality = Math.min(6, quality + 1);
  specialRulesApplied.push({ rule: 'Indirect', value: null, effect: 'quality +1 after moving' });
  }

  // Artillery: +1 to hit at range > 9" (lower quality = better)
  if (weapon.special_rules?.includes('Artillery') && this.calculateDistance(unit, target) > 9) {
  quality = Math.max(2, quality - 1);
  specialRulesApplied.push({ rule: 'Artillery', value: null, effect: 'quality -1 at 9"+ range' });
  }

  // Reliable: attacks at Quality 2+ (override quality)
  if (weapon.special_rules?.includes('Reliable')) {
  quality = 2;
  specialRulesApplied.push({ rule: 'Reliable', value: null, effect: 'attacks at Quality 2+' });
  }

  let attacks = weapon.attacks || 1;

  // Blast(X) — X automatic hits, no quality roll
  // Bug 1 fix: Check weapon.blast field, special_rules array, and weapon name
  let blastCount = null;

  // Check weapon.blast field first
  if (weapon.blast === true && weapon.blast_x) {
    blastCount = weapon.blast_x;
  }

  // Check special_rules array
  if (!blastCount && Array.isArray(weapon.special_rules)) {
    for (const sr of weapon.special_rules) {
      const srStr = typeof sr === 'string' ? sr : (sr.rule || '');
      const match = srStr.match(/Blast\((\d+)\)/i);
      if (match) {
        blastCount = parseInt(match[1]);
        break;
      }
    }
  }

  // Check special_rules string
  if (!blastCount && weapon.special_rules && typeof weapon.special_rules === 'string') {
    const match = weapon.special_rules.match(/Blast\((\d+)\)/i);
    if (match) blastCount = parseInt(match[1]);
  }

  // Check weapon name
  if (!blastCount) {
    const nameMatch = (weapon.name || '').match(/Blast[\s\-]?(\d+)/i);
    if (nameMatch) blastCount = parseInt(nameMatch[1]);
  }

  // If Blast found, use it
  if (blastCount) {
    const autoHitRolls = Array.from({ length: blastCount }, () => ({ value: 6, success: true, auto: true }));
    specialRulesApplied.push({ rule: 'Blast', value: blastCount, effect: `${blastCount} automatic hits, no quality roll` });
    return { rolls: autoHitRolls, successes: blastCount, specialRulesApplied, blast: true };
  }

  const rolls = this.dice.rollQualityTest(quality, attacks);
  let successes = rolls.filter(r => r.success).length;

  // Bug 1 fix: Furious — add 1 extra hit per unmodified 6, do NOT re-roll misses
  if (unit.special_rules?.includes('Furious') && !weapon.special_rules?.includes('Furious')) {
    const naturalSixes = rolls.filter(r => r.value === 6 && r.success).length;
    if (naturalSixes > 0) {
      successes += naturalSixes;
      bonusHitsFromFurious = naturalSixes;
      specialRulesApplied.push({ rule: 'Furious', value: null, effect: `${naturalSixes} unmodified 6s generated ${naturalSixes} extra hits` });
    }
  }

  if (weapon.special_rules?.includes('Deadly')) {
  const deadlyMatch = weapon.special_rules.match(/Deadly\((\d+)\)/);
  const deadlyThreshold = deadlyMatch ? parseInt(deadlyMatch[1]) : 6;
  const extra = rolls.filter(r => r.value >= deadlyThreshold).length;
  successes += extra;
  if (extra > 0) specialRulesApplied.push({ rule: 'Deadly', value: deadlyThreshold, effect: `${extra} extra hits on ${deadlyThreshold}+` });
  }

  // Relentless: extra hit on 6 at 9"+ range
  if (weapon.special_rules?.includes('Relentless') && this.calculateDistance(unit, target) > 9) {
  const natureSixes = rolls.filter(r => r.value === 6 && r.success).length;
  successes += natureSixes;
  if (natureSixes > 0) specialRulesApplied.push({ rule: 'Relentless', value: null, effect: `${natureSixes} extra hits from natural 6s at 9"+ range` });
  }

  // Surge: extra hit on natural 6
  if (weapon.special_rules?.includes('Surge')) {
  const natureSixes = rolls.filter(r => r.value === 6 && r.success).length;
  successes += natureSixes;
  if (natureSixes > 0) specialRulesApplied.push({ rule: 'Surge', value: null, effect: `${natureSixes} extra hits from natural 6s` });
  }

  return { rolls, successes, specialRulesApplied };
  }

  rollDefense(unit, hitCount, weapon, terrain, hitRolls) {
  let defense = unit.defense || 5;
  const ap = weapon.ap || 0;
  const specialRulesApplied = [];
  let baneProcs = 0;

  // Bane: natural 6s on hit rolls auto-wound, bypassing saves
  const baneHits = weapon.special_rules?.includes('Bane') && hitRolls
    ? hitRolls.filter(r => r.value === 6 && r.success && !r.auto).length
    : 0;
  if (baneHits > 0) {
    baneProcs = baneHits;
    hitCount = Math.max(0, hitCount - baneHits); // Remove Bane hits from save pool
    if (baneHits > 0) specialRulesApplied.push({ rule: 'Bane', value: baneHits, effect: `${baneHits} natural 6s auto-wound, bypassing saves` });
  }

  if (terrain) {
  const coverBonus = this.getCoverBonus(unit, terrain);
  if (coverBonus > 0) {
  defense -= coverBonus;
  specialRulesApplied.push({ rule: 'Cover', value: coverBonus, effect: `save improved by ${coverBonus} from terrain` });
  }
  }

  // Damage(X): each unsaved wound deals X damage (only on weapons, not melee Fists)
  const damageMatch = weapon.special_rules?.match(/Damage\((\d+)\)/);
  const damageValue = damageMatch ? parseInt(damageMatch[1]) : 1;
  if (damageMatch) {
  specialRulesApplied.push({ rule: 'Damage', value: damageValue, effect: `each unsaved wound deals ${damageValue} damage` });
  }

  // Deadly(X): only applies if weapon explicitly has the rule
  let deadlyMultiplier = 1;
  if (weapon.special_rules) {
    const weaponRulesStr = Array.isArray(weapon.special_rules) 
      ? weapon.special_rules.join(' ') 
      : (typeof weapon.special_rules === 'string' ? weapon.special_rules : '');
    const deadlyMatch = weaponRulesStr.match(/Deadly\((\d+)\)/i);
    if (deadlyMatch) {
      deadlyMultiplier = parseInt(deadlyMatch[1]);
      specialRulesApplied.push({ rule: 'Deadly', value: deadlyMultiplier, effect: `unsaved wounds multiplied by ${deadlyMultiplier}` });
    }
  }

  // Unstoppable: ignores negative AP modifiers
  let effectiveAp = ap;
  if (weapon.special_rules && 
      (Array.isArray(weapon.special_rules) ? weapon.special_rules.includes('Unstoppable') : weapon.special_rules.includes('Unstoppable'))) {
    if (ap < 0) {
      effectiveAp = 0;
      specialRulesApplied.push({ rule: 'Unstoppable', value: null, effect: 'ignores negative AP modifiers' });
    }
  }

  // Bug 3 fix: AP is applied to defense modifier, not to saved hits
  // Modified defense = base defense - AP (AP reduces how hard it is to save)
  if (effectiveAp > 0) {
    specialRulesApplied.push({ rule: 'AP', value: effectiveAp, effect: `defense reduced by ${effectiveAp}` });
  }

  const modifiedDefense = Math.min(6, Math.max(2, defense - effectiveAp));
  const rolls = this.dice.rollDefense(modifiedDefense, hitCount);
  let saves = rolls.filter(r => r.success).length;

  // Rending: Unmodified 6s on hit rolls auto-wound (bypass saves)
  let renderingAutoWounds = 0;
  if (weapon.special_rules && hitRolls) {
    const hasRending = Array.isArray(weapon.special_rules) 
      ? weapon.special_rules.includes('Rending')
      : weapon.special_rules.includes('Rending');
    if (hasRending) {
      renderingAutoWounds = hitRolls.filter(r => r.value === 6 && r.success && !r.auto && r.baneProc !== true).length;
      saves = Math.max(0, saves - renderingAutoWounds);
      if (renderingAutoWounds > 0) specialRulesApplied.push({ rule: 'Rending', value: null, effect: `${renderingAutoWounds} natural 6s bypass saves` });
    }
  }

  // Bug 2 fix: Calculate wounds ONLY from unsaved hits, apply multipliers only once
  // wounds = (hits_not_saved) × deadly_multiplier + bane_procs
  const unsavedWounds = Math.max(0, hitCount - saves);
  const wounds = unsavedWounds * deadlyMultiplier + baneProcs;

  // CRITICAL VALIDATION: ensure wounds never exceed initial hit count (can happen if multipliers applied incorrectly)
  // Also ensure if hitCount = 0, then wounds = 0
  if (hitCount === 0 && wounds > 0) {
    console.error(`[MELEE BUG] hitCount=0 but wounds=${wounds}. This is impossible. Setting to 0.`);
    return { rolls, saves, wounds: 0, wounds_dealt: 0, baneProcs, deadlyMultiplier, specialRulesApplied };
  }

  return { rolls, saves, wounds, wounds_dealt: wounds, baneProcs, deadlyMultiplier, specialRulesApplied };
  }

  // End-of-round regeneration/self-repair — unified for Regeneration, Self-Repair and Repair.
  // NEVER touches unit.status — only modifies current_models.
  applyRegeneration(unit) {
    const REGEN_RULES = ['Regeneration', 'Self-Repair', 'Repair'];
    const hasRule = REGEN_RULES.some(r => unit.special_rules?.includes(r));
    if (!hasRule) return { recovered: 0, roll: null };
    if (unit.current_models >= unit.total_models) return { recovered: 0, roll: null };
    const roll = this.dice.roll(); // always an integer 1-6
    const recovered = roll >= 5 ? 1 : 0;
    // Only heal wounds — never touch status
    unit.current_models = Math.min(unit.total_models, unit.current_models + recovered);
    return { recovered, roll };
  }

  // Melee
  resolveMelee(attacker, defender, gameState) {
     const attackerResults = this.resolveMeleeStrikes(attacker, defender, false, gameState);
     let defenderResults = null;
     if (defender.status !== 'shaken' && defender.current_models > 0) {
     defenderResults = this.resolveMeleeStrikes(defender, attacker, true, gameState);
     }

     // Bug 1+2 fix: LOCK wounds from dice FIRST, before any other calculations
     // wounds_dealt = (hits - saves) × damage_x + bane_procs
     // wounds_taken = (defender_hits - attacker_saves) × defender_damage_x + defender_bane_procs
     let attackerRealWounds = attackerResults.total_wounds;
     let defenderRealWounds = defenderResults?.total_wounds || 0;

     // Bug 1 fix: Apply Fear(X) ONLY if unit actually has Fear rule
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

     // For winner determination: use Fear-adjusted wounds (for comparison only)
     const attackerWoundsForComparison = attackerRealWounds + attackerFearBonus;
     const defenderWoundsForComparison = defenderRealWounds + defenderFearBonus;

     // Assertion: wounds_dealt must always be <= attacker_wounds_for_comparison
     if (attackerRealWounds > attackerWoundsForComparison) {
       console.error(`[MELEE BUG] attackerRealWounds(${attackerRealWounds}) > comp(${attackerWoundsForComparison})`);
     }
     if (defenderRealWounds > defenderWoundsForComparison) {
       console.error(`[MELEE BUG] defenderRealWounds(${defenderRealWounds}) > comp(${defenderWoundsForComparison})`);
     }

     const winner = attackerWoundsForComparison > defenderWoundsForComparison ? attacker :
                    defenderWoundsForComparison > attackerWoundsForComparison ? defender : null;

     // Build full bidirectional roll_results for the logger
     const aRes = attackerResults.results?.[0] || {};
     const dRes = defenderResults?.results?.[0] || null;
     const specialRulesApplied = [
     ...(attackerResults.specialRulesApplied || []),
     ...(defenderResults?.specialRulesApplied || [])
     ];

     // Bug 4 fix: Global SRA deduplication — max one entry per rule name
     const seenRules = new Set();
     const deduplicatedRules = specialRulesApplied.filter(rule => {
       if (seenRules.has(rule.rule)) return false;
       seenRules.add(rule.rule);
       return true;
     });

     // Bug 1+2 fix: attacker_saves_forced and defender_saves_forced track non-Bane hits only
     const attackerSavesForced = aRes.hits ?? 0;
     const defenderSavesForced = dRes ? (dRes.hits ?? 0) : 0;

     const rollResults = {
     attacker_attacks: aRes.attacks || 1,
     attacker_hits: aRes.hits ?? 0,
     attacker_saves_forced: attackerSavesForced,
     defender_saves_made: aRes.saves ?? 0,
     wounds_dealt: attackerRealWounds,  // LOCKED from dice, no modifications after (Bug 1+2)
     defender_attacks: dRes ? (dRes.attacks || 1) : 0,
     defender_hits: dRes ? (dRes.hits ?? 0) : 0,
     defender_saves_forced: defenderSavesForced,
     attacker_saves_made: dRes ? (dRes.saves ?? 0) : 0,
     wounds_taken: defenderRealWounds,  // LOCKED from dice, no modifications after (Bug 2)
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

      // Multi-model units strike once per model
      const currentModelCount = Math.ceil(attacker.current_models / Math.max(attacker.tough_per_model, 1));

      weaponsToUse.forEach(weapon => {
      let modifiedWeapon = { ...weapon };
      const weaponSpecialRules = [];

      // Thrust: +1 to hit and AP(+1) when charging
      if (attacker.just_charged && weapon.special_rules?.includes('Thrust')) {
      modifiedWeapon.ap = (weapon.ap || 0) + 1;
      // Note: +1 to hit handled in rollToHit via quality modification
      weaponSpecialRules.push({ rule: 'Thrust', value: null, effect: '+1 to hit and AP(+1) on charge' });
      }

      // Impact(X): Roll X dice on charge attack (unless fatigued)
      if (attacker.just_charged && !attacker.fatigued && weapon.special_rules?.includes('Impact')) {
      const impactMatch = weapon.special_rules.match(/Impact\((\d+)\)/);
      const impactDice = impactMatch ? parseInt(impactMatch[1]) : 1;
      const impactHits = Array.from({ length: impactDice }, () => this.dice.roll()).filter(r => r >= 2).length;
      modifiedWeapon.attacks = (weapon.attacks || 1) + impactHits;
      weaponSpecialRules.push({ rule: 'Impact', value: impactDice, effect: `${impactHits} extra hits from Impact(${impactDice})` });
      }

      // Scale attacks by model count
      const baseAttacks = modifiedWeapon.attacks || 1;
      const scaledAttacks = baseAttacks * Math.max(currentModelCount, 1);
      const scaledWeapon = { ...modifiedWeapon, attacks: scaledAttacks };

      const result = this.resolveShooting(attacker, defender, scaledWeapon, null, gameState);
      result.hits = result.hits ?? 0;
      result.saves = result.saves ?? 0;
      result.attacks = scaledAttacks;

      // Lock wounds_dealt BEFORE building melee_resolution
      // wounds_dealt = max(0, hits - saves) × damage_multiplier × deadly_multiplier
      const realWounds = result.wounds || 0;

      // CRITICAL: Ensure realWounds is NEVER negative and never includes Fear bonus
      if (realWounds < 0) {
        console.error(`[MELEE BUG] realWounds is negative: ${realWounds}. Setting to 0.`);
      }
      const validatedWounds = Math.max(0, realWounds);

      // Fear(X): attacker counts as dealing +X wounds when checking who won melee
      // Fear bonus goes ONLY into melee_resolution, NOT into wounds_dealt
      if (attacker.special_rules?.includes('Fear')) {
      const fearMatch = attacker.special_rules.match(/Fear\((\d+)\)/);
      const fearBonus = fearMatch ? parseInt(fearMatch[1]) : 1;
      result.fearBonus = fearBonus;
      weaponSpecialRules.push({ rule: 'Fear', value: fearBonus, effect: `+${fearBonus} wounds for melee victory check` });
      }

      // Only include rules from THIS melee weapon, not all weapons on the unit
      // Filter out ranged-only rules (Blast) and rules from other weapons
      const rangedOnlyRules = ['Blast', 'Relentless', 'Indirect', 'Artillery'];
      const filtered = (result.specialRulesApplied || []).filter(rule => !rangedOnlyRules.includes(rule.rule));

      // Merge melee-specific rules and weapon rules
      const combined = [...weaponSpecialRules, ...filtered];
      const seenRules = new Set();
      result.specialRulesApplied = combined.filter(rule => {
        if (seenRules.has(rule.rule)) return false;
        seenRules.add(rule.rule);
        return true;
      });

      allSpecialRules.push(...result.specialRulesApplied);
      results.push(result);
      totalWounds += validatedWounds;
      });

      if (isStrikeBack || attacker.just_charged) {
      attacker.fatigued = true;
      }

      return { results, total_wounds: totalWounds, specialRulesApplied: allSpecialRules };
      }

  // Morale — never called on already-shaken units (callers must guard), but defensively roll anyway
  checkMorale(unit, reason = 'wounds') {
  const quality = unit.quality || 4;
  const roll = this.dice.roll();
  const specialRulesApplied = [];

  if (unit.status === 'shaken') {
  return { passed: false, roll, reason: 'Already Shaken', specialRulesApplied };
  }
  const passed = roll >= quality;

  // Bug 1 fix: Fearless re-roll only applies if unit actually has Fearless rule
  if (!passed && unit.special_rules?.includes('Fearless')) {
  const reroll = this.dice.roll();
  specialRulesApplied.push({ rule: 'Fearless', value: null, effect: `re-rolled on 4+ (re-roll: ${reroll})` });
  if (reroll >= 4) {
  return { passed: true, roll, reroll, reason: 'Fearless reroll', specialRulesApplied };
  }
  }

  return { passed, roll, reason, specialRulesApplied };
  }

  // Counter: defender strikes first when charged, charging unit gets -1 Impact per model with Counter
  applyCounterToCharger(charger, defender) {
    let penalty = 0;
    const counterModels = (defender.current_models || 0);
    if (defender.special_rules?.includes('Counter')) {
      penalty = counterModels;
    }
    return penalty;
  }

  // Caster(X): manages spell tokens and casting
  getCasterTokens(unit) {
    const casterMatch = unit.special_rules?.match(/Caster\((\d+)\)/);
    return casterMatch ? parseInt(casterMatch[1]) : 0;
  }

  canCast(unit, spellValue, currentTokens) {
    return currentTokens >= spellValue;
  }

  // Takedown: pick individual model as target (treated as unit of 1)
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

  // Objectives
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

  // Utilities
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

  // Zone helper for JSON log
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