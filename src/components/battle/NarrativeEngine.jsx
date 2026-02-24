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
  const seenKeys = new Set();

  for (const event of log.events) {
    if (['deploy', 'deployment_summary', 'coin_toss', 'objectives_placed',
         'battle_end', 'round_summary'].includes(event.event_type)) continue;

    const key = `${event.acting_unit}-${event.round}-${activations.length}`;
    // Group by acting_unit+round but start a new group if a different unit acts
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

// ─── System Prompt ────────────────────────────────────────────────────────────

export const NARRATIVE_SYSTEM_PROMPT = `You are a battle reporter narrating a Grimdark Future tabletop wargame in real time.
You will receive a JSON array of activation summaries. Write vivid, punchy commentary for each one.

FORMAT — strictly output activations in this exact format, no other text:
[ACTIVATION:0]
<commentary>
[ACTIVATION:1]
<commentary>
...and so on for every activation in order.

RULES:
- One commentary block per activation, index must match exactly
- 1 sentence for 'minor' significance. 2 sentences for 'standard'. Up to 3 for 'notable' or 'major'.
- Use unit names naturally. "The Vigilant Sisters cut through the hull" not "Unit A dealt 3 wounds to Unit B".
- Reference specific outcomes when dramatic:
    - A morale roll of 1 is a catastrophic failure — call it out
    - wounds_dealt equal to target wounds_remaining means a killing blow — say so
    - A unit fighting on at less than 25% wounds_remaining is worth noting
- Track momentum across the battle. If one side is winning on objectives, reflect the pressure.
- When a unit is destroyed, give it a moment. Don't rush past deaths.
- Vary your sentence structure and energy. Not every activation gets the same cadence.
- Never invent rules, dice, or events not present in the data.
- Objective changes (e.g. an objective flipping faction) are high-drama moments — flag them.`;

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
        // Flush remaining
        if (currentIndex !== null && partialBuffer.trim()) {
          narrativeByActivation[currentIndex] = partialBuffer.trim();
          onActivationReady?.(currentIndex, narrativeByActivation[currentIndex]);
        }
        break;
      }

      const chunk = decoder.decode(value, { stream: true });

      // Anthropic SSE format
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        let parsed;
        try { parsed = JSON.parse(data); } catch { continue; }

        if (parsed.type !== 'content_block_delta') continue;
        const text = parsed.delta?.text || '';
        globalBuffer += text;

        // Detect [ACTIVATION:N] markers
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

    // Callbacks wired in from the React component
    this.onPlayActivation = onPlayActivation;   // (activation) => Promise<void>
    this.onShowCommentary = onShowCommentary;   // (text, significance) => void
    this.onComplete = onComplete;               // () => void
  }

  // Called by stream parser as each activation commentary arrives
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
    this.playNext();
  }

  async playNext() {
    if (this.stopped || this.currentIndex >= this.activations.length) {
      this.onComplete?.();
      return;
    }

    const activation = this.activations[this.currentIndex];
    const index = this.currentIndex;

    // Animate
    await this.onPlayActivation?.(activation);

    // Get commentary — immediate if already streamed, await if not yet ready
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
      setTimeout(() => this.playNext(), delay);
    }
  }
}

export function getActivationDuration(activation) {
  const base = { major: 4000, notable: 3000, standard: 2500, minor: 1500 };
  return base[activation?.significance] ?? 2500;
}