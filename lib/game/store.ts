import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import {
  act,
  addPracticePlayers,
  botStep,
  createRoom,
  ensure,
  joinRoom,
  makePlayer,
  publicView,
  recoverOfflineHost,
  recoverOfflineLeader,
  tick,
  PUBLIC_AVATAR_COUNT,
  type Player,
  type Room,
} from './engine.ts';
import { ROLES } from './roles.ts';

const root = resolve(process.env.AVALON_DATA_DIR || '.data');
mkdirSync(root, { recursive: true, mode: 0o700 });
const db = new DatabaseSync(resolve(root, 'avalon.sqlite'));
db.exec(
  'PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS rooms(code TEXT PRIMARY KEY, state TEXT NOT NULL, updated INTEGER NOT NULL);',
);

const ttl = 24 * 60 * 60 * 1000;
const LADY_RESULT_MS = 5_200;

type LadyCheck = {
  examiner: string;
  target: string;
  loyalty: 'good' | 'evil';
  quest: number;
};

type LadyState = {
  enabled?: boolean;
  holder?: string;
  usedBy?: string[];
  checks?: LadyCheck[];
  pending?: boolean;
  resultUntil?: number;
};

type AvalonRoom = Room & {
  optionalRules?: {
    ladyOfLake?: LadyState;
  };
};

function hash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function token() {
  return randomBytes(32).toString('hex');
}

function get(code: string): AvalonRoom {
  const row = db
    .prepare('SELECT state, updated FROM rooms WHERE code=?')
    .get(code);
  ensure(
    row && Number(row.updated) > Date.now() - ttl,
    'This room could not be found or has expired.',
  );
  return JSON.parse(row.state as string) as AvalonRoom;
}

function save(room: Room) {
  db.prepare(
    'INSERT INTO rooms VALUES(?,?,?) ON CONFLICT(code) DO UPDATE SET state=excluded.state,updated=excluded.updated',
  ).run(room.code, JSON.stringify(room), room.updated);
}

function ladyState(room: AvalonRoom) {
  room.optionalRules ??= {};
  room.optionalRules.ladyOfLake ??= {};
  return room.optionalRules.ladyOfLake;
}

function clearLadyRound(room: AvalonRoom) {
  const lady = ladyState(room);
  lady.holder = undefined;
  lady.usedBy = [];
  lady.checks = [];
  lady.pending = false;
  lady.resultUntil = undefined;
}

function normalizeLadyAvailability(room: AvalonRoom) {
  const lady = ladyState(room);
  if (room.players.length < 7 || room.practice) {
    lady.enabled = false;
    clearLadyRound(room);
  }
}

function initializeLady(room: AvalonRoom) {
  const lady = ladyState(room);
  clearLadyRound(room);
  if (!lady.enabled || room.players.length < 7 || room.practice) return;
  lady.holder = room.players[(room.leader + 1) % room.players.length]?.id;
  const holder = room.players.find((player) => player.id === lady.holder);
  if (holder)
    room.log.push(`${holder.name} begins with the Lady of the Lake.`);
}

function questScore(room: Room) {
  const good = room.quests.filter((quest) => quest.success).length;
  return { good, evil: room.quests.length - good };
}

function shouldUseLady(room: AvalonRoom) {
  const lady = ladyState(room);
  const { evil } = questScore(room);
  return (
    Boolean(lady.enabled) &&
    evil < 3 &&
    [2, 3, 4].includes(room.round + 1) &&
    Boolean(lady.holder) &&
    (lady.usedBy?.length ?? 0) < 3 &&
    !(lady.checks ?? []).some((check) => check.quest === room.round + 1)
  );
}

function advanceTimedState(room: AvalonRoom, now: number) {
  const lady = ladyState(room);
  if (lady.resultUntil) {
    if (now < lady.resultUntil) return;
    lady.resultUntil = undefined;
    room.phaseEndsAt = now - 1;
    tick(room, now);
    return;
  }
  if (lady.pending) return;
  if (
    room.phase === 'result' &&
    room.phaseEndsAt &&
    now >= room.phaseEndsAt &&
    shouldUseLady(room)
  ) {
    room.phaseEndsAt = undefined;
    lady.pending = true;
    const holder = room.players.find((player) => player.id === lady.holder);
    if (holder)
      room.log.push(`${holder.name} may examine one player's loyalty.`);
    return;
  }
  tick(room, now);
}

