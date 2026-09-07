*This is a submission for [Weekend Challenge: Generosity Edition](https://dev.to/challenges/weekend-2026-09-03)*

## What I Built

I built **The Repair Line**, a community-repair platform for the small shared things that keep a neighbourhood moving: a broken public hand pump, a leaking roof above a ration counter, a damaged study desk, or a clinic fan that has stopped working.

The goal is to make generosity visible and practical. Someone uploads a clear photo of a repair need, receives an AI-assisted assessment, and can add it to a local repair line where people can see the impact, the directional cost, and the amount already pledged.

Each repair includes:

- a real repair photo and a short explanation
- severity, people affected, and a directional INR cost range
- funding progress
- a before-and-after proof-of-repair concept

The experience is designed to feel warm and community-led rather than like a generic fundraising dashboard. It starts with local repairs, but the city selector supports Lucknow, Kanpur, Prayagraj, Varanasi, and an all-cities view.

## Demo

Live app: [The Repair Line](https://therepairline.vercel.app)

Try the flow:

1. Choose a city from the location selector.
2. Browse local repair needs or click **Show all repairs**.
3. In **Assess a repair**, upload a clear photo of a broken shared item.
4. Receive an assessment of severity, plausibility, likely repair cost, and reasoning.
5. Add the assessed repair to the line.

## Code

The project is built with React and Vite, with API routes prepared for Vercel Functions.

> Add the public GitHub repository URL here before publishing this post.

Key pieces of the implementation:

- React interface and location-aware repair feed
- Gemini-backed server-side assessment endpoint
- Snowflake-backed repair, pledge, sort, and city-filtering queries
- Vercel deployment and API routes

## How I Built It

### Starting with a small but meaningful problem

I wanted to focus on generosity that is easy to understand. Not every community need requires a huge campaign. A ₹2,000–₹10,000 repair can make a real difference when it restores a shared tap, desk, roof, or fan.

The product flow became: **photo in, fixed out**.

### AI assessment with Google Gemini

The repair assessor accepts a photo and sends it to a server-side Gemini route. Gemini is asked to return structured JSON with:

```json
{
  "severity": "Low | Medium | High",
  "cost": "a directional INR range",
  "plausibility": "Likely genuine | Needs review | Unclear",
  "reasoning": "a concise explanation"
}
```

I require a photo before an assessment can run. This prevents the interface from creating a confident-looking repair result without visual evidence. The cost is intentionally presented as directional guidance rather than a quote.

### Repair feed and Snowflake

Repair records include the repair title, location, severity, estimated cost, people helped, reason, image, and pledged amount. Snowflake queries power the feed filters for city, severity, and sorting.

The feed initially keeps the page focused by showing a smaller set of repairs. A **Show all repairs** control expands the complete list, while the city selector changes the listings and heading to keep the experience locally relevant.

### Deployment

The frontend is deployed on Vercel, while Vercel Functions host the assessment, repair, and pledge endpoints. Sensitive credentials stay in server-side environment variables rather than the browser bundle.

## Prize Categories

### Best Use of Google AI

The project uses Google Gemini to analyse an uploaded repair photo and produce a structured, user-facing assessment. Gemini helps translate a visual problem into understandable severity, plausibility, repair guidance, and an INR cost range.

### Best Use of Snowflake

Snowflake provides the repair data layer for listings and pledges. The app is designed to query repairs by city, severity, and priority, so a growing local repair line remains filterable and useful.

---

The Repair Line is a small idea on purpose: make a modest, shared repair easy to see, trust, and complete.
