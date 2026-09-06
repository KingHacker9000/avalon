import test from 'node:test';
import assert from 'node:assert/strict';
import {
  act,
  createRoom,
  makePlayer,
  publicView,
  deckFor,
  knowledge,
  addPracticePlayers,
  botStep,
  joinRoom,
  type Room,
} from '../lib/game/engine.ts';
import { ROLES, TEAM_SIZES, EVIL_COUNT, type Role } from '../lib/game/roles.ts';
function fixture(n = 5): Room {
  const p = makePlayer('Player 1', 'secret1');
  const r = createRoom('ABC234', p);
  r.capacity = n;
  for (let i = 1; i < n; i++)
    r.players.push(makePlayer(`Player ${i + 1}`, `secret${i + 1}`));
  return r;
}
function start(r: Room) {
  r.players.forEach((p) => act(r, p.id, 'ready'));
  act(r, r.host, 'start');
  r.players.forEach((p) => act(r, p.id, 'ready'));
  return r;
}
function proposal(
  r: Room,
  team = r.players
    .slice(0, TEAM_SIZES[r.players.length][r.round])
    .map((p) => p.id),
) {
  act(r, r.players[r.leader].id, 'propose', { team });
}
function approve(r: Room) {
  for (const p of r.players) act(r, p.id, 'vote', { approve: true });
}
function quest(r: Room, fails = 0) {
  proposal(r);
  approve(r);
  r.team.forEach((id, i) => {
    if (i < fails) r.players.find((p) => p.id === id)!.role = 'Minion';
    act(r, id, 'quest', { success: i >= fails });
  });
}
function continueResult(r: Room) {
  r.players.forEach((p) => act(r, p.id, 'ready'));
}

