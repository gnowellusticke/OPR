import aggressive  from './aggressive.json';
import cautious    from './cautious.json';
import opportunist from './opportunist.json';
import berserker   from './berserker.json';
import tactician   from './tactician.json';

export const PERSONALITIES = [aggressive, cautious, opportunist, berserker, tactician];

export const PERSONALITIES_MAP = Object.fromEntries(PERSONALITIES.map(p => [p.id, p]));

export function getPersonality(id) {
  return PERSONALITIES_MAP[id] || null;
}

export function getRandomPersonality() {
  return PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
}

export const DEFAULT_PERSONALITY = opportunist;