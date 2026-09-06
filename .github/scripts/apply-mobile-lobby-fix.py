from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing expected snippet: {label}")
    return text.replace(old, new, 1)


# --- Entry + lobby UI -------------------------------------------------------
page_path = Path("app/page.tsx")
page = page_path.read_text()

page = replace_once(
    page,
    "  const [code, setCode] = useState('');\n  const [tab, setTab] = useState<'host' | 'join'>('host');",
    "  const [code, setCode] = useState('');\n  const [inviteCode, setInviteCode] = useState('');\n  const [tab, setTab] = useState<'host' | 'join'>('host');",
    "invite state",
)

page = replace_once(
    page,
    """        const invite = new URLSearchParams(location.search).get('room');
        if (invite) {
          setCode(invite.toUpperCase().slice(0, 6));
          setTab('join');
        }
        const raw = sessionStorage.getItem('avalon.session');
        if (raw) {
          const saved = JSON.parse(raw) as Session;
          if (!invite || invite.toUpperCase() === saved.code) {""",
    """        const invite = new URLSearchParams(location.search).get('room');
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
          if (!normalizedInvite || normalizedInvite === saved.code) {""",
    "invite parsing",
)

page = replace_once(
    page,
    '                <div className="entry-tabs" aria-label="Host or join">',
    "                <div className={`entry-tabs ${inviteCode ? 'invite-hidden' : ''}`} aria-label=\"Host or join\">",
    "invite tabs",
)

page = replace_once(
    page,
    '                <label htmlFor="name">Your name</label>',
    """                {inviteCode && (
                  <div
                    className="invite-room-summary"
                    aria-label={`Invited to room ${inviteCode}`}
                  >
                    <span>Invited to room</span>
                    <strong>{inviteCode}</strong>
                    <small>Enter your name and you’re in.</small>
                  </div>
                )}
                <label htmlFor="name">Your name</label>""",
    "invite summary",
)

page = replace_once(
    page,
    "                {tab === 'join' && (",
    "                {tab === 'join' && !inviteCode && (",
    "hide invite code input",
)

page = replace_once(
    page,
    """              <strong>{room.code}</strong>
              {copied ? <Check /> : <Copy />}""",
    """              <span>{copied ? 'Invite copied' : 'Copy invite'}</span>
              <strong>{room.code}</strong>
              {copied ? <Check /> : <Copy />}""",
    "copy invite label",
)

page = replace_once(
    page,
    """  const playerName = (id: string) =>
    room?.players.find((p) => p.id === id)?.name ?? 'Player';
  function togglePlayer(id: string) {""",
    """  const playerName = (id: string) =>
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
  function togglePlayer(id: string) {""",
    "role availability helper",
)

capacity_pattern = re.compile(
    r'\s*<label htmlFor="capacity">Players</label>\s*<select\s+id="capacity".*?</select>\s*<div className="settings-divider" />',
    re.S,
)
capacity_replacement = """
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
                    <div className="settings-divider" />"""
page, count = capacity_pattern.subn(capacity_replacement, page, count=1)
if count != 1:
    raise SystemExit("failed to replace manual player-count selector")

page = replace_once(
    page,
    """                            void send('configure', {
                              capacity: room.capacity,
                              optional: e.target.checked""",
    """                            void send('configure', {
                              optional: e.target.checked""",
    "configure payload",
)

page = replace_once(
    page,
    """                          disabled={!host || busy}
                          onChange={(e) =>""",
    """                          disabled={
                            !host || busy || optionalRoleDisabled(role)
                          }
                          onChange={(e) =>""",
    "disable impossible optional roles",
)

page_path.write_text(page)


# --- Server: actual joined seats define the game ----------------------------
engine_path = Path("lib/game/engine.ts")
engine = engine_path.read_text()

engine = replace_once(
    engine,
    "    capacity: 5,",
    "    capacity: practice ? 5 : 10,",
    "default auto capacity",
)

engine = replace_once(
    engine,
    "  ensure(room.players.length < room.capacity, 'This table is full.');",
    "  ensure(room.players.length < 10, 'This table is full (10 players maximum).');",
    "ten player join limit",
)

