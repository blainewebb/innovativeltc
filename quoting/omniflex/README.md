# Manhattan Life Omniflex — Short-Term Care (STC) rater

Turns Manhattan Life's Omniflex STC premium-rate exhibits into exact premiums.

- **Michigan** — ManhattanLife Insurance and Annuity Company, policy form **AT7002**.
- **Texas** — Standard Life and Casualty Insurance Company, policy form **AL7060**.

Files:
- `rates.json` — every rate + factor, extracted from the carrier's Exhibit 1 rate PDFs.
- `rater.py` — the calculator. `python3 rater.py`, or `import rater; rater.quote(...)`.

## How a premium is built

Rates are an **annual premium per $10 of daily benefit**, indexed by:
- **Issue age** 45–89 (ages 45–50 share one rate), **unisex**.
- **Benefit period** — 90 / 180 / 270 / 360 days (how long the daily benefit pays).
- **Elimination period** — 0 / 20 / 30 / 60 / 90 / 100 days (the waiting period).

```
annual = ( facility_rate + home_care_rate? ) × (daily_benefit ÷ 10)
       × smoker_load?      # ×1.10 if smoker
       × spousal_discount? # ×0.90 if spousal
then × modal factor        # monthly ×0.0833, semi-annual ×0.52, annual ×1.0
```

- **Home care** is an additive rider at the **same daily benefit / benefit period /
  elimination period** (its own per-$10 rate table).
- **Inflation** switches both the facility and home-care tables to their inflation
  variant (forms `...I` / `...IH`).

## Forms in the exhibits

| Form | Meaning | In the rater |
|---|---|---|
| AT7002 / AL7060 | Facility base, no inflation | `facility_none` |
| AT7002I / AL7060I | Facility base, with inflation | `facility_infl` |
| AT7002HC / AL7060HC | Home-care rider, no inflation | `homecare_none` |
| AT7002IH / AL7060IH | Home-care rider, with inflation | `homecare_infl` |
| AT7002HR / AL7060HR | A short-duration (3/6/10/20-day) rider | not yet modeled |
| (base pg. 7) | "Annual Max / Rx" cash-and-pharmacy option | not yet modeled |

## Verification status

Facility + home-care assembly reproduces the carrier's rate exhibits and was
cross-checked between the Python rater and the browser engine over 9,216
combinations (both states, all ages/periods/EPs, smoker/spousal/inflation/home
care, all modes) — 9,036 exact, the rest within a single rounding penny.

**Pending:** confirm the additive facility + home-care assembly against a real
Omniflex illustration, and decide whether to model the HR rider and the Annual-Max /
Rx cash option. Filed only in **MI and TX** here.
