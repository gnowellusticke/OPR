// Parser for OPR Army Forge JSON format
export class ArmyForgeParser {
  
  // This would need the actual army data files to properly parse units
  // For now, we'll create a basic structure parser
  parse(armyForgeData) {
    if (!armyForgeData.list || !armyForgeData.list.units) {
      throw new Error('Invalid Army Forge format: missing list.units');
    }

    const units = armyForgeData.list.units;
    const parsedUnits = [];

    // Group units that are combined or joined
    const processedIds = new Set();
    
    units.forEach((unit, index) => {
      if (processedIds.has(unit.selectionId)) return;
      
      // Check if this unit is joined to another
      if (unit.joinToUnit) {
        processedIds.add(unit.selectionId);
        return; // Will be processed with parent unit
      }

      // Find all units joined to this one
      const joinedUnits = units.filter(u => u.joinToUnit === unit.selectionId);
      const totalModels = 1 + joinedUnits.length; // Simplified

      // Create a basic unit structure
      // Note: Without army data files, we use generic stats
      const parsedUnit = {
        name: this.generateUnitName(unit, index),
        quality: this.inferQuality(unit),
        defense: this.inferDefense(unit),
        models: totalModels,
        total_models: totalModels,
        points: this.estimatePoints(unit, joinedUnits),
        weapons: this.parseWeapons(unit),
        special_rules: this.parseSpecialRules(unit)
      };

      parsedUnits.push(parsedUnit);
      processedIds.add(unit.selectionId);
      joinedUnits.forEach(j => processedIds.add(j.selectionId));
    });

    return {
      name: armyForgeData.armyName || armyForgeData.list.name,
      faction: armyForgeData.armyName || 'Unknown',
      total_points: armyForgeData.listPoints || armyForgeData.list.pointsLimit,
      units: parsedUnits
    };
  }

  generateUnitName(unit, index) {
    // Unit IDs from Army Forge - we'll create readable names
    const idMap = {
      'iAADbpw': 'Orc Warriors',
      'knHYEoy': 'Orc Archers',
      'WgVWJ9Z': 'Orc Bikers',
      'D69wnil': 'Orc Brutes',
      'ynxGc1K': 'Orc Tank',
      'wHYIcWV': 'Orc Hero',
      'f2gOlPs': 'Orc Hero'
    };
    return idMap[unit.id] || `Unit ${index + 1}`;
  }

  inferQuality(unit) {
    // Heroes typically have better quality
    if (unit.id === 'wHYIcWV' || unit.id === 'f2gOlPs') return 3;
    // Regular troops
    return 4;
  }

  inferDefense(unit) {
    // Brutes and vehicles have better defense
    if (unit.id === 'D69wnil' || unit.id === 'ynxGc1K') return 3;
    // Regular units
    return 4;
  }

  estimatePoints(unit, joinedUnits) {
    // Rough point estimation based on unit type and size
    const basePoints = {
      'iAADbpw': 30, // Warriors
      'knHYEoy': 25, // Archers
      'WgVWJ9Z': 40, // Bikers
      'D69wnil': 50, // Brutes
      'ynxGc1K': 120, // Tank
      'wHYIcWV': 80, // Hero
      'f2gOlPs': 90  // Hero
    };
    
    const base = basePoints[unit.id] || 30;
    const upgradeCount = unit.selectedUpgrades?.length || 0;
    const joinedCount = joinedUnits.length;
    
    return base + (upgradeCount * 5) + (joinedCount * 20);
  }

  parseWeapons(unit) {
    const weapons = [];
    
    // Default weapons based on unit type
    const defaultWeapons = {
      'iAADbpw': [
        { name: "Choppa", range: 1, attacks: 1, ap: 0 },
        { name: "Slugga", range: 12, attacks: 1, ap: 0 }
      ],
      'knHYEoy': [
        { name: "Bow", range: 24, attacks: 1, ap: 0 }
      ],
      'WgVWJ9Z': [
        { name: "Bike Gun", range: 18, attacks: 2, ap: 0 },
        { name: "Ramming", range: 1, attacks: 2, ap: 0 }
      ],
      'D69wnil': [
        { name: "Big Choppa", range: 1, attacks: 2, ap: -1 }
      ],
      'ynxGc1K': [
        { name: "Tank Cannon", range: 36, attacks: 3, ap: -2 }
      ],
      'wHYIcWV': [
        { name: "Power Klaw", range: 1, attacks: 3, ap: -2 },
        { name: "Pistol", range: 12, attacks: 2, ap: 0 }
      ],
      'f2gOlPs': [
        { name: "Hero Weapons", range: 18, attacks: 2, ap: -1 }
      ]
    };

    return defaultWeapons[unit.id] || [
      { name: "Basic Weapon", range: 12, attacks: 1, ap: 0 }
    ];
  }

  parseSpecialRules(unit) {
    const rules = [];
    
    // Add rules based on unit type
    if (unit.id === 'wHYIcWV' || unit.id === 'f2gOlPs') {
      rules.push('Hero');
    }
    
    if (unit.id === 'WgVWJ9Z') {
      rules.push('Fast');
    }
    
    if (unit.id === 'D69wnil') {
      rules.push('Furious');
    }
    
    return rules;
  }
}

export default ArmyForgeParser;