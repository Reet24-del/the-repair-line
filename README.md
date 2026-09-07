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

Use Node.js 22 or newer. Before opening the app, initialize its database:

~~~bash
pnpm snowflake:setup
pnpm dev
~~~

Setup creates missing objects without deleting existing repairs, and adds the
column used to return the exact saved record. The default database is empty.
Only for an empty development database, optional clearly labeled sample data can
be added with `pnpm snowflake:setup --seed-demo`.

Required server variables: `GEMINI_API_KEY`, `SNOWFLAKE_ACCOUNT`,
`SNOWFLAKE_USERNAME`, `SNOWFLAKE_PASSWORD`, `SNOWFLAKE_WAREHOUSE`,
`SNOWFLAKE_DATABASE`, and `SNOWFLAKE_SCHEMA`. Put these in Vercel Production
environment variables too, and redeploy after changing them. A successful build
does not initialize Snowflake: the database setup is a separate step.

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