engine = replace_once(
    engine,
    """export function deckFor(count: number, optional: Role[]): Role[] {
  ensure(TEAM_SIZES[count], 'Avalon needs 5–10 players.');""",
    """function normalizeOptionalForCount(count: number, optional: Role[]): Role[] {
  const safeCount = Math.min(10, Math.max(5, count));
  ensure(
    optional.every((r) => (OPTIONAL as readonly string[]).includes(r)) &&
      new Set(optional).size === optional.length,
    'Invalid character selection.',
  );
  let goodSlots = safeCount - EVIL_COUNT[safeCount] - 1;
  let evilSlots = EVIL_COUNT[safeCount] - 1;
  return optional.filter((role) => {
    if (ROLES[role].side === 'good') {
      if (goodSlots <= 0) return false;
      goodSlots--;
      return true;
    }
    if (evilSlots <= 0) return false;
    evilSlots--;
    return true;
  });
}

export function deckFor(count: number, optional: Role[]): Role[] {
  ensure(TEAM_SIZES[count], 'Avalon needs 5–10 players.');""",
    "optional normalization helper",
)

configure_old = """    case 'configure': {
      host();
      ensure(room.phase === 'lobby', 'Settings are locked during play.');
      const count = Number(data.capacity);
      ensure(
        Number.isInteger(count) &&
          count >= 5 &&
          count <= 10 &&
          count >= room.players.length,
        'Choose a table size from 5 to 10 with room for everyone.',
      );
      ensure(Array.isArray(data.optional), 'Choose the optional characters.');
      deckFor(count, data.optional as Role[]);
      room.capacity = count;
      room.optional = data.optional as Role[];
      room.players.forEach((p) => (p.ready = p.bot));
      break;
    }"""
configure_new = """    case 'configure': {
      host();
      ensure(room.phase === 'lobby', 'Settings are locked during play.');
      ensure(Array.isArray(data.optional), 'Choose the optional characters.');
      room.capacity = room.practice ? 5 : 10;
      room.optional = normalizeOptionalForCount(
        room.players.length,
        data.optional as Role[],
      );
      room.players.forEach((p) => (p.ready = p.bot));
      break;
    }"""
engine = replace_once(engine, configure_old, configure_new, "configure action")

engine = replace_once(
    engine,
    "      const deck = shuffle(deckFor(room.players.length, room.optional));",
    """      room.optional = normalizeOptionalForCount(
        room.players.length,
        room.optional,
      );
      room.capacity = room.practice ? 5 : 10;
      const deck = shuffle(deckFor(room.players.length, room.optional));""",
    "start normalization",
)

engine = replace_once(
    engine,
    """      room.players = room.players.filter((player) => player.id !== data.target);
      if (room.leader >= room.players.length) room.leader = 0;""",
    """      room.players = room.players.filter((player) => player.id !== data.target);
      room.optional = normalizeOptionalForCount(room.players.length, room.optional);
      room.capacity = room.practice ? 5 : 10;
      if (room.leader >= room.players.length) room.leader = 0;""",
    "remove normalization",
)

engine = replace_once(
    engine,
    """      room.players = room.players.filter((player) => player.id !== id);
      if (room.host === id)""",
    """      room.players = room.players.filter((player) => player.id !== id);
      room.optional = normalizeOptionalForCount(room.players.length, room.optional);
      room.capacity = room.practice ? 5 : 10;
      if (room.host === id)""",
    "leave normalization",
)

engine = replace_once(
    engine,
    """    capacity: room.capacity,
    practice: room.practice,""",
    """    capacity: room.practice ? 5 : 10,
    practice: room.practice,""",
    "public capacity",
)

engine = replace_once(
    engine,
    "    teamSizes: TEAM_SIZES[room.players.length] ?? TEAM_SIZES[room.capacity],",
    "    teamSizes: TEAM_SIZES[room.players.length] ?? TEAM_SIZES[5],",
    "lobby team size fallback",
)

engine_path.write_text(engine)


# --- Table: grow visually with the lobby instead of preselecting a size -----
table_path = Path("components/game-table.tsx")
table = table_path.read_text()

table = replace_once(
    table,
    "  const seats = lobby ? room.capacity : room.players.length;",
    """  const seats = lobby
    ? Math.min(10, Math.max(5, room.players.length + (room.players.length < 10 ? 1 : 0)))
    : room.players.length;""",
    "dynamic lobby seats",
)

table = replace_once(
    table,
    """                  aria-label={`${room.players.length} of ${room.capacity} seats filled`}
                >
                  <Users />
                  {room.players.length}/{room.capacity}""",
    """                  aria-label={`${room.players.length} players joined, up to 10`}
                >
                  <Users />
                  {room.players.length}""",
    "lobby joined count",
)

table_path.write_text(table)


