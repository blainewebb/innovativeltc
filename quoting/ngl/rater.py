#!/usr/bin/env python3
"""NGL EssentialLTC (NLTC200) premium calculator.

Reads the rate tables extracted from NGL's official rate workbook (rates.json)
and computes a premium the same way NGL's own software does: look up the base
rate for the applicant, then apply the published factors multiplicatively.

IMPORTANT: Outputs are only as trustworthy as the algorithm's match to NGL's
software. Validate against at least one real NGL-generated illustration before
relying on a number in front of a client. See README.md ("Validation").
"""
import json, os, argparse, math

HERE = os.path.dirname(os.path.abspath(__file__))
RATES = json.load(open(os.path.join(HERE, "rates.json")))


def _age_row(table, age):
    if age <= 40:
        return table["18-40"]
    if str(age) in table:
        return table[str(age)]
    raise ValueError(f"Issue age {age} is outside NGL's rated range (18–79).")


def _pick_table(state, worksite):
    if state and state.upper() == "CO":
        return "CO Non-Worksite"
    if worksite:
        return "Generic Worksite"
    return "Generic Non-Worksite"


def quote(
    age,
    gender,                 # 'male' | 'female' (ignored for CO/worksite, which are unisex 'single')
    monthly_benefit,        # dollars/month
    benefit_period="36",    # '24','36','48','60','72','lifetime'
    elimination="90",       # '90' | '180'
    inflation=None,         # None/0 for level, or 0.01..0.05 compound COLA
    joint=False,            # True = couple/partner (joint) rate
    pay="level",            # 'level' | '10pay' | 'single'
    mode="monthly",         # 'annual','semiannual','quarterly','monthly'
    risk_class="Premier",
    class_one=False,        # substandard "Class One" offer = +35% (Premier is the only standard class NGL writes)
    state=None,
    worksite=False,
    rider_shared_additional=False,   # SBA rider (needs total benefit period)
    total_benefit_period=None,       # required if rider_shared_additional
    rider_first_day_hccs=False,      # FDC rider
    rider_shortened_benefit=False,   # SBN rider
):
    # NGL sells the monthly benefit only in $300 increments — snap to the
    # nearest quotable amount so every premium we return is bindable.
    monthly_benefit = max(RATES["base_unit"], round(monthly_benefit / RATES["base_unit"]) * RATES["base_unit"])

    f = RATES["factors"]
    tname = _pick_table(state, worksite)
    table = RATES["tables"][tname]
    row = _age_row(table, age)

    # --- population / base rate ---
    if joint:
        pop = "joint"
    elif tname == "Generic Non-Worksite":
        pop = gender.lower()
    else:
        pop = "single"     # CO & Worksite are unisex
    base = row["base"].get(pop)
    if base is None:
        raise ValueError(f"No base rate for '{pop}' in {tname}.")

    units = monthly_benefit / RATES["base_unit"]     # per $300 of monthly benefit
    annual = base * units
    steps = [(f"base {base} × {units:g} units (${monthly_benefit:,.0f}/mo ÷ $300)", annual)]

    # --- inflation / compound COLA ---
    if inflation:
        cf = row["cola"].get(str(inflation))
        if cf is None:
            raise ValueError(f"Unsupported inflation option {inflation}. Choose 0.01–0.05 or none.")
        annual *= cf
        steps.append((f"× {cf} compound COLA @ {inflation:.0%}", annual))

    # --- benefit period ---
    bpf = f["benefit_period"].get(str(benefit_period))
    if bpf is None:
        raise ValueError(f"Unsupported benefit period '{benefit_period}'.")
    annual *= bpf
    steps.append((f"× {bpf} benefit period ({benefit_period}-mo)", annual))

    # --- elimination period ---
    epf = f["elimination_period"].get(str(elimination))
    if epf is None:
        raise ValueError(f"Unsupported elimination period '{elimination}'.")
    annual *= epf
    steps.append((f"× {epf} elimination period ({elimination}-day)", annual))

    # --- risk class ---
    rcf = f["risk_class"].get(risk_class, 1.0)
    annual *= rcf
    if rcf != 1.0:
        steps.append((f"× {rcf} risk class ({risk_class})", annual))
    if class_one:
        annual *= 1.35
        steps.append(("× 1.35 Class One (substandard) offer", annual))

    # --- optional riders (multiplicative) ---
    if rider_shared_additional:
        tbp = str(total_benefit_period or benefit_period)
        sba = f["rider_shared_additional_by_total_bp"].get(tbp)
        if sba is None:
            raise ValueError("Shared Additional rider needs a valid total benefit period.")
        annual *= sba
        steps.append((f"× {sba} Shared Additional Policy Limit rider (total BP {tbp}-mo)", annual))
    if rider_first_day_hccs:
        annual *= f["rider_first_day_hccs"]
        steps.append((f"× {f['rider_first_day_hccs']} First-Day HCCS rider", annual))
    if rider_shortened_benefit:
        annual *= f["rider_shortened_benefit_period"]
        steps.append((f"× {f['rider_shortened_benefit_period']} Shortened Benefit Period rider", annual))

    # --- pay option ---
    result = {"table": tname, "population": pop, "inputs": locals_clean(locals())}
    if pay == "level":
        annual_premium = annual
        result["pay"] = "Level (to age 100)"
    elif pay == "10pay":
        tp = row["tenpay"]
        annual_premium = annual * tp
        steps.append((f"× {tp} 10-Pay factor", annual_premium))
        result["pay"] = "10-Pay"
    elif pay == "single":
        sp = row["singlepay"]
        single_premium = annual * sp
        steps.append((f"× {sp} Single-Pay factor", single_premium))
        result["pay"] = "Single-Pay"
        result["single_premium"] = round(single_premium, 2)
        result["steps"] = steps
        return result
    else:
        raise ValueError(f"Unsupported pay option '{pay}'.")

    # --- modal payment ---
    mf = f["payment_mode"].get(mode)
    if mf is None:
        raise ValueError(f"Unsupported payment mode '{mode}'.")
    modal_payment = annual_premium * mf

    result.update({
        "annual_premium": round(annual_premium, 2),
        "mode": mode,
        "modal_factor": mf,
        "modal_payment": round(modal_payment, 2),
        "annualized": round(modal_payment * {"annual":1,"semiannual":2,"quarterly":4,"monthly":12}[mode], 2),
        "steps": steps,
    })
    return result


