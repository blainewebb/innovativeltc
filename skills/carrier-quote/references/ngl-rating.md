# NGL EssentialLTC (NLTC200) rater

Turns NGL's official rate workbook into exact premium calculations. Built from
`NGL_HLTC_Generic_and_CO_Rate_Tables.xlsx` (policy form ICC25-NLTC200P).

- `rates.json` — every base rate and factor, extracted verbatim from the workbook.
- `rater.py` — the calculator. `python3 rater.py --age 62 --gender female --benefit 4500 --bp 36 --inflation 0.03 --mode monthly`, or `import rater; rater.quote(...)`.

## How a premium is built

The base rate is an **annual premium per $300 of monthly benefit**, for one fixed
starting configuration: **36-month benefit period, Premier risk, 90-day
elimination, reimbursement, level pay, no inflation.** Everything else is a factor
applied on top:

```
annual = base_rate(age, population) × (monthly_benefit ÷ 300)
       × compound_COLA(age, %)        # inflation option
       × benefit_period_factor        # 36-mo = 1.00
       × elimination_period_factor    # 90-day = 1.00, 180-day = 0.90
       × risk_class_factor            # Premier = 1.00
       × any rider factors
then × 10-Pay or Single-Pay factor    (if limited pay)
then × payment-mode factor            # monthly payment = annual × 0.0875
```

- **Population/table:** most states use the Generic Non-Worksite table (Male /
  Female / Joint). **Colorado** and **worksite** cases are unisex (Single / Joint)
  and have their own tables — the rater picks the right one from `state`/`worksite`.
- **Joint** = the couple/partner rate (both partners applying), rated on each
  person's own age.
- Rated issue ages **18–79** (18–40 share one rate).
- **Monthly benefit is sold only in $300 increments** (the rate is *per $300*). The
  rater snaps any benefit to the nearest $300 so every premium is bindable; the
  budget solver (`benefit_for_premium`) floors to the largest $300 increment within
  the target premium and returns both that benefit and the `actual_premium` at it.

## Verification status: FULLY VERIFIED (single-life and joint)

Checked against six real NGL illustrations (HonestLTC / NLTC200P, TX, 8/11/2026) —
**every figure matched to the penny.** The assembly is confirmed:

- **Single-life quotes are exact.** Base comprehensive, the compound-COLA multiplier,
  the benefit-period factor, and all four payment modes reproduced NGL's numbers
  exactly (F60/$4,500/36-mo/3% → $3,673.01 annual / $321.39 monthly; M65/$3,000/48-mo/
  no-inflation → $1,406.09 / $123.03).
- **Inflation is a multiplier on the base**, which NGL *displays* as base + a
  separate "inflation rider" line (that line is just base × (COLA−1)). The rater's
  multiplicative approach gives the identical total.
- **Shared Additional Policy Limit rider = ×1.26** (36-mo) confirmed exactly,
  multiplicative on the base+inflation subtotal.
- **Joint (couple) policies:** the combined premium is the **Joint-column rate at the
  older insured's age** × units × that age's COLA × factors × riders; each survivor
  reverts to their own single-life premium. Reproduced both couple illustrations
  (with and without the shared rider) exactly. Use `quote_couple()`.

Settled with Blaine (not open questions):
- **Return-of-Premium riders (LROP / LROPS): permanently off** — he doesn't sell them.
- **Premier is the only class.** A substandard **"Class One" offer at +35%** exists as
  an optional `class_one=True` toggle (×1.35), off by default.

Product change:
- **Lifetime benefit period is discontinued** — NGL no longer offers it. Quote only
  24 / 36 / 48 / 60 / 72-month periods. (The `lifetime` factor is still in `rates.json`
  for backward compatibility with old saved quotes, but don't offer it on new ones.)

Pending confirmation:
- **Spousal / marital discount** for a married applicant applying **alone** (spouse not
  applying): `marital_discount=True` (× 0.95), off by default, set by the
  `MARITAL_DISCOUNT` constant atop `rater.py`. **The 5% is Blaine's recollection, NOT yet
  verified against the NGL notes** — confirm and update the one constant. The verified
  joint-rate path (both partners applying) is separate and unaffected.

The joint "older insured drives the rate" rule is confirmed on two couples with
different age gaps (62/60 and 65/60) — both exact, including survivor premiums and
the shared rider.

## Validation log

Fill this in as real NGL illustrations are compared against the rater. Once a few
mainstream configs match to the dollar, the rater is trustworthy for those configs.

| Date | Inputs | NGL software | Rater | Match? |
|------|--------|--------------|-------|--------|
| 2026-08-11 | F60, $4,500/mo, 36-mo, 90-day, 3% comp, level, monthly | $321.39/mo ($3,673.01/yr) | $321.39 / $3,673.01 | ✅ exact |
| 2026-08-11 | M65, $3,000/mo, 48-mo, 90-day, no inflation, level, monthly | $123.03/mo ($1,406.09/yr) | $123.03 / $1,406.09 | ✅ exact |
| 2026-08-11 | Couple M62+F60, $4,500/mo, 36-mo, 90-day, 3% comp, joint, monthly | $442.48/mo ($5,056.88/yr) | $442.48 / $5,056.88 | ✅ exact |
| 2026-08-11 | Same couple + Shared Additional rider | $557.52/mo ($6,371.66/yr) | $557.52 / $6,371.66 | ✅ exact |
| 2026-08-11 | Survivor singles (F60 $3,673.01 / M62 $2,458.36; +rider $4,627.99 / $3,097.53) | as shown | identical | ✅ exact |
| 2026-08-11 | Couple M65+F60 (wide gap), $4,500/mo, 36-mo, 90-day, 3% comp, joint, monthly | $514.67/mo ($5,881.97/yr) | $514.67 / $5,881.97 | ✅ exact |
| 2026-08-11 | Same couple + Shared Additional rider | $648.49/mo ($7,411.29/yr) | $648.49 / $7,411.29 | ✅ exact |
| 2026-08-11 | Survivor singles (F60 $3,673.01 / M65 $2,877.71) | as shown | identical | ✅ exact |
