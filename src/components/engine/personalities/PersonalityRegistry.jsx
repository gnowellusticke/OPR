import aggressive  from './aggressive.js';
import cautious    from './cautious.js';
import opportunist from './opportunist.js';
import berserker   from './berserker.js';
import tactician   from './tactician.js';

export const PERSONALITIES = [aggressive, cautious, opportunist, berserker, tactician];

export const PERSONALITIES_MAP = Object.fromEntries(PERSONALITIES.map(p => [p.id, p]));

export function getPersonality(id) {
  return PERSONALITIES_MAP[id] || null;
}

export function getRandomPersonality() {
  return PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
}

export const DEFAULT_PERSONALITY = opportunist;