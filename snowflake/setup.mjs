import snowflake from 'snowflake-sdk';
import { existsSync, readFileSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');
snowflake.configure({ logLevel: 'ERROR' });

const required = ['SNOWFLAKE_ACCOUNT', 'SNOWFLAKE_USERNAME', 'SNOWFLAKE_PASSWORD', 'SNOWFLAKE_WAREHOUSE', 'SNOWFLAKE_DATABASE', 'SNOWFLAKE_SCHEMA'];
const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length) throw new Error(`Missing Snowflake configuration: ${missing.join(', ')}`);
const connection = snowflake.createConnection({ account: process.env.SNOWFLAKE_ACCOUNT, username: process.env.SNOWFLAKE_USERNAME, password: process.env.SNOWFLAKE_PASSWORD, warehouse: process.env.SNOWFLAKE_WAREHOUSE });
const execute = (sqlText) => new Promise((resolve, reject) => connection.execute({ sqlText, complete: (error, _statement, rows) => error ? reject(error) : resolve(rows) }));
try {
  await new Promise((resolve, reject) => connection.connect((error) => error ? reject(error) : resolve()));
  await execute(`CREATE WAREHOUSE IF NOT EXISTS ${process.env.SNOWFLAKE_WAREHOUSE} WITH WAREHOUSE_SIZE='XSMALL' AUTO_SUSPEND=60 AUTO_RESUME=TRUE`);
  await execute(`USE WAREHOUSE ${process.env.SNOWFLAKE_WAREHOUSE}`);
  await execute(`CREATE DATABASE IF NOT EXISTS ${process.env.SNOWFLAKE_DATABASE}`);
  await execute(`CREATE SCHEMA IF NOT EXISTS ${process.env.SNOWFLAKE_DATABASE}.${process.env.SNOWFLAKE_SCHEMA}`);
  await execute(`USE DATABASE ${process.env.SNOWFLAKE_DATABASE}`);
  await execute(`USE SCHEMA ${process.env.SNOWFLAKE_SCHEMA}`);
  await execute(readFileSync('snowflake/schema.sql', 'utf8'));
  await execute('ALTER TABLE REPAIRS ADD COLUMN IF NOT EXISTS CREATE_REQUEST_ID VARCHAR');
  if (process.argv.includes('--seed-demo')) {
    const [{ COUNT: count }] = await execute('SELECT COUNT(*) AS COUNT FROM REPAIRS');
    if (Number(count) === 0) await execute(readFileSync('snowflake/seed.sql', 'utf8'));
    else console.log('Skipped demo seed: the repair table already contains records.');
  }
  console.log('Snowflake schema ready. Demo data is optional: use --seed-demo on an empty development database.');
} finally {
  await new Promise((resolve) => connection.destroy(() => resolve()));
}
