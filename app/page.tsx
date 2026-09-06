'use client';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SyntheticEvent,
} from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  Crown,
  Eye,
  EyeOff,
  Feather,
  Flame,
  Flag,
  Heart,
  Leaf,
  LogOut,
  Moon,
  Shield,
  Sparkles,
  Swords,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ROLES,
  OPTIONAL,
  QUEST_NAMES,
  EVIL_COUNT,
  type Role,
} from '@/lib/game/roles';
import Link from 'next/link';
import Image from 'next/image';
import type { RoomView } from '@/lib/game/engine';

type Session = { code: string; token: string };
type Modal = 'rules' | 'characters' | 'identity' | 'leave' | null;
const symbols = [Crown, Feather, Flame, Moon, Leaf, Shield, Heart, Flag];
const FEATURED: Role[] = ['Merlin', 'Percival', 'Morgana', 'Assassin'];
function Portrait({
  role,
  className = '',
}: {
  role: Role;
  className?: string;
}) {
  const n = ROLES[role].art;
  return (
    <div className={`portrait ${className}`}>
      <Image
        unoptimized
        width={1774}
        height={887}
        src="/art/characters.png"
        alt={`${ROLES[role].name}, original character portrait`}
        style={{ left: `${-(n % 4) * 100}%`, top: n < 4 ? '0' : '-100%' }}
      />
    </div>
  );
}
function Avatar({ n }: { n: number }) {
  const Icon = symbols[n % symbols.length];
  return (
    <span className={`avatar avatar-${n % 4}`}>
      <Icon />
    </span>
  );
}
async function request(
  action: string,
  data: Record<string, unknown> = {},
  session: Session | null = null,
) {
  const response = await fetch('/api/game', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: JSON.stringify({ ...data, code: session?.code ?? data.code, action }),
  });
  const result = (await response.json()) as {
    room?: RoomView;
    token?: string;
    left?: boolean;
    error?: string;
  };
  if (!response.ok)
    throw new Error(result.error || 'The table could not be reached.');
  return result as { room?: RoomView; token?: string; left?: boolean };
}
export default function Home() {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [tab, setTab] = useState<'host' | 'join'>('host');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [connection, setConnection] = useState('');
  const [modal, setModal] = useState<Modal>(null);
  const [character, setCharacter] = useState<Role>('Merlin');
  const [revealed, setRevealed] = useState(false);
  const selectionKey = [
    room?.code,
    room?.phase,
    room?.leader,
    room?.round,
  ].join(':');
  const [selection, setSelection] = useState({
    key: '',
    ids: [] as string[],
    target: '',
  });
  const selected = selection.key === selectionKey ? selection.ids : [];
  const target = selection.key === selectionKey ? selection.target : '';
  const setSelected = (update: (ids: string[]) => string[]) =>
    setSelection((old) => ({
      key: selectionKey,
      ids: update(old.key === selectionKey ? old.ids : []),
      target: '',
    }));
  const setTarget = (value: string) =>
    setSelection((old) => ({ ...old, key: selectionKey, target: value }));
  const [copied, setCopied] = useState(false);
  const [historyTab, setHistoryTab] = useState<'events' | 'votes'>('events');
  const generation = useRef(0);
  const saveSession = useCallback((next: Session | null) => {
    sessionRef.current = next;
    setSession(next);
    try {
      if (next) sessionStorage.setItem('avalon.session', JSON.stringify(next));
      else sessionStorage.removeItem('avalon.session');
    } catch {}
  }, []);
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      try {
        const savedName = localStorage.getItem('avalon.name');
        if (savedName) setName(savedName);
        const invite = new URLSearchParams(location.search).get('room');
        if (invite) {
          setCode(invite.toUpperCase().slice(0, 6));
          setTab('join');
        }
        const raw = sessionStorage.getItem('avalon.session');
        if (raw) {
          const saved = JSON.parse(raw) as Session;
          if (!invite || invite.toUpperCase() === saved.code) {
            saveSession(saved);
            request('poll', {}, saved)
              .then((r) => {
                if (r.room) setRoom(r.room);
              })
              .catch((e) => setError(e.message));
          }
        }
      } catch {}
    });
    return () => {
      cancelled = true;
    };
  }, [saveSession]);
  const atTable = room !== null;
  useEffect(() => {
    if (!session || !atTable) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (!busyRef.current) {
        const current = generation.current;
        try {
          const r = await request('poll', {}, session);
          if (!stopped && current === generation.current) {
            if (r.room) setRoom(r.room);
            setConnection('');
          }
        } catch {
          if (!stopped)
            setConnection(
              'Connection interrupted. Reconnecting… Your seat is saved.',
            );
        }
      }
      if (!stopped) timer = setTimeout(poll, 1200);
    };
    timer = setTimeout(poll, 1200);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [session, atTable]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) {
        setRevealed(false);
        setModal((m) => (m === 'identity' ? null : m));
      }
    };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  const send = useCallback(
    async (action: string, data: Record<string, unknown> = {}) => {
      if (busyRef.current) return;
      busyRef.current = true;
      generation.current++;
      setBusy(true);
      setError('');
      try {
        const r = await request(action, data, sessionRef.current);
        if (r.room) setRoom(r.room);
        if (r.left) {
          setRoom(null);
          saveSession(null);
          history.replaceState(null, '', '/');
        }
        return r;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Please try again.');
      } finally {
        setBusy(false);
        busyRef.current = false;
      }
    },
    [saveSession],
  );
  const enter = useCallback(
    async (practice = false) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setError('');
      generation.current++;
      try {
        const playerName = name.trim() || (practice ? 'You' : '');
        const r = await request(
          practice ? 'practice' : tab === 'host' ? 'create' : 'join',
          { name: playerName, code: code.toUpperCase() },
        );
        if (r.room && r.token) {
          saveSession({ code: r.room.code, token: r.token });
          setRoom(r.room);
          try {
            localStorage.setItem('avalon.name', playerName);
          } catch {}
          history.replaceState(null, '', `?room=${r.room.code}`);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Please try again.');
      } finally {
        setBusy(false);
        busyRef.current = false;
      }
    },
    [name, tab, code, saveSession],
  );
  // Optional agent-friendly entrypoint. Private identities are never exposed here.
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: { registerTool: (t: unknown, o: unknown) => void };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: 'open_avalon_rules',
            description: 'Open the Avalon rules guide.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false },
            execute: (input: unknown) => {
              if (
                !input ||
                typeof input !== 'object' ||
                Object.keys(input).length
              )
                throw new Error('Expected an empty object.');
              setModal('rules');
              return { opened: 'Avalon rules' };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, []);
  const closeModal = () => {
    setModal(null);
    setRevealed(false);
  };
  const showIdentity = () => {
    setRevealed(false);
    setModal('identity');
  };
  const copy = async () => {
    if (!room) return;
    const url = `${location.origin}/?room=${room.code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError(`Copy this invitation: ${url}`);
    }
  };
  const me = room?.players.find((p) => p.id === room.me.id);
  const host = room?.host === me?.id;
  const leader = room?.players.find((p) => p.id === room.leader);
  const myTurn = room?.leader === me?.id;
  const required = room?.teamSizes[room.round] ?? 2;
  const playerName = (id: string) =>
    room?.players.find((p) => p.id === id)?.name ?? 'Player';
  function togglePlayer(id: string) {
    setSelected((s) =>
      s.includes(id)
        ? s.filter((x) => x !== id)
        : s.length < required
          ? [...s, id]
          : s,
    );
  }
  function submitEntry(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    void enter();
  }
  return (
    <main className={`shell ${room ? 'in-game' : ''}`}>
      <header>
        <Link
          className="brand"
          href="/"
          onClick={(e) => {
            if (room) {
              e.preventDefault();
              setModal('leave');
            }
          }}
        >
          <Crown />
          <span>
            AVALON<small>THE ROUND TABLE</small>
          </span>
        </Link>
        <nav>
          <button onClick={() => setModal('rules')}>How to play</button>
          <button onClick={() => setModal('characters')}>The characters</button>
          {room ? (
            <button className="nav-leave" onClick={() => setModal('leave')}>
              <LogOut />
              <span>Leave table</span>
            </button>
          ) : (
            <span className="online">
              <i /> A seat awaits
            </span>
          )}
        </nav>
      </header>
      {error && (
        <div className="notice error" role="alert">
          <span>{error}</span>
          <button aria-label="Dismiss error" onClick={() => setError('')}>
            <X />
          </button>
        </div>
      )}
      {connection && <output className="notice">{connection}</output>}
      {!room ? (
        <>
          <section className="home-stage">
            <div className="intro">
              <div className="eyebrow">
                <span /> A GAME OF HIDDEN LOYALTIES
              </div>
              <h1>
                The fate of Camelot.
                <br />
                <em>In your hands.</em>
              </h1>
              <p>
                Gather your friends. Keep your secrets.
                <br />
                Not everyone at the table serves the same king.
              </p>
              <div className="facts">
                <span>
                  <Users />
                  5–10 players
                </span>
                <span>
                  <Clock3 />
                  30 minutes
                </span>
                <span>
                  <Shield />
                  No account needed
                </span>
              </div>
              <form className="entry-panel" onSubmit={submitEntry}>
                <div
                  className="entry-tabs"
                  role="tablist"
                  aria-label="Host or join"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === 'host'}
                    className={tab === 'host' ? 'active' : ''}
                    onClick={() => {
                      setTab('host');
                      setError('');
                    }}
                  >
                    Host a game
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === 'join'}
                    className={tab === 'join' ? 'active' : ''}
                    onClick={() => {
                      setTab('join');
                      setError('');
                    }}
                  >
                    Join a game
                  </button>
                </div>
                <label htmlFor="name">YOUR NAME AT THE TABLE</label>
                <input
                  autoComplete="off"
                  id="name"
                  placeholder="What shall we call you?"
                  required
                  maxLength={20}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {tab === 'join' && (
                  <div className="code-field">
                    <label htmlFor="code">ROOM CODE</label>
                    <input
                      id="code"
                      autoComplete="off"
                      autoCapitalize="characters"
                      placeholder="e.g. CAME7T"
                      required
                      minLength={6}
                      maxLength={6}
                      value={code}
                      onChange={(e) =>
                        setCode(
                          e.target.value
                            .toUpperCase()
                            .replace(/[^A-Z2-9]/g, ''),
                        )
                      }
                    />
                  </div>
                )}
                <Button type="submit" className="gold-button" disabled={busy}>
                  {busy
                    ? 'Preparing your seat…'
                    : tab === 'host'
                      ? 'Create a room'
                      : 'Join the table'}
                  <ArrowRight />
                </Button>
                <div className="entry-note">
                  {tab === 'host'
                    ? 'A private table. An invitation for your friends.'
                    : 'Enter the six-character code from your host.'}
                </div>
              </form>
              <button
                className="practice-link"
                disabled={busy}
                onClick={() => void enter(true)}
              >
                Just exploring?{' '}
                <span>
                  Try a practice game <ArrowRight />
                </span>
              </button>
              {session && (
                <button
                  className="resume-link"
                  disabled={busy}
                  onClick={() => void send('poll')}
                >
                  Return to table {session.code} <ArrowRight />
                </button>
              )}
            </div>
            <div className="scene-caption">
              <span>THE KINGDOM IS DIVIDED</span>
              <p>Trust is your greatest weapon.</p>
            </div>
          </section>
          <section className="character-section">
            <div className="section-title">
              <div>
                <div className="eyebrow">
                  LOYAL TO ARTHUR. OR SOMETHING DARKER.
                </div>
                <h2>Every face hides a secret.</h2>
              </div>
              <button onClick={() => setModal('characters')}>
                Meet the characters <ArrowRight />
              </button>
            </div>
            <div className="character-grid">
              {FEATURED.map((role) => (
                <button
                  className="character-card"
                  key={role}
                  onClick={() => {
                    setCharacter(role);
                    setModal('characters');
                  }}
                >
                  <Portrait role={role} />
                  <div className="card-info">
                    <span className={ROLES[role].side}>
                      {ROLES[role].side === 'good'
                        ? 'FOR CAMELOT'
                        : 'AGAINST THE CROWN'}
                    </span>
                    <h3>{ROLES[role].name}</h3>
                    <p>{ROLES[role].line}</p>
                  </div>
                  <span className="card-arrow">
                    <ArrowRight />
                  </span>
                </button>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="game-shell">
          <div className="table-bar">
            <div>
              <div className="eyebrow">
                {room.practice
                  ? 'SOLO PRACTICE • 4 COMPUTER PLAYERS'
                  : 'YOUR PRIVATE ROUND TABLE'}
              </div>
              <h1>
                {room.phase === 'lobby'
                  ? 'The gathering'
                  : room.phase === 'finished'
                    ? 'The story is told'
                    : 'The quest for Camelot'}
              </h1>
            </div>
            <button
              className="room-code"
              onClick={copy}
              aria-label={`Copy invitation for room ${room.code}`}
            >
              <span>ROOM CODE</span>
              <strong>{room.code}</strong>
              {copied ? <Check /> : <Copy />}
            </button>
          </div>
          {room.phase === 'lobby' ? (
            <div className="lobby-layout">
              <section className="panel lobby-main">
                <div className="panel-heading">
                  <div>
                    <h2>A place at the table.</h2>
                    <p>
                      {room.practice
                        ? 'Learn by playing a full game with computer players.'
                        : 'Invite your friends, then ready up. Your roles are still a mystery.'}
                    </p>
                  </div>
                  <span className="count-badge">
                    <Users />
                    {room.players.length}/{room.capacity}
                  </span>
                </div>
                <div className="seats">
                  {Array.from({ length: room.capacity }, (_, i) => {
                    const p = room.players[i];
                    return (
                      <div
                        className={`seat ${p ? 'occupied' : ''}`}
                        key={p?.id ?? i}
                      >
                        {p ? (
                          <>
                            <Avatar n={p.avatar} />
                            <div>
                              <strong>
                                {p.name}
                                {p.id === me?.id && <small> YOU</small>}
                              </strong>
                              <span>
                                {p.id === room.host
                                  ? 'Table host'
                                  : p.bot
                                    ? 'Computer player'
                                    : p.online
                                      ? 'At the table'
                                      : 'Reconnecting…'}
                              </span>
                            </div>
                            <span
                              className={`ready-status ${p.ready ? 'good' : ''}`}
                            >
                              {p.ready ? (
                                <>
                                  <Check />
                                  Ready
                                </>
                              ) : (
                                'Not ready'
                              )}
                            </span>
                            {host && p.id !== me?.id && !p.bot && (
                              <button
                                className="remove-player"
                                aria-label={`Remove ${p.name}`}
                                onClick={() =>
                                  void send('remove', { target: p.id })
                                }
                              >
                                <X />
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="empty-avatar">{i + 1}</span>
                            <div>
                              <strong>An open seat</strong>
                              <span>Waiting for a friend</span>
                            </div>
                            <span className="seat-dot" />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="lobby-bottom">
                  <Button
                    className={`outline-button ${me?.ready ? 'ready-button' : ''}`}
                    disabled={busy}
                    onClick={() => void send('ready', { ready: !me?.ready })}
                  >
                    {me?.ready ? <Check /> : <Shield />}
                    {me?.ready ? 'You’re ready' : 'I’m ready'}
                  </Button>
                  {host ? (
                    <Button
                      className="gold-button"
                      disabled={
                        busy ||
                        room.players.length < 5 ||
                        !room.players.every((p) => p.ready)
                      }
                      onClick={() => void send('start')}
                    >
                      Deal the roles <ArrowRight />
                    </Button>
                  ) : (
                    <p>Once everyone is ready, the host can begin.</p>
                  )}
                </div>
                <p className="muted-footnote">
                  {room.players.length < 5
                    ? `${5 - room.players.length} more ${5 - room.players.length === 1 ? 'player' : 'players'} needed to begin.`
                    : room.players.every((p) => p.ready)
                      ? 'Everyone is ready. Let the secrets begin.'
                      : 'Waiting for everyone to ready up.'}
                </p>
              </section>
              <aside className="lobby-sidebar">
                <section className="panel settings">
                  <div className="eyebrow">THE WAY YOU PLAY</div>
                  <h2>Table settings</h2>
                  <label htmlFor="capacity">SEATS AT THE TABLE</label>
                  <select
                    id="capacity"
                    disabled={!host || busy || room.practice}
                    value={room.capacity}
                    onChange={(e) =>
                      void send('configure', {
                        capacity: Number(e.target.value),
                        optional: room.optional,
                      })
                    }
                  >
                    {[5, 6, 7, 8, 9, 10].map((n) => (
                      <option
                        key={n}
                        value={n}
                        disabled={n < room.players.length}
                      >
                        {n} players · {n - EVIL_COUNT[n]} good / {EVIL_COUNT[n]}{' '}
                        evil
                      </option>
                    ))}
                  </select>
                  <div className="settings-divider" />
                  <p className="field-label">SPECIAL CHARACTERS</p>
                  <p className="settings-hint">
                    Merlin and the Assassin always play.
                  </p>
                  {OPTIONAL.map((role) => (
                    <label
                      key={role}
                      className="role-toggle"
                      aria-label={ROLES[role].name}
                    >
                      <span>
                        <strong>{ROLES[role].name}</strong>
                        <small className={ROLES[role].side}>
                          {ROLES[role].title}
                        </small>
                      </span>
                      <input
                        type="checkbox"
                        checked={room.optional.includes(role)}
                        disabled={!host || busy}
                        onChange={(e) =>
                          void send('configure', {
                            capacity: room.capacity,
                            optional: e.target.checked
                              ? [...room.optional, role]
                              : room.optional.filter((r) => r !== role),
                          })
                        }
                      />
                    </label>
                  ))}
                  <button
                    className="text-link"
                    onClick={() => setModal('characters')}
                  >
                    Learn about each character <ArrowRight />
                  </button>
                </section>
                <div className="tip">
                  <Sparkles />
                  <p>
                    {room.practice
                      ? 'Computer players make simple decisions. Practice teaches the flow; the real intrigue comes from friends.'
                      : 'Play together in person or on a voice call. Each player uses their own screen to keep their identity secret.'}
                  </p>
                </div>
              </aside>
            </div>
          ) : (
            <div className="play-layout">
              <div className="play-main">
                <section className="quest-board panel">
                  <div className="board-heading">
                    <span className="eyebrow">THE FIVE QUESTS</span>
                    <div className="score">
                      <span className="good">
                        {room.quests.filter((q) => q.success).length} GOOD
                      </span>
                      <span> / </span>
                      <span className="evil">
                        {room.quests.filter((q) => !q.success).length} EVIL
                      </span>
                    </div>
                  </div>
                  <div className="quest-track">
                    {room.teamSizes.map((size, i) => {
                      const q = room.quests[i];
                      return (
                        <div
                          className={`quest-stop ${q ? (q.success ? 'success' : 'failed') : i === room.round ? 'current' : ''}`}
                          key={i}
                        >
                          <div className="quest-medallion">
                            {q ? (
                              q.success ? (
                                <Shield />
                              ) : (
                                <Swords />
                              )
                            ) : (
                              <span>{['I', 'II', 'III', 'IV', 'V'][i]}</span>
                            )}
                          </div>
                          <strong>Quest {i + 1}</strong>
                          <span>
                            <Users />
                            {size} players
                          </span>
                          {i === 3 && room.players.length >= 7 && (
                            <small>2 fails needed</small>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="rejection-track">
                    <span>REJECTED TEAMS</span>
                    <div>
                      {[0, 1, 2, 3, 4].map((i) => (
                        <i
                          key={i}
                          className={i < room.rejections ? 'filled' : ''}
                        />
                      ))}
                    </div>
                    <p>
                      {room.rejections === 4
                        ? 'One more rejection gives evil the win.'
                        : 'Five rejections in a row. One fallen kingdom.'}
                    </p>
                  </div>
                </section>
                <section
                  className={`panel action-panel phase-${room.phase}`}
                  aria-live="polite"
                >
                  {room.phase === 'reveal' && (
                    <>
                      <div className="phase-icon">
                        <Eye />
                      </div>
                      <div className="eyebrow">BEFORE THE FIRST QUEST</div>
                      <h2>Every secret has a keeper.</h2>
                      <p>
                        Your character has been dealt. Discover your loyalty and
                        learn what only you know.
                      </p>
                      <Button className="gold-button" onClick={showIdentity}>
                        Reveal my character <Eye />
                      </Button>
                      <span className="action-hint">
                        {room.submitted}/{room.players.length} players have
                        confirmed their roles.
                      </span>
                    </>
                  )}
                  {room.phase === 'team' && (
                    <>
                      <div className="eyebrow">
                        QUEST {room.round + 1} ·{' '}
                        {QUEST_NAMES[room.round].toUpperCase()}
                      </div>
                      <h2>
                        {myTurn
                          ? 'Whom do you trust?'
                          : `${leader?.name} is choosing a team.`}
                      </h2>
                      <p>
                        {myTurn
                          ? `Choose ${required} players below to embark on this quest. You may choose yourself.`
                          : 'Discuss the choices together. Everyone will vote on the proposed team.'}
                      </p>
                      <div className="leader-label">
                        <Crown /> {myTurn ? 'You are' : `${leader?.name} is`}{' '}
                        the quest leader
                      </div>
                      {myTurn && (
                        <Button
                          className="gold-button"
                          disabled={busy || selected.length !== required}
                          onClick={() =>
                            void send('propose', { team: selected })
                          }
                        >
                          Propose team · {selected.length}/{required}
                          <ArrowRight />
                        </Button>
                      )}
                    </>
                  )}
                  {room.phase === 'vote' && (
                    <>
                      <div className="eyebrow">THE TABLE DECIDES</div>
                      <h2>Does this team have your trust?</h2>
                      <p>
                        {room.team.map(playerName).join(', ')} will undertake
                        the quest. A strict majority must approve; a tie rejects
                        the team.
                      </p>
                      {room.me.voted ? (
                        <div className="sealed">
                          <Check /> Your vote is sealed. Waiting for the table.
                        </div>
                      ) : (
                        <div className="vote-actions">
                          <Button
                            className="success-button"
                            disabled={busy}
                            onClick={() => void send('vote', { approve: true })}
                          >
                            <Shield />
                            Approve
                          </Button>
                          <Button
                            className="danger-button"
                            disabled={busy}
                            onClick={() =>
                              void send('vote', { approve: false })
                            }
                          >
                            <X />
                            Reject
                          </Button>
                        </div>
                      )}
                      <span className="action-hint">
                        {room.submitted}/{room.players.length} votes sealed.
                        Votes reveal together.
                      </span>
                    </>
                  )}
                  {room.phase === 'quest' && (
                    <>
                      <div className="eyebrow">
                        QUEST {room.round + 1} · A TEST OF LOYALTY
                      </div>
                      <h2>The kingdom is counting on you.</h2>
                      <p>
                        {room.round === 3 && room.players.length >= 7
                          ? 'This quest requires two Fail cards to fail.'
                          : 'A single Fail card will doom this quest.'}{' '}
                        Quest cards remain anonymous.
                      </p>
                      {room.team.includes(me!.id) ? (
                        room.me.quested ? (
                          <div className="sealed">
                            <Check /> Your card is sealed.
                          </div>
                        ) : (
                          <div className="vote-actions">
                            <Button
                              className="success-button"
                              disabled={busy}
                              onClick={() =>
                                void send('quest', { success: true })
                              }
                            >
                              <Shield />
                              Success
                            </Button>
                            {room.me.role &&
                              ROLES[room.me.role].side === 'evil' && (
                                <Button
                                  className="danger-button"
                                  disabled={busy}
                                  onClick={() =>
                                    void send('quest', { success: false })
                                  }
                                >
                                  <Swords />
                                  Fail
                                </Button>
                              )}
                          </div>
                        )
                      ) : (
                        <div className="sealed">
                          <Clock3 /> The quest party is making its choice.
                        </div>
                      )}
                      <span className="action-hint">
                        {room.submitted}/{room.team.length} quest cards sealed.
                      </span>
                    </>
                  )}
                  {room.phase === 'result' && (
                    <>
                      <div
                        className={`phase-icon ${room.quests.at(-1)?.success ? 'good' : 'evil'}`}
                      >
                        {room.quests.at(-1)?.success ? <Shield /> : <Swords />}
                      </div>
                      <div className="eyebrow">
                        QUEST {room.round + 1} · THE CARDS ARE REVEALED
                      </div>
                      <h2>
                        {room.quests.at(-1)?.success
                          ? 'A light in the darkness.'
                          : 'Betrayal on the road.'}
                      </h2>
                      <p>
                        The quest{' '}
                        {room.quests.at(-1)?.success ? 'succeeded' : 'failed'}.{' '}
                        {room.quests.at(-1)?.fails} Fail{' '}
                        {room.quests.at(-1)?.fails === 1
                          ? 'card was'
                          : 'cards were'}{' '}
                        played.
                      </p>
                      <div className="result-cards">
                        {Array.from(
                          { length: room.quests.at(-1)!.team.length },
                          (_, i) => {
                            const fail = i < room.quests.at(-1)!.fails;
                            return (
                              <div
                                key={i}
                                className={fail ? 'fail-card' : 'success-card'}
                              >
                                {fail ? <Swords /> : <Shield />}
                                <span>{fail ? 'Fail' : 'Success'}</span>
                              </div>
                            );
                          },
                        )}
                      </div>
                      <Button
                        className="gold-button"
                        disabled={busy || me?.ready}
                        onClick={() => void send('ready')}
                      >
                        {me?.ready ? 'Waiting for the table…' : 'Continue'}
                        <ArrowRight />
                      </Button>
                      <span className="action-hint">
                        {room.submitted}/{room.players.length} players are ready
                        to continue.
                      </span>
                    </>
                  )}
                  {room.phase === 'assassinate' && (
                    <>
                      <div className="phase-icon evil">
                        <Swords />
                      </div>
                      <div className="eyebrow">EVIL’S LAST CHANCE</div>
                      <h2>One name. One final blade.</h2>
                      <p>
                        Three quests have succeeded. The Assassin can still win
                        for evil by identifying Merlin.
                      </p>
                      {room.me.role === 'Assassin' ? (
                        <>
                          <label htmlFor="target">WHO IS MERLIN?</label>
                          <select
                            id="target"
                            value={target}
                            onChange={(e) => setTarget(e.target.value)}
                          >
                            <option value="">Choose your target…</option>
                            {room.players
                              .filter(
                                (p) =>
                                  p.id !== me?.id &&
                                  !room.me.knowledge.some((k) => k.id === p.id),
                              )
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                          </select>
                          <Button
                            className="danger-button assassinate"
                            disabled={busy || !target}
                            onClick={() => void send('assassinate', { target })}
                          >
                            <Swords />
                            Assassinate {target ? playerName(target) : 'Merlin'}
                          </Button>
                        </>
                      ) : (
                        <div className="sealed">
                          <Clock3 /> The Assassin is making the final choice.
                        </div>
                      )}
                    </>
                  )}
                  {room.phase === 'finished' && (
                    <>
                      <div className={`phase-icon ${room.winner}`}>
                        <Crown />
                      </div>
                      <div className="eyebrow">
                        {room.winner === 'good'
                          ? 'THE LIGHT ENDURES'
                          : 'DARKNESS TAKES THE THRONE'}
                      </div>
                      <h2>
                        {room.winner === 'good'
                          ? 'Camelot is saved.'
                          : 'The kingdom has fallen.'}
                      </h2>
                      <p>{room.reason}</p>
                      <div className="ending-roles">
                        {room.players.map((p) => (
                          <div key={p.id}>
                            <Portrait role={p.role!} />
                            <strong>{p.name}</strong>
                            <span className={ROLES[p.role!].side}>
                              {ROLES[p.role!].name}
                            </span>
                          </div>
                        ))}
                      </div>
                      {host ? (
                        <Button
                          className="gold-button"
                          disabled={busy}
                          onClick={() => void send('rematch')}
                        >
                          Gather for another game <ArrowRight />
                        </Button>
                      ) : (
                        <span className="action-hint">
                          The host can start a new game.
                        </span>
                      )}
                    </>
                  )}
                </section>
                <section className="players-panel">
                  <div className="players-heading">
                    <h3>The round table</h3>
                    <span>
                      {room.players.length} players ·{' '}
                      {room.phase === 'team' && myTurn
                        ? 'Choose your quest party'
                        : 'Keep your friends close'}
                    </span>
                  </div>
                  <div className="player-chips">
                    {room.players.map((p) => (
                      <button
                        key={p.id}
                        className={`player-chip ${selected.includes(p.id) ? 'selected' : ''} ${room.team.includes(p.id) && room.phase !== 'team' ? 'on-quest' : ''}`}
                        disabled={
                          room.phase !== 'team' ||
                          !myTurn ||
                          busy ||
                          (!selected.includes(p.id) &&
                            selected.length >= required)
                        }
                        aria-pressed={selected.includes(p.id)}
                        onClick={() => togglePlayer(p.id)}
                      >
                        <Avatar n={p.avatar} />
                        <span>
                          <strong>
                            {p.name}
                            {p.id === me?.id && <small> YOU</small>}
                          </strong>
                          <small>
                            {p.id === room.leader
                              ? 'Quest leader'
                              : !p.online
                                ? 'Reconnecting'
                                : p.bot
                                  ? 'Computer'
                                  : 'At the table'}
                          </small>
                        </span>
                        {p.id === room.leader && (
                          <Crown className="leader-crown" />
                        )}
                        {selected.includes(p.id) && (
                          <Check className="selection-check" />
                        )}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
              <aside className="game-sidebar">
                <section className="identity-panel panel">
                  <div className="eyebrow">FOR YOUR EYES ONLY</div>
                  <div className="card-back">
                    <Crown />
                    <span>A V A L O N</span>
                    <i />
                    <Shield />
                  </div>
                  <h3>Your secret identity</h3>
                  <p>Some knowledge is best kept close.</p>
                  <Button className="outline-button" onClick={showIdentity}>
                    <Eye />
                    View my character
                  </Button>
                </section>
                <section className="panel chronicle">
                  <div className="entry-tabs">
                    <button
                      className={historyTab === 'events' ? 'active' : ''}
                      onClick={() => setHistoryTab('events')}
                    >
                      Chronicle
                    </button>
                    <button
                      className={historyTab === 'votes' ? 'active' : ''}
                      onClick={() => setHistoryTab('votes')}
                    >
                      Vote history
                    </button>
                  </div>
                  {historyTab === 'events' ? (
                    <ol>
                      {[...room.log].reverse().map((event, i) => (
                        <li key={i}>
                          <span />
                          {event}
                        </li>
                      ))}
                    </ol>
                  ) : room.history.length ? (
                    <div className="vote-history">
                      {[...room.history].reverse().map((h, i) => (
                        <div key={i}>
                          <strong>
                            Quest {h.quest + 1}{' '}
                            <span className={h.approved ? 'good' : 'evil'}>
                              {h.approved ? 'Approved' : 'Rejected'}
                            </span>
                          </strong>
                          <p>{h.team.map(playerName).join(', ')}</p>
                          <div>
                            {room.players.map((p) => (
                              <span
                                key={p.id}
                                className={h.votes[p.id] ? 'good' : 'evil'}
                              >
                                {h.votes[p.id] ? <Check /> : <X />}
                                {p.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-history">
                      Completed team votes will appear here.
                    </p>
                  )}
                </section>
                <button
                  className="rules-link"
                  onClick={() => setModal('rules')}
                >
                  <BookOpen /> Need a reminder? Read the rules <ChevronRight />
                </button>
              </aside>
            </div>
          )}
        </section>
      )}
      <footer>
        <span>
          <Swords /> Built for friends. Made for betrayal.
        </span>
        <button onClick={() => setModal('rules')}>
          <BookOpen /> A quick guide to Avalon
        </button>
        <span>An unofficial fan-made adaptation.</span>
      </footer>
      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open) closeModal();
        }}
      >
        <DialogContent
          className={`avalon-modal ${modal === 'characters' ? 'character-modal' : ''} ${modal === 'rules' ? 'rules-modal' : ''}`}
        >
          {modal === 'rules' && (
            <>
              <DialogTitle>The art of hidden loyalties.</DialogTitle>
              <DialogDescription>
                Avalon in a few minutes. The game handles the rules; you handle
                the trust.
              </DialogDescription>
              <div className="rules-steps">
                {[
                  [
                    '01',
                    'Discover your allegiance',
                    'Arthur’s loyal followers are the majority. Hidden among them are agents of evil. Your private character tells you which side you serve and whom you can see.',
                  ],
                  [
                    '02',
                    'Choose a quest party',
                    'The leader proposes the exact number of players shown on the quest board. Discuss the team, then everyone votes. A majority approves; a tie rejects. Leadership rotates after a rejection.',
                  ],
                  [
                    '03',
                    'Put your loyalty to the test',
                    'Only the approved party plays quest cards. Good must play Success. Evil may play Success or Fail. One Fail ruins a quest, except quest four with 7–10 players, which needs two. Cards are anonymous.',
                  ],
                  [
                    '04',
                    'Decide the fate of Camelot',
                    'Three failed quests or five consecutive rejected teams give evil the win. After three successful quests, the Assassin has one chance to name Merlin. If Merlin survives, good wins.',
                  ],
                ].map(([n, title, text]) => (
                  <div className="rule-step" key={n}>
                    <span>{n}</span>
                    <div>
                      <h3>{title}</h3>
                      <p>{text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="rule-tip">
                <EyeOff />
                <p>
                  Keep your role private. Talk, bluff, and debate in person or
                  on a voice call. Each player should use a separate screen.
                </p>
              </div>
              <a
                className="text-link"
                href="https://avalon.fun/pdfs/rules.pdf"
                target="_blank"
                rel="noreferrer"
              >
                Read the original rulebook <ArrowRight />
              </a>
            </>
          )}
          {modal === 'characters' && (
            <>
              <DialogTitle>The faces of Avalon</DialogTitle>
              <DialogDescription>
                Eight characters. Two allegiances. Countless secrets.
              </DialogDescription>
              <div className="character-browser">
                <div className="character-list">
                  {(Object.keys(ROLES) as Role[]).map((role) => (
                    <button
                      key={role}
                      className={character === role ? 'active' : ''}
                      onClick={() => setCharacter(role)}
                    >
                      <Portrait role={role} />
                      <span>
                        {ROLES[role].name}
                        <small className={ROLES[role].side}>
                          {ROLES[role].side === 'good'
                            ? 'Loyal to Arthur'
                            : 'Agent of evil'}
                        </small>
                      </span>
                      <ChevronRight />
                    </button>
                  ))}
                </div>
                <div className="character-detail">
                  <Portrait role={character} />
                  <div>
                    <span className={`eyebrow ${ROLES[character].side}`}>
                      {ROLES[character].side === 'good'
                        ? 'FOR CAMELOT'
                        : 'AGAINST THE CROWN'}
                    </span>
                    <h2>{ROLES[character].name}</h2>
                    <em>{ROLES[character].title}</em>
                    <p>{ROLES[character].description}</p>
                  </div>
                </div>
              </div>
            </>
          )}
          {modal === 'identity' && room?.me.role && (
            <>
              <DialogTitle>
                {revealed
                  ? ROLES[room.me.role].name
                  : 'A secret, entrusted to you.'}
              </DialogTitle>
              <DialogDescription>
                {revealed
                  ? 'Keep this knowledge away from other players.'
                  : 'Make sure only you can see this screen.'}
              </DialogDescription>
              {revealed ? (
                <div className="private-reveal">
                  <Portrait role={room.me.role} />
                  <span className={`allegiance ${ROLES[room.me.role].side}`}>
                    <Shield />
                    {ROLES[room.me.role].side === 'good'
                      ? 'LOYAL TO ARTHUR'
                      : 'AGENT OF EVIL'}
                  </span>
                  <p>{ROLES[room.me.role].description}</p>
                  <div className="knowledge">
                    <span className="eyebrow">WHAT YOU KNOW</span>
                    {room.me.knowledge.length ? (
                      room.me.knowledge.map((k) => (
                        <div key={k.id}>
                          <strong>{playerName(k.id)}</strong>
                          <span
                            className={k.label === 'Evil' ? 'evil' : 'good'}
                          >
                            {k.label}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p>You have no knowledge of other players’ identities.</p>
                    )}
                  </div>
                  {room.phase === 'reveal' && !me?.ready ? (
                    <Button
                      className="gold-button"
                      disabled={busy}
                      onClick={async () => {
                        const r = await send('ready');
                        if (r) closeModal();
                      }}
                    >
                      I know my role. Hide it. <EyeOff />
                    </Button>
                  ) : (
                    <Button className="outline-button" onClick={closeModal}>
                      Hide my identity <EyeOff />
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="card-back reveal-back">
                    <Crown />
                    <span>A V A L O N</span>
                    <i />
                    <Shield />
                  </div>
                  <Button
                    className="gold-button"
                    onClick={() => setRevealed(true)}
                  >
                    Only I can see this screen <Eye />
                  </Button>
                </>
              )}
            </>
          )}
          {modal === 'leave' && (
            <>
              <DialogTitle>
                {room?.phase === 'lobby' || room?.phase === 'finished'
                  ? 'Leave the round table?'
                  : 'Step away from the table?'}
              </DialogTitle>
              <DialogDescription>
                {room?.phase === 'lobby' || room?.phase === 'finished'
                  ? 'Your seat will be released. You can join again while the table is in the lobby.'
                  : 'Your seat stays reserved in this browser. Return to this tab to reconnect; the game will wait when it needs your decision.'}
              </DialogDescription>
              <div className="modal-actions">
                <Button className="outline-button" onClick={closeModal}>
                  Stay at the table
                </Button>
                <Button
                  className="danger-button"
                  disabled={busy}
                  onClick={async () => {
                    if (room?.phase === 'lobby' || room?.phase === 'finished') {
                      const r = await send('leave');
                      if (r) closeModal();
                    } else {
                      setRoom(null);
                      closeModal();
                    }
                  }}
                >
                  <LogOut />
                  Leave table
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