function performLadyCheck(room: AvalonRoom, player: Player, targetId: unknown) {
  const lady = ladyState(room);
  ensure(lady.enabled && lady.pending, 'The Lady of the Lake is not active now.');
  ensure(lady.holder === player.id, 'Only the Lady of the Lake holder may examine loyalty.');
  ensure(typeof targetId === 'string', 'Choose a player to examine.');
  const target = room.players.find((candidate) => candidate.id === targetId);
  ensure(target && target.id !== player.id && target.role, 'Choose another player to examine.');
  ensure(
    !(lady.usedBy ?? []).includes(target.id),
    'A player who has already used the Lady of the Lake cannot be examined.',
  );
  const loyalty = ROLES[target.role].side;
  lady.usedBy ??= [];
  lady.checks ??= [];
  lady.checks.push({
    examiner: player.id,
    target: target.id,
    loyalty,
    quest: room.round + 1,
  });
  lady.usedBy.push(player.id);
  lady.holder = target.id;
  lady.pending = false;
  lady.resultUntil = Date.now() + LADY_RESULT_MS;
  room.phaseEndsAt = undefined;
  room.log.push(
    `${player.name} examined ${target.name} with the Lady of the Lake.`,
  );
}

function pendingPlayers(room: AvalonRoom) {
  const lady = ladyState(room);
  if (lady.pending) return lady.holder ? [lady.holder] : [];
  if (lady.resultUntil) return [];
  if (room.phase === 'reveal')
    return room.players.filter((player) => !player.ready).map((player) => player.id);
  if (room.phase === 'team')
    return room.players[room.leader] ? [room.players[room.leader].id] : [];
  if (room.phase === 'vote')
    return room.players
      .filter((player) => !(player.id in room.votes))
      .map((player) => player.id);
  if (room.phase === 'quest')
    return room.team.filter((id) => !(id in room.cards));
  if (room.phase === 'assassinate') {
    const assassin = room.players.find((player) => player.role === 'Assassin');
    return assassin ? [assassin.id] : [];
  }
  return [];
}

function enhancedView(room: AvalonRoom, id: string) {
  const base = publicView(room, id);
  const lady = ladyState(room);
  const checks = lady.checks ?? [];
  const lastPrivateCheck = [...checks]
    .reverse()
    .find((check) => check.examiner === id);
  return {
    ...base,
    pending: pendingPlayers(room),
    lady: {
      enabled: Boolean(lady.enabled),
      holder: lady.holder,
      usedBy: [...(lady.usedBy ?? [])],
      checks: checks.map(({ examiner, target, quest }) => ({
        examiner,
        target,
        quest,
      })),
      pending: Boolean(lady.pending),
      resultUntil: lady.resultUntil,
    },
    me: {
      ...base.me,
      ladyResult: lastPrivateCheck
        ? {
            target: lastPrivateCheck.target,
            loyalty: lastPrivateCheck.loyalty,
            quest: lastPrivateCheck.quest,
          }
        : undefined,
    },
  };
}

function chooseUnusedAvatar(players: Player[], ignoreId = '') {
  const used = new Set(
    players.filter((p) => p.id !== ignoreId).map((p) => p.avatar),
  );
  const choices = Array.from({ length: PUBLIC_AVATAR_COUNT }, (_, i) => i).filter(
    (avatar) => !used.has(avatar),
  );
  return choices.length
    ? choices[randomInt(choices.length)]
    : randomInt(PUBLIC_AVATAR_COUNT);
}

function makeAvatarsDistinct(players: Player[]) {
  const used = new Set<number>();
  for (const player of players) {
    if (
      player.avatar >= 0 &&
      player.avatar < PUBLIC_AVATAR_COUNT &&
      !used.has(player.avatar)
    ) {
      used.add(player.avatar);
      continue;
    }
    const choices = Array.from({ length: PUBLIC_AVATAR_COUNT }, (_, i) => i).filter(
      (avatar) => !used.has(avatar),
    );
    player.avatar = choices[randomInt(choices.length)];
    used.add(player.avatar);
  }
}

