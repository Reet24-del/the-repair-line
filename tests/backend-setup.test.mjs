import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createPrivateKey, generateKeyPairSync } from 'node:crypto';

async function runSetup(seedDemo, extraEnv = {}) {
  let inserts = 0;
  let closes = 0;
  let count = 0;
  const connectionOptions = [];
  const statements = [];
  const sdk = { configure() {}, createConnection: (options) => {
    connectionOptions.push(options);
    return {
    connect(callback) { callback(null); },
    execute({ sqlText, complete }) {
      statements.push(sqlText);
      if (/^INSERT INTO REPAIRS/i.test(sqlText.trim())) { inserts++; count = 5; }
      complete(null, {}, /^SELECT COUNT/i.test(sqlText.trim()) ? [{ COUNT: count }] : []);
    },
    destroy(callback) { closes++; callback(null); }
  }; } };
  const env = { ...Object.fromEntries(['ACCOUNT', 'USERNAME', 'PASSWORD', 'WAREHOUSE', 'DATABASE', 'SCHEMA'].map((name) => [`SNOWFLAKE_${name}`, 'test'])), ...extraEnv };
  for (let run = 0; run < 2; run++) {
    const context = vm.createContext({ process: { env, argv: seedDemo ? ['node', 'setup.mjs', '--seed-demo'] : ['node', 'setup.mjs'] }, console: { log() {} } });
    const module = new vm.SourceTextModule(readFileSync(new URL('../snowflake/setup.mjs', import.meta.url), 'utf8'), { context });
    await module.link(async (name) => {
      if (name === 'snowflake-sdk') return new vm.SyntheticModule(['default'], function () { this.setExport('default', sdk); }, { context });
      if (name === './config.mjs') return new vm.SourceTextModule(readFileSync(new URL('../snowflake/config.mjs', import.meta.url), 'utf8'), { context });
      if (name === 'node:crypto') return new vm.SyntheticModule(['createPrivateKey'], function () { this.setExport('createPrivateKey', createPrivateKey); }, { context });
      if (name === 'node:fs') return new vm.SyntheticModule(['existsSync', 'readFileSync'], function () {
        // Never inspect credentials; schema/seed are the only test filesystem inputs.
        this.setExport('existsSync', () => false);
        this.setExport('readFileSync', (path, encoding) => readFileSync(new URL(`../${path}`, import.meta.url), encoding));
      }, { context });
      throw new Error(`Unexpected setup dependency: ${name}`);
    });
    await module.evaluate();
  }
  return { inserts, closes, connectionOptions, statements };
}

if (!vm.SourceTextModule) {
  test('setup regressions pass in an isolated VM runner', () => {
    const result = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', '--experimental-vm-modules', '--test', fileURLToPath(import.meta.url)], { encoding: 'utf8', env: {} });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });
} else {
test('running setup twice seeds demo data only once when explicitly requested', async () => {
  const { inserts, closes } = await runSetup(true);
  assert.equal(inserts, 1);
  assert.equal(closes, 2);
});

test('default setup leaves real repair tables empty', async () => {
  const { inserts, closes } = await runSetup(false);
  assert.equal(inserts, 0);
  assert.equal(closes, 2);
});

test('admin setup accepts JWT credentials before its database and schema exist', async () => {
  const key = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const { connectionOptions, statements } = await runSetup(false, { SNOWFLAKE_PASSWORD: undefined, SNOWFLAKE_AUTHENTICATOR: 'SNOWFLAKE_JWT', SNOWFLAKE_ROLE: 'TEST_SETUP_ROLE', SNOWFLAKE_PRIVATE_KEY: key });
  assert.equal(connectionOptions[0].authenticator, 'SNOWFLAKE_JWT');
  assert.equal(connectionOptions[0].role, 'TEST_SETUP_ROLE');
  assert.equal('password' in connectionOptions[0], false);
  assert.equal('database' in connectionOptions[0], false);
  assert.equal('schema' in connectionOptions[0], false);
  assert.equal(statements.some((sql) => /^CREATE DATABASE IF NOT EXISTS /.test(sql)), true);
  assert.equal(statements.some((sql) => /^CREATE WAREHOUSE IF NOT EXISTS /.test(sql)), true);
});
}
