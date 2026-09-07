import snowflake from 'snowflake-sdk';
import { existsSync, readFileSync } from 'node:fs';

if (existsSync('.env')) for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) { const [key, ...parts] = line.split('='); if (key && !key.startsWith('#') && !process.env[key]) process.env[key] = parts.join('=').trim(); }

const required = ['SNOWFLAKE_ACCOUNT', 'SNOWFLAKE_USERNAME', 'SNOWFLAKE_PASSWORD', 'SNOWFLAKE_WAREHOUSE', 'SNOWFLAKE_DATABASE', 'SNOWFLAKE_SCHEMA'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) throw new Error(`Missing Snowflake configuration: ${missing.join(', ')}`);
const connection = snowflake.createConnection({ account: process.env.SNOWFLAKE_ACCOUNT, username: process.env.SNOWFLAKE_USERNAME, password: process.env.SNOWFLAKE_PASSWORD, warehouse: process.env.SNOWFLAKE_WAREHOUSE });
await new Promise((resolve, reject) => connection.connect((error) => error ? reject(error) : resolve()));
const execute = (sqlText) => new Promise((resolve, reject) => connection.execute({ sqlText, complete: (error) => error ? reject(error) : resolve() }));
await execute(`CREATE WAREHOUSE IF NOT EXISTS ${process.env.SNOWFLAKE_WAREHOUSE} WITH WAREHOUSE_SIZE='XSMALL' AUTO_SUSPEND=60 AUTO_RESUME=TRUE`);
await execute(`CREATE DATABASE IF NOT EXISTS ${process.env.SNOWFLAKE_DATABASE}`);
await execute(`CREATE SCHEMA IF NOT EXISTS ${process.env.SNOWFLAKE_DATABASE}.${process.env.SNOWFLAKE_SCHEMA}`);
await execute(`USE DATABASE ${process.env.SNOWFLAKE_DATABASE}`);
await execute(`USE SCHEMA ${process.env.SNOWFLAKE_SCHEMA}`);
for (const sqlText of [readFileSync('snowflake/schema.sql', 'utf8'), readFileSync('snowflake/seed.sql', 'utf8')]) await execute(sqlText);
connection.destroy(() => {});
console.log('Snowflake schema and seed data loaded.');
