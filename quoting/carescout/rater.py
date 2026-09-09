#!/usr/bin/env python3
"""CareScout Policy Form 005 (Individual LTC) premium calculator.

Implements the CareScout rate algorithm (see algorithm.md) against the base-rate
tables and Exhibit E factors extracted from CareScout's rate workbook (rates.json).

VERIFIED: base_rate x units reproduces the workbook's own Pricing Cells premiums
(415/504 sampled cells exact, remainder within $0.10 rounding) across ages 40-70,
both sexes, single & married, all plan cells.

Still pending: state variations file (licensing + any state adjustments), and
end-to-end confirmation of the 0-day-home-care add-on and nonforfeiture with a
real CareScout sample quote.
"""
import json, os, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
RATES = json.load(open(os.path.join(HERE, "rates.json")))
BIO_IX = {b: i for i, b in enumerate(RATES["bio"])}          # none/1/3/5 -> 0..3
CELL = {tuple(v): k for k, v in RATES["plan_cells"].items()} # (pool, daily) -> cell letter
MODAL = RATES["exhibit_e"]["modal"]
DAILY_OPTS = (50, 100, 150, 200)
POOL_OPTS = (50000, 100000, 150000, 200000, 250000)


def issue_age(dob, effective_date=None):
    """Save-age: full years at the effective date, minus one if the next birthday
    is within 30 days (client rated one year younger)."""
    if effective_date is None:
        effective_date = datetime.date.today()
    if isinstance(dob, str):
        dob = datetime.date.fromisoformat(dob)
    if isinstance(effective_date, str):
        effective_date = datetime.date.fromisoformat(effective_date)
    age = effective_date.year - dob.year - ((effective_date.month, effective_date.day) < (dob.month, dob.day))
    try:
        nb = dob.replace(year=effective_date.year)
    except ValueError:
        nb = dob.replace(year=effective_date.year, day=28)
    if nb < effective_date:
        nb = nb.replace(year=effective_date.year + 1)
    if (nb - effective_date).days <= 30:
        age -= 1          # birthday within 30 days -> rate one year younger (save age); pending convention confirm
    return age


def quote(sex, uw_class, marital, daily_benefit, coverage_max, bio="none",
          age=None, dob=None, effective_date=None, deductible=90, zero_day_hc=False,
          nonforfeiture=False, mode="monthly", state=None):
    if age is None:
        age = issue_age(dob, effective_date)
    if not (40 <= age <= 70):
        raise ValueError(f"Issue age {age} outside CareScout's rated range (40-70).")
    if daily_benefit not in DAILY_OPTS:
        raise ValueError(f"Daily benefit must be one of {DAILY_OPTS}.")
    if coverage_max not in POOL_OPTS:
        raise ValueError(f"Coverage maximum must be one of {POOL_OPTS}.")
    if coverage_max == 50000 and daily_benefit in (150, 200):
        raise ValueError("With a $50,000 coverage maximum, daily benefit cannot be $150 or $200.")
    cell = CELL.get((coverage_max, daily_benefit))
    if cell is None:
        raise ValueError(f"No plan cell for pool {coverage_max} / daily {daily_benefit}.")
    cohort = f"{'M' if sex.lower().startswith('m') else 'F'}_{'Pref' if 'pref' in uw_class.lower() else 'Std'}_{marital}"
    if cohort not in RATES["rates"]["90"]:
        raise ValueError(f"Unknown cohort '{cohort}' (marital must be Single / Married1buy / Married).")
    bi = BIO_IX[str(bio)]

    units = daily_benefit / 10.0
    base_rate = RATES["rates"]["90"][cohort][str(age)][cell][bi]
    if base_rate is None:
        raise ValueError("No base rate for that plan/age/inflation combination.")
    annual = base_rate * units
    steps = [(f"base rate {base_rate} x {units:g} units (daily ${daily_benefit} / 10)", round(annual, 2))]

    # deductible period (Exhibit E) - 90-day = 1.0
    if int(deductible) == 180:
        f = RATES["exhibit_e"]["deductible_180"]["ge68" if age >= 68 else "lt68"]
        annual *= f
        steps.append((f"x {f} for 180-day deductible", round(annual, 2)))

    # nonforfeiture benefit
    if nonforfeiture:
        annual *= RATES["exhibit_e"]["nonforfeiture"]
        steps.append((f"x {RATES['exhibit_e']['nonforfeiture']} nonforfeiture benefit", round(annual, 2)))

    # 0-day home care rider (only with a 90-day deductible): additive from the 0HC tables
    if zero_day_hc and int(deductible) == 90:
        hc = RATES["rates"]["0HC"][cohort][str(age)][cell][bi]
        hc_annual = hc * units
        if nonforfeiture:
            hc_annual *= RATES["exhibit_e"]["nonforfeiture"]
        annual += hc_annual
        steps.append((f"+ {round(hc_annual,2)} 0-day home care rider", round(annual, 2)))

    annual = round(annual, 2)
    mf = MODAL[mode]
    modal_payment = round(annual * mf, 2)
    return {
        "carrier": "CareScout", "cohort": cohort, "plan_cell": cell,
        "issue_age": age, "daily_benefit": daily_benefit, "coverage_max": coverage_max,
        "benefit_ratio": round(coverage_max / daily_benefit / 365.25, 8),
        "inflation": bio, "deductible": deductible, "zero_day_hc": bool(zero_day_hc),
        "nonforfeiture": bool(nonforfeiture),
        "annual_premium": annual, "mode": mode, "modal_factor": mf,
        "modal_payment": modal_payment,
        "steps": steps,
    }


if __name__ == "__main__":
    r = quote("male", "Preferred", "Single", 100, 100000, bio="none", age=40, mode="annual")
    print(json.dumps(r, indent=2))
