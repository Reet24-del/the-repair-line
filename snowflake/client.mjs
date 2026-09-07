import snowflake from 'snowflake-sdk';

export async function queryRepairs({ city, severity, sort = 'needed' } = {}) {
  const connection = snowflake.createConnection({ account: process.env.SNOWFLAKE_ACCOUNT, username: process.env.SNOWFLAKE_USERNAME, password: process.env.SNOWFLAKE_PASSWORD, warehouse: process.env.SNOWFLAKE_WAREHOUSE, database: process.env.SNOWFLAKE_DATABASE, schema: process.env.SNOWFLAKE_SCHEMA });
  await new Promise((resolve, reject) => connection.connect((error) => error ? reject(error) : resolve()));
  const orderBy = { cost: 'ESTIMATED_COST ASC', people: 'PEOPLE_HELPED DESC', needed: 'ESTIMATED_COST DESC' }[sort] ?? 'ESTIMATED_COST DESC';
  const params = [];
  const clauses = [];
  if (severity && severity !== 'All') { clauses.push('SEVERITY = ?'); params.push(severity); }
  if (city && city !== 'All cities') { clauses.push('LOCATION ILIKE ?'); params.push(`%${city}%`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await new Promise((resolve, reject) => connection.execute({ sqlText: `SELECT ID, TITLE, LOCATION, SEVERITY, ESTIMATED_COST, PEOPLE_HELPED, REASON, IMAGE_URL, PLEDGED_AMOUNT, STATUS FROM REPAIRS ${where} ORDER BY ${orderBy}`, binds: params, complete: (error, _statement, data) => error ? reject(error) : resolve(data) }));
  connection.destroy(() => {});
  return rows.map((row) => ({ id: row.ID, title: row.TITLE, place: row.LOCATION, severity: row.SEVERITY, cost: Number(row.ESTIMATED_COST), people: Number(row.PEOPLE_HELPED), reason: row.REASON, image: row.IMAGE_URL, funded: Number(row.PLEDGED_AMOUNT), status: row.STATUS }));
}

async function executeWrite(sqlText, binds) {
  const connection = snowflake.createConnection({ account: process.env.SNOWFLAKE_ACCOUNT, username: process.env.SNOWFLAKE_USERNAME, password: process.env.SNOWFLAKE_PASSWORD, warehouse: process.env.SNOWFLAKE_WAREHOUSE, database: process.env.SNOWFLAKE_DATABASE, schema: process.env.SNOWFLAKE_SCHEMA });
  await new Promise((resolve, reject) => connection.connect((error) => error ? reject(error) : resolve()));
  const result = await new Promise((resolve, reject) => connection.execute({ sqlText, binds, complete: (error, statement) => error ? reject(error) : resolve(statement.getNumUpdatedRows()) }));
  connection.destroy(() => {});
  return result;
}

export function createRepair({ title, location, severity, cost, people, reason, imageUrl }) {
  return executeWrite('INSERT INTO REPAIRS (TITLE, LOCATION, SEVERITY, ESTIMATED_COST, PEOPLE_HELPED, REASON, IMAGE_URL) VALUES (?, ?, ?, ?, ?, ?, ?)', [title, location, severity, cost, people, reason, imageUrl || null]);
}

export function pledgeRepair(id, amount) {
  return executeWrite("UPDATE REPAIRS SET PLEDGED_AMOUNT = LEAST(ESTIMATED_COST, PLEDGED_AMOUNT + ?), STATUS = IFF(PLEDGED_AMOUNT + ? >= ESTIMATED_COST, 'FUNDED', STATUS) WHERE ID = ?", [amount, amount, id]);
}
