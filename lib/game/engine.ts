import { randomInt, randomUUID } from 'node:crypto';
import { ROLES, OPTIONAL, TEAM_SIZES, EVIL_COUNT, type Role } from './roles.ts';

export type Phase =
  | 'lobby'
  | 'reveal'
  | 'team'
  | 'vote'
  | 'vote-result'
  | 'quest'
  | 'result'
  | 'assassinate'
  | 'finished';

export type Player = {
  id: string;
  name: string;
  tokenHash: string;
  avatar: number;
  ready: boolean;
  bot: boolean;
  seen: number;
  role?: Role;
};

export type Proposal = {
  quest: number;
  leader: string;
  team: string[];
  votes: Record<string, boolean>;
  approved: boolean;
};

export type Quest = { team: string[]; fails: number; success: boolean };

export type Room = {
  code: string;
  host: string;
  players: Player[];
  phase: Phase;
  optional: Role[];
  capacity: number;
  practice: boolean;
  leader: number;
  round: number;
  rejections: number;
  team: string[];
  votes: Record<string, boolean>;
  cards: Record<string, boolean>;
  quests: Quest[];
  history: Proposal[];
  log: string[];
  winner?: 'good' | 'evil';
  reason?: string;
  phaseEndsAt?: number;
  updated: number;
  revision: number;
};

export const PUBLIC_AVATAR_COUNT = 12;
export const ONLINE_WINDOW_MS = 25_000;
export const VOTE_REVEAL_MS = 4_800;
export const QUEST_RESULT_MS = 6_500;
export const HOST_RECOVERY_GRACE_MS = 75_000;
export const ACTIVE_RECOVERY_GRACE_MS = 90_000;

export function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createRoom(
  code: string,
  player: Player,
  practice = false,
): Room {
  return {
    code,
    host: player.id,
    players: [player],
    phase: 'lobby',
    optional: ['Percival', 'Morgana'],
    capacity: practice ? 5 : 10,
    practice,
    leader: 0,
    round: 0,
    rejections: 0,
    team: [],
    votes: {},
    cards: {},
    quests: [],
    history: [],
    log: ['A new round table awaits.'],
    updated: Date.now(),
    revision: 0,
  };
}

