# CareScout Policy Form 005 — rate algorithm (Individual LTC)

Source: "Calculations for CareScout Policy Form 005.doc" (Genworth/CareScout, algorithm dated May 2024).
Individual LTC; inputs done individually per applicant. Pre-designed product plans; not all options available for every plan/state.

**Rate tables received** — extracted verbatim from `Carescout_quotes.xlsx` into `rates.json`; `rater.py` reproduces the workbook's own Pricing-Cell premiums (415/504 sampled cells exact, remainder within $0.10 rounding).

## Webpage integration

`ltc-quote.html` embeds a compact JS port of this rater (the 90-day base tables + Exhibit E
factors, ages 40–70, all 12 cohorts). It was cross-checked against `rater.py` over 9,600
input combinations — 9,526 exact, the other 74 off by a single penny from half-cent rounding.
CareScout is selectable from the header carrier dropdown and its quotes drop into the same
comparison tray, client records, and printable quote sheet as NGL. The **0-day home-care
rider** is now in the webpage (additive 0HC table, offered only with the 90-day deductible).

### End-to-end verification against real CareScout illustrations

`care_scout_quote.pdf` — two StrateCision illustrations (TX, 55M, Standard, $200/day,
$250k pool, 3% compound, 90-day, marital "One Insured", annual), identical except the
0-day home-care rider. Both reproduced **to the penny**:

| Config | CareScout illustration | Webpage / rater |
|---|---|---|
| Base (no 0-day HC) | $3,759.80 / yr | $3,759.80 |
| + 0-day home-care rider | $4,683.40 / yr | $4,683.40 |

Confirms the base calc end-to-end, the additive 0-day HC rider (+$923.60 here), the
"One Insured" → `Married1buy` cohort mapping, and the age-80 benefit growth
($12,730/mo · $523,444 pool = daily/pool × 1.03^25). The optional Nonforfeiture Benefit
Rider (×1.26) is not something Blaine sells, so it's left out of the webpage UI (the
`nonforfeiture` flag remains in the rater for completeness).

## State availability & variations (from CareAssurance_state_variability.xlsx)

The "Care Assurance Individual" state grid is a spec-by-state table, not a rate table — it
carries **no per-state premium multipliers**, so the nationwide rate workbook applies to
every licensed state (state factor stays 1.0). What it defines:

- **Licensed in 43 states.** Individual coverage is sold in 42 of them; **CO is worksite-only**.
  **Not licensed:** CA, FL, MA, ME, MN, NE, NJ, NY. (Not in the file = not licensed.)
- **2-year minimum coverage — AZ, MD, OR:** only combos with benefit ratio ≥ 2 years
  (drops $50k+$100/day, $100k+$150/day, $100k+$200/day).
- **$100 minimum daily benefit — SD, VT, WI:** no $50/day option.
- **90-day deductible only — CT, KS, SD, VT:** 180-day not permitted.
- **Waiver-of-HHC-deductible (0-day home care) rider is unavailable with the 180-day
  deductible** — already enforced by the rater.

These rules are wired into the webpage (state picker limited to the 42 individual states;
daily/pool/deductible dropdowns filter to what each state allows).

## "Most I can buy" — budget solve across all carriers

The webpage has a carrier-agnostic budget tool: enter a monthly budget + age + gender +
target years + inflation + state, and it returns the richest design each carrier offers at
or under that budget, side by side (each addable to the shared comparison/print sheet).
Carriers live in a `CARRIERS` registry — each exposes `solve(p)`; adding a carrier makes it
join every budget comparison automatically. NGL solves linearly (premium ∝ monthly benefit,
floored to a $300 increment); CareScout enumerates its discrete daily/pool combos whose pool
lasts about the target years and picks the richest that fits, honoring the state rules and
licensing. Reachable by button (both carrier sides) and by typed command
(e.g. "62 female, most I can buy for $300, 3% for 3 years, each company").

## "Sweet spot" — each carrier's best-value lead design

A second registry method, `sweetSpot(p)`, returns each carrier's strongest value-per-dollar
lead design for a client (age/gender/state/marital/inflation), rendered side by side and
addable to the shared comparison. Defaults live in one `SWEETSPOT` constant:

- **CareScout:** $100/day + $200k pool (≈5.5 yr), 3% compound, 90-day, Standard — CareScout
  prices off the daily benefit, so a modest daily with a large pool is its best leverage.
- **NGL:** $4,500/mo, 4-year, 3% compound.

Analysis behind the picks (60F, Standard/Premier, Single, 3%, 90-day): NGL out-buys CareScout
per premium dollar even at CareScout's own sweet spot — for ~$429/mo NGL gives ~$4,500/mo over
5 years ($270k) vs CareScout's ~$3,040/mo-equivalent over 5.5 years ($200k). CareScout's edge
is underwriting/eligibility and its pooled daily design, not price. Reachable by button and by
typed command ("sweet spot for a 60 year old female in TX").

**Issue ages 40–70.** The state spec's "Issue Ages" field reads 40–65, but StrateCision
(CareScout's illustration software) quotes through age 70 and the rate workbook carries
base rates to 70 — so the webpage allows 40–70. Save-age convention (rate one year younger
within 30 days of the next birthday) is confirmed.

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