# --- Tests ------------------------------------------------------------------
tests_path = Path("tests/engine.test.ts")
tests = tests_path.read_text()
tests = replace_once(
    tests,
    """void test('room names, capacity and midgame joins are validated', () => {
  assert.throws(() => makePlayer('', 'x'));
  assert.throws(() => makePlayer('a'.repeat(21), 'x'));
  const r = fixture();
  assert.throws(() => joinRoom(r, makePlayer('Sixth', 'x')), /full/);
  start(r);
  assert.throws(() => joinRoom(r, makePlayer('Late', 'x')), /already started/);
});""",
    """void test('rooms auto-grow to ten players and reject midgame joins', () => {
  assert.throws(() => makePlayer('', 'x'));
  assert.throws(() => makePlayer('a'.repeat(21), 'x'));
  const r = fixture();
  for (let n = 6; n <= 10; n++)
    joinRoom(r, makePlayer(`Player ${n}`, `secret${n}`));
  assert.equal(r.players.length, 10);
  assert.throws(() => joinRoom(r, makePlayer('Eleventh', 'x')), /full/);
  start(r);
  assert.throws(() => joinRoom(r, makePlayer('Late', 'x')), /already started/);
});

void test('optional roles adapt to the number of players actually in the lobby', () => {
  const r = fixture(5);
  act(r, r.host, 'configure', {
    optional: ['Morgana', 'Mordred', 'Oberon'],
  });
  assert.deepEqual(r.optional, ['Morgana']);
  r.players.push(makePlayer('Player 6', 'secret6'));
  r.players.push(makePlayer('Player 7', 'secret7'));
  act(r, r.host, 'configure', {
    optional: ['Morgana', 'Mordred', 'Oberon'],
  });
  assert.deepEqual(r.optional, ['Morgana', 'Mordred']);
});""",
    "auto capacity tests",
)
tests_path.write_text(tests)


# --- Last-loaded mobile CSS -------------------------------------------------
layout_path = Path("app/layout.tsx")
layout = layout_path.read_text()
layout = replace_once(
    layout,
    "import './final-polish.css';",
    "import './final-polish.css';\nimport './mobile-lobby-fix.css';",
    "mobile fix stylesheet import",
)
layout_path.write_text(layout)

Path("app/mobile-lobby-fix.css").write_text("""/* Targeted production fixes from real-device mobile testing. */
.clean-ui .entry-tabs.invite-hidden {
  display: none;
}

.clean-ui .invite-room-summary {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px 14px;
  margin: 20px 0;
  padding: 14px 16px;
  border: 1px solid #d9b87755;
  border-radius: 8px;
  background: #172b2dbd;
}

.clean-ui .invite-room-summary span,
.clean-ui .invite-room-summary small {
  color: var(--dim);
  font-size: 12px;
}

.clean-ui .invite-room-summary strong {
  grid-row: 1 / 3;
  grid-column: 2;
  align-self: center;
  color: var(--gold);
  font-family: Georgia, serif;
  font-size: 21px;
  font-weight: 400;
  letter-spacing: 3px;
}

.clean-ui .invite-room-summary small {
  line-height: 1.4;
}

.clean-ui .player-count-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0 4px;
}

.clean-ui .player-count-summary > svg {
  width: 21px;
  height: 21px;
  color: var(--gold);
  flex: none;
}

.clean-ui .player-count-summary strong,
.clean-ui .player-count-summary span {
  display: block;
}

.clean-ui .player-count-summary strong {
  color: #eee7d7;
  font-size: 14px;
  font-weight: 600;
}

.clean-ui .player-count-summary span {
  margin-top: 4px;
  color: var(--dim);
  font-size: 12px;
  line-height: 1.4;
}

/* Each atlas cell is square. The old phone rule forced the selected portrait
   to match the text column height, which visibly stretched faces and armor. */
.clean-ui .portrait,
.clean-ui .character-detail > .portrait {
  aspect-ratio: 1 / 1 !important;
}

@media (max-width: 700px) {
  .clean-ui .character-detail {
    display: flex;
    flex-direction: column;
  }

  .clean-ui .character-detail > .portrait {
    width: 100%;
    height: auto !important;
    max-height: none;
    flex: none;
  }

  .clean-ui .character-detail > div:last-child {
    padding: 16px;
  }
}

@media (max-width: 450px) {
  .clean-ui .invite-room-summary {
    grid-template-columns: 1fr;
  }

  .clean-ui .invite-room-summary strong {
    grid-row: auto;
    grid-column: auto;
    margin: 3px 0;
  }
}
""")