export function makePlayer(
  name: unknown,
  tokenHash: string,
  bot = false,
): Player {
  ensure(
    typeof name === 'string' &&
      name.trim().length >= 1 &&
      name.trim().length <= 20,
    'Choose a name between 1 and 20 characters.',
  );
  ensure(
    name
      .split('')
      .every((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127),
    'Use a name without control characters.',
  );
  return {
    id: randomUUID(),
    name: name.trim(),
    tokenHash,
    avatar: randomInt(PUBLIC_AVATAR_COUNT),
    ready: false,
    bot,
    seen: Date.now(),
  };
}

export function joinRoom(room: Room, player: Player) {
  ensure(room.phase === 'lobby', 'This game has already started.');
  ensure(!room.practice, 'Practice tables are solo.');
  ensure(room.players.length < 10, 'This table is full (10 players maximum).');
  ensure(
    !room.players.some(
      (p) => p.name.toLowerCase() === player.name.toLowerCase(),
    ),
    'That name is already at the table.',
  );
  room.players.push(player);
  room.log.push(`${player.name} joined the table.`);
}

function finish(room: Room, winner: 'good' | 'evil', reason: string) {
  room.phase = 'finished';
  room.phaseEndsAt = undefined;
  room.winner = winner;
  room.reason = reason;
  room.log.push(reason);
}

function nextLeader(room: Room) {
  room.leader = (room.leader + 1) % room.players.length;
}

function resetRound(room: Room, message: string) {
  room.phase = 'lobby';
  room.phaseEndsAt = undefined;
  room.round = 0;
  room.rejections = 0;
  room.team = [];
  room.votes = {};
  room.cards = {};
  room.quests = [];
  room.history = [];
  room.winner = undefined;
  room.reason = undefined;
  room.players.forEach((p) => {
    p.role = undefined;
    p.ready = p.bot;
  });
  room.log = [message];
}

function normalizeOptionalForCount(count: number, optional: Role[]): Role[] {
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
  ensure(TEAM_SIZES[count], 'Avalon needs 5–10 players.');
  ensure(
    optional.every((r) => (OPTIONAL as readonly string[]).includes(r)) &&
      new Set(optional).size === optional.length,
    'Invalid character selection.',
  );
  const good: Role[] = [
    'Merlin',
    ...optional.filter((r) => ROLES[r].side === 'good'),
  ];
  const evil: Role[] = [
    'Assassin',
    ...optional.filter((r) => ROLES[r].side === 'evil'),
  ];
  ensure(
    evil.length <= EVIL_COUNT[count] &&
      good.length <= count - EVIL_COUNT[count],
    'Too many special characters for this player count.',
  );
  while (evil.length < EVIL_COUNT[count]) evil.push('Minion');
  while (good.length < count - EVIL_COUNT[count]) good.push('Servant');
  return [...good, ...evil];
}

export function knowledge(room: Room, p: Player) {
  const role = p.role;
  if (!role) return [];
  return room.players
    .filter(
      (other) =>
        other.id !== p.id &&
        other.role &&
        (role === 'Merlin'
          ? ROLES[other.role].side === 'evil' && other.role !== 'Mordred'
          : role === 'Percival'
            ? ['Merlin', 'Morgana'].includes(other.role)
            : ROLES[role].side === 'evil' && role !== 'Oberon'
              ? ROLES[other.role].side === 'evil' && other.role !== 'Oberon'
              : false),
    )
    .map((other) => ({
      id: other.id,
      label: role === 'Percival' ? 'Merlin or Morgana' : 'Evil',
    }));
}

function resolveVotes(room: Room) {
  if (Object.keys(room.votes).length !== room.players.length) return;
  const approved =
    Object.values(room.votes).filter(Boolean).length > room.players.length / 2;
  room.history.push({
    quest: room.round,
    leader: room.players[room.leader].id,
    team: [...room.team],
    votes: { ...room.votes },
    approved,
  });
  room.votes = {};
  if (approved) {
    room.rejections = 0;
    room.log.push(`Quest ${room.round + 1}: the team was approved.`);
  } else {
    room.rejections++;
    room.log.push(`Team rejected (${room.rejections}/5).`);
  }
  room.phase = 'vote-result';
  room.phaseEndsAt = Date.now() + VOTE_REVEAL_MS;
}

function resolveQuest(room: Room) {
  if (Object.keys(room.cards).length !== room.team.length) return;
  const fails = Object.values(room.cards).filter((v) => !v).length;
  const threshold = room.round === 3 && room.players.length >= 7 ? 2 : 1;
  const success = fails < threshold;
  room.quests.push({ team: [...room.team], fails, success });
  room.cards = {};
  room.log.push(
    `Quest ${room.round + 1} ${success ? 'succeeded' : 'failed'} with ${fails} Betray ${fails === 1 ? 'card' : 'cards'}.`,
  );
  room.phase = 'result';
  room.phaseEndsAt = Date.now() + QUEST_RESULT_MS;
  room.players.forEach((p) => (p.ready = false));
}

function staleHuman(room: Room, now: number) {
  return room.players.some(
    (p) => !p.bot && now - p.seen >= ACTIVE_RECOVERY_GRACE_MS,
  );
}

export function act(
  room: Room,
  id: string,
  action: string,
  data: Record<string, unknown> = {},
) {
  const p = room.players.find((p) => p.id === id);
  ensure(p, 'Your seat could not be found.');
  const host = () => ensure(room.host === id, 'Only the host can do that.');
  switch (action) {
    case 'configure': {
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
    }
    case 'ready': {
      ensure(
        room.phase === 'lobby' || room.phase === 'reveal',
        'There is nothing to confirm right now.',
      );
      p.ready = data.ready !== false;
      break;
    }
    case 'start': {
      host();
      ensure(room.phase === 'lobby', 'The game has already started.');
      ensure(room.players.length >= 5, 'At least 5 players are needed.');
      ensure(
        room.players.every((p) => p.ready),
        'Wait for everyone to be ready.',
      );
      room.optional = normalizeOptionalForCount(
        room.players.length,
        room.optional,
      );
      room.capacity = room.practice ? 5 : 10;
      const deck = shuffle(deckFor(room.players.length, room.optional));
      room.players.forEach((p, i) => {
        p.role = deck[i];
        p.ready = p.bot;
      });
      room.leader = randomInt(room.players.length);
      room.phase = 'reveal';
      room.phaseEndsAt = undefined;
      room.log.push('Roles have been dealt. Keep your identity secret.');
      break;
    }
    case 'propose': {
      ensure(room.phase === 'team', 'Wait for the team-building phase.');
      ensure(
        room.players[room.leader].id === id,
        'Only the leader can propose a team.',
      );
      ensure(
        Array.isArray(data.team) &&
          data.team.length === TEAM_SIZES[room.players.length][room.round],
        'Choose the exact number of players for this quest.',
      );
      const team = data.team as string[];
      ensure(
        new Set(team).size === team.length &&
          team.every((memberId) => room.players.some((player) => player.id === memberId)),
        'Choose distinct players at this table.',
      );
      room.team = team;
      room.votes = {};
      room.phase = 'vote';
      room.phaseEndsAt = undefined;
      break;
    }
    case 'vote': {
      ensure(room.phase === 'vote', 'Voting is closed.');
      ensure(typeof data.approve === 'boolean', 'Choose Approve or Reject.');
      ensure(!(id in room.votes), 'Your vote is already sealed.');
      room.votes[id] = data.approve;
      resolveVotes(room);
      break;
    }
    case 'quest': {
      ensure(
        room.phase === 'quest' && room.team.includes(id),
        'Only quest members may submit a card.',
      );
      ensure(typeof data.success === 'boolean', 'Choose a quest card.');
      ensure(!(id in room.cards), 'Your quest card is already sealed.');
      ensure(
        data.success || (p.role && ROLES[p.role].side === 'evil'),
        'Loyal characters must play Success.',
      );
      room.cards[id] = data.success;
      resolveQuest(room);
      break;
    }
    case 'assassinate': {
      ensure(
        room.phase === 'assassinate' && p.role === 'Assassin',
        'Only the Assassin may make the final choice.',
      );
      const target = room.players.find((player) => player.id === data.target);
      ensure(
        target && target.role && target.id !== id,
        'Choose another player as your target.',
      );
      const hit = target.role === 'Merlin';
      finish(
        room,
        hit ? 'evil' : 'good',
        hit
          ? `${target.name} was Merlin. The Assassin strikes, and evil wins.`
          : `${target.name} was not Merlin. Camelot is saved.`,
      );
      break;
    }
    case 'restart-round': {
      host();
      ensure(
        room.phase !== 'lobby' && room.phase !== 'finished',
        'There is no active round to restart.',
      );
      ensure(
        staleHuman(room, Date.now()),
        'Round recovery becomes available after a player has been disconnected for a while.',
      );
      resetRound(room, 'The host restarted the round after a prolonged disconnect.');
      break;
    }
    case 'remove': {
      host();
      ensure(room.phase === 'lobby', 'Seats cannot be removed during a game.');
      ensure(data.target !== id, 'Use Leave table to leave.');
      ensure(
        room.players.some((player) => player.id === data.target),
        'That player is not at this table.',
      );
      room.players = room.players.filter((player) => player.id !== data.target);
      room.optional = normalizeOptionalForCount(room.players.length, room.optional);
      room.capacity = room.practice ? 5 : 10;
      if (room.leader >= room.players.length) room.leader = 0;
      break;
    }
    case 'leave': {
      ensure(
        room.phase === 'lobby' || room.phase === 'finished',
        'An active seat is reserved so you can reconnect.',
      );
      room.players = room.players.filter((player) => player.id !== id);
      room.optional = normalizeOptionalForCount(room.players.length, room.optional);
      room.capacity = room.practice ? 5 : 10;
      if (room.host === id)
        room.host =
          room.players.find((player) => !player.bot)?.id ?? room.players[0]?.id ?? '';
      if (room.leader >= room.players.length) room.leader = 0;
      break;
    }
    case 'rematch': {
      host();
      ensure(room.phase === 'finished', 'Finish this game first.');
      resetRound(room, 'A new game awaits.');
      break;
    }
    default:
      throw new Error('Unknown action.');
  }
  advance(room);
  room.updated = Date.now();
  room.revision++;
}

function advance(room: Room) {
  if (room.phase === 'reveal' && room.players.every((p) => p.ready)) {
    room.phase = 'team';
    room.phaseEndsAt = undefined;
    room.players.forEach((p) => (p.ready = false));
  }
}

export function tick(room: Room, now = Date.now()) {
  if (!room.phaseEndsAt || now < room.phaseEndsAt) return false;

  if (room.phase === 'vote-result') {
    const proposal = room.history.at(-1);
    room.phaseEndsAt = undefined;
    if (!proposal) return false;
    if (proposal.approved) {
      room.phase = 'quest';
    } else if (room.rejections >= 5) {
      finish(
        room,
        'evil',
        'Five teams were rejected. The kingdom falls to evil.',
      );
    } else {
      nextLeader(room);
      room.team = [];
      room.phase = 'team';
    }
  } else if (room.phase === 'result') {
    room.phaseEndsAt = undefined;
    const good = room.quests.filter((q) => q.success).length;
    const evil = room.quests.length - good;
    if (evil === 3) {
      finish(room, 'evil', 'Three quests were sabotaged. Camelot has fallen.');
    } else if (good === 3) {
      room.phase = 'assassinate';
      room.log.push(
        'Three quests succeeded. The Assassin has one final chance.',
      );
    } else {
      room.round++;
      nextLeader(room);
      room.team = [];
      room.phase = 'team';
    }
  } else {
    room.phaseEndsAt = undefined;
    return false;
  }

  room.updated = now;
  room.revision++;
  return true;
}

export function recoverOfflineHost(room: Room, now = Date.now()) {
  const host = room.players.find((p) => p.id === room.host);
  if (!host || host.bot) return false;
  const grace = room.phase === 'lobby' ? HOST_RECOVERY_GRACE_MS : ACTIVE_RECOVERY_GRACE_MS;
  if (now - host.seen < grace) return false;

  const next = room.players.find(
    (p) => p.id !== host.id && !p.bot && now - p.seen < ONLINE_WINDOW_MS,
  );
  if (!next) return false;

  room.host = next.id;
  room.log.push(`${next.name} became table host after the previous host disconnected.`);
  room.updated = now;
  room.revision++;
  return true;
}

export function recoverOfflineLeader(room: Room, now = Date.now()) {
  if (room.phase !== 'team' || room.players.length < 2) return false;
  const leader = room.players[room.leader];
  if (!leader || leader.bot || now - leader.seen < ACTIVE_RECOVERY_GRACE_MS)
    return false;

  for (let offset = 1; offset < room.players.length; offset++) {
    const index = (room.leader + offset) % room.players.length;
    const candidate = room.players[index];
    if (candidate.bot || now - candidate.seen < ONLINE_WINDOW_MS) {
      room.leader = index;
      room.team = [];
      room.log.push(`Leadership passed after ${leader.name} remained disconnected.`);
      room.updated = now;
      room.revision++;
      return true;
    }
  }
  return false;
}

export function addPracticePlayers(room: Room) {
  ensure(room.practice, 'Not a practice room.');
  for (const name of ['Guinevere', 'Gawain', 'Tristan', 'Isolde']) {
    const p = makePlayer(name, '', true);
    p.ready = true;
    room.players.push(p);
  }
}

export function botStep(room: Room) {
  if (!room.practice) return;
  const bots = room.players.filter((p) => p.bot);
  const leader = room.players[room.leader];
  if (room.phase === 'team' && leader.bot) {
    act(room, leader.id, 'propose', {
      team: shuffle(room.players.map((p) => p.id)).slice(
        0,
        TEAM_SIZES[room.players.length][room.round],
      ),
    });
    return;
  }
  if (room.phase === 'vote') {
    const bot = bots.find((p) => !(p.id in room.votes));
    if (bot) act(room, bot.id, 'vote', { approve: randomInt(10) < 8 });
    return;
  }
  if (room.phase === 'quest') {
    const bot = bots.find(
      (p) => room.team.includes(p.id) && !(p.id in room.cards),
    );
    if (bot)
      act(room, bot.id, 'quest', {
        success: ROLES[bot.role!].side === 'good' || randomInt(10) < 2,
      });
    return;
  }
  if (room.phase === 'assassinate') {
    const bot = bots.find((p) => p.role === 'Assassin');
    if (bot) {
      const targets = room.players.filter(
        (p) => p.role && ROLES[p.role].side === 'good',
      );
      act(room, bot.id, 'assassinate', {
        target: targets[randomInt(targets.length)].id,
      });
    }
  }
}

export function publicView(room: Room, id: string) {
  const me = room.players.find((p) => p.id === id);
  ensure(me, 'Your seat could not be found.');
  const now = Date.now();
  const canRestartRound =
    room.host === id &&
    room.phase !== 'lobby' &&
    room.phase !== 'finished' &&
    staleHuman(room, now);
  return {
    code: room.code,
    host: room.host,
    phase: room.phase,
    optional: room.optional,
    capacity: room.practice ? 5 : 10,
    practice: room.practice,
    leader: room.players[room.leader]?.id,
    round: room.round,
    rejections: room.rejections,
    team: room.team,
    quests: room.quests,
    history: room.history,
    log: room.log.slice(-30),
    winner: room.winner,
    reason: room.reason,
    phaseEndsAt: room.phaseEndsAt,
    revision: room.revision,
    recovery: { canRestartRound },
    teamSizes: TEAM_SIZES[room.players.length] ?? TEAM_SIZES[5],
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      ready: p.ready,
      bot: p.bot,
      online: p.bot || now - p.seen < ONLINE_WINDOW_MS,
      ...(room.phase === 'finished' ? { role: p.role } : {}),
    })),
    me: {
      id: me.id,
      role: me.role,
      knowledge: knowledge(room, me),
      voted: me.id in room.votes,
      quested: me.id in room.cards,
    },
    submitted:
      room.phase === 'vote'
        ? Object.keys(room.votes).length
        : room.phase === 'quest'
          ? Object.keys(room.cards).length
          : room.players.filter((p) => p.ready).length,
  };
}

export type RoomView = ReturnType<typeof publicView>;
