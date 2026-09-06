'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Check, ChessPawn, Clock3, Crown, Shield, Users } from 'lucide-react';
import type { RoomView } from '@/lib/game/engine';

const colors = [
  '#e4c27d',
  '#89c8cd',
  '#cfa0b8',
  '#b4bf85',
  '#b4a4db',
  '#dba57e',
  '#8aaad7',
  '#d9cfb8',
  '#c78286',
  '#85b8a2',
];

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
  return (
    <section className="tabletop" aria-label="Round table">
      <div className="tabletop-center">
        {children || (
          <div className="table-lobby-center">
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
        )}
      </div>
      <fieldset
        className="table-seats"
        aria-label={
          onSelect ? 'Tap a pawn to choose a player' : 'Players at the table'
        }
      >
        {Array.from({ length: seats }, (_, i) => {
          const p = room.players[i];
          const angle = -Math.PI / 2 + (i * Math.PI * 2) / seats;
          const style = {
            left: `${50 + Math.cos(angle) * 39}%`,
            top: `${50 + Math.sin(angle) * 41}%`,
            '--pawn-color': colors[i % colors.length],
          } as CSSProperties;
          if (!p)
            return (
              <div
                key={`empty-${i}`}
                className="table-seat empty-seat"
                style={style}
                aria-label={`Open seat ${i + 1}`}
              >
                <ChessPawn />
                <span>＋</span>
              </div>
            );
          const chosen = selected.includes(p.id);
          const leader = p.id === (lobby ? room.host : room.leader);
          return (
            <button
              key={p.id}
              style={style}
              className={`table-seat ${chosen ? 'chosen' : ''} ${p.id === room.me.id ? 'my-seat' : ''}`}
              disabled={!onSelect || !eligible.includes(p.id)}
              aria-pressed={onSelect ? chosen : undefined}
              aria-label={`${p.name}${p.id === room.me.id ? ', you' : ''}${leader ? ', leader' : ''}${chosen ? ', selected for quest' : ''}${lobby && p.ready ? ', ready' : ''}${!p.online && !p.bot ? ', reconnecting' : ''}`}
              title={p.name}
              onClick={() => onSelect?.(p.id)}
            >
              <span className="pawn-piece">
                <ChessPawn aria-hidden="true" />
                {leader && (
                  <span
                    className="leader-coin"
                    title={lobby ? 'Host' : 'Leader'}
                  >
                    <Crown />
                  </span>
                )}
                {(chosen || (lobby && p.ready)) && (
                  <span className="team-coin">
                    {lobby ? <Check /> : <Shield />}
                  </span>
                )}
                {!p.online && !p.bot && <Clock3 className="pawn-offline" />}
              </span>
              <span className="pawn-name">{p.name}</span>
              {p.id === room.me.id && <span className="pawn-you">you</span>}
            </button>
          );
        })}
      </fieldset>
    </section>
  );
}