// Synchronous transactions serialize decisions across simultaneous requests.
export function execute(input: Record<string, unknown>, bearer: string) {
  db.exec('BEGIN IMMEDIATE');
  try {
    let output;
    const action = input.action;
    ensure(typeof action === 'string', 'Choose a game action.');

    if (action === 'create' || action === 'practice') {
      db.prepare('DELETE FROM rooms WHERE updated < ?').run(Date.now() - ttl);
      const count = db.prepare('SELECT count(*) AS n FROM rooms').get()!;
      ensure(Number(count.n) < 500, 'The server is full. Try again later.');

      const secret = token();
      const player = makePlayer(input.name, hash(secret));
      let code = '';
      for (let attempt = 0; attempt < 30; attempt++) {
        code = Array.from(
          { length: 6 },
          () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)],
        ).join('');
        if (!db.prepare('SELECT code FROM rooms WHERE code=?').get(code)) break;
        code = '';
      }
      ensure(code, 'Could not create a room. Please try again.');

      const room = createRoom(code, player, action === 'practice') as AvalonRoom;
      if (room.practice) {
        addPracticePlayers(room);
        makeAvatarsDistinct(room.players);
      }
      normalizeLadyAvailability(room);
      save(room);
      output = { token: secret, room: enhancedView(room, player.id) };
    } else {
      ensure(
        typeof input.code === 'string' && /^[A-Z2-9]{6}$/.test(input.code),
        'Enter a six-character room code.',
      );
      const room = get(input.code);

      if (action === 'join') {
        const secret = token();
        const player = makePlayer(input.name, hash(secret));
        player.avatar = chooseUnusedAvatar(room.players);
        joinRoom(room, player);
        normalizeLadyAvailability(room);
        room.updated = Date.now();
        room.revision++;
        save(room);
        output = { token: secret, room: enhancedView(room, player.id) };
      } else {
        ensure(
          /^[a-f0-9]{64}$/.test(bearer),
          'Reconnect using the browser where you joined this room.',
        );
        const player = room.players.find((p) => p.tokenHash === hash(bearer));
        ensure(player, 'This seat is no longer available.');

        const now = Date.now();
        player.seen = now;
        recoverOfflineHost(room, now);
        recoverOfflineLeader(room, now);

        if (action === 'avatar') {
          ensure(
            room.phase === 'lobby',
            'Public avatars are locked after the game starts.',
          );
          const avatar = Number(input.avatar);
          ensure(
            Number.isInteger(avatar) &&
              avatar >= 0 &&
              avatar < PUBLIC_AVATAR_COUNT,
            'Choose one of the available public avatars.',
          );
          ensure(
            !room.players.some((p) => p.id !== player.id && p.avatar === avatar),
            'That public avatar is already taken. Choose another.',
          );
          player.avatar = avatar;
          room.updated = now;
          room.revision++;
        } else if (action === 'poll') {
          // Bots act before a timed reveal advances so humans receive at least one
          // rendered frame of the new phase before a bot can act in it.
          botStep(room);
          advanceTimedState(room, now);
          room.updated = now;
        } else if (action === 'lady') {
          performLadyCheck(room, player, input.target);
          room.updated = now;
          room.revision++;
        } else {
          act(room, player.id, action, input);
          if (action === 'configure') {
            const lady = ladyState(room);
            if ('ladyOfLake' in input) {
              ensure(
                typeof input.ladyOfLake === 'boolean',
                'Choose whether to use the Lady of the Lake.',
              );
              lady.enabled =
                room.players.length >= 7 &&
                !room.practice &&
                input.ladyOfLake;
              if (!lady.enabled) clearLadyRound(room);
            }
            normalizeLadyAvailability(room);
          } else if (action === 'start') {
            initializeLady(room);
          } else if (action === 'rematch' || action === 'restart-round') {
            clearLadyRound(room);
          } else if (action === 'remove' || action === 'leave') {
            normalizeLadyAvailability(room);
          }
        }

        save(room);
        output =
          action === 'leave'
            ? { left: true }
            : { room: enhancedView(room, player.id) };
      }
    }

    db.exec('COMMIT');
    return output;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
