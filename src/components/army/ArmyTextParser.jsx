export class ArmyTextParser {
  static parse(text) {
    const lines = text.trim().split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      throw new Error('Empty army list');
    }

    // Parse header: ++ Army Name (version) [GF XXXpts] [X Units] ++
    const headerLine = lines[0];
    const headerMatch = headerLine.match(/\+\+\s*(.+?)\s*\(.*?\)\s*\[GF\s*(\d+)pts\]/);
    
    if (!headerMatch) {
      throw new Error('Invalid army list format - missing header');
    }

    const armyName = headerMatch[1].trim();
    const totalPoints = parseInt(headerMatch[2]);

    const units = [];
    let i = 1;

    while (i < lines.length) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (!line) {
        i++;
        continue;
      }

      // Check if this is a unit line (contains Q and D stats)
      if (line.includes('Q') && line.includes('D') && line.includes('+')) {
        const result = this.parseUnit(lines, i);
        if (result) {
          units.push(...result.units);
          i = result.nextLineIndex;
        } else {
          i++;
        }
      } else {
        i++;
      }
    }

    return {
      name: armyName,
      faction: armyName,
      total_points: totalPoints,
      units: units
    };
  }

  static parseUnit(lines, startIndex) {
    const line = lines[startIndex].trim();
    
    // Check for multiplier prefix like "2x Stingers [5]"
    const multiplierMatch = line.match(/^(\d+)x\s+(.+)/);
    const multiplier = multiplierMatch ? parseInt(multiplierMatch[1]) : 1;
    const actualLine = multiplierMatch ? multiplierMatch[2] : line;

    // Parse unit line: Unit Name [count] Q#+ D#+ | XXXpts | special rules
    const unitMatch = actualLine.match(/^(.+?)\s*\[(\d+)\]\s*Q(\d+)\+\s*D(\d+)\+\s*\|\s*(\d+)pts(?:\s*\|(.*))?/);
    
    if (!unitMatch) {
      return null;
    }

    const name = unitMatch[1].trim();
    const models = parseInt(unitMatch[2]);
    const quality = parseInt(unitMatch[3]);
    const defense = parseInt(unitMatch[4]);
    const points = parseInt(unitMatch[5]);
    const specialRules = unitMatch[6] ? unitMatch[6].trim() : '';

    // Parse weapons from following lines until we hit next unit or joined unit
    const weapons = [];
    let nextIndex = startIndex + 1;
    let joinedUnit = null;

    while (nextIndex < lines.length) {
      const nextLine = lines[nextIndex].trim();
      
      if (!nextLine) {
        nextIndex++;
        continue;
      }

      // Check if joined unit
      if (nextLine.includes('| Joined to:')) {
        nextIndex++;
        // Parse the joined unit
        if (nextIndex < lines.length) {
          joinedUnit = this.parseUnit(lines, nextIndex);
          if (joinedUnit) {
            nextIndex = joinedUnit.nextLineIndex;
          }
        }
        break;
      }

      // Check if this is a new unit (has Q and D stats)
      if (nextLine.includes('Q') && nextLine.includes('D') && nextLine.includes('+')) {
        break;
      }

      // Parse weapon line (may return a single weapon or an array for multiplied weapons)
      const weapon = this.parseWeapon(nextLine);
      if (weapon) {
        if (Array.isArray(weapon)) weapons.push(...weapon);
        else weapons.push(weapon);
      }
      
      nextIndex++;
    }

    // Create unit objects based on multiplier
    const result = [];
    for (let i = 0; i < multiplier; i++) {
      const unit = {
        name: name,
        models: models,
        quality: quality,
        defense: defense,
        points: points,
        special_rules: specialRules,
        weapons: weapons.length > 0 ? weapons : undefined
      };

      // If there's a joined unit, merge the stats
      if (joinedUnit && joinedUnit.units && joinedUnit.units.length > 0) {
        const joined = joinedUnit.units[0];
        unit.models += joined.models;
        unit.points += joined.points;
        if (joined.weapons) {
          unit.weapons = [...(unit.weapons || []), ...joined.weapons];
        }
      }

      result.push(unit);
    }

    return {
      units: result,
      nextLineIndex: nextIndex
    };
  }

  static parseWeapon(line) {
    // Parse weapon: Energy Spear (A2, AP(4))
    // Or: 9x Shard Carbine (18", A2, Crack)
    const weaponMatch = line.match(/^(\d+)x\s+(.+?)\s*\(([^)]+)\)|^(.+?)\s*\(([^)]+)\)/);

    if (!weaponMatch) {
      return null;
    }

    // Group 1/2/3 = multiplier form; group 4/5 = plain form
    const count = weaponMatch[1] ? parseInt(weaponMatch[1]) : 1;
    const name = (weaponMatch[2] || weaponMatch[4]).trim();
    const stats = weaponMatch[3] || weaponMatch[5];

    // Extract range
    const rangeMatch = stats.match(/(\d+)"/);
    const range = rangeMatch ? parseInt(rangeMatch[1]) : 2; // Default melee range

    // Extract attacks
    const attacksMatch = stats.match(/A(\d+)/);
    const attacks = attacksMatch ? parseInt(attacksMatch[1]) : 1;

    // Extract AP
    const apMatch = stats.match(/AP\((\d+)\)/);
    const ap = apMatch ? parseInt(apMatch[1]) : 0;

    // Extract special rules (everything that isn't range/attacks/AP)
    const specialParts = stats
      .split(',')
      .map(s => s.trim())
      .filter(s => !/^\d+"$/.test(s) && !/^A\d+$/.test(s) && !/^AP\(\d+\)$/.test(s));
    const special_rules = specialParts.join(', ') || undefined;

    // Return one entry per weapon copy so each fires independently in the engine
    const weapon = { name, range, attacks, ap, special_rules };
    if (count > 1) {
      return Array(count).fill(null).map(() => ({ ...weapon }));
    }
    return weapon;
  }
}

export default ArmyTextParser;