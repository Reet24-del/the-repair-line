---
title: "I built The Repair Line: a small-repair platform for local communities"
published: false
description: "How I turned a photo of a broken shared thing into a transparent, fundable community repair."
tags: react, ai, webdev, community
---

# I built The Repair Line: a small-repair platform for local communities

Most community problems are not grand enough to make the news.

They are the loose handle on a public hand pump. The cracked bench at a library. The leaking roof above a ration counter. The fan in a clinic waiting room that stops on the hottest day of the year.

They are small, unglamorous problems—but they affect many people every day.

That is the idea behind **The Repair Line**: a lightweight platform where someone can share a photo of a broken shared thing, get a directional repair assessment, and make the need visible to people who may want to help.

The project is live at [therepairline.vercel.app](https://therepairline.vercel.app).

## The starting question

I began with a simple question: *what if funding a local repair felt as understandable as seeing it?*

Instead of asking people to trust a vague appeal, The Repair Line makes the repair legible:

1. Share a clear photo of the issue.
2. Get an AI-assisted assessment of severity, plausibility, and a directional INR cost range.
3. Browse local repairs, see who they affect, and fund a small fix.
4. Close the loop with visible before-and-after proof.

The important detail is the last step. Donations should not disappear into a black box. A repair should have an ending that people can see.

## Designing for a feeling, not just a flow

I did not want the product to look like a generic fundraising dashboard. The visual direction is warm, documentary-like, and local: paper-toned backgrounds, practical repair photography, clear prices, and restrained interactions.

The core message became:

> Small repairs. Shared relief.

The landing page begins with a community-first statement, then moves into a simple three-step explanation before showing the repair feed. It deliberately puts the cost range in plain view—most repairs are meant to be small enough to feel possible.

## Building the repair flow

The main interaction is the **Assess a repair** panel.

Someone uploads a photo and can optionally describe the issue. The image is sent to a server-side Gemini route that returns structured JSON:

```json
{
  "severity": "Medium",
  "cost": "₹2,000–4,000",
  "plausibility": "Likely genuine",
  "reasoning": "The issue appears consistent with a small local repair."
}
```

I made two intentional choices here:

- A photo is required. Without one, the system should not invent a repair from a sentence alone.
- Costs are labelled as *directional guidance*, never as guaranteed quotes.

That keeps the experience useful without pretending that AI has replaced a local technician or volunteer.

## Making the feed local—but not locked to one city

The first version was framed around Lucknow as a focused pilot. Then I expanded the location selector to support Lucknow, Kanpur, Prayagraj, Varanasi, and an all-cities view.

The selector changes the visible feed, heading, repair count, and backend query. The feed initially shows a small set of repairs, with a **Show all repairs** action for the complete list.

It is a small interaction, but it matters: local relevance is the difference between a list of problems and a line of repairs that feels like yours.

## Stack

- **React + Vite** for the interface
- **Gemini** for structured image-and-text repair assessments
- **Snowflake** for repair listings, pledges, and filtering
- **Vercel Functions** for the deployed API routes
- **Vercel** for the production deployment

The backend is deliberately split into small endpoints for assessment, repairs, and pledges. API keys and database credentials stay in server-side environment variables—never in the browser bundle.

## What I learned while building it

The difficult part was not making an AI response appear on a page. The difficult part was deciding what the response should *mean*.

An assessment needs to be specific enough to help someone understand a repair, but humble enough to acknowledge uncertainty. A community product also needs proof: if someone contributes to a repair, they should be able to see what changed.

I also learned that local context has to be real in the interface. A city selector that does not affect the list is decoration. A photo input that accepts images but does not assess them is a broken promise. Building this meant repeatedly tracing each visible action all the way to its backend result.

## What comes next

The next stage is about making the line more durable:

- verified before-and-after uploads for completed repairs
- local repair-volunteer workflows
- stronger image storage instead of inline upload data
- moderation for submissions before they enter the public feed
- real donor payments, with transparent repair-status updates

The Repair Line is intentionally about modest things. That is the point. A functioning tap, a dry roof, a repaired bench, or a fan that turns again can quietly make a neighbourhood work better.

Sometimes the most meaningful technology is not the one that tries to solve everything. It is the one that makes a small fix easier to see, trust, and complete.

---

If you are building civic, community, or public-interest tools, I would love to hear what you think. What small shared problem in your neighbourhood deserves a repair line?
