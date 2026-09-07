# The Repair Line

A community-repair platform that turns photos of shared local problems into visible, fundable fixes.

## What it does

- Lets people upload a photo of a broken shared item.
- Uses Google Gemini to provide a directional repair assessment.
- Displays repairs by city, severity, cost, and people helped.
- Supports pledge tracking and before-and-after repair proof.

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

## Live demo

[therepairline.vercel.app](https://therepairline.vercel.app)
