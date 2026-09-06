import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

void test('rooms survive a full process restart, tokens remain valid, fake tokens fail', () => {
  const dir = mkdtempSync(join(tmpdir(), 'avalon-persistence-'));
  const moduleUrl = new URL('../lib/game/store.ts', import.meta.url).href;
  const run = (source: string) => {
    const r = spawnSync(
      process.execPath,
      ['--experimental-strip-types', '--input-type=module', '-e', source],
      {
        cwd: resolve('.'),
        env: { ...process.env, AVALON_DATA_DIR: dir },
        encoding: 'utf8',
      },
    );
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(r.stdout);
  };
  try {
    const created = run(
      `import {execute} from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(execute({action:'create',name:'Persistent Host'},'')));`,
    );
    const avatarChanged = run(
      `import {execute} from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(execute({action:'avatar',code:${JSON.stringify(created.room.code)},avatar:11},${JSON.stringify(created.token)})));`,
    );
    assert.equal(
      avatarChanged.room.players.find((p: { id: string }) => p.id === created.room.me.id)
        .avatar,
      11,
    );

    const joined = run(
      `import {execute} from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(execute({action:'join',name:'Distinct Guest',code:${JSON.stringify(created.room.code)}},'')));`,
    );
    const joinedHost = joined.room.players.find(
      (p: { id: string }) => p.id === created.room.me.id,
    );
    const joinedGuest = joined.room.players.find(
      (p: { id: string }) => p.id === joined.room.me.id,
    );
    assert.notEqual(joinedHost.avatar, joinedGuest.avatar);

    const duplicateRejected = run(
      `import {execute} from ${JSON.stringify(moduleUrl)}; try{execute({action:'avatar',code:${JSON.stringify(created.room.code)},avatar:11},${JSON.stringify(joined.token)});console.log('false')}catch{console.log('true')}`,
    );
    assert.equal(duplicateRejected, true);

    const resumed = run(
      `import {execute} from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(execute({action:'poll',code:${JSON.stringify(created.room.code)}},${JSON.stringify(created.token)})));`,
    );
    assert.equal(resumed.room.me.id, created.room.me.id);
    assert.equal(resumed.room.code, created.room.code);
    assert.equal(
      resumed.room.players.find((p: { id: string }) => p.id === created.room.me.id)
        .avatar,
      11,
    );
    const invalidAvatar = run(
      `import {execute} from ${JSON.stringify(moduleUrl)}; try{execute({action:'avatar',code:${JSON.stringify(created.room.code)},avatar:99},${JSON.stringify(created.token)});console.log('false')}catch{console.log('true')}`,
    );
    assert.equal(invalidAvatar, true);
    const rejected = run(
      `import {execute} from ${JSON.stringify(moduleUrl)}; try{execute({action:'poll',code:${JSON.stringify(created.room.code)}},'a'.repeat(64));console.log('false')}catch{console.log('true')}`,
    );
    assert.equal(rejected, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
