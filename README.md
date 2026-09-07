# The Repair Line

A community-repair platform that turns photos of shared local problems into visible, fundable fixes.

## What it does

- Lets people upload a photo of a broken shared item.
- Uses Google Gemini to provide a directional repair assessment.
- Displays repairs by city, severity, cost, and people helped.
- Saves repair listings and pledge totals in Snowflake.
- Rejects unclear photos and shows genuine loading, empty, and error states.

This is a working prototype. Pledges record interest; they do not charge money.
The proof-of-repair section is an illustrative concept, not evidence of completed
repairs. Payments, accounts, human moderation, and proof uploads are not implemented.

## Stack

- React + Vite
- Google Gemini
- Snowflake
- Vercel Functions + Vercel

## Run locally

~~~bash
pnpm install
pnpm dev
~~~

Create a .env file from .env.example and add the required Gemini and Snowflake environment variables. Never commit secrets.

Use Node.js 22 or newer. Before opening the app, initialize its database using
an authorized administrator's configuration, not the limited runtime user:

~~~bash
pnpm snowflake:setup
pnpm dev
~~~

Setup creates missing objects without deleting existing repairs, and adds the
column used to return the exact saved record. The default database is empty.
Only for an empty development database, optional clearly labeled sample data can
be added with `pnpm snowflake:setup --seed-demo`.

Required server variables: `GEMINI_API_KEY`, `SNOWFLAKE_ACCOUNT`,
`SNOWFLAKE_USERNAME`, `SNOWFLAKE_WAREHOUSE`, `SNOWFLAKE_DATABASE`, and
`SNOWFLAKE_SCHEMA`. A successful build does not initialize Snowflake: database
setup is a separate step.

### Production database authentication

Use a dedicated Snowflake `TYPE=SERVICE` user with
`SNOWFLAKE_AUTHENTICATOR=SNOWFLAKE_JWT`, an explicit `SNOWFLAKE_ROLE`, and
`SNOWFLAKE_PRIVATE_KEY`. The key accepts PEM text with real or escaped newlines.
For an encrypted PEM, also set `SNOWFLAKE_PRIVATE_KEY_PASSPHRASE`.

The runtime role needs only warehouse/database/schema `USAGE` and table
`SELECT`, `INSERT`, and `UPDATE`. Its direct grants do not need `ACCOUNTADMIN`,
`DELETE`, object ownership, or permission to create databases or users. Audit
inherited `PUBLIC` grants too: Snowflake's account-wide sample-data and learning
roles may add access beyond the application's direct grants. Keep the
administrator's credentials out of the runtime.

Store the private key as a sensitive, server-only Vercel Production variable,
never a `VITE_` variable or tracked file. Do not give preview deployments the
production key. Redeploy after environment changes, verify the new connection,
and then remove the obsolete production password. Invalid or missing key-pair
credentials fail closed rather than falling back to a password.

Password mode remains for a separately authorized local/admin environment:
omit the private-key variables and set `SNOWFLAKE_AUTHENTICATOR=SNOWFLAKE` plus
`SNOWFLAKE_PASSWORD`, only where Snowflake still permits that authentication.
Key rotation should use Snowflake's second public-key slot, switch Vercel to
the new key, verify, and only then revoke the old key.

See [Snowflake Node.js authentication](https://docs.snowflake.com/en/developer-guide/node-js/nodejs-driver-authenticate)
and [key-pair rotation](https://docs.snowflake.com/en/user-guide/key-pair-auth).

## Verify a repair

1. Upload a JPEG, PNG, or WebP photo up to 2 MB and describe the visible damage.
2. Choose the repair's city and estimate the number of people helped.
3. Assess the photo. Unrelated or uncertain photos cannot be listed.
4. Submit an eligible repair. Its actual database record appears in the feed.
5. Record a pledge and refresh: the saved repair and pledge should remain.

The upper end of the AI's INR range becomes the pledge target. Targets above
₹10,000 require a smaller repair scope. AI estimates are guidance, not quotes or
proof of authenticity. Photos currently persist as bounded data URLs in Snowflake;
dedicated object storage and access controls are future production work.

## Checks

~~~bash
node --test tests/*.test.mjs src/*.test.mjs
pnpm build
~~~

For a failed feed, inspect the current Vercel runtime error. An HTTP 502 alone
does not diagnose a password problem: missing database objects and query failures
also produce that status. Never print passwords or full connection settings.

## Live demo

[therepairline.vercel.app](https://therepairline.vercel.app)
