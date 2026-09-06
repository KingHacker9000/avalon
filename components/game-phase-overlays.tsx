'use client';

import { Check, Clock3, RotateCcw, Swords, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { RoomView } from '@/lib/game/engine';

type StoredSession = { code: string; token: string };

type ActionState = 'idle' | 'submitting' | 'error';

function secondsRemaining(endsAt?: number) {
  if (!endsAt) return 0;
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
}

export function PhaseCountdown({
  endsAt,
  prefix,
}: {
  endsAt?: number;
  prefix: string;
}) {
  const [seconds, setSeconds] = useState(() => secondsRemaining(endsAt));

  useEffect(() => {
    setSeconds(secondsRemaining(endsAt));
    if (!endsAt) return;
    const timer = window.setInterval(
      () => setSeconds(secondsRemaining(endsAt)),
      250,
    );
    return () => window.clearInterval(timer);
  }, [endsAt]);

  return (
    <output className="phase-countdown" aria-live="polite">
      <Clock3 aria-hidden="true" />
      <span>{seconds > 0 ? `${prefix} ${seconds}s` : 'Resolving…'}</span>
    </output>
  );
}

export function VoteReveal({ room }: { room: RoomView }) {
  if (room.phase !== 'vote-result') return null;
  const proposal = room.history.at(-1);
  if (!proposal) return null;

  const outcome = proposal.approved ? 'Team approved' : 'Team rejected';
  const nextLabel = proposal.approved
    ? 'Quest begins in'
    : room.rejections >= 5
      ? 'Evil victory in'
      : 'Next leader in';
  const teamNames = proposal.team
    .map((id) => room.players.find((p) => p.id === id)?.name ?? 'Player')
    .join(' · ');

  return (
    <section
      className={`table-vote-reveal ${proposal.approved ? 'approved' : 'rejected'}`}
      aria-label={`${outcome}. All votes are now public.`}
    >
      <div className="vote-reveal-heading">
        <span className="vote-reveal-eyebrow">Votes revealed</span>
        <strong>{outcome}</strong>
        <small title={teamNames}>Quest team · {teamNames}</small>
      </div>
      <div className="vote-reveal-grid" aria-label="Individual votes">
        {room.players.map((player) => {
          const approved = Boolean(proposal.votes[player.id]);
          return (
            <span
              key={player.id}
              className={approved ? 'approve' : 'reject'}
              aria-label={`${player.name}: ${approved ? 'Approve' : 'Reject'}`}
            >
              {approved ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}
              <b>{player.name}</b>
            </span>
          );
        })}
      </div>
      <PhaseCountdown endsAt={room.phaseEndsAt} prefix={nextLabel} />
    </section>
  );
}

async function authenticatedAction(
  action: string,
  data: Record<string, unknown> = {},
) {
  const raw = sessionStorage.getItem('avalon.session');
  if (!raw) throw new Error('Your table session is unavailable. Reopen the room.');
  const session = JSON.parse(raw) as StoredSession;
  const response = await fetch('/api/game', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
    },
    body: JSON.stringify({ action, code: session.code, ...data }),
  });
  const result = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  if (!response.ok)
    throw new Error(result.error || 'The table could not be updated.');
}

export function AssassinationConfirm({
  room,
  targetId,
}: {
  room: RoomView;
  targetId: string;
}) {
  const [state, setState] = useState<ActionState>('idle');
  const [message, setMessage] = useState('');
  const target = room.players.find((p) => p.id === targetId);

  if (
    room.phase !== 'assassinate' ||
    room.me.role !== 'Assassin' ||
    !target
  )
    return null;

  const submit = async () => {
    if (state === 'submitting') return;
    setState('submitting');
    setMessage('');
    try {
      await authenticatedAction('assassinate', { target: targetId });
    } catch (error) {
      setState('error');
      setMessage(
        error instanceof Error ? error.message : 'Could not seal the final choice.',
      );
    }
  };

  return (
    <section className="table-assassination-confirm" aria-live="polite">
      <span>Selected target</span>
      <strong>{target.name}</strong>
      <button
        type="button"
        disabled={state === 'submitting'}
        onClick={() => void submit()}
      >
        <Swords aria-hidden="true" />
        {state === 'submitting' ? 'Sealing…' : `Confirm ${target.name}`}
      </button>
      <small className={state === 'error' ? 'error' : ''}>
        {message || 'Final choice — cannot be undone.'}
      </small>
    </section>
  );
}

export function TableRecovery({ room }: { room: RoomView }) {
  const [confirming, setConfirming] = useState(false);
  const [state, setState] = useState<ActionState>('idle');
  const [message, setMessage] = useState('');
  const offlineNames = useMemo(
    () =>
      room.players
        .filter((p) => !p.bot && !p.online)
        .map((p) => p.name)
        .join(', '),
    [room.players],
  );

  if (!room.recovery.canRestartRound) return null;

  const restart = async () => {
    if (state === 'submitting') return;
    setState('submitting');
    setMessage('');
    try {
      await authenticatedAction('restart-round');
    } catch (error) {
      setState('error');
      setMessage(
        error instanceof Error ? error.message : 'Could not restart the round.',
      );
    }
  };

  return (
    <aside className="table-recovery" aria-live="polite">
      <div>
        <Clock3 aria-hidden="true" />
        <span>
          <strong>Table stalled</strong>
          <small>
            {offlineNames
              ? `${offlineNames} disconnected. Seats stay reserved.`
              : 'A player has been disconnected for a while.'}
          </small>
        </span>
      </div>
      {confirming ? (
        <div className="table-recovery-actions">
          <button
            type="button"
            className="restart"
            disabled={state === 'submitting'}
            onClick={() => void restart()}
          >
            <RotateCcw aria-hidden="true" />
            {state === 'submitting' ? 'Restarting…' : 'Confirm restart'}
          </button>
          <button
            type="button"
            disabled={state === 'submitting'}
            onClick={() => {
              setConfirming(false);
              setMessage('');
              setState('idle');
            }}
          >
            Keep waiting
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)}>
          Restart round
        </button>
      )}
      <small className="table-recovery-note">
        {message || 'Recovery clears this round and returns everyone to the lobby.'}
      </small>
    </aside>
  );
}
