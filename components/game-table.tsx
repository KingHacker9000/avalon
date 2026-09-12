'use client';

import {
  Check,
  Clock3,
  Compass,
  Crown,
  Feather,
  Flame,
  Gem,
  Heart,
  Key,
  Moon,
  Plus,
  Shield,
  Star,
  Sun,
  Sword,
  Users,
} from 'lucide-react';
import { Fragment, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { RoomView } from '@/lib/game/engine';
import { ROLES } from '@/lib/game/roles';
import { QuestCardHand } from '@/components/quest-card-hand';
import {
  AssassinationConfirm,
  PhaseCountdown,
  TableRecovery,
  VoteReveal,
} from '@/components/game-phase-overlays';

const AVATARS = [
  { name: 'Crown', Icon: Crown },
  { name: 'Blade', Icon: Sword },
  { name: 'Flame', Icon: Flame },
  { name: 'Gem', Icon: Gem },
  { name: 'Feather', Icon: Feather },
  { name: 'Star', Icon: Star },
  { name: 'Compass', Icon: Compass },
  { name: 'Shield', Icon: Shield },
  { name: 'Moon', Icon: Moon },
  { name: 'Sun', Icon: Sun },
  { name: 'Heart', Icon: Heart },
  { name: 'Key', Icon: Key },
] as const;

type StoredSession = { code: string; token: string };
type EnhancedRoomView = RoomView & {
  pending?: string[];
  lady?: {
    enabled: boolean;
    holder?: string;
    usedBy: string[];
    checks: { examiner: string; target: string; quest: number }[];
    pending: boolean;
    resultUntil?: number;
  };
  me: RoomView['me'] & {
    ladyResult?: { target: string; loyalty: 'good' | 'evil'; quest: number };
  };
};

function AvatarMedallion({
  avatar,
  className = '',
  compact = false,
}: {
  avatar: number;
  className?: string;
  compact?: boolean;
}) {
  const entry = AVATARS[avatar] ?? AVATARS[0];
  const Icon = entry.Icon;
  return (
    <span
      className={`public-avatar avatar-${avatar} ${className}`}
      aria-hidden="true"
      title={entry.name}
      style={compact ? { width: 30, height: 30 } : undefined}
    >
      <span className="avatar-rim" />
      <Icon style={compact ? { width: 15, height: 15 } : undefined} />
    </span>
  );
}

export function GameTable({
  room,
  selected = [],
  eligible = [],
  onSelect,
  children,
}: {
  room: RoomView;
  selected?: string[];
  eligible?: string[];
  onSelect?: (id: string) => void;
  children?: ReactNode;
}) {
  const view = room as EnhancedRoomView;
  const lady = view.lady ?? {
    enabled: false,
    usedBy: [],
    checks: [],
    pending: false,
  };
  const lobby = room.phase === 'lobby';
  const seats = lobby
    ? Math.min(10, Math.max(5, room.players.length + (room.players.length < 10 ? 1 : 0)))
    : room.players.length;
  const dense = seats >= 9;
  const me = room.players.find((p) => p.id === room.me.id);
  const privateInfoAvailable = room.phase !== 'reveal' || Boolean(me?.ready);
  const [avatarOverride, setAvatarOverride] = useState<number | null>(null);
  const avatarChoice = avatarOverride ?? me?.avatar ?? 0;
  const takenAvatars = new Set(
    room.players.filter((p) => p.id !== me?.id).map((p) => p.avatar),
  );
  const [avatarState, setAvatarState] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  );
  const [ladyOverride, setLadyOverride] = useState<boolean | null>(null);
  const [ladyActionState, setLadyActionState] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const [ladyTarget, setLadyTarget] = useState('');
  const ladyEnabled = ladyOverride ?? lady.enabled;
  const ladyActive = Boolean(lady.pending || lady.resultUntil);
  const waitingIds = view.pending ?? [];
  const latestLadyCheck = lady.checks.at(-1);
  const privateLadyResult =
    latestLadyCheck?.examiner === room.me.id ? view.me.ladyResult : undefined;
  const ladyHolder = room.players.find((player) => player.id === lady.holder);
  const ladyEligible = room.players.filter(
    (player) => player.id !== lady.holder && !lady.usedBy.includes(player.id),
  );

  /* app/page.tsx still contains two legacy labels from the original pawn UI.
     Keep those labels and the active leave affordance accurate until the large
     page shell is decomposed into phase components. */
  useEffect(() => {
    document.querySelectorAll('.phase-team h2, .target-name').forEach((node) => {
      if (node.textContent?.includes('pawn')) {
        node.textContent = node.textContent
          .replace(/pawns/g, 'players')
          .replace(/pawn/g, 'player');
      }
    });

    const leave = document.querySelector<HTMLButtonElement>(
      'nav button[aria-label="Leave table"], nav button[aria-label="Step away"]',
    );
    if (leave) {
      const active = room.phase !== 'lobby' && room.phase !== 'finished';
      leave.setAttribute('aria-label', active ? 'Step away' : 'Leave table');
      leave.setAttribute('title', active ? 'Step away' : 'Leave table');
    }
  }, [room.phase, room.round, room.revision]);

  useEffect(() => {
    const actionPanel = document.querySelector<HTMLElement>('.action-panel');
    const transitionBar = document.querySelector<HTMLElement>('.auto-transition-bar');
    if (ladyActive) {
      actionPanel?.setAttribute('hidden', '');
      transitionBar?.setAttribute('hidden', '');
    } else {
      actionPanel?.removeAttribute('hidden');
      transitionBar?.removeAttribute('hidden');
    }
    return () => {
      actionPanel?.removeAttribute('hidden');
      transitionBar?.removeAttribute('hidden');
    };
  }, [ladyActive]);

  async function postTableAction(
    action: string,
    data: Record<string, unknown> = {},
  ) {
    const raw = sessionStorage.getItem('avalon.session');
    if (!raw) throw new Error('Session unavailable.');
    const session = JSON.parse(raw) as StoredSession;
    const response = await fetch('/api/game', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({
        action,
        ...data,
        code: session.code,
      }),
    });
    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(result.error || 'Could not update the table.');
    }
  }

  async function chooseAvatar(avatar: number) {
    if (
      !lobby ||
      avatar === avatarChoice ||
      takenAvatars.has(avatar) ||
      avatarState === 'saving'
    )
      return;
    const previousOverride = avatarOverride;
    setAvatarOverride(avatar);
    setAvatarState('saving');
    try {
      await postTableAction('avatar', { avatar });
      setAvatarState('saved');
      window.setTimeout(() => setAvatarState('idle'), 1200);
    } catch {
      setAvatarOverride(previousOverride);
      setAvatarState('error');
      window.setTimeout(() => setAvatarState('idle'), 2200);
    }
  }

  async function toggleLady(enabled: boolean) {
    if (
      !lobby ||
      room.practice ||
      room.players.length < 7 ||
      room.host !== room.me.id ||
      ladyActionState === 'saving'
    )
      return;
    const previousOverride = ladyOverride;
    setLadyOverride(enabled);
    setLadyActionState('saving');
    try {
      await postTableAction('configure', {
        optional: room.optional,
        ladyOfLake: enabled,
      });
      setLadyActionState('saved');
      window.setTimeout(() => setLadyActionState('idle'), 1200);
    } catch {
      setLadyOverride(previousOverride);
      setLadyActionState('error');
      window.setTimeout(() => setLadyActionState('idle'), 2200);
    }
  }

  async function inspectWithLady() {
    if (
      !lady.pending ||
      lady.holder !== room.me.id ||
      !ladyTarget ||
      ladyActionState === 'saving'
    )
      return;
    setLadyActionState('saving');
    try {
      await postTableAction('lady', { target: ladyTarget });
      setLadyTarget('');
      setLadyActionState('saved');
      window.setTimeout(() => setLadyActionState('idle'), 1200);
    } catch {
      setLadyActionState('error');
      window.setTimeout(() => setLadyActionState('idle'), 2200);
    }
  }

  const teamNames = room.team
    .map((id) => room.players.find((p) => p.id === id)?.name ?? 'Player')
    .join(' · ');
  const goodQuests = room.quests.filter((quest) => quest.success).length;
  const failedQuests = room.quests.length - goodQuests;
  const resultCountdownLabel =
    goodQuests >= 3
      ? 'Final choice in'
      : failedQuests >= 3
        ? 'Game ends in'
        : 'Next quest in';
  const assassinationTarget =
    room.phase === 'assassinate' && room.me.role === 'Assassin'
      ? selected[0]
      : undefined;

  return (
    <Fragment>
      <section
        className="tabletop"
        aria-label="Round table"
        data-seat-count={seats}
        data-phase={room.phase}
      >
        <div className="tabletop-center">
          {children || (
            <div className="table-lobby-center">
              <div className="table-brand-lockup">
                <Crown aria-hidden="true" />
                <span className="table-brand">AVALON</span>
                <span
                  className="table-seat-count"
                  aria-label={`${room.players.length} players joined, up to 10`}
                >
                  <Users />
                  {room.players.length}
                </span>
              </div>
              {me && (
                <div className="avatar-picker">
                  <span className="avatar-picker-title">Choose your public avatar</span>
                  <div className="avatar-options" role="radiogroup" aria-label="Public avatar">
                    {AVATARS.map(({ name }, avatar) => {
                      const active = avatar === avatarChoice;
                      const taken = !active && takenAvatars.has(avatar);
                      return (
                        <label
                          key={name}
                          title={taken ? `${name} — taken` : name}
                          style={{
                            position: 'relative',
                            display: 'grid',
                            minWidth: 0,
                            minHeight: 34,
                            placeItems: 'center',
                            border: active
                              ? '1px solid #f0cf7a'
                              : '1px solid transparent',
                            borderRadius: '50%',
                            boxShadow: active ? '0 0 0 2px #e2bf6840' : 'none',
                            cursor:
                              avatarState === 'saving'
                                ? 'wait'
                                : taken
                                  ? 'not-allowed'
                                  : 'pointer',
                            opacity:
                              taken || (avatarState === 'saving' && !active) ? 0.38 : 1,
                          }}
                        >
                          <input
                            type="radio"
                            name="public-avatar"
                            value={avatar}
                            checked={active}
                            disabled={avatarState === 'saving' || taken}
                            aria-label={taken ? `${name}, taken` : name}
                            onChange={() => void chooseAvatar(avatar)}
                            style={{
                              position: 'absolute',
                              width: 1,
                              height: 1,
                              opacity: 0,
                              pointerEvents: 'none',
                            }}
                          />
                          <AvatarMedallion avatar={avatar} compact />
                        </label>
                      );
                    })}
                  </div>
                  <small
                    className={avatarState === 'error' ? 'evil' : ''}
                    aria-live="polite"
                  >
                    {avatarState === 'saving'
                      ? 'Saving…'
                      : avatarState === 'saved'
                        ? 'Avatar saved'
                        : avatarState === 'error'
                          ? 'Could not save. Try again.'
                          : 'Each player gets a distinct public crest.'}
                  </small>
                </div>
              )}
              {!room.practice && room.players.length >= 7 && (
                <label
                  title="Private loyalty checks after Quests 2, 3, and 4"
                  style={{
                    display: 'flex',
                    width: 'min(270px, 100%)',
                    alignItems: 'center',
                    gap: 9,
                    padding: '9px 11px',
                    border: '1px solid #d2b87345',
                    borderRadius: 10,
                    background: '#0c211dd6',
                    cursor: room.host === room.me.id ? 'pointer' : 'default',
                  }}
                >
                  <Gem style={{ width: 20, height: 20, color: '#f0cf7a', flex: 'none' }} />
                  <span style={{ display: 'grid', gap: 2, flex: 1, textAlign: 'left' }}>
                    <strong style={{ fontSize: 11, color: '#eee4cd' }}>
                      Lady of the Lake
                    </strong>
                    <small style={{ fontSize: 9, lineHeight: 1.25, color: '#9eb0a5' }}>
                      Loyalty checks after Quests 2–4 · recommended for 7+
                    </small>
                  </span>
                  <input
                    type="checkbox"
                    checked={ladyEnabled}
                    disabled={room.host !== room.me.id || ladyActionState === 'saving'}
                    onChange={(event) => void toggleLady(event.target.checked)}
                  />
                </label>
              )}
            </div>
          )}
        </div>

        <VoteReveal room={room} />
        <QuestCardHand
          key={`${room.code}:${room.round}:${room.history.length}:${room.team.join('.')}:${room.me.id}`}
          room={room}
        />
        {assassinationTarget && (
          <AssassinationConfirm
            key={assassinationTarget}
            room={room}
            targetId={assassinationTarget}
          />
        )}

        <fieldset
          className="table-seats"
          aria-label={onSelect ? 'Tap an avatar to choose a player' : 'Players at the table'}
        >
          {Array.from({ length: seats }, (_, i) => {
            const p = room.players[i];
            const angle = -Math.PI / 2 + (i * Math.PI * 2) / seats;
            const radiusX = dense ? 42 : 39;
            const radiusY = dense ? 40 : 41;
            const style = {
              left: `${50 + Math.cos(angle) * radiusX}%`,
              top: `${50 + Math.sin(angle) * radiusY}%`,
            } as CSSProperties;
            if (!p)
              return (
                <div
                  key={`empty-${i}`}
                  className="table-seat empty-seat"
                  style={style}
                  aria-label={`Open seat ${i + 1}`}
                >
                  <span className="empty-avatar-token" aria-hidden="true">
                    <Plus />
                  </span>
                  <span>Open</span>
                </div>
              );

            const chosen = selected.includes(p.id);
            const leader = p.id === (lobby ? room.host : room.leader);
            const isMe = p.id === room.me.id;
            const avatar = isMe ? avatarChoice : p.avatar;
            const knowledge = privateInfoAvailable
              ? room.me.knowledge.find((k) => k.id === p.id)
              : undefined;
            const privateClue = knowledge
              ? room.me.role === 'Percival'
                ? 'Possible Merlin'
                : 'Known evil'
              : '';
            const shortClue = knowledge?.label === 'Evil' ? 'Evil' : 'Merlin?';
            const myRole = isMe && privateInfoAvailable ? room.me.role : undefined;
            const selectable = Boolean(onSelect && eligible.includes(p.id));
            const waiting = waitingIds.includes(p.id);
            const holdsLady = lady.enabled && lady.holder === p.id;

            return (
              <button
                key={p.id}
                style={style}
                className={`table-seat ${chosen ? 'chosen' : ''} ${isMe ? 'my-seat' : ''} ${selectable ? 'selectable' : ''} ${waiting ? 'waiting-action' : ''}`}
                disabled={!selectable}
                aria-pressed={onSelect ? chosen : undefined}
                aria-label={`${p.name}${isMe ? ', you' : ''}${leader ? ', leader' : ''}${chosen ? ', selected for quest' : ''}${lobby && p.ready ? ', ready' : ''}${waiting ? ', waiting to act' : ''}${holdsLady ? ', holds the Lady of the Lake' : ''}${!p.online && !p.bot ? ', reconnecting' : ''}${privateClue ? `, ${privateClue}` : ''}`}
                title={p.name}
                onClick={() => onSelect?.(p.id)}
              >
                {privateClue && (
                  <span
                    className={`private-knowledge-tag ${knowledge?.label === 'Evil' ? 'evil' : 'clue'}`}
                    title={privateClue}
                  >
                    <span className="clue-long">{privateClue}</span>
                    <span className="clue-short" aria-hidden="true">
                      {shortClue}
                    </span>
                  </span>
                )}
                <span
                  className="avatar-piece"
                  style={{
                    transform: waiting ? 'translateY(-6px) scale(1.035)' : undefined,
                    filter: waiting
                      ? 'drop-shadow(0 0 7px rgba(240, 207, 122, 0.9))'
                      : undefined,
                    transition:
                      'transform 220ms cubic-bezier(.2,.8,.2,1), filter 220ms ease',
                  }}
                >
                  <AvatarMedallion avatar={avatar} />
                  {leader && (
                    <span className="leader-coin" title={lobby ? 'Host' : 'Leader'}>
                      <Crown />
                    </span>
                  )}
                  {(chosen || (lobby && p.ready)) && (
                    <span className="team-coin" title={lobby ? 'Ready' : 'Quest team'}>
                      {lobby ? <Check /> : <Shield />}
                    </span>
                  )}
                  {holdsLady && (
                    <span
                      title="Lady of the Lake"
                      style={{
                        position: 'absolute',
                        zIndex: 5,
                        left: -5,
                        bottom: 0,
                        display: 'grid',
                        width: 20,
                        height: 20,
                        placeItems: 'center',
                        border: '1px solid #d9c276',
                        borderRadius: '50%',
                        background: '#173d3d',
                        color: '#f0cf7a',
                        boxShadow: '0 2px 7px #0008',
                      }}
                    >
                      <Gem style={{ width: 11, height: 11 }} />
                    </span>
                  )}
                  {waiting && (
                    <span
                      aria-hidden="true"
                      title="Waiting for this player"
                      style={{
                        position: 'absolute',
                        zIndex: 7,
                        top: -7,
                        right: -6,
                        display: 'grid',
                        width: 21,
                        height: 21,
                        placeItems: 'center',
                        border: '1px solid #f5d88c',
                        borderRadius: '50%',
                        background: '#2a2417',
                        color: '#ffe6a0',
                        boxShadow: '0 0 10px #efc65c99, 0 2px 6px #0009',
                        fontSize: 13,
                        fontWeight: 900,
                        lineHeight: 1,
                      }}
                    >
                      ?
                    </span>
                  )}
                  {!p.online && !p.bot && <Clock3 className="pawn-offline" />}
                </span>
                <span className="pawn-name">{p.name}</span>
                {isMe && !myRole && <span className="pawn-you">you</span>}
                {myRole && (
                  <span className={`private-seat-note ${ROLES[myRole].side}`}>
                    {ROLES[myRole].name}
                  </span>
                )}
              </button>
            );
          })}
        </fieldset>
      </section>

      {lady.pending && (
        <section
          className="panel"
          aria-label="Lady of the Lake"
          style={{
            width: 'min(720px, 100%)',
            margin: '14px auto 0',
            padding: 18,
            textAlign: 'center',
          }}
        >
          <Gem style={{ width: 28, height: 28, color: '#f0cf7a', margin: '0 auto 8px' }} />
          <h2 style={{ margin: '0 0 6px' }}>Lady of the Lake</h2>
          {lady.holder === room.me.id ? (
            <>
              <p style={{ margin: '0 auto 14px', maxWidth: 520 }}>
                Choose one player to examine. Their Good or Evil loyalty is shown only to you.
              </p>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {ladyEligible.map((player) => (
                  <button
                    key={player.id}
                    type="button"
                    aria-pressed={ladyTarget === player.id}
                    disabled={ladyActionState === 'saving'}
                    onClick={() => setLadyTarget(player.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '6px 10px 6px 7px',
                      border: ladyTarget === player.id
                        ? '1px solid #f0cf7a'
                        : '1px solid #d2b87345',
                      borderRadius: 999,
                      background: ladyTarget === player.id ? '#3a321fcc' : '#0c211dd6',
                      color: '#eee4cd',
                    }}
                  >
                    <AvatarMedallion avatar={player.avatar} compact />
                    <span>{player.name}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={!ladyTarget || ladyActionState === 'saving'}
                onClick={() => void inspectWithLady()}
                style={{
                  marginTop: 14,
                  minHeight: 42,
                  padding: '0 18px',
                  border: '1px solid #f0cf7a',
                  borderRadius: 10,
                  background: '#b58a35',
                  color: '#101913',
                  fontWeight: 800,
                  opacity: !ladyTarget || ladyActionState === 'saving' ? 0.5 : 1,
                }}
              >
                {ladyActionState === 'saving' ? 'Examining…' : 'Examine loyalty'}
              </button>
            </>
          ) : (
            <p style={{ margin: 0 }}>
              Waiting for <strong>{ladyHolder?.name ?? 'the Lady holder'}</strong> to examine a player.
            </p>
          )}
          {ladyActionState === 'error' && (
            <p className="evil" style={{ marginTop: 10 }}>
              Could not use the Lady. Try again.
            </p>
          )}
        </section>
      )}

      {lady.resultUntil && latestLadyCheck && (
        <section
          className="panel"
          aria-label="Lady of the Lake result"
          style={{
            width: 'min(720px, 100%)',
            margin: '14px auto 0',
            padding: 18,
            textAlign: 'center',
          }}
        >
          <Gem style={{ width: 28, height: 28, color: '#f0cf7a', margin: '0 auto 8px' }} />
          {privateLadyResult ? (
            <>
              <h2 style={{ margin: '0 0 6px' }}>Private loyalty</h2>
              <p style={{ margin: '0 0 8px' }}>
                {room.players.find((player) => player.id === privateLadyResult.target)?.name ?? 'That player'} is
              </p>
              <strong
                className={privateLadyResult.loyalty}
                style={{ display: 'block', fontSize: 28, letterSpacing: '0.08em' }}
              >
                {privateLadyResult.loyalty.toUpperCase()}
              </strong>
              <small style={{ display: 'block', marginTop: 7, opacity: 0.72 }}>
                Only you can see this. You may tell the table anything you want.
              </small>
            </>
          ) : (
            <>
              <h2 style={{ margin: '0 0 6px' }}>The Lady has spoken</h2>
              <p style={{ margin: 0 }}>
                {room.players.find((player) => player.id === latestLadyCheck.examiner)?.name ?? 'The Lady holder'} examined{' '}
                <strong>
                  {room.players.find((player) => player.id === latestLadyCheck.target)?.name ?? 'a player'}
                </strong>.
              </p>
              <small style={{ display: 'block', marginTop: 7, opacity: 0.72 }}>
                Their loyalty remains private to the examiner.
              </small>
            </>
          )}
          <div style={{ marginTop: 12 }}>
            <PhaseCountdown endsAt={lady.resultUntil} prefix="Next phase in" />
          </div>
        </section>
      )}

      {room.phase === 'vote' && room.team.length > 0 && (
        <output
          className="team-summary-bar"
          aria-label={`Quest team: ${teamNames}`}
          title={teamNames}
        >
          <Shield aria-hidden="true" />
          <span>
            <strong>Quest team</strong>
            <small>{teamNames}</small>
          </span>
        </output>
      )}

      {room.phase === 'result' && !ladyActive && (
        <div className="auto-transition-bar">
          <PhaseCountdown
            endsAt={room.phaseEndsAt}
            prefix={resultCountdownLabel}
          />
        </div>
      )}

      <TableRecovery room={room} />
    </Fragment>
  );
}
