'use client';

import {
  Check,
  Clock3,
  Compass,
  Crown,
  Feather,
  Flame,
  Gem,
  Plus,
  Shield,
  Star,
  Sword,
  Users,
} from 'lucide-react';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { RoomView } from '@/lib/game/engine';
import { ROLES } from '@/lib/game/roles';

const AVATARS = [
  { name: 'Crown', Icon: Crown },
  { name: 'Blade', Icon: Sword },
  { name: 'Flame', Icon: Flame },
  { name: 'Gem', Icon: Gem },
  { name: 'Feather', Icon: Feather },
  { name: 'Star', Icon: Star },
  { name: 'Compass', Icon: Compass },
  { name: 'Shield', Icon: Shield },
] as const;

type StoredSession = { code: string; token: string };

function AvatarMedallion({
  avatar,
  className = '',
}: {
  avatar: number;
  className?: string;
}) {
  const entry = AVATARS[avatar] ?? AVATARS[0];
  const Icon = entry.Icon;
  return (
    <span
      className={`public-avatar avatar-${avatar} ${className}`}
      aria-hidden="true"
      title={entry.name}
    >
      <span className="avatar-rim" />
      <Icon />
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
  const me = room.players.find((p) => p.id === room.me.id);
  const privateInfoAvailable = room.phase !== 'reveal' || Boolean(me?.ready);
  const [avatarChoice, setAvatarChoice] = useState(me?.avatar ?? 0);
  const [avatarState, setAvatarState] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  );

  useEffect(() => {
    if (me) setAvatarChoice(me.avatar);
  }, [me?.avatar]);

  // The old action copy called the selectable pieces "pawns". The pieces are now
  // public avatars; keep legacy page copy in sync without coupling the table to
  // the parent page's local selection state.
  useEffect(() => {
    document.querySelectorAll('.phase-team h2, .target-name').forEach((node) => {
      if (node.textContent?.includes('pawn')) {
        node.textContent = node.textContent
          .replace(/pawns/g, 'players')
          .replace(/pawn/g, 'player');
      }
    });
  }, [room.phase, room.round, room.revision]);

  async function chooseAvatar(avatar: number) {
    if (!lobby || avatar === avatarChoice || avatarState === 'saving') return;
    const previous = avatarChoice;
    setAvatarChoice(avatar);
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
      setAvatarChoice(previous);
      setAvatarState('error');
      window.setTimeout(() => setAvatarState('idle'), 2200);
    }
  }

  return (
    <section className="tabletop" aria-label="Round table">
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
                    return (
                      <button
                        type="button"
                        key={name}
                        role="radio"
                        aria-checked={active}
                        aria-label={name}
                        title={name}
                        className={active ? 'active' : ''}
                        disabled={avatarState === 'saving'}
                        onClick={() => void chooseAvatar(avatar)}
                      >
                        <AvatarMedallion avatar={avatar} />
                      </button>
                    );
                  })}
                </div>
                <small className={avatarState === 'error' ? 'evil' : ''}>
                  {avatarState === 'saving'
                    ? 'Saving…'
                    : avatarState === 'saved'
                      ? 'Avatar saved'
                      : avatarState === 'error'
                        ? 'Could not save. Try again.'
                        : 'Public only — it never reveals your secret role.'}
                </small>
              </div>
            )}
          </div>
        )}
      </div>
      <fieldset
        className="table-seats"
        aria-label={onSelect ? 'Tap an avatar to choose a player' : 'Players at the table'}
      >
        {Array.from({ length: seats }, (_, i) => {
          const p = room.players[i];
          const angle = -Math.PI / 2 + (i * Math.PI * 2) / seats;
          const style = {
            left: `${50 + Math.cos(angle) * 39}%`,
            top: `${50 + Math.sin(angle) * 41}%`,
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
          const myRole = isMe && privateInfoAvailable ? room.me.role : undefined;

          return (
            <button
              key={p.id}
              style={style}
              className={`table-seat ${chosen ? 'chosen' : ''} ${isMe ? 'my-seat' : ''}`}
              disabled={!onSelect || !eligible.includes(p.id)}
              aria-pressed={onSelect ? chosen : undefined}
              aria-label={`${p.name}${isMe ? ', you' : ''}${leader ? ', leader' : ''}${chosen ? ', selected for quest' : ''}${lobby && p.ready ? ', ready' : ''}${!p.online && !p.bot ? ', reconnecting' : ''}${privateClue ? `, ${privateClue}` : ''}`}
              title={p.name}
              onClick={() => onSelect?.(p.id)}
            >
              {privateClue && (
                <span
                  className={`private-knowledge-tag ${knowledge?.label === 'Evil' ? 'evil' : 'clue'}`}
                >
                  {privateClue}
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
  );
}
