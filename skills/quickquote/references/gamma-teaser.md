# Gamma Teaser — structure, wording, disclaimer

The teaser is a **short** Gamma (aim for 3 cards). It is not the full comparison deck. Its job is to be skimmable in under a minute and leave the prospect wanting the exact number — which they only get on a call.

Generate with `mcp__Gamma__generate`. Pass `inputText` that lays out the cards below. Only include the category summaries for categories the prospect was actually deemed eligible for. Fill `[Name]` with the prospect's first name (or full name on the title if natural).

## Card 1 — Title

- Headline: **Your Long-Term Care Options — Prepared for [Name]**
  - If the eligibility is purely short-term/front-loaded, "Your Short-Term Care Options — Prepared for [Name]" reads better. Match the product.
- Subhead: **Provided by Blaine Webb**

## Card 2 — Your Options

Two parts, in order:

**A. Plain-language summary** for each category present, using Blaine's exact client-facing wording (verbatim — this is the language already in his decks, not a paraphrase):

- **Traditional LTC** — "Traditional Long-Term Care insurance pays a monthly benefit toward the cost of care — home health aide, assisted living, or nursing home — once you need help with 2+ activities of daily living or have a cognitive impairment. It has no cash value or death benefit, which is the tradeoff for typically higher coverage per premium dollar."

- **Hybrid LTC** — "Hybrid policies pair long-term care benefits with a permanent life insurance chassis. If care is never needed, the death benefit passes to your beneficiaries instead of being forfeited — premiums are typically guaranteed and can be paid over a limited number of years."

- **STC / Front-Loaded** — "Short-Term Care insurance — sometimes called Front Loaded Long Term Care — provides up to a 2-year benefit, typically structured as 1 year of Home Care coverage plus 1 year of Facility Care coverage. Because benefits are often paid out at a rate higher than the actual cost of care, unused funds can carry forward — giving you the potential to continue receiving care beyond the initial 2-year period."

- **LTC Annuity** — "An LTC Annuity uses an annuity's cash value to fund long-term care costs, often multiplying the payout available for qualified care expenses beyond the base account value. Funds not used for care remain accessible as a standard annuity, and any remaining balance passes to your beneficiaries."

**B. The ranges table.** One row per option Blaine specified. Full ranges on both sides — show the benefit range AND the premium range exactly as Blaine gave them. Columns:

| Option | Estimated Monthly/Total Benefit | Estimated Premium |
|---|---|---|
| [e.g. Traditional LTC] | [benefit range Blaine gave] | [premium range Blaine gave] |
| [e.g. Hybrid LTC] | [benefit range Blaine gave] | [premium range Blaine gave] |

- Use the premium cadence Blaine states (per month, per year, single pay). Don't convert or normalize unless he asks — show it how he said it.
- If Blaine labels an option by a friendly name ("Option 1", "the richer plan"), use his label.

Directly under the table, include this framing line and the disclaimer, both verbatim:

> *These are preliminary estimates for discussion only. Your exact figures depend on underwriting and are confirmed with a formal illustration.*

> *This is an independent illustration not provided or approved by the issuers of the policies shown. Use the Insurer's forms and software for Insurer-approved quotes and applications.*

## Card 3 — Next Steps

Short and action-oriented:

- A line like: **"These are ballpark ranges. The exact numbers for your situation take about 15 minutes to pin down — let's find a time."**
- A booking CTA button labeled **"Book your quick call"** pointing to Blaine's scheduling link (see `references/config.md`).
- Blaine's name and, if present in config, his contact line.

## Style notes

- Keep it warm and confident, not salesy or fear-based. Blaine's brand is "trusted specialist," not "act now."
- No carrier names on the teaser unless Blaine asks — the teaser is about the *shape* of the options, and naming carriers invites premature comparison shopping.
- Never carry source/file/page references onto the page (there are none here anyway).
