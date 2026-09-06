import assert from 'node:assert/strict';

const base = process.env.AVALON_TEST_URL || 'http://localhost:4173';

async function api(action, data = {}, session, expected = 200) {
  const r = await fetch(`${base}/api/game`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: base,
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: JSON.stringify({ ...data, code: session?.code ?? data.code, action }),
  });
  const text = await r.text();
  assert.equal(r.status, expected, `${action}: ${text.slice(0, 250)}`);
  assert.equal(r.headers.get('cache-control'), 'no-store, private');
  return JSON.parse(text);
}

async function waitForPhase(session, wanted, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  let latest;
  while (Date.now() < deadline) {
    latest = await api('poll', {}, session);
    if (wanted.includes(latest.room.phase)) return latest;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.fail(
    `Timed out waiting for ${wanted.join(' or ')}; last phase was ${latest?.room?.phase}`,
  );
}

const created = await api('create', { name: 'QA Host' });
const code = created.room.code;
const sessions = [{ code, token: created.token, id: created.room.me.id }];
for (let i = 1; i < 5; i++) {
  const joined = await api('join', { name: `QA ${i}`, code });
  sessions.push({ code, token: joined.token, id: joined.room.me.id });
}

await api('poll', {}, { code, token: 'a'.repeat(64) }, 400);
await api('configure', { capacity: 5, optional: [] }, sessions[1], 400);
await Promise.all(sessions.map((s) => api('ready', {}, s)));
let r = await api('start', {}, sessions[0]);
assert.equal(r.room.phase, 'reveal');

const roles = await Promise.all(sessions.map((s) => api('poll', {}, s)));
roles.forEach((result, i) => {
  sessions[i].role = result.room.me.role;
  assert.ok(result.room.players.every((p) => !('role' in p) && !('tokenHash' in p)));
  assert.ok(!JSON.stringify(result).includes(sessions[i].token));
});

await Promise.all(sessions.map((s) => api('ready', {}, s)));
for (let round = 0; round < 3; round++) {
  r = await api('poll', {}, sessions[0]);
  assert.equal(r.room.phase, 'team');
  const team = sessions.slice(0, r.room.teamSizes[round]);
  const leader = sessions.find((s) => s.id === r.room.leader);
  await api('propose', { team: team.map((s) => s.id) }, leader);

  await api('vote', { approve: true }, sessions[0]);
  const sealed = await api('poll', {}, sessions[1]);
  assert.equal(sealed.room.submitted, 1);
  assert.ok(!('votes' in sealed.room));
  await api('vote', { approve: false }, sessions[0], 400);
  await Promise.all(
    sessions.slice(1).map((s) => api('vote', { approve: true }, s)),
  );

  r = await api('poll', {}, sessions[0]);
  assert.equal(r.room.phase, 'vote-result');
  assert.ok(r.room.phaseEndsAt);
  assert.equal(r.room.history.at(-1).approved, true);
  assert.equal(Object.keys(r.room.history.at(-1).votes).length, 5);

  r = await waitForPhase(sessions[0], ['quest']);
  const nonmember = sessions.find((s) => !team.includes(s));
  await api('quest', { success: true }, nonmember, 400);
  await Promise.all(team.map((s) => api('quest', { success: true }, s)));

  r = await api('poll', {}, sessions[0]);
  assert.equal(r.room.phase, 'result');
  assert.equal(r.room.quests[round].success, true);
  assert.ok(r.room.phaseEndsAt);
  assert.ok(!('cards' in r.room));

  if (round < 2) {
    r = await waitForPhase(sessions[0], ['team']);
    assert.equal(r.room.round, round + 1);
  }
}

r = await waitForPhase(sessions[0], ['assassinate']);
const assassin = sessions.find((s) => s.role === 'Assassin');
const target = sessions.find((s) => s.role === 'Servant');
await api('assassinate', { target: target.id }, assassin);
r = await api('poll', {}, sessions[0]);
assert.equal(r.room.winner, 'good');
assert.ok(r.room.players.every((p) => p.role));

await api('rematch', {}, sessions[0]);
r = await api('poll', {}, sessions[1]);
assert.equal(r.room.me.role, undefined);
assert.deepEqual(r.room.history, []);

const forbidden = await fetch(`${base}/api/game`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Origin: 'https://other.example',
  },
  body: '{}',
});
assert.equal(forbidden.status, 403);

const large = await fetch(`${base}/api/game`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: 'a'.repeat(9000) }),
});
assert.equal(large.status, 413);

for (const s of sessions) await api('leave', {}, s);
const practice = await api('practice', { name: 'Practice QA' });
assert.equal(practice.room.players.length, 5);
assert.equal(practice.room.players.filter((p) => p.bot).length, 4);
await api('leave', {}, { code: practice.room.code, token: practice.token });

console.log(
  'PASS: five independent clients completed a full timed-reveal game with concurrent votes/cards, secrecy, authorization, rematch, practice, cross-origin and size checks.',
);
