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
    const resumed = run(
      `import {execute} from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(execute({action:'poll',code:${JSON.stringify(created.room.code)}},${JSON.stringify(created.token)})));`,
    );
    assert.equal(resumed.room.me.id, created.room.me.id);
    assert.equal(resumed.room.code, created.room.code);
    const rejected = run(
      `import {execute} from ${JSON.stringify(moduleUrl)}; try{execute({action:'poll',code:${JSON.stringify(created.room.code)}},'a'.repeat(64));console.log('false')}catch{console.log('true')}`,
    );
    assert.equal(rejected, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
