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
  type Player,
  type Room,
} from './engine.ts';
const root = resolve(process.env.AVALON_DATA_DIR || '.data');
mkdirSync(root, { recursive: true, mode: 0o700 });
const db = new DatabaseSync(resolve(root, 'avalon.sqlite'));
db.exec(
  'PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS rooms(code TEXT PRIMARY KEY, state TEXT NOT NULL, updated INTEGER NOT NULL);',
);
const ttl = 24 * 60 * 60 * 1000;
const publicAvatarCount = 12;
function hash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
function token() {
  return randomBytes(32).toString('hex');
}
function get(code: string): Room {
  const row = db
    .prepare('SELECT state, updated FROM rooms WHERE code=?')
    .get(code);
  ensure(
    row && Number(row.updated) > Date.now() - ttl,
    'This room could not be found or has expired.',
  );
  return JSON.parse(row.state as string);
}
function save(room: Room) {
  db.prepare(
    'INSERT INTO rooms VALUES(?,?,?) ON CONFLICT(code) DO UPDATE SET state=excluded.state,updated=excluded.updated',
  ).run(room.code, JSON.stringify(room), room.updated);
}
function chooseUnusedAvatar(players: Player[], ignoreId = '') {
  const used = new Set(
    players.filter((p) => p.id !== ignoreId).map((p) => p.avatar),
  );
  const choices = Array.from({ length: publicAvatarCount }, (_, i) => i).filter(
    (avatar) => !used.has(avatar),
  );
  return choices.length ? choices[randomInt(choices.length)] : randomInt(publicAvatarCount);
}
function makeAvatarsDistinct(players: Player[]) {
  const used = new Set<number>();
  for (const player of players) {
    if (player.avatar < publicAvatarCount && !used.has(player.avatar)) {
      used.add(player.avatar);
      continue;
    }
    player.avatar = chooseUnusedAvatar(
      players.filter((candidate) => candidate.id === player.id || used.has(candidate.avatar)),
      player.id,
    );
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
      const room = createRoom(code, player, action === 'practice');
      if (room.practice) {
        addPracticePlayers(room);
        makeAvatarsDistinct(room.players);
      }
      save(room);
      output = { token: secret, room: publicView(room, player.id) };
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
        room.updated = Date.now();
        room.revision++;
        save(room);
        output = { token: secret, room: publicView(room, player.id) };
      } else {
        ensure(
          /^[a-f0-9]{64}$/.test(bearer),
          'Reconnect using the browser where you joined this room.',
        );
        const player = room.players.find((p) => p.tokenHash === hash(bearer));
        ensure(player, 'This seat is no longer available.');
        player.seen = Date.now();
        if (action === 'avatar') {
          ensure(room.phase === 'lobby', 'Public avatars are locked after the game starts.');
          const avatar = Number(input.avatar);
          ensure(
            Number.isInteger(avatar) && avatar >= 0 && avatar < publicAvatarCount,
            'Choose one of the available public avatars.',
          );
          ensure(
            !room.players.some((p) => p.id !== player.id && p.avatar === avatar),
            'That public avatar is already taken. Choose another.',
          );
          player.avatar = avatar;
          room.updated = Date.now();
          room.revision++;
        } else if (action === 'poll') {
          botStep(room);
          room.updated = Date.now();
        } else act(room, player.id, action, input);
        save(room);
        output =
          action === 'leave'
            ? { left: true }
            : { room: publicView(room, player.id) };
      }
    }
    db.exec('COMMIT');
    return output;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
