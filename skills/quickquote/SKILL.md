---
name: quickquote
description: Blaine's fast "teaser quote" tool for prospects who just want a ballpark number and haven't earned a full illustration yet. Trigger whenever Blaine types "quickquote" (his one-word trigger) — and also when he clearly wants a fast ballpark teaser rather than a full comparison deck, e.g. "send so-and-so a quick range," "just give this lead something to chew on," "teaser quote for [name]." Blaine hands over the prospect's name/email, which product categories they're eligible for, and the premium + benefit RANGES he wants shown; this skill builds a short, branded Gamma teaser page (full ranges on both sides) and drafts a warm Gmail email to the prospect with the link and a booking CTA, ready for Blaine to review and send. This is the LIGHTWEIGHT counterpart to ltc-quote-to-gamma — do NOT use this when Blaine has actual illustration PDFs to compare (that's ltc-quote-to-gamma's job); use quickquote when there are no illustrations yet, just Blaine's eligibility call and a range in his head.
---

# QuickQuote — Teaser Quote → Gamma + Gmail Draft

## What this is (and what it is NOT)

Blaine sells long-term care, short-term care, and hybrid coverage. A chunk of his inbound is people who "just want a quote" before they're willing to invest real time. Running a full illustration for every tire-kicker is a waste — but ignoring them loses the lead.

**QuickQuote is the hook.** Blaine already knows what a prospect would qualify for and roughly where the numbers land. He hands you that in shorthand; you produce a short, good-looking teaser that shows real *ranges* (enough to be interesting, honest about being estimates) plus a clear reason and way to book a call. He reviews the drafted email and sends it himself.

This is deliberately the **lightweight** path. Its heavyweight sibling is **`ltc-quote-to-gamma`**, which builds the full multi-carrier comparison deck from real illustration PDFs. Rule of thumb:

- No illustration PDFs, just Blaine's eligibility call + a range → **quickquote** (this skill).
- Actual carrier illustration PDFs in hand, prospect is serious → **ltc-quote-to-gamma**.

If Blaine hands you real illustration PDFs while asking for a "quick quote," gently flag that `ltc-quote-to-gamma` will give a sharper result and ask which he wants.

## What Blaine gives you (the shorthand)

Blaine talks fast and casual. Expect one message with some or all of:

- **Prospect name** — for the sheet and the greeting. If a last name matters for the email but only a first name is given, that's fine; ask only if genuinely unclear.
- **Prospect email address** — required to draft the email. If it's missing, ask for it before drafting (you can still build the Gamma first).
- **Eligibility** — which product categories they qualify for, in Blaine's words. Map them to the four categories below.
- **The ranges** — for each option he wants shown, a **premium range** and a **benefit range**. These are Blaine's numbers. You never compute or invent them.
- Optional: age / brief profile, a note on tone, or which carriers to name (usually leave carriers unnamed on a teaser).

**Product category mapping** (Blaine's four buckets — match his wording to these):

| Blaine might say... | Category |
|---|---|
| traditional, LTC, "the pay-only-if-you-need-it kind" | **Traditional LTC** |
| hybrid, life+LTC, "keeps a death benefit" | **Hybrid LTC** |
| short-term, STC, front-loaded, "the 2-year one" | **STC / Front-Loaded** |
| annuity, LTC annuity | **LTC Annuity** |

If eligibility spans more than one category, show them all — one row/option per category (or per option Blaine specifies), in this order: **Traditional → Hybrid → STC/Front-Loaded → Annuity**.

## The two hard rules (compliance — do not bend these)

These protect Blaine's license and reputation. Everything else is stylistic; these are not.

1. **Never invent, round, or "improve" a number.** Show only the ranges Blaine gave you, exactly. If a range is missing for an option he asked to show, ask him — do not guess or borrow a figure from an example.
2. **Frame everything as a preliminary estimate subject to underwriting.** These are not approved illustrations. Never imply a guaranteed rate or guaranteed approval. Always carry the disclaimer (below) and the "estimates for discussion" framing. Eligibility is Blaine's professional judgment, stated as such — not a promise of coverage.

## Workflow

### 1. Read the shorthand and confirm the essentials

Parse name, email, categories, and the ranges. Restate what you understood in one tight line — *"Teaser for Margaret (margaret@email.com): Traditional LTC and a Hybrid, showing the ranges you gave."* — so Blaine can catch a misread before anything is built. Only ask a question if something required is missing (email) or genuinely ambiguous (which category he meant). Don't interrogate him.

### 2. Build the Gamma teaser

Read `references/gamma-teaser.md` for the exact card structure, the verbatim product summaries, and the disclaimer. In short, it's a short page:
- **Title card** — "Your Long-Term Care Options — Prepared for [Name]", "Provided by Blaine Webb".
- **One "Your Options" card** — the plain-language summary for each category present (verbatim wording from the reference), then a clean ranges table showing, per option: the product, the **benefit range**, and the **premium range** (full ranges, both sides). Estimates framing on the card.
- **Next Steps card** — a short "these are ballpark; your exact numbers come from a quick call" nudge with the booking CTA button pointing to Blaine's scheduling link (in `references/config.md`).

Generate it with `mcp__Gamma__generate` (not `generate_from_template` — that's the heavy full-deck path). Keep it to ~3 cards; a teaser should be skimmable in under a minute.

### 3. Draft the Gmail email

Read `references/email-and-voice.md` for tone and the template. Create it as a **draft** with `mcp__Gmail__create_draft` — never send. Blaine reviews it in Gmail and hits send himself (that's the "yes or no" he asked for). The email is short and warm, drops the Gamma link, and repeats the booking CTA. Sign-off and any scheduling link come from `references/config.md`.

### 4. Hand it back for approval

Give Blaine, in the chat:
- The **Gamma link**.
- Confirmation the **Gmail draft** is sitting in his drafts, addressed to the prospect, with the subject line — so he knows exactly what he's approving.
- The one-line summary of the ranges shown, so he can sanity-check before sending.

Then stop. He decides whether it goes out.

## When a teaser turns into a real opportunity

If the prospect bites and Blaine wants to run real numbers, that's the handoff to **`ltc-quote-to-gamma`** — mention it's available so he doesn't rebuild by hand. QuickQuote's whole job is to get them to that point.
