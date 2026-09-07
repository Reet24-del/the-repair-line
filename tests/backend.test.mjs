import assert from 'node:assert/strict';
import { test } from 'node:test';
import snowflake from 'snowflake-sdk';
import { queryRepairs, createRepair, pledgeRepair } from '../snowflake/client.mjs';
import repairsHandler from '../api/repairs.js';
import pledgesHandler from '../api/repairs/[id]/pledges.js';

const input = { title: 'Shared pump', location: 'Lucknow', severity: 'High', cost: 7500, people: 40, reason: 'The handle is broken.', imageUrl: null };
const stored = { ID: 84, TITLE: 'Shared pump', LOCATION: 'Lucknow', SEVERITY: 'High', ESTIMATED_COST: 7500, PEOPLE_HELPED: 40, REASON: 'The handle is broken.', IMAGE_URL: null, PLEDGED_AMOUNT: 0, STATUS: 'OPEN' };
const canonical = { id: 84, title: 'Shared pump', place: 'Lucknow', severity: 'High', cost: 7500, people: 40, reason: 'The handle is broken.', image: null, funded: 0, status: 'OPEN' };

function database(t, execute) {
  const previousEnv = process.env;
  process.env = Object.fromEntries(['ACCOUNT', 'USERNAME', 'PASSWORD', 'WAREHOUSE', 'DATABASE', 'SCHEMA'].map((name) => [`SNOWFLAKE_${name}`, 'test-config-value']));
  t.after(() => { process.env = previousEnv; });
  const state = { opened: 0, closed: 0, queries: [] };
  t.mock.method(snowflake, 'createConnection', () => {
    state.opened++;
    return {
      connect(callback) { callback(null); },
      execute(options) {
        state.queries.push({ sql: options.sqlText, binds: options.binds });
        execute(options);
      },
      destroy(callback) { state.closed++; callback(null); }
    };
  });
  return state;
}

function response() {
  return { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
}

function createDatabase(t) {
  let token;
  return database(t, ({ sqlText, binds, complete }) => {
    if (/^INSERT/i.test(sqlText)) {
      token = binds.at(-1);
      complete(null, { getNumUpdatedRows: () => 0 }, []);
    } else {
      // A separate request with identical title/location must not select this row.
      const matchesToken = /WHERE CREATE_REQUEST_ID = \?/i.test(sqlText) && binds[0] === token;
      complete(null, {}, matchesToken ? [stored] : []);
    }
  });
}

test('failed feed query closes its Snowflake session', async (t) => {
  const state = database(t, ({ complete }) => complete(new Error('query failed')));
  await assert.rejects(queryRepairs(), /query failed/);
  assert.equal(state.closed, 1);
});

test('failed repair insert closes its Snowflake session', async (t) => {
  const state = database(t, ({ complete }) => complete(new Error('insert failed')));
  await assert.rejects(createRepair(input), /insert failed/);
  assert.equal(state.closed, 1);
});

test('creation returns the database identity and persisted defaults on one connection', async (t) => {
  const state = createDatabase(t);
  assert.deepEqual(await createRepair(input), canonical);
  assert.equal(state.opened, 1);
  assert.equal(state.closed, 1);
});

test('repair POST returns the canonical record needed for subsequent pledges', async (t) => {
  createDatabase(t);
  const res = response();
  await repairsHandler({ method: 'POST', body: input }, res);
  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, { ok: true, repair: canonical });
});

test('invalid repair details are rejected before contacting Snowflake', async (t) => {
  const state = database(t, ({ complete }) => complete(null, { getNumUpdatedRows: () => 1 }, [stored]));
  for (const patch of [{ title: '  ' }, { title: 'Pump' }, { location: 'All cities' }, { location: 'Elsewhere' }, { severity: 'Extreme' }, { cost: -1 }, { cost: 65008 }, { cost: 'no estimate' }, { cost: true }, { people: 1.5 }, { people: [] }, { imageUrl: 'data:image/gif;base64,R0lGODlh' }, { imageUrl: `data:image/png;base64,${Buffer.alloc(2 * 1024 * 1024 + 1).toString('base64')}` }]) {
    const res = response();
    await repairsHandler({ method: 'POST', body: { ...input, ...patch } }, res);
    assert.equal(res.statusCode, 400, Object.keys(patch).join(', '));
  }
  assert.equal(state.opened, 0);
});

test('malformed repair IDs and fractional pledges are rejected before database access', async (t) => {
  const state = database(t, ({ complete }) => complete(null, { getNumUpdatedRows: () => 1 }, [stored]));
  for (const [id, amount] of [['new-123', 1000], ['0', 1000], ['-1', 1000], ['1.5', 1000], ['84', 0.5], ['84', -100], ['84', true]]) {
    const res = response();
    await pledgesHandler({ method: 'POST', query: { id }, body: { amount } }, res);
    assert.equal(res.statusCode, 400, JSON.stringify({ id, amount }));
  }
  assert.equal(state.opened, 0);
});

test('pledging a missing repair returns 404 instead of false success', async (t) => {
  database(t, ({ complete }) => complete(null, { getNumUpdatedRows: () => 0 }, []));
  const res = response();
  await pledgesHandler({ method: 'POST', query: { id: '84' }, body: { amount: 1000 } }, res);
  assert.equal(res.statusCode, 404);
});

test('pledge response uses persisted funded amount and status', async (t) => {
  database(t, ({ sqlText, complete }) => {
    if (/^UPDATE/i.test(sqlText)) complete(null, { getNumUpdatedRows: () => 1 }, []);
    else complete(null, {}, [{ ...stored, PLEDGED_AMOUNT: 7500, STATUS: 'FUNDED' }]);
  });
  const res = response();
  await pledgesHandler({ method: 'POST', params: { id: '84' }, body: { amount: 1000 } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, updated: 1, repair: { ...canonical, funded: 7500, status: 'FUNDED' } });
});

test('failed pledge updates close the Snowflake session', async (t) => {
  const state = database(t, ({ complete }) => complete(new Error('update failed')));
  await assert.rejects(pledgeRepair(84, 1000), /update failed/);
  assert.equal(state.closed, 1);
});

test('missing configuration fails before creating a connection and reports names only', async (t) => {
  const state = database(t, ({ complete }) => complete(null, {}, []));
  delete process.env.SNOWFLAKE_PASSWORD;
  await assert.rejects(queryRepairs(), (error) => error.message.includes('SNOWFLAKE_PASSWORD') && !error.message.includes('test-config-value'));
  assert.equal(state.opened, 0);
});

test('SDK logging is reduced before a repair connection is created', async (t) => {
  database(t, ({ complete }) => complete(null, {}, []));
  let logging;
  t.mock.method(snowflake, 'configure', (options) => { logging = options.logLevel; });
  const client = await import(`../snowflake/client.mjs?logging-check=${Date.now()}`);
  await client.queryRepairs();
  assert.equal(logging, 'ERROR');
});