void test('every player count has the correct allegiance split and five quests', () => {
  for (let n = 5; n <= 10; n++) {
    const deck = deckFor(n, ['Percival', 'Morgana']);
    assert.equal(deck.length, n);
    assert.equal(
      deck.filter((r) => ROLES[r].side === 'evil').length,
      EVIL_COUNT[n],
    );
    assert.equal(TEAM_SIZES[n].length, 5);
    assert.equal(deck.filter((r) => r === 'Merlin').length, 1);
    assert.equal(deck.filter((r) => r === 'Assassin').length, 1);
  }
});
void test('invalid and overfilled role sets are rejected', () => {
  assert.throws(() => deckFor(5, ['Morgana', 'Mordred']), /Too many/);
  assert.throws(() => deckFor(5, ['Morgana', 'Morgana']), /Invalid/);
  assert.throws(() => deckFor(5, ['Fake' as Role]), /Invalid/);
  assert.throws(() => deckFor(4, []), /5–10/);
});
void test('non-hosts cannot configure, start, remove, or rematch', () => {
  const r = fixture();
  for (const action of ['configure', 'start', 'remove', 'rematch'])
    assert.throws(
      () => act(r, r.players[1].id, action, { capacity: 5, optional: [] }),
      /Only the host/,
    );
});
void test('room names, capacity and midgame joins are validated', () => {
  assert.throws(() => makePlayer('', 'x'));
  assert.throws(() => makePlayer('a'.repeat(21), 'x'));
  const r = fixture();
  assert.throws(() => joinRoom(r, makePlayer('Sixth', 'x')), /full/);
  start(r);
  assert.throws(() => joinRoom(r, makePlayer('Late', 'x')), /already started/);
});
void test('start requires five players and all players ready', () => {
  const r = fixture();
  assert.throws(() => act(r, r.host, 'start'), /everyone/);
  r.players = r.players.slice(0, 4);
  assert.throws(() => act(r, r.host, 'start'), /5 players/);
});
void test('roles are hidden publicly but available privately after dealing', () => {
  const r = start(fixture());
  const view = publicView(r, r.players[0].id);
  assert.equal(view.me.role, r.players[0].role);
  assert.ok(view.players.every((p) => !('role' in p) && !('tokenHash' in p)));
  assert.ok(!JSON.stringify(view).includes('secret1'));
  assert.ok(!('cards' in view));
  assert.ok(!('votes' in view));
});
void test('Merlin cannot see Mordred but can see Oberon', () => {
  const r = fixture(7);
  const roles: Role[] = [
    'Merlin',
    'Percival',
    'Servant',
    'Mordred',
    'Oberon',
    'Assassin',
    'Morgana',
  ];
  r.players.forEach((p, i) => (p.role = roles[i]));
  assert.deepEqual(
    knowledge(r, r.players[0]).map((k) => k.id),
    [4, 5, 6].map((i) => r.players[i].id),
  );
});
void test('Percival sees Merlin and Morgana identically; evil does not see Oberon', () => {
  const r = fixture(7);
  const roles: Role[] = [
    'Merlin',
    'Percival',
    'Servant',
    'Mordred',
    'Oberon',
    'Assassin',
    'Morgana',
  ];
  r.players.forEach((p, i) => (p.role = roles[i]));
  assert.deepEqual(
    knowledge(r, r.players[1]).map((k) => k.label),
    ['Merlin or Morgana', 'Merlin or Morgana'],
  );
  assert.deepEqual(knowledge(r, r.players[4]), []);
  assert.deepEqual(
    knowledge(r, r.players[5]).map((k) => k.id),
    [3, 6].map((i) => r.players[i].id),
  );
  assert.deepEqual(knowledge(r, r.players[2]), []);
});
void test('proposals must come from leader and contain exact unique valid players', () => {
  const r = start(fixture());
  assert.throws(
    () => act(r, r.players[(r.leader + 1) % 5].id, 'propose', { team: [] }),
    /leader/,
  );
  assert.throws(() => proposal(r, [r.players[0].id]), /exact/);
  assert.throws(
    () => proposal(r, [r.players[0].id, r.players[0].id]),
    /distinct/,
  );
  assert.throws(() => proposal(r, ['x', 'y']), /distinct/);
});
void test('votes are sealed, immutable, and reveal only after all players vote', () => {
  const r = start(fixture());
  proposal(r);
  act(r, r.players[0].id, 'vote', { approve: true });
  assert.equal(r.history.length, 0);
  const view = publicView(r, r.players[1].id);
  assert.equal(view.submitted, 1);
  assert.equal(view.me.voted, false);
  assert.ok(!('votes' in view));
  assert.throws(
    () => act(r, r.players[0].id, 'vote', { approve: false }),
    /already sealed/,
  );
  for (const p of r.players.slice(1)) act(r, p.id, 'vote', { approve: true });
  assert.equal(r.history.length, 1);
  assert.equal(r.phase, 'quest');
  assert.equal(r.history[0].votes[r.players[0].id], true);
});
void test('a tie rejects the team and rotates leadership', () => {
  const r = start(fixture(6));
  const old = r.leader;
  proposal(r);
  r.players.forEach((p, i) => act(r, p.id, 'vote', { approve: i < 3 }));
  assert.equal(r.phase, 'team');
  assert.equal(r.rejections, 1);
  assert.equal(r.leader, (old + 1) % 6);
});
void test('five consecutive rejected teams give evil victory', () => {
  const r = start(fixture());
  for (let i = 0; i < 5; i++) {
    proposal(r);
    r.players.forEach((p) => act(r, p.id, 'vote', { approve: false }));
  }
  assert.equal(r.phase, 'finished');
  assert.equal(r.winner, 'evil');
});
void test('approval resets rejection count', () => {
  const r = start(fixture());
  proposal(r);
  r.players.forEach((p) => act(r, p.id, 'vote', { approve: false }));
  proposal(r);
  approve(r);
  assert.equal(r.rejections, 0);
});
void test('only team members submit; good cannot fail; duplicate cards rejected', () => {
  const r = start(fixture());
  proposal(r);
  approve(r);
  r.players[0].role = 'Servant';
  assert.throws(
    () => act(r, r.players[0].id, 'quest', { success: false }),
    /Loyal/,
  );
  assert.throws(
    () => act(r, r.players[4].id, 'quest', { success: true }),
    /Only quest/,
  );
  act(r, r.players[0].id, 'quest', { success: true });
  assert.throws(
    () => act(r, r.players[0].id, 'quest', { success: true }),
    /already sealed/,
  );
});
void test('individual quest choices are never published, even at game end', () => {
  const r = start(fixture());
  quest(r, 1);
  assert.equal(r.quests[0].success, false);
  assert.equal(r.quests[0].fails, 1);
  assert.deepEqual(r.cards, {});
  assert.deepEqual(
    Object.keys(publicView(r, r.players[0].id).quests[0]).sort(),
    ['fails', 'success', 'team'],
  );
  r.phase = 'finished';
  assert.ok(!('cards' in publicView(r, r.host)));
});
void test('fourth quest needs two fails at seven or more, one at six', () => {
  for (const n of [6, 7, 8, 9, 10]) {
    for (const fails of [1, 2]) {
      const r = start(fixture(n));
      r.round = 3;
      quest(r, fails);
      assert.equal(r.quests[0].success, n >= 7 && fails === 1);
    }
  }
});
void test('three failed quests finish the game after everyone sees the result', () => {
  const r = start(fixture());
  for (let i = 0; i < 3; i++) {
    quest(r, 1);
    assert.equal(r.phase, 'result');
    continueResult(r);
  }
  assert.equal(r.phase, 'finished');
  assert.equal(r.winner, 'evil');
});
void test('three successes enter assassination and only the Assassin chooses', () => {
  const r = start(fixture());
  for (let i = 0; i < 3; i++) {
    quest(r);
    continueResult(r);
  }
  assert.equal(r.phase, 'assassinate');
  const assassin = r.players.find((p) => p.role === 'Assassin')!;
  const merlin = r.players.find((p) => p.role === 'Merlin')!;
  assert.throws(
    () => act(r, merlin.id, 'assassinate', { target: assassin.id }),
    /Only the Assassin/,
  );
  act(r, assassin.id, 'assassinate', { target: merlin.id });
  assert.equal(r.winner, 'evil');
  assert.ok(publicView(r, r.host).players.every((p) => p.role));
});
void test('a missed assassination awards good the win, rematch clears secrets', () => {
  const r = start(fixture());
  r.phase = 'assassinate';
  const assassin = r.players.find((p) => p.role === 'Assassin')!;
  const innocent = r.players.find((p) => p.role === 'Servant')!;
  act(r, assassin.id, 'assassinate', { target: innocent.id });
  assert.equal(r.winner, 'good');
  act(r, r.host, 'rematch');
  assert.equal(r.phase, 'lobby');
  assert.ok(r.players.every((p) => !p.role && !p.ready));
  assert.deepEqual(r.quests, []);
  assert.deepEqual(publicView(r, r.host).me.knowledge, []);
});
void test('lobby host departure transfers host; active seats cannot be lost', () => {
  const r = fixture();
  const next = r.players[1].id;
  act(r, r.host, 'leave');
  assert.equal(r.host, next);
  const active = start(fixture());
  assert.throws(() => act(active, active.host, 'leave'), /reserved/);
});
void test('practice bots advance only their own decisions', () => {
  const r = createRoom('TEST23', makePlayer('You', 'secret'), true);
  addPracticePlayers(r);
  assert.equal(r.players.length, 5);
  act(r, r.host, 'ready');
  act(r, r.host, 'start');
  act(r, r.host, 'ready');
  r.leader = 0;
  botStep(r);
  assert.equal(r.phase, 'team');
  r.leader = 1;
  botStep(r);
  assert.equal(r.phase, 'vote');
  for (let i = 0; i < 8; i++) botStep(r);
  assert.equal(Object.keys(r.votes).length, 4);
  assert.equal(r.phase, 'vote');
  assert.equal(publicView(r, r.host).me.voted, false);
});
