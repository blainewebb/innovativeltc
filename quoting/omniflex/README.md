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
- **Elimination period** — the rate tables carry 0 / 20 / 30 / 60 / 90 / 100 days,
  but Manhattan Life only **sells 0 / 20 / 60 / 90 days**, so the webpage offers only those.

```
facility = facility_rate(age, fac_bp, fac_ep) × (fac_daily ÷ 10)
home_care= home_care_rate(age, hc_bp, hc_ep) × (hc_daily ÷ 10)   # optional rider
base     = facility + home_care
subtotal = base + rx_annual                # + prescription-drug benefit ($300/500/700/yr max)
subtotal*= 1.10 (smoker)  *= 0.90 (spousal) # applied to the WHOLE premium, Rx included
annual   = round(subtotal, 2)
modal    = round(annual × modal factor)    # monthly ×0.0833, semi-annual ×0.52, annual ×1.0
                                           # + a $25 one-time policy fee
```

- **Facility** and the **home-care rider** carry INDEPENDENT daily benefit, benefit
  period, and elimination period.
- **Inflation (5% simple)** switches the facility and home-care tables to their
  inflation variant (forms `...I` / `...IH`).
- **Prescription-drug benefit** is a flat annual premium by age × annual max
  (the "Annual Max" / Rx exhibit), not adjusted by smoker/spousal.
- The **facility & home-care cash benefits** equal 50% of the daily benefit — an
  included feature, no separate premium.

## Forms in the exhibits

| Form | Meaning | In the rater |
|---|---|---|
| AT7002 / AL7060 | Facility base, no inflation | `facility_none` |
| AT7002I / AL7060I | Facility base, with inflation | `facility_infl` |
| AT7002HC / AL7060HC | Home-care rider, no inflation | `homecare_none` |
| AT7002IH / AL7060IH | Home-care rider, with inflation | `homecare_infl` |
| AT7002HR / AL7060HR | A short-duration (3/6/10/20-day) rider | not yet modeled |
| (base pg. 7) | "Annual Max / Rx" cash-and-pharmacy option | not yet modeled |

## Verification status: VERIFIED against a real illustration

Reproduced two StrateCision Omniflex illustrations **to the penny** — a Texas
single (M61) and a Michigan couple (M61 + F58, with the spousal discount):

| State | Design | Illustration | Rater |
|---|---|---|---|
| TX | Fac $400/0-day + HC $300/0-day, 5% infl, Rx $300 | $271.37/mo | $271.37 |
| TX | Fac $300/90-day + HC $300/0-day, 5% infl, Rx $300 | $183.07/mo | $183.07 |
| TX | Fac $100/0-day + HC $100/0-day, no infl, Rx $300 | $44.28/mo | $44.28 |
| MI | Fac $400/0-day + HC $300/0-day, no infl, Rx $300, spousal | $134.15 / $106.08 | exact |
| MI | Fac $400/90-day + HC $300/0-day, 5% infl, Rx $300, spousal | $190.72 / $154.91 | exact |

Confirms: independent facility/home-care daily+EP, the 5%-simple inflation tables,
the Rx add-on, unisex rates (M61 vs F58 differ only by age), and that
smoker/spousal apply to the **whole** premium (Rx included). Python rater and
browser engine agree over 2,304 combinations (all within a rounding penny).

**Not yet modeled** (weren't in this illustration's premium): the **HR** short-duration
rider and any hospital-care rider. The facility/home-care cash benefits and restoration
of benefits appear included at no separate charge. Filed only in **MI and TX** here.