def cost_of_waiting(age, gender, monthly_benefit, benefit_period="36", inflation=0.03,
                    state=None, care_growth=0.03, years=(0, 1, 3, 5, 10)):
    """Show what waiting costs: older issue age AND a bigger benefit needed because
    the cost of care keeps rising (default 3%/yr). Returns the premium at each wait
    horizon, the coverage they'd then need (snapped to $300), and the increase vs.
    buying now. Past issue age 79 they're flagged ineligible (uninsurable)."""
    def price(a, ben):
        try:
            return quote(a, gender, ben, benefit_period=benefit_period, elimination="90",
                         inflation=inflation, mode="monthly", state=state)["modal_payment"]
        except Exception:
            return None
    now = price(age, monthly_benefit)
    rows = []
    for yr in years:
        a = age + yr
        need = max(300, round(monthly_benefit * (1 + care_growth) ** yr / 300) * 300)
        eligible = a <= 79
        prem = price(a, need) if eligible else None
        rows.append({"wait_years": yr, "issue_age": a, "coverage_needed": need,
                     "eligible": eligible, "monthly_premium": prem,
                     "increase_vs_now": (round(prem - now, 2) if (prem is not None and now is not None) else None)})
    return {"age": age, "gender": gender, "benefit": monthly_benefit,
            "buy_now_premium": now, "rows": rows}


def _cost_figure(result):
    """The premium a quote result is 'quoting at' — single premium or modal payment."""
    return result.get("single_premium", result.get("modal_payment"))


def benefit_for_premium(target_premium, age, gender, mode="monthly", **kw):
    """Reverse quote: 'If they can spend $X, how much benefit does that buy?'

    Premium is exactly linear in the monthly benefit (benefit only scales the unit
    count; every other factor is a constant multiplier), so we price one reference
    unit and scale. `target_premium` is in the same cadence as `mode` (monthly target
    → monthly premium), or the single premium if pay='single'. Returns the solved
    monthly benefit plus the full quote at that benefit.
    """
    ref = quote(age, gender, RATES["base_unit"], mode=mode, **kw)   # $300/mo = 1 unit
    ref_cost = _cost_figure(ref)
    raw = RATES["base_unit"] * (target_premium / ref_cost)
    # NGL sells in $300 increments — floor to the largest amount within budget.
    monthly_benefit = max(RATES["base_unit"], math.floor(raw / RATES["base_unit"]) * RATES["base_unit"])
    full = quote(age, gender, monthly_benefit, mode=mode, **kw)
    return {
        "target_premium": target_premium,
        "solved_monthly_benefit": monthly_benefit,   # a quotable $300 increment
        "actual_premium": _cost_figure(full),        # premium at that benefit (<= target)
        "quote": full,
    }


def quote_couple(age1, gender1, age2, gender2, monthly_benefit, **kw):
    """Joint (two-life) NGL policy.

    Verified against NGL illustrations: the combined premium is the JOINT-column
    rate at the OLDER insured's age (× units × that age's COLA × policy factors ×
    riders). If either insured dies, the survivor reverts to their own single-life
    premium — so those are returned too. `kw` accepts the same options as quote()
    (benefit_period, elimination, inflation, pay, mode, riders, state, etc.).

    Note: confirmed on a 62/60 couple where "older age" == "client 1". A couple with
    a wide age gap is worth one spot-check to be certain the older age (not client
    order) is what drives it.
    """
    (old_age, old_g), (yng_age, yng_g) = sorted(
        [(age1, gender1), (age2, gender2)], key=lambda x: -x[0])
    combined = quote(old_age, old_g, monthly_benefit, joint=True, **kw)
    survivor_older = quote(old_age, old_g, monthly_benefit, **kw)
    survivor_younger = quote(yng_age, yng_g, monthly_benefit, **kw)
    return {
        "combined_joint": combined,
        "survivor_if_" + old_g: survivor_older,
        "survivor_if_" + yng_g: survivor_younger,
    }


def locals_clean(d):
    keep = ("age","gender","monthly_benefit","benefit_period","elimination","inflation",
            "joint","pay","mode","risk_class","state","worksite")
    return {k: d[k] for k in keep if k in d}


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="NGL EssentialLTC quote")
    ap.add_argument("--age", type=int, required=True)
    ap.add_argument("--gender", default="female")
    ap.add_argument("--benefit", type=float, required=True, help="monthly benefit $")
    ap.add_argument("--bp", default="36")
    ap.add_argument("--ep", default="90")
    ap.add_argument("--inflation", type=float, default=None)
    ap.add_argument("--joint", action="store_true")
    ap.add_argument("--pay", default="level")
    ap.add_argument("--mode", default="monthly")
    ap.add_argument("--state", default=None)
    a = ap.parse_args()
    r = quote(a.age, a.gender, a.benefit, benefit_period=a.bp, elimination=a.ep,
              inflation=a.inflation, joint=a.joint, pay=a.pay, mode=a.mode, state=a.state)
    print(json.dumps(r, indent=2))
