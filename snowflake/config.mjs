import { createPrivateKey } from 'node:crypto';

const commonFields = ['SNOWFLAKE_ACCOUNT', 'SNOWFLAKE_USERNAME', 'SNOWFLAKE_WAREHOUSE', 'SNOWFLAKE_DATABASE', 'SNOWFLAKE_SCHEMA'];
const present = (value) => typeof value === 'string' && value.trim().length > 0;

function configurationError(kind, fields) {
  const error = new Error(`${kind === 'missing' ? 'Missing' : 'Invalid'} Snowflake configuration: ${fields.join(', ')}`);
  error.code = `SNOWFLAKE_CONFIGURATION_${kind.toUpperCase()}`;
  error[kind] = fields;
  return error;
}

function normalizedPrivateKey(env) {
  const fields = ['SNOWFLAKE_PRIVATE_KEY'];
  if (env.SNOWFLAKE_PRIVATE_KEY_PASSPHRASE !== undefined) fields.push('SNOWFLAKE_PRIVATE_KEY_PASSPHRASE');
  try {
    const key = createPrivateKey({
      key: env.SNOWFLAKE_PRIVATE_KEY.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').trim(),
      format: 'pem',
      passphrase: env.SNOWFLAKE_PRIVATE_KEY_PASSPHRASE
    });
    if (key.asymmetricKeyType !== 'rsa' || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) throw new Error();
    return key.export({ format: 'pem', type: 'pkcs8' }).toString();
  } catch {
    // Never expose PEM material, passphrases, or crypto-provider errors.
    throw configurationError('invalid', fields);
  }
}

export function buildSnowflakeConfig(env = process.env, { setup = false } = {}) {
  const configuredAuthenticator = env.SNOWFLAKE_AUTHENTICATOR;
  if (configuredAuthenticator !== undefined && typeof configuredAuthenticator !== 'string') {
    throw configurationError('invalid', ['SNOWFLAKE_AUTHENTICATOR']);
  }
  const authenticator = configuredAuthenticator?.trim().toUpperCase() || 'SNOWFLAKE';
  if (!['SNOWFLAKE', 'SNOWFLAKE_JWT'].includes(authenticator)) {
    throw configurationError('invalid', ['SNOWFLAKE_AUTHENTICATOR']);
  }

  // Even a blank or malformed configured key selects JWT: never downgrade to password.
  const useJwt = authenticator === 'SNOWFLAKE_JWT' || env.SNOWFLAKE_PRIVATE_KEY !== undefined;
  const required = [...commonFields, ...(useJwt ? ['SNOWFLAKE_ROLE', 'SNOWFLAKE_PRIVATE_KEY'] : ['SNOWFLAKE_PASSWORD'])];
  const missing = required.filter((field) => !present(env[field]));
  if (missing.length) throw configurationError('missing', missing);

  const config = {
    account: env.SNOWFLAKE_ACCOUNT.trim(),
    username: env.SNOWFLAKE_USERNAME.trim(),
    warehouse: env.SNOWFLAKE_WAREHOUSE.trim()
  };
  if (present(env.SNOWFLAKE_ROLE)) config.role = env.SNOWFLAKE_ROLE.trim();
  // The explicit admin setup command creates these objects after connecting.
  if (!setup) {
    config.database = env.SNOWFLAKE_DATABASE.trim();
    config.schema = env.SNOWFLAKE_SCHEMA.trim();
  }
  if (useJwt) {
    config.authenticator = 'SNOWFLAKE_JWT';
    config.privateKey = normalizedPrivateKey(env);
  } else {
    config.authenticator = 'SNOWFLAKE';
    config.password = env.SNOWFLAKE_PASSWORD;
  }
  return config;
}
