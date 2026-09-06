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
  LogOut,
  Shield,
  Bot,
  Settings2,
  History,
  CircleHelp,
  Swords,
  Users,
  X,
} from 'lucide-react';
import { GameTable } from '@/components/game-table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { ROLES, OPTIONAL, EVIL_COUNT, type Role } from '@/lib/game/roles';
import Link from 'next/link';
import Image from 'next/image';
import type { RoomView } from '@/lib/game/engine';

type Session = { code: string; token: string };
type Modal = 'rules' | 'characters' | 'identity' | 'leave' | null;
const ROLE_HINTS: Record<Role, string> = {
  Merlin: 'See evil, except Mordred. Stay hidden.',
  Percival: 'Find the real Merlin.',
  Servant: 'Help three quests succeed.',
  Assassin: 'Find Merlin after three successful quests.',
  Morgana: 'Appear as Merlin to Percival.',
  Mordred: 'Hidden from Merlin.',
  Oberon: 'Evil. Your allies are unknown.',
  Minion: 'Help three quests fail.',
};
function Progress({
  count,
  total,
  label,
}: {
  count: number;
  total: number;
  label: string;
}) {
  return (
    <output
      className="submission-progress"
      aria-label={`${label}: ${count} of ${total}`}
      aria-live="polite"
    >
      <span className="submission-dots" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <i key={i} className={i < count ? 'filled' : ''} />
        ))}
      </span>
      <span>
        {count}/{total}
      </span>
    </output>
  );
}
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
  const [inviteCode, setInviteCode] = useState('');
  const [tab, setTab] = useState<'host' | 'join'>('host');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [connection, setConnection] = useState('');
  const [modal, setModal] = useState<Modal>(null);
  const [character, setCharacter] = useState<Role>('Merlin');
  const [revealed, setRevealed] = useState(false);
  const [roleHidden, setRoleHidden] = useState(false);
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
        const normalizedInvite =
          invite?.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6) ?? '';
        if (normalizedInvite.length === 6) {
          setInviteCode(normalizedInvite);
          setCode(normalizedInvite);
          setTab('join');
        }
        const raw = sessionStorage.getItem('avalon.session');
        if (raw) {
          const saved = JSON.parse(raw) as Session;
          if (!normalizedInvite || normalizedInvite === saved.code) {
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
        setRoleHidden(true);
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
  const lobbyPlayerCount = room?.players.length ?? 0;
  const roleRuleCount = Math.min(10, Math.max(5, lobbyPlayerCount || 5));
  const optionalRoleDisabled = (role: Role) => {
    if (!room || room.optional.includes(role)) return false;
    const side = ROLES[role].side;
    const selectedOnSide = room.optional.filter(
      (selectedRole) => ROLES[selectedRole].side === side,
    ).length;
    const sideSlots =
      side === 'evil'
        ? EVIL_COUNT[roleRuleCount] - 1
        : roleRuleCount - EVIL_COUNT[roleRuleCount] - 1;
    return selectedOnSide >= sideSlots;
  };
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
    <main className={`shell clean-ui ${room ? 'in-game' : ''}`}>
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
          <span>AVALON</span>
        </Link>
        <nav aria-label="Game help">
          <button
            className="icon-button"
            aria-label="How to play"
            title="How to play"
            onClick={() => setModal('rules')}
          >
            <BookOpen />
          </button>
          <button
            className="icon-button"
            aria-label="Characters"
            title="Characters"
            onClick={() => setModal('characters')}
          >
            <Users />
          </button>
          {room && (
            <button
              className="icon-button"
              aria-label="Leave table"
              title="Leave table"
              onClick={() => setModal('leave')}
            >
              <LogOut />
            </button>
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
      {connection && (
        <output className="notice">
          <Clock3 />
          Reconnecting…
        </output>
      )}
      {!room ? (
        <>
          <section className="home-stage">
            <div className="intro">
              <h1 className="sr-only">Play Avalon</h1>
              <form className="entry-panel" onSubmit={submitEntry}>
                <div className={`entry-tabs ${inviteCode ? 'invite-hidden' : ''}`} aria-label="Host or join">
                  <button
                    type="button"
                    aria-pressed={tab === 'host'}
                    className={tab === 'host' ? 'active' : ''}
                    onClick={() => {
                      setTab('host');
                      setError('');
                    }}
                  >
                    <Crown />
                    Host
                  </button>
                  <button
                    type="button"
                    aria-pressed={tab === 'join'}
                    className={tab === 'join' ? 'active' : ''}
                    onClick={() => {
                      setTab('join');
                      setError('');
                    }}
                  >
                    <Users />
                    Join
                  </button>
                </div>
                {inviteCode && (
                  <div
                    className="invite-room-summary"
                    aria-label={`Invited to room ${inviteCode}`}
                  >
                    <span>Invited to room</span>
                    <strong>{inviteCode}</strong>
                    <small>Enter your name and you’re in.</small>
                  </div>
                )}
                <label htmlFor="name">Your name</label>
                <input
                  autoComplete="off"
                  id="name"
                  placeholder="Name"
                  required
                  maxLength={20}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {tab === 'join' && !inviteCode && (
                  <div className="code-field">
                    <label htmlFor="code">Room code</label>
                    <input
                      id="code"
                      autoComplete="off"
                      autoCapitalize="characters"
                      placeholder="ABC234"
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
                    ? 'Joining…'
                    : tab === 'host'
                      ? 'Create room'
                      : 'Join room'}
                  <ArrowRight />
                </Button>
              </form>
              <div className="entry-extras">
                <span aria-label="5 to 10 players">
                  <Users />
                  5–10
                </span>
                <button disabled={busy} onClick={() => void enter(true)}>
                  <Bot />
                  Practice
                </button>
              </div>
              {session && (
                <button
                  className="resume-link"
                  disabled={busy}
                  onClick={() => void send('poll')}
                >
                  Resume {session.code}
                  <ArrowRight />
                </button>
              )}
            </div>
          </section>
          <section className="character-section" aria-label="Character gallery">
            <div className="section-title">
              <h2>Characters</h2>
              <button
                className="icon-button"
                aria-label="View all characters"
                onClick={() => setModal('characters')}
              >
                <ArrowRight />
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
                    <h3>{ROLES[role].name}</h3>
                    <span
                      className={ROLES[role].side}
                      aria-label={ROLES[role].side === 'good' ? 'Good' : 'Evil'}
                    >
                      {ROLES[role].side === 'good' ? <Shield /> : <Swords />}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="game-shell">
          <div className="table-bar">
            <h1>
              {room.phase === 'lobby'
                ? 'Lobby'
                : room.phase === 'finished'
                  ? 'Game over'
                  : `Quest ${room.round + 1}`}
              {room.practice && (
                <Bot className="practice-icon" aria-label="Practice game" />
              )}
            </h1>
            <button
              className="room-code"
              onClick={copy}
              aria-label={`Copy room invitation ${room.code}`}
              title="Copy invitation"
            >
              <span>{copied ? 'Invite copied' : 'Copy invite'}</span>
              <strong>{room.code}</strong>
              {copied ? <Check /> : <Copy />}
            </button>
          </div>
          {room.phase === 'lobby' ? (
            <div className="lobby-layout">
              <section className="panel lobby-main">
                <GameTable room={room} />
                <div className="lobby-bottom">
                  <Button
                    className={`outline-button ${me?.ready ? 'ready-button' : ''}`}
                    disabled={busy}
                    onClick={() => void send('ready', { ready: !me?.ready })}
                  >
                    {me?.ready ? <Check /> : <Shield />}
                    {me?.ready ? 'Ready' : 'Ready up'}
                  </Button>
                  {host && (
                    <Button
                      className="gold-button"
                      disabled={
                        busy ||
                        room.players.length < 5 ||
                        !room.players.every((p) => p.ready)
                      }
                      onClick={() => void send('start')}
                    >
                      Start
                      <ArrowRight />
                    </Button>
                  )}
                </div>
                <output className="muted-footnote">
                  {room.players.length < 5
                    ? `${5 - room.players.length} more needed`
                    : !room.players.every((p) => p.ready)
                      ? `${room.players.filter((p) => p.ready).length}/${room.players.length} ready`
                      : host
                        ? 'Ready to start'
                        : 'Waiting for host'}
                </output>
              </section>
              <aside className="lobby-sidebar">
                <details className="panel settings">
                  <summary>
                    <Settings2 />
                    Settings
                    <ChevronRight />
                  </summary>
                  <div className="settings-content">
                    {host &&
                      room.players.some((p) => p.id !== me?.id && !p.bot) && (
                        <details className="manage-seats">
                          <summary>Manage players</summary>
                          {room.players
                            .filter((p) => p.id !== me?.id && !p.bot)
                            .map((p) => (
                              <div key={p.id}>
                                <span>{p.name}</span>
                                <button
                                  className="icon-button"
                                  disabled={busy}
                                  aria-label={`Remove ${p.name}`}
                                  onClick={() =>
                                    void send('remove', { target: p.id })
                                  }
                                >
                                  <X />
                                </button>
                              </div>
                            ))}
                        </details>
                      )}
                    <div className="player-count-summary" aria-live="polite">
                      <Users />
                      <div>
                        <strong>{room.players.length} joined</strong>
                        <span>
                          {room.players.length >= 5
                            ? `${room.players.length - EVIL_COUNT[room.players.length]} good / ${EVIL_COUNT[room.players.length]} evil · starts with whoever is here`
                            : `${5 - room.players.length} more needed · room expands automatically up to 10`}
                        </span>
                      </div>
                    </div>
                    <div className="settings-divider" />
                    {OPTIONAL.map((role) => (
                      <label
                        key={role}
                        className="role-toggle"
                        aria-label={ROLES[role].name}
                      >
                        <span className="setting-role">
                          <span className={ROLES[role].side}>
                            {ROLES[role].side === 'good' ? (
                              <Shield />
                            ) : (
                              <Swords />
                            )}
                          </span>
                          <strong>{ROLES[role].name}</strong>
                        </span>
                        <input
                          type="checkbox"
                          checked={room.optional.includes(role)}
                          disabled={
                            !host || busy || optionalRoleDisabled(role)
                          }
                          onChange={(e) =>
                            void send('configure', {
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
                      Character guide
                      <ArrowRight />
                    </button>
                  </div>
                </details>
              </aside>
            </div>
          ) : (
            <>
              {room.me.role && (room.phase !== 'reveal' || me?.ready) && (
                <section
                  className={`role-strip panel ${roleHidden ? 'concealed' : ''}`}
                  aria-label="Your private role"
                >
                  {roleHidden ? (
                    <>
                      <EyeOff />
                      <span>Role hidden</span>
                      <button
                        className="icon-button"
                        onClick={() => setRoleHidden(false)}
                        aria-label="Show role and knowledge"
                        title="Show role"
                      >
                        <Eye />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="role-portrait-button"
                        onClick={showIdentity}
                        aria-label="Your character details"
                      >
                        <Portrait role={room.me.role} />
                      </button>
                      <div className="role-strip-content">
                        <div className="role-strip-heading">
                          <h2>{ROLES[room.me.role].name}</h2>
                          <span
                            className={ROLES[room.me.role].side}
                            aria-label={
                              ROLES[room.me.role].side === 'good'
                                ? 'Good'
                                : 'Evil'
                            }
                          >
                            {ROLES[room.me.role].side === 'good' ? (
                              <Shield />
                            ) : (
                              <Swords />
                            )}
                          </span>
                        </div>
                        <p>{ROLE_HINTS[room.me.role]}</p>
                        {room.me.knowledge.length > 0 && (
                          <div className="known-players">
                            <span>
                              {room.me.role === 'Percival'
                                ? 'Possible Merlin'
                                : 'Known evil'}
                            </span>
                            {room.me.knowledge.map((k) => (
                              <span className="known-player" key={k.id}>
                                {playerName(k.id)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        className="icon-button"
                        aria-label="Hide role and knowledge"
                        title="Hide role"
                        onClick={() => setRoleHidden(true)}
                      >
                        <EyeOff />
                      </button>
                    </>
                  )}
                </section>
              )}
              <div className="play-layout">
                <div className="play-main">
                  <GameTable
                    room={room}
                    selected={
                      room.phase === 'team'
                        ? selected
                        : room.phase === 'assassinate'
                          ? target
                            ? [target]
                            : []
                          : room.team
                    }
                    eligible={
                      busy
                        ? []
                        : room.players
                            .filter((p) =>
                              room.phase === 'team'
                                ? myTurn &&
                                  (selected.includes(p.id) ||
                                    selected.length < required)
                                : room.phase === 'assassinate' &&
                                  room.me.role === 'Assassin' &&
                                  p.id !== me?.id &&
                                  !room.me.knowledge.some((k) => k.id === p.id),
                            )
                            .map((p) => p.id)
                    }
                    onSelect={
                      room.phase === 'team' && myTurn
                        ? togglePlayer
                        : room.phase === 'assassinate' &&
                            room.me.role === 'Assassin'
                          ? setTarget
                          : undefined
                    }
                  >
                    <section
                      className="quest-board panel"
                      aria-label="Quest board"
                    >
                      <div className="quest-track">
                        {room.teamSizes.map((size, i) => {
                          const q = room.quests[i];
                          return (
                            <div
                              className={`quest-stop ${q ? (q.success ? 'success' : 'failed') : i === room.round ? 'current' : ''}`}
                              key={i}
                              aria-label={`Quest ${i + 1}, ${size} players${q ? (q.success ? ', succeeded' : ', failed') : i === room.round ? ', current' : ''}`}
                            >
                              <div className="quest-medallion">
                                {q ? (
                                  q.success ? (
                                    <Shield />
                                  ) : (
                                    <Swords />
                                  )
                                ) : (
                                  <span>
                                    {['I', 'II', 'III', 'IV', 'V'][i]}
                                  </span>
                                )}
                              </div>
                              <span aria-label={`${size} players`}>
                                <Users />
                                {size}
                              </span>
                              {i === 3 && room.players.length >= 7 && (
                                <small title="Two Fail cards required">
                                  <Swords />
                                  ×2
                                  <span className="sr-only">
                                    fails required
                                  </span>
                                </small>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="rejection-track">
                        <span>Rejections</span>
                        <div
                          aria-label={`${room.rejections} of 5 rejected teams`}
                        >
                          {[0, 1, 2, 3, 4].map((i) => (
                            <i
                              key={i}
                              className={i < room.rejections ? 'filled' : ''}
                            />
                          ))}
                        </div>
                        <button
                          className="icon-button"
                          aria-label="Explain rejection rules"
                          onClick={() => setModal('rules')}
                        >
                          <CircleHelp />
                        </button>
                        {room.rejections === 4 && (
                          <p className="evil">Next rejection: evil wins</p>
                        )}
                      </div>
                    </section>
                  </GameTable>
                  <section
                    className={`panel action-panel phase-${room.phase}`}
                    aria-label="Current action"
                  >
                    {room.phase === 'reveal' && (
                      <>
                        <div className="phase-icon">
                          <Eye />
                        </div>
                        <h2>
                          {me?.ready
                            ? 'Waiting for players'
                            : 'Your role is ready'}
                        </h2>
                        {!me?.ready && (
                          <Button
                            className="gold-button"
                            onClick={showIdentity}
                          >
                            Reveal
                            <Eye />
                          </Button>
                        )}
                        <Progress
                          count={room.submitted}
                          total={room.players.length}
                          label="roles confirmed"
                        />
                      </>
                    )}
                    {room.phase === 'team' && (
                      <>
                        <div className="action-heading">
                          <h2>
                            {myTurn
                              ? `Tap ${required} pawns`
                              : 'Choosing a team'}
                          </h2>
                          <span className="leader-label">
                            <Crown />
                            {myTurn ? 'You' : leader?.name}
                          </span>
                        </div>
                        {myTurn && (
                          <Button
                            className="gold-button"
                            disabled={busy || selected.length !== required}
                            onClick={() =>
                              void send('propose', { team: selected })
                            }
                          >
                            Propose{' '}
                            <span>
                              {selected.length}/{required}
                            </span>
                            <ArrowRight />
                          </Button>
                        )}
                      </>
                    )}
                    {room.phase === 'vote' && (
                      <>
                        <h2>
                          {room.me.voted ? 'Vote sealed' : 'Approve team?'}
                        </h2>
                        {room.me.voted ? (
                          <Check
                            className="sealed-icon good"
                            aria-label="Vote submitted"
                          />
                        ) : (
                          <div className="vote-actions">
                            <Button
                              className="success-button"
                              disabled={busy}
                              onClick={() =>
                                void send('vote', { approve: true })
                              }
                            >
                              <Check />
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
                        <Progress
                          count={room.submitted}
                          total={room.players.length}
                          label="votes sealed"
                        />
                      </>
                    )}
                    {room.phase === 'quest' && (
                      <>
                        <h2>
                          {room.me.quested
                            ? 'Card sealed'
                            : room.team.includes(me!.id)
                              ? 'Play your card'
                              : 'Quest in progress'}
                        </h2>
                        {room.round === 3 && room.players.length >= 7 && (
                          <span className="quest-warning">
                            <Swords />2 fails required
                          </span>
                        )}
                        {room.team.includes(me!.id) && !room.me.quested ? (
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
                        ) : room.me.quested ? (
                          <Check
                            className="sealed-icon good"
                            aria-label="Card submitted"
                          />
                        ) : (
                          <Clock3
                            className="sealed-icon"
                            aria-label="Waiting for quest party"
                          />
                        )}
                        <Progress
                          count={room.submitted}
                          total={room.team.length}
                          label="quest cards sealed"
                        />
                      </>
                    )}
                    {room.phase === 'result' && (
                      <>
                        <h2
                          className={
                            room.quests.at(-1)?.success ? 'good' : 'evil'
                          }
                        >
                          {room.quests.at(-1)?.success
                            ? 'Quest succeeded'
                            : 'Quest failed'}
                        </h2>
                        <div
                          className="result-cards"
                          aria-label={`${room.quests.at(-1)!.fails} Fail cards`}
                        >
                          {Array.from(
                            { length: room.quests.at(-1)!.team.length },
                            (_, i) => {
                              const fail = i < room.quests.at(-1)!.fails;
                              return (
                                <div
                                  key={i}
                                  className={
                                    fail ? 'fail-card' : 'success-card'
                                  }
                                  aria-label={fail ? 'Fail' : 'Success'}
                                >
                                  {fail ? <Swords /> : <Shield />}
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
                          {me?.ready ? 'Waiting…' : 'Continue'}
                          {me?.ready ? <Clock3 /> : <ArrowRight />}
                        </Button>
                        <Progress
                          count={room.submitted}
                          total={room.players.length}
                          label="players ready"
                        />
                      </>
                    )}
                    {room.phase === 'assassinate' && (
                      <>
                        <div className="phase-icon evil">
                          <Swords />
                        </div>
                        <h2>
                          {room.me.role === 'Assassin'
                            ? 'Who is Merlin?'
                            : 'The Assassin is choosing'}
                        </h2>
                        {room.me.role === 'Assassin' && (
                          <>
                            <p className="target-name">
                              {target ? playerName(target) : 'Tap a pawn'}
                            </p>
                            <Button
                              className="danger-button assassinate"
                              disabled={busy || !target}
                              onClick={() =>
                                void send('assassinate', { target })
                              }
                            >
                              <Swords />
                              Assassinate
                            </Button>
                          </>
                        )}
                      </>
                    )}
                    {room.phase === 'finished' && (
                      <>
                        <div className={`phase-icon ${room.winner}`}>
                          <Crown />
                        </div>
                        <h2>
                          {room.winner === 'good' ? 'Good wins' : 'Evil wins'}
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
                        {host && (
                          <Button
                            className="gold-button"
                            disabled={busy}
                            onClick={() => void send('rematch')}
                          >
                            Play again
                            <ArrowRight />
                          </Button>
                        )}
                      </>
                    )}
                  </section>
                </div>
                <aside className="game-sidebar">
                  <details className="panel chronicle">
                    <summary>
                      <History />
                      History
                      <ChevronRight />
                    </summary>
                    <div className="history-content">
                      <div className="entry-tabs">
                        <button
                          className={historyTab === 'events' ? 'active' : ''}
                          onClick={() => setHistoryTab('events')}
                        >
                          Events
                        </button>
                        <button
                          className={historyTab === 'votes' ? 'active' : ''}
                          onClick={() => setHistoryTab('votes')}
                        >
                          Votes
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
                                Quest {h.quest + 1}
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
                        <p className="empty-history">No votes yet</p>
                      )}
                    </div>
                  </details>
                </aside>
              </div>
            </>
          )}
        </section>
      )}
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
              <DialogTitle>How to play</DialogTitle>
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
              <DialogTitle>Characters</DialogTitle>
              <DialogDescription>
                Tap a character to learn more.
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
                {revealed ? ROLES[room.me.role].name : 'Your character'}
              </DialogTitle>
              <DialogDescription>
                {revealed ? 'For your eyes only.' : 'Keep your screen private.'}
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
                        if (r) {
                          setRoleHidden(false);
                          closeModal();
                        }
                      }}
                    >
                      Ready <EyeOff />
                    </Button>
                  ) : (
                    <Button className="outline-button" onClick={closeModal}>
                      Close <EyeOff />
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
                    Reveal <Eye />
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
