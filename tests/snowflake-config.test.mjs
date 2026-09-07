import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, verify } from 'node:crypto';
import { test } from 'node:test';
import snowflake from 'snowflake-sdk';
import { queryRepairs } from '../snowflake/client.mjs';

// These disposable test keys never leave this process or authenticate to a service.
const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = pair.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
const passphrase = ' test-only passphrase with spaces ';
const encryptedPem = pair.privateKey.export({ format: 'pem', type: 'pkcs8', cipher: 'aes-256-cbc', passphrase }).toString();
const legacy = { SNOWFLAKE_ACCOUNT: 'test-account', SNOWFLAKE_USERNAME: 'test-user', SNOWFLAKE_PASSWORD: ' test-only password ', SNOWFLAKE_WAREHOUSE: 'test-warehouse', SNOWFLAKE_DATABASE: 'test-database', SNOWFLAKE_SCHEMA: 'test-schema' };

function isolate(t, env) {
  const previousEnv = process.env;
  process.env = env;
  t.after(() => { process.env = previousEnv; });
  const connections = [];
  t.mock.method(snowflake, 'createConnection', (options) => {
    connections.push(options);
    return {
      connect(callback) { callback(null); },
      execute({ complete }) { complete(null, {}, []); },
      destroy(callback) { callback(null); }
    };
  });
  return connections;
}

for (const [name, key, extra] of [
  ['multiline PKCS8', pem, {}],
  ['escaped newlines', pem.replaceAll('\n', '\\n'), {}],
  ['PKCS1 normalized to PKCS8', pair.privateKey.export({ format: 'pem', type: 'pkcs1' }).toString(), {}],
  ['encrypted PKCS8', encryptedPem, { SNOWFLAKE_PRIVATE_KEY_PASSPHRASE: passphrase }]
]) {
  test(`runtime signs with ${name} using JWT and the explicit role`, async (t) => {
    const connections = isolate(t, { ...legacy, ...extra, SNOWFLAKE_ROLE: 'TEST_APP_ROLE', SNOWFLAKE_PRIVATE_KEY: key });
    await queryRepairs();
    const options = connections[0];
    assert.equal(options.authenticator, 'SNOWFLAKE_JWT');
    assert.equal(options.role, 'TEST_APP_ROLE');
    assert.equal('password' in options, false);
    assert.equal('privateKeyPass' in options, false);
    assert.equal(typeof options.privateKey, 'string');
    assert.equal(options.privateKey.startsWith('-----BEGIN PRIVATE KEY-----\n'), true);
    const challenge = Buffer.from('repair-line authentication configuration test');
    assert.equal(verify('RSA-SHA256', challenge, pair.publicKey, sign('RSA-SHA256', challenge, options.privateKey)), true);
  });
}

test('JWT credentials do not require a password', async (t) => {
  const env = { ...legacy, SNOWFLAKE_AUTHENTICATOR: 'SNOWFLAKE_JWT', SNOWFLAKE_ROLE: 'TEST_APP_ROLE', SNOWFLAKE_PRIVATE_KEY: pem };
  delete env.SNOWFLAKE_PASSWORD;
  const connections = isolate(t, env);
  await queryRepairs();
  assert.equal(connections[0].authenticator, 'SNOWFLAKE_JWT');
});

