// ─── Activation Log Preprocessor ─────────────────────────────────────────────

function getFaction(unitName, log) {
  const agentAUnits = (log.agent_a?.units || []).map(u => u.name);
  if (agentAUnits.includes(unitName)) return log.agent_a?.faction || 'Agent A';
  return log.agent_b?.faction || 'Agent B';
}

function getSignificance({ destruction, morale, rr, primaryEvent }) {
  if (destruction) return 'major';
  if (morale?.result === 'destroyed' || morale?.result === 'routed') return 'major';
  if (morale?.result === 'shaken') return 'notable';
  if ((rr.wounds_dealt || 0) >= 5) return 'notable';
  if (primaryEvent.event_type === 'move' && !primaryEvent.target_unit) return 'minor';
  return 'standard';
}

function summariseActivation(activation, index, log) {
  const events = activation.events;
  const primaryEvent = events.find(e =>
    ['charge', 'shoot', 'melee', 'move', 'ability'].includes(e.event_type)
  );
  if (!primaryEvent) return null;

  const rr = primaryEvent.roll_results || {};
  const stateAfter = (primaryEvent.unit_state_after || {}).acting_unit || {};
  const targetAfter = (primaryEvent.unit_state_after || {}).target_unit || {};

  const destruction = events.find(e => e.event_type === 'destruction') || null;
  const morale = events.find(e => e.event_type === 'morale') || null;
  const roundSummary = log.events
    .filter(e => e.event_type === 'round_summary' && e.round === activation.round)
    .pop() || null;

  const moraleData = morale ? {
    unit: morale.acting_unit,
    roll: (morale.roll_results || {}).roll,
    needed: (morale.roll_results || {}).quality_needed,
    result: ((morale.unit_state_after || {}).acting_unit || {}).status,
  } : null;

  return {
    index,
    round: activation.round,
    unit: activation.unit,
    faction: getFaction(activation.unit, log),
    action: primaryEvent.event_type,
    target: primaryEvent.target_unit || null,
    key_numbers: {
      attacks: rr.attacks || null,
      hits: rr.hits || null,
      wounds_dealt: rr.wounds_dealt || null,
      wounds_taken: rr.wounds_taken || null,
      distance: rr.distance_moved != null ? rr.distance_moved : null,
    },
    unit_health: {
      wounds_remaining: stateAfter.wounds_remaining || null,
      max_wounds: stateAfter.max_wounds || null,
    },
    target_health: {
      wounds_remaining: targetAfter.wounds_remaining || null,
      max_wounds: targetAfter.max_wounds || null,
    },
    destruction: destruction ? { unit_killed: destruction.target_unit } : null,
    morale: moraleData,
    score: roundSummary?.score || null,
    objectives: roundSummary?.objectives || null,
    significance: getSignificance({ destruction, morale: moraleData, rr, primaryEvent }),
  };
}

export function processLogToActivations(log) {
  const activations = [];

  for (const event of log.events) {
    if (['deploy', 'deployment_summary', 'coin_toss', 'objectives_placed',
         'battle_end', 'round_summary'].includes(event.event_type)) continue;

    const last = activations[activations.length - 1];
    if (!last || last.unit !== event.acting_unit || last.round !== event.round) {
      activations.push({ unit: event.acting_unit, round: event.round, events: [] });
    }
    activations[activations.length - 1].events.push(event);
  }

  return activations
    .map((a, i) => summariseActivation(a, i, log))
    .filter(Boolean);
}

// ─── System Prompt & Style ────────────────────────────────────────────────────

export const NARRATIVE_SYSTEM_PROMPT = `You are a battle reporter narrating a Grimdark Future tabletop wargame in real time.`;

export const STYLE_SUFFIXES = {
  tactical:  'Write in a dry, precise military debriefing style. Focus on tactical decisions and outcomes.',
  dramatic:  'Write in a cinematic, high-stakes style. Treat every charge like a movie moment.',
  humorous:  'Write with dark Warhammer-style humour. Deaths are grimly funny. Glory is fleeting.',
};

// ─── Stream Parser ────────────────────────────────────────────────────────────

export async function parseNarrativeStream(stream, totalActivations, { onActivationReady, onActivationPartial } = {}) {
  const narrativeByActivation = {};
  let currentIndex = null;
  let partialBuffer = '';
  let globalBuffer = '';

  const reader = stream.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (currentIndex !== null && partialBuffer.trim()) {
          narrativeByActivation[currentIndex] = partialBuffer.trim();
          onActivationReady?.(currentIndex, narrativeByActivation[currentIndex]);
        }
        break;
      }

      const chunk = decoder.decode(value, { stream: true });

      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        let parsed;
        try { parsed = JSON.parse(data); } catch { continue; }
        if (parsed.type !== 'content_block_delta') continue;

        const text = parsed.delta?.text || '';
        globalBuffer += text;

        const markerRegex = /\[ACTIVATION:(\d+)\]/g;
        let match;
        let lastIndex = 0;

        while ((match = markerRegex.exec(globalBuffer)) !== null) {
          const beforeMarker = globalBuffer.slice(lastIndex, match.index);
          if (currentIndex !== null) {
            partialBuffer += beforeMarker;
            narrativeByActivation[currentIndex] = partialBuffer.trim();
            onActivationReady?.(currentIndex, narrativeByActivation[currentIndex]);
            partialBuffer = '';
          }
          currentIndex = parseInt(match[1]);
          narrativeByActivation[currentIndex] = '';
          lastIndex = match.index + match[0].length;
        }

        if (currentIndex !== null) {
          const remainder = globalBuffer.slice(lastIndex);
          partialBuffer += remainder;
          onActivationPartial?.(currentIndex, partialBuffer);
        }
        globalBuffer = '';
      }
    }
  } finally {
    reader.releaseLock();
  }

  return narrativeByActivation;
}

// ─── Replay Controller ────────────────────────────────────────────────────────

export class BattleReplayController {
  constructor({ log, activations, onPlayActivation, onShowCommentary, onComplete }) {
    this.log = log;
    this.activations = activations;
    this.narrative = {};
    this.pendingCallbacks = {};
    this.currentIndex = 0;
    this.stopped = false;

    this.onPlayActivation = onPlayActivation;
    this.onShowCommentary = onShowCommentary;
    this.onComplete = onComplete;
  }

  onActivationReady(index, text) {
    this.narrative[index] = text;
    if (this.pendingCallbacks[index]) {
      this.pendingCallbacks[index](text);
      delete this.pendingCallbacks[index];
    }
  }

  stop() { this.stopped = true; }

  async start() {
    this.stopped = false;
    this.currentIndex = 0;
    this._playNext();
  }

  async _playNext() {
    if (this.stopped || this.currentIndex >= this.activations.length) {
      this.onComplete?.();
      return;
    }

    const activation = this.activations[this.currentIndex];
    const index = this.currentIndex;

    await this.onPlayActivation?.(activation);

    let commentary = this.narrative[index];
    if (commentary == null) {
      commentary = await new Promise(resolve => {
        this.pendingCallbacks[index] = resolve;
      });
    }

    this.onShowCommentary?.(commentary, activation.significance);

    this.currentIndex++;
    const delay = getActivationDuration(activation);
    if (!this.stopped) {
      setTimeout(() => this._playNext(), delay);
    }
  }
}

export function getActivationDuration(activation) {
  const base = { major: 4000, notable: 3000, standard: 2500, minor: 1500 };
  return base[activation?.significance] ?? 2500;
}