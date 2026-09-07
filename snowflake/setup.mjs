import snowflake from 'snowflake-sdk';
import { existsSync, readFileSync } from 'node:fs';
import { buildSnowflakeConfig } from './config.mjs';

if (existsSync('.env')) process.loadEnvFile('.env');
snowflake.configure({ logLevel: 'ERROR' });

const connection = snowflake.createConnection(buildSnowflakeConfig(process.env, { setup: true }));
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
