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

## What's confirmed vs. what to verify

The **base rates and every factor value** are copied straight from NGL's workbook —
those are exact. What needs a sanity check is the **assembly** (how the factors
combine), because the workbook lists the tables but not the formula. Before trusting
a number in front of a client, confirm these against one real NGL-generated
illustration:

1. **Factor order / all-multiplicative.** The rater multiplies all factors together
   (standard LTC practice). Confirm NGL applies COLA, benefit-period, and
   elimination factors this way rather than some additive combination.
2. **Riders not yet enabled.** The Return-of-Premium riders (LROP / LROPS) are in
   the workbook but **excluded from the rater** — their columns could be read as a
   per-$300 add-on *or* a multiplier, and guessing wrong on a client quote isn't
   worth it. Left off until confirmed. The Shared-Additional, First-Day HCCS, and
   Shortened-Benefit riders are wired in as multipliers (labeled that way in the
   workbook) but should still be spot-checked.
3. **Single risk class.** This filing lists only **Premier** (factor 1.00). If NGL
   also writes Select/Standard classes with their own factors, they aren't in this
   workbook — get that table to quote them.

## Validation log

Fill this in as real NGL illustrations are compared against the rater. Once a few
mainstream configs match to the dollar, the rater is trustworthy for those configs.

| Date | Inputs (age/gender/benefit/BP/EP/inflation/pay/mode) | NGL software premium | Rater premium | Match? |
|------|------------------------------------------------------|----------------------|---------------|--------|
| _pending_ | | | | |
