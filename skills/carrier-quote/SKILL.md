---
name: carrier-quote
description: Blaine's real-premium calculator for carriers whose rate tables he's authorized to use. Right now that's National Guardian Life (NGL) EssentialLTC. Trigger whenever Blaine wants an ACTUAL premium number (not a ballpark range) computed from a carrier's rates — e.g. "quote NGL for a 62-year-old female, $4,500/mo, 3-yr, 3% compound," "run an NGL number for [prospect]," "what would NGL cost for...," or when a quickquote teaser needs a real figure instead of Blaine's gut range. This is the engine that produces the numbers; it pairs with `quickquote` (which formats a teaser + Gmail draft) and with `ltc-quote-to-gamma` (the full illustration-PDF deck). Use carrier-quote when Blaine has the client's parameters and wants the math done from the carrier's own rate manual. As more carriers authorize their rate tables, each gets added under its own scripts folder and this same skill quotes them.
---

# Carrier Quote — real premiums from authorized rate tables

## What this is

Blaine has begun getting carriers to authorize the use of their rate manuals so he
(and Claude) can compute exact premiums without logging into each carrier's
software. This skill is the calculator. Today it covers **NGL EssentialLTC**; the
structure is built so a new carrier is just a new folder of rates + a rater.

It answers one question: *given a client's parameters, what does this carrier
actually charge?* — with the full math shown, not a black box. It does **not**
invent or estimate; every number traces back to the carrier's published tables.

**How it relates to the other tools:**
- `carrier-quote` (this) → produces the real premium.
- `quickquote` → wraps a number/range into a client teaser + Gmail draft.
- `ltc-quote-to-gamma` → builds the full comparison deck from real illustration PDFs.

A natural combo: Blaine says "quote NGL for Margaret and send her a teaser" → run
carrier-quote to get the premium, then hand it to quickquote.

## Available carriers

| Carrier | Product | Script | Rating notes |
|---|---|---|---|
| **NGL** | EssentialLTC (NLTC200) | `scripts/ngl/rater.py` | `references/ngl-rating.md` |

If Blaine names a carrier that isn't here yet, say so plainly — don't approximate
its pricing from another carrier. Adding a carrier means getting its authorized
rate manual and building it out (see "Adding a carrier" below).

## Running an NGL quote

Read `references/ngl-rating.md` once so you understand NGL's structure, then run the
bundled calculator. From the skill directory:

```
python3 scripts/ngl/rater.py --age 62 --gender female --benefit 4500 \
    --bp 36 --ep 90 --inflation 0.03 --pay level --mode monthly
```

Or import it: `from rater import quote; quote(age=62, gender="female", monthly_benefit=4500, ...)`.

**Parse Blaine's shorthand into these inputs:**

| Input | Notes |
|---|---|
| age | issue age, 18–79 |
| gender | male / female (ignored for Colorado & worksite — those are unisex) |
| monthly_benefit | dollars per month (if Blaine says a *daily* benefit, ×30; a *pool*, divide by months) |
| benefit_period | 24 / 36 / 48 / 60 / 72 months, or lifetime |
| elimination | 90 or 180 days |
| inflation | none/level, or 0.01–0.05 compound COLA |
| joint | true if it's a couple/partner (joint) rate |
| pay | level / 10pay / single |
| mode | annual / semiannual / quarterly / monthly |
| state | only matters for Colorado (its own unisex table) |

**When something material is missing, use these defaults and STATE them in your
answer** so Blaine can correct a wrong assumption: 90-day elimination, Premier risk,
reimbursement, level pay, monthly mode. But **benefit period and inflation option
move the price a lot** — if Blaine didn't specify them, either ask or quote a couple
of common variants (e.g. 36-mo and 48-mo, 3% and 5% compound) so he sees the spread.

## Presenting the number

- Lead with the headline: **monthly and annual premium** for the configuration quoted.
- Show the **breakdown** the rater returns (base × units × each factor) — Blaine and
  the client both trust a number more when the math is visible.
- Name the **configuration** in plain words: "62F, $4,500/mo, 36-month, 90-day
  elimination, 3% compound inflation, Premier, level pay, monthly."
- Append the disclaimer verbatim: *"This is an independent illustration not provided
  or approved by the issuers of the policies shown. Use the Insurer's forms and
  software for Insurer-approved quotes and applications."*

## Verification status: VERIFIED

The rater was checked against four real NGL illustrations (single-life and couples,
with/without the shared rider) and **matched every figure to the penny** — see the
validation log in `references/ngl-rating.md`. So NGL numbers can be presented as
real quotes (still with the disclaimer), not hedged estimates.

Keep the standard honesty anyway: it's still an independent illustration, not an
NGL-issued quote, so the disclaimer stays and anything genuinely unusual (a config
far outside the tested cases) is worth a spot-check in NGL's software.

Settled per Blaine: Return-of-Premium riders are **permanently off** (he doesn't sell
them), and **Premier is the only class** he quotes. A substandard "Class One" offer
(+35%) exists as an optional `class_one=True` toggle but stays off unless Blaine
explicitly asks to show a rated scenario.

## Saved scenarios ("run my standard 3 for a 62F")

Blaine runs the same option sets over and over. Those live in `scripts/scenarios.json`
as named scenarios — each option fixes everything except the applicant. At runtime he
supplies only age + gender (+ state), and every option is quoted at once:

```
python3 scripts/run_scenario.py --scenario standard-3 --age 62 --gender female --state TX
```

**Defining / editing a scenario:** when Blaine says "save this as my standard three:
Option 1 is X, Option 2 is Y, Option 3 is Z," write those options into
`scripts/scenarios.json` under a new key (or edit an existing one). Each option takes
`name`, `monthly_benefit`, `benefit_period`, `elimination`, `inflation`, and any other
`quote()` argument. The shipped `standard-3` is a **placeholder example** — replace it
with Blaine's real options the first time he specifies them. A scenario names a
`carrier` (currently `ngl`); as carriers are added, an option can name its own carrier
so one scenario spans multiple carriers.

## Budget / reverse quoting ("what does $300/mo buy?")

Given a target premium, solve for the benefit it buys — premium is exactly linear in
the monthly benefit, so this is precise, not a search:

```
python3 scripts/run_scenario.py --scenario standard-3 --age 62 --gender female --budget 300
```

That answers "if they can spend $300/mo, how much coverage does each option design
buy?" For a single config, `rater.benefit_for_premium(target, age, gender, ...)` does
the same. When Blaine asks "what can I get across these carriers for $X," run the
budget solve for each authorized carrier and lay the results side by side — today
that's NGL; the same call fans out as carriers are added.

## Quoting a couple

Use `quote_couple(age1, gender1, age2, gender2, monthly_benefit, ...)` for a joint
(two-life) policy. It returns the combined household premium plus each survivor's
individual premium. If instead Blaine wants two **separate** individual policies for
a couple, just quote each person with `quote()` — those single-life numbers are the
verified survivor amounts.

## Adding a carrier later

Each newly authorized carrier follows the NGL pattern:
1. Get the carrier's authorized rate manual (spreadsheet or PDF).
2. Extract its base rates + factor tables into `scripts/<carrier>/rates.json`.
3. Write `scripts/<carrier>/rater.py` implementing that carrier's assembly rules.
4. Document its structure + a validation log in `references/<carrier>-rating.md`.
5. Add a row to the "Available carriers" table above.

The engine per carrier is small; the real work is confirming the assembly against a
known-good illustration, same as NGL.