for (const [name, patch, field] of [
  ['explicit JWT without a key', { SNOWFLAKE_AUTHENTICATOR: 'SNOWFLAKE_JWT' }, 'SNOWFLAKE_PRIVATE_KEY'],
  ['a blank configured key', { SNOWFLAKE_PRIVATE_KEY: '' }, 'SNOWFLAKE_PRIVATE_KEY'],
  ['an invalid key', { SNOWFLAKE_PRIVATE_KEY: 'invalid-private-key-test-sentinel' }, 'SNOWFLAKE_PRIVATE_KEY'],
  ['an invalid key with an explicit password authenticator', { SNOWFLAKE_PRIVATE_KEY: 'invalid-private-key-test-sentinel', SNOWFLAKE_AUTHENTICATOR: 'SNOWFLAKE' }, 'SNOWFLAKE_PRIVATE_KEY'],
  ['an encrypted key with a wrong passphrase', { SNOWFLAKE_PRIVATE_KEY: encryptedPem, SNOWFLAKE_PRIVATE_KEY_PASSPHRASE: 'wrong-passphrase-test-sentinel' }, 'SNOWFLAKE_PRIVATE_KEY'],
  ['an encrypted key without a passphrase', { SNOWFLAKE_PRIVATE_KEY: encryptedPem }, 'SNOWFLAKE_PRIVATE_KEY'],
  ['an unknown authenticator', { SNOWFLAKE_AUTHENTICATOR: 'unknown-authenticator-test-sentinel' }, 'SNOWFLAKE_AUTHENTICATOR'],
  ['JWT without an explicit role', { SNOWFLAKE_PRIVATE_KEY: pem, SNOWFLAKE_ROLE: '' }, 'SNOWFLAKE_ROLE']
]) {
  test(`${name} cannot fall back to the configured password`, async (t) => {
    const connections = isolate(t, { ...legacy, SNOWFLAKE_ROLE: 'TEST_APP_ROLE', ...patch });
    await assert.rejects(queryRepairs(), (error) => {
      assert.match(error.code, /^SNOWFLAKE_CONFIGURATION_(?:MISSING|INVALID)$/);
      assert.equal(error.message.includes(field), true);
      assert.equal(/test-sentinel|test-only|BEGIN|test-user|test-account|wrong-passphrase/.test(error.message), false);
      assert.equal('cause' in error, false);
      return true;
    });
    assert.equal(connections.length, 0);
  });
}

test('a non-RSA key is rejected locally instead of reaching the Snowflake SDK', async (t) => {
  const key = generateKeyPairSync('ed25519').privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  const connections = isolate(t, { ...legacy, SNOWFLAKE_ROLE: 'TEST_APP_ROLE', SNOWFLAKE_PRIVATE_KEY: key });
  await assert.rejects(queryRepairs(), { code: 'SNOWFLAKE_CONFIGURATION_INVALID' });
  assert.equal(connections.length, 0);
});

test('an RSA key below the supported 2048-bit minimum is rejected locally', async (t) => {
  const key = generateKeyPairSync('rsa', { modulusLength: 1024 }).privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  const connections = isolate(t, { ...legacy, SNOWFLAKE_ROLE: 'TEST_APP_ROLE', SNOWFLAKE_PRIVATE_KEY: key });
  await assert.rejects(queryRepairs(), { code: 'SNOWFLAKE_CONFIGURATION_INVALID' });
  assert.equal(connections.length, 0);
});

test('legacy password mode preserves the password and accepts an optional role', async (t) => {
  const connections = isolate(t, { ...legacy, SNOWFLAKE_ROLE: 'TEST_DEVELOPMENT_ROLE' });
  await queryRepairs();
  assert.equal(connections[0].password, ' test-only password ');
  assert.equal(connections[0].role, 'TEST_DEVELOPMENT_ROLE');
  assert.equal('privateKey' in connections[0], false);
});

test('missing common configuration reports only the missing variable names', async (t) => {
  const env = { ...legacy, SNOWFLAKE_ROLE: 'TEST_APP_ROLE', SNOWFLAKE_PRIVATE_KEY: pem };
  delete env.SNOWFLAKE_ACCOUNT;
  delete env.SNOWFLAKE_DATABASE;
  const connections = isolate(t, env);
  await assert.rejects(queryRepairs(), (error) => {
    assert.equal(error.code, 'SNOWFLAKE_CONFIGURATION_MISSING');
    assert.deepEqual(error.missing, ['SNOWFLAKE_ACCOUNT', 'SNOWFLAKE_DATABASE']);
    assert.equal(/test-only|BEGIN|test-user/.test(error.message), false);
    return true;
  });
  assert.equal(connections.length, 0);
});
