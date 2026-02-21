// Comprehensive OPR rulebook data
export const rulebook = {
  'Hold': {
    category: 'Action',
    title: 'Hold',
    text: 'The unit does not move. It may shoot (if the action allows). After resolving all other attacks, the unit can make up to one ranged attack with one of its ranged weapons. A shaken unit holding position can attempt a morale check to recover.'
  },
  'Advance': {
    category: 'Action',
    title: 'Advance',
    text: 'The unit moves up to 6 inches. After moving, it can shoot as per the Hold action (one ranged attack with one weapon). This is the standard tactical movement used to reposition while maintaining offensive capability.'
  },
  'Rush': {
    category: 'Action',
    title: 'Rush',
    text: 'The unit moves up to 12 inches but cannot shoot in this activation. This action prioritizes mobility over firepower and is useful for reaching distant objectives or flanking positions.'
  },
  'Charge': {
    category: 'Action',
    title: 'Charge',
    text: 'The unit moves up to 12 inches and must end its movement in base contact with an enemy unit. It then immediately resolves a melee attack against that enemy. The charging unit does not benefit from cover in this melee combat. After charging, the unit is fatigued and cannot charge again this round.'
  },
  'Shaken': {
    category: 'State',
    title: 'Shaken',
    text: 'A unit becomes shaken when it loses morale. A shaken unit cannot charge or shoot. At the start of its activation, a shaken unit rolls a morale check (Quality d6). If it passes, it recovers to normal status. If it fails, it can only move up to 6 inches this activation. A shaken unit that loses again goes routed and is removed from play.'
  },
  'Fear': {
    category: 'Special Rule',
    title: 'Fear(X)',
    text: 'When this unit wins a melee, it counts as dealing +X additional wounds for the purpose of determining who won the combat. Fear does not increase actual wounds dealt, only affects the melee resolution comparison. Units with Fear are terrifying in close combat.'
  },
  'Furious': {
    category: 'Special Rule',
    title: 'Furious',
    text: 'When this unit attacks, after rolling to hit, it may re-roll any dice that failed to hit exactly once. This improves hit probability without adding extra attacks. Furious units are aggressive and never miss an opening.'
  },
  'Blast': {
    category: 'Weapon Rule',
    title: 'Blast(X)',
    text: 'This weapon automatically hits X times without rolling to hit. No quality test is needed. Blast weapons are area-of-effect and ignore line-of-sight requirements. Blast X hits cannot be saved against using normal saves but are affected by AP modifiers.'
  },
  'Reliable': {
    category: 'Weapon Rule',
    title: 'Reliable',
    text: 'This weapon always attacks at Quality 2+, regardless of the unit\'s base quality. Reliable weapons are extremely consistent and rarely jam or miss.'
  },
  'Bane': {
    category: 'Weapon Rule',
    title: 'Bane',
    text: 'Natural 6s on hit rolls automatically wound the target, bypassing all saves. These wounds cannot be reduced by armor or defensive abilities. Bane weapons are specially crafted to penetrate defenses.'
  },
  'Impact': {
    category: 'Weapon Rule',
    title: 'Impact(X)',
    text: 'When the unit charges with this weapon and is not fatigued, roll X dice. Each die showing 2+ adds one bonus hit to the melee attack. This represents impact from the charge.'
  },
  'Tough': {
    category: 'Special Rule',
    title: 'Tough(X)',
    text: 'Each model in the unit has X wounds. A unit with 3 models and Tough(3) has 9 total wounds. Wounds are tracked on the unit total, not per model. Tough units are harder to kill and represent heavy armor or construction.'
  },
  'Ambush': {
    category: 'Special Rule',
    title: 'Ambush',
    text: 'This unit starts in reserve. At the start of each round, it can deploy anywhere on the battlefield more than 9 inches from all enemies. Ambush represents infiltration tactics.'
  },
  'Regeneration': {
    category: 'Special Rule',
    title: 'Regeneration',
    text: 'At the end of each round, if the unit has fewer than its starting number of wounds, it rolls a d6. On a 5+, it recovers 1 wound. This represents organic healing and is checked once per round.'
  },
  'Damage': {
    category: 'Weapon Rule',
    title: 'Damage(X)',
    text: 'Each unsaved wound from this weapon deals X damage to the target\'s wound pool. A weapon with Damage(4) that deals 1 unsaved wound inflicts 4 total wounds. This represents high-impact strikes.'
  },
  'Stealth': {
    category: 'Special Rule',
    title: 'Stealth',
    text: 'Enemy ranged attacks against this unit suffer +1 quality (harder to hit). Stealth units are harder to target and are effective at range.'
  },
  'Indirect': {
    category: 'Weapon Rule',
    title: 'Indirect',
    text: 'This weapon ignores line-of-sight and can shoot around cover. It suffers +1 quality (harder to hit) after moving. Indirect weapons use ballistic trajectories.'
  },
  'Objective': {
    category: 'Scoring',
    title: 'Objective',
    text: 'Objectives are worth 1 victory point per round they are controlled. A unit controls an objective if it is within 3 inches and has more models than enemy units in that radius. Objectives drive victory conditions.'
  },
  'Morale': {
    category: 'System',
    title: 'Morale Check',
    text: 'When a unit loses at least 1 model or loses melee, it makes a morale check: roll a d6 against Quality. If the roll is equal to or greater than the unit\'s Quality value, it passes. Otherwise, it becomes shaken or routed.'
  },
  'Quality': {
    category: 'System',
    title: 'Quality',
    text: 'A number from 2-6 representing unit training and discipline. Better Quality (lower number) means more reliable rolls. Quality is used for all d6 tests (to hit, saves, morale).'
  },
};

export function getRule(ruleName) {
  return rulebook[ruleName] || null;
}