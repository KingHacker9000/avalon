'use client';

import { Check, Shield, Swords } from 'lucide-react';
import { useState } from 'react';
import type { RoomView } from '@/lib/game/engine';

type StoredSession = { code: string; token: string };
type SubmitState = 'idle' | 'submitting' | 'sealed' | 'error';

function randomFailFirst() {
  try {
    const bytes = new Uint8Array(1);
    crypto.getRandomValues(bytes);
    return (bytes[0] & 1) === 1;
  } catch {
    return Math.random() < 0.5;
  }
}

export function QuestCardHand({ room }: { room: RoomView }) {
  const onQuest = room.phase === 'quest' && room.team.includes(room.me.id);
  const [failFirst] = useState(randomFailFirst);
  const [state, setState] = useState<SubmitState>('idle');
  const [message, setMessage] = useState('');

  if (!onQuest || room.me.quested) return null;

  async function submit(success: boolean) {
    if (state === 'submitting' || state === 'sealed') return;
    setState('submitting');
    setMessage('');
    try {
      const raw = sessionStorage.getItem('avalon.session');
      if (!raw) throw new Error('Your table session is unavailable. Reopen the room.');
      const session = JSON.parse(raw) as StoredSession;
      const response = await fetch('/api/game', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          action: 'quest',
          code: session.code,
          success,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || 'Your card could not be sealed.');
      setState('sealed');
    } catch (error) {
      setState('error');
      setMessage(
        error instanceof Error ? error.message : 'Your card could not be sealed.',
      );
    }
  }

  if (state === 'sealed') {
    return (
      <output className="table-quest-sealed" aria-live="polite">
        <Check />
        Card sealed
      </output>
    );
  }

  const cards = failFirst
    ? ([false, true] as const)
    : ([true, false] as const);

  return (
    <section className="table-quest-hand" aria-label="Choose your quest card">
      <div className="table-quest-hand-copy">
        <strong>Choose one card</strong>
        <span>Both cards are shown to every quest member.</span>
      </div>
      <div className="table-quest-cards">
        {cards.map((success) => (
          <button
            key={success ? 'success' : 'betray'}
            type="button"
            className={`table-quest-card ${success ? 'success' : 'fail'}`}
            disabled={state === 'submitting'}
            aria-label={success ? 'Play Success quest card' : 'Play Betray quest card'}
            onClick={() => void submit(success)}
          >
            <span className="table-quest-card-art" aria-hidden="true" />
            <span className="table-quest-card-label">
              {success ? <Shield /> : <Swords />}
              <strong>{success ? 'SUCCESS' : 'BETRAY'}</strong>
              <small>{success ? 'Support the quest' : 'Fail the quest'}</small>
            </span>
          </button>
        ))}
      </div>
      <p className={state === 'error' ? 'table-quest-error' : 'table-quest-rule'}>
        {state === 'submitting'
          ? 'Sealing your choice…'
          : message || 'Loyal characters must submit Success. Evil may submit either card.'}
      </p>
    </section>
  );
}
