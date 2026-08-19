# CareScout Policy Form 005 — rate algorithm (Individual LTC)

Source: "Calculations for CareScout Policy Form 005.doc" (Genworth/CareScout, algorithm dated May 2024).
Individual LTC; inputs done individually per applicant. Pre-designed product plans; not all options available for every plan/state.

**Rate tables received** — extracted verbatim from `Carescout_quotes.xlsx` into `rates.json`; `rater.py` reproduces the workbook's own Pricing-Cell premiums (415/504 sampled cells exact, remainder within $0.10 rounding).

## Webpage integration

`ltc-quote.html` embeds a compact JS port of this rater (the 90-day base tables + Exhibit E
factors, ages 40–70, all 12 cohorts). It was cross-checked against `rater.py` over 9,600
input combinations — 9,526 exact, the other 74 off by a single penny from half-cent rounding.
CareScout is selectable from the header carrier dropdown and its quotes drop into the same
comparison tray, client records, and printable quote sheet as NGL. Still held out of the
webpage until confirmed by a real CareScout illustration: the **0-day home-care rider**
(its own additive table) and the **save-age** convention. State licensing / any state rate
adjustments load when the state-variations file arrives (state factor is currently 1.0).

## Inputs (per applicant)
- **Issue age** from DOB via **Save Age** logic: if birthday within 30 days of current date, rate one year younger. Min age 40, max 70.
- Effective date of coverage
- **Residence state** (if a state isn't in the state-variation sheet, CareScout isn't licensed there)
- **Marital status**: (a) Single, (b) Married – 2 apply/2 issue, (c) Married – 1 issue
- **Underwriting class**: (a) Standard, (b) Preferred
- Benefit payment frequency — base policy pays **DAILY** benefits
- **Daily Benefit Maximum**: $50 / $100 / $150 / $200
- **Coverage Maximum** (total benefit pool): $50,000 / $100,000 / $150,000 / $200,000 / $250,000
  - Validation: if Coverage Max = $50,000, Daily Benefit cannot be $150 or $200 (min coverage-period rule); also subject to state minimums
- **Benefit Increase Option (inflation)**: None / 1% / 3% / 5% Compound For Life (must be available in policy state)
- **Payment Term**: Lifetime only
- **Deductible Period (elimination)**: 90 or 180 service days (verify available in state)
- **0-Day Home Care DP**: if 90-day DP → Yes/No; if 180-day DP → only No
- **Non-forfeiture Benefit**: Yes/No (some states mandate it be offered)
- **Premium Payment Mode**: Monthly / Quarterly / Semi-Annual / Annual

## Calculation
1. **Issue Age** via Save Age logic.
2. **Units** = Daily Benefit / 10.
3. **Benefit Ratio** = Coverage Maximum ÷ Daily Benefit Maximum ÷ 365.25, rounded to 8 decimals. (≈ years of coverage.)
4. **Base rate lookup** — table chosen by Issue State, Marital Status, Underwriting Class, Sex (when applicable), Benefit Ratio; then look up the base rate by Issue Age, Daily Benefit Max, Coverage Max, Benefit Increase Option.
5. **Initial Annual Base Premium** = Base Rate × Units.
6. **Factor lookup** (Exhibit E) for each selected option: Deductible Period; 0-Day DP for HC (uses 90-day base DP table); Nonforfeiture Benefit (by issue age + BIO); Alternative Billing Frequency; State Adjustments.
7. **Adjusted Annual Base Premium** = Initial Annual Base Premium × (1 + Factor). Round 2 decimals. [Need Exhibit E to confirm whether factors sum then apply once, or apply sequentially.]
8. **Annual Premium for 0-HHC options** = Adjusted Annual Base Premium × (0-HHC factor table). Round 2 decimals. (e.g., MaleStdSingle0HC)
9. **Total Modal Premium** = Total Annual Premium × Modal Factor (Exhibit E, by payment mode). Round 2 decimals.
10. **State-level adjustment** = Total Annual Premium × State Adjustment (currently "None for now"). Round 2 decimals.

## Open questions to confirm when tables arrive
- Step 6/7: are the option factors summed into one (1 + ΣFactor), or applied one-by-one?
- Step 8: exact structure of the "0-HHC" factor tables (per sex/class/marital?).
- Steps 9 vs 10 ordering and whether both multiply the Step-8 annual (i.e., modal and state applied independently to the same annual base).
- Sex "when applicable" — which states are unisex.
- Nonforfeiture: default off unless state mandates?

## Standalone vs Worksite (per CareScout note)
- **Standalone**: rate sheets + this calculation doc → this is what the tool should implement.
- **Worksite**: a macro spreadsheet CareScout says Blaine can use as-is (no need to rebuild in the tool).
