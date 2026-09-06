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
  const lobby = room.phase === 'lobby';
  const seats = lobby ? room.capacity : room.players.length;
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
          action: 'avatar',
          avatar,
          code: session.code,
        }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(result.error || 'Could not save avatar.');
      }
      setAvatarState('saved');
      window.setTimeout(() => setAvatarState('idle'), 1200);
    } catch {
      setAvatarOverride(previousOverride);
      setAvatarState('error');
      window.setTimeout(() => setAvatarState('idle'), 2200);
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
                  aria-label={`${room.players.length} of ${room.capacity} seats filled`}
                >
                  <Users />
                  {room.players.length}/{room.capacity}
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

            return (
              <button
                key={p.id}
                style={style}
                className={`table-seat ${chosen ? 'chosen' : ''} ${isMe ? 'my-seat' : ''} ${selectable ? 'selectable' : ''}`}
                disabled={!selectable}
                aria-pressed={onSelect ? chosen : undefined}
                aria-label={`${p.name}${isMe ? ', you' : ''}${leader ? ', leader' : ''}${chosen ? ', selected for quest' : ''}${lobby && p.ready ? ', ready' : ''}${!p.online && !p.bot ? ', reconnecting' : ''}${privateClue ? `, ${privateClue}` : ''}`}
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
                <span className="avatar-piece">
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

      {room.phase === 'result' && (
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
