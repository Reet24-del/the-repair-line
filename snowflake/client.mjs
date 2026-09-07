import snowflake from 'snowflake-sdk';
import { randomUUID } from 'node:crypto';
import { buildSnowflakeConfig } from './config.mjs';

snowflake.configure({ logLevel: 'ERROR' });

const columns = 'ID, TITLE, LOCATION, SEVERITY, ESTIMATED_COST, PEOPLE_HELPED, REASON, IMAGE_URL, PLEDGED_AMOUNT, STATUS';

async function withConnection(operation) {
  const connection = snowflake.createConnection(buildSnowflakeConfig());
  try {
    await new Promise((resolve, reject) => connection.connect((error) => error ? reject(error) : resolve()));
    return await operation(connection);
  } finally {
    await new Promise((resolve) => connection.destroy(() => resolve()));
  }
}

function execute(connection, sqlText, binds = []) {
  return new Promise((resolve, reject) => connection.execute({ sqlText, binds, complete: (error, statement, rows) => error ? reject(error) : resolve({ statement, rows: rows ?? [] }) }));
}

function repairFromRow(row) {
  return { id: row.ID, title: row.TITLE, place: row.LOCATION, severity: row.SEVERITY, cost: Number(row.ESTIMATED_COST), people: Number(row.PEOPLE_HELPED), reason: row.REASON, image: row.IMAGE_URL, funded: Number(row.PLEDGED_AMOUNT), status: row.STATUS };
}

export function queryRepairs({ city, severity, sort = 'needed' } = {}) {
  const orderBy = { cost: 'ESTIMATED_COST ASC', people: 'PEOPLE_HELPED DESC', needed: 'ESTIMATED_COST DESC' }[sort] ?? 'ESTIMATED_COST DESC';
  const params = [];
  const clauses = [];
  if (severity && severity !== 'All') { clauses.push('SEVERITY = ?'); params.push(severity); }
  if (city && city !== 'All cities') { clauses.push('LOCATION ILIKE ?'); params.push(`%${city}%`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return withConnection(async (connection) => {
    const { rows } = await execute(connection, `SELECT ${columns} FROM REPAIRS ${where} ORDER BY ${orderBy}`, params);
    return rows.map(repairFromRow);
  });
}

export function createRepair({ title, location, severity, cost, people, reason, imageUrl }) {
  return withConnection(async (connection) => {
    // Correlate this insert without assuming an IDENTITY value or selecting another request's row.
    const requestId = randomUUID();
    await execute(connection, 'INSERT INTO REPAIRS (TITLE, LOCATION, SEVERITY, ESTIMATED_COST, PEOPLE_HELPED, REASON, IMAGE_URL, CREATE_REQUEST_ID) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [title, location, severity, cost, people, reason, imageUrl || null, requestId]);
    const { rows } = await execute(connection, `SELECT ${columns} FROM REPAIRS WHERE CREATE_REQUEST_ID = ?`, [requestId]);
    if (rows.length !== 1) throw new Error('The saved repair could not be retrieved.');
    return repairFromRow(rows[0]);
  });
}

export function pledgeRepair(id, amount) {
  return withConnection(async (connection) => {
    const { statement } = await execute(connection, "UPDATE REPAIRS SET PLEDGED_AMOUNT = LEAST(ESTIMATED_COST, PLEDGED_AMOUNT + ?), STATUS = IFF(PLEDGED_AMOUNT + ? >= ESTIMATED_COST, 'FUNDED', STATUS) WHERE ID = ?", [amount, amount, id]);
    if (statement.getNumUpdatedRows() === 0) return null;
    const { rows } = await execute(connection, `SELECT ${columns} FROM REPAIRS WHERE ID = ?`, [id]);
    return rows.length ? repairFromRow(rows[0]) : null;
  });
}
