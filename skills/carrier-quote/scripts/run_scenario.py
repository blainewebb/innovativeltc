#!/usr/bin/env python3
"""Run a saved multi-option quote scenario for a client, given just their age/gender.

Blaine defines his common scenarios once in scenarios.json (e.g. the three options
he always presents). Then a single call fills in the applicant and quotes every
option, so "run my standard 3 for a 62-year-old female" is one step.

Also supports a budget/reverse question ("what does $X/mo buy across the options?")
via --budget.
"""
import json, os, sys, argparse

HERE = os.path.dirname(os.path.abspath(__file__))
SCENARIOS = json.load(open(os.path.join(HERE, "scenarios.json")))["scenarios"]

# carrier name -> its rater module
CARRIERS = {}
def _load_carrier(name):
    if name not in CARRIERS:
        sys.path.insert(0, os.path.join(HERE, name))
        CARRIERS[name] = __import__("rater")
        sys.path.pop(0)
    return CARRIERS[name]


def run_scenario(name, age, gender, mode="monthly", state=None):
    if name not in SCENARIOS:
        raise ValueError(f"Unknown scenario '{name}'. Available: {', '.join(SCENARIOS)}")
    sc = SCENARIOS[name]
    rater = _load_carrier(sc["carrier"])
    rows = []
    for opt in sc["options"]:
        cfg = {k: v for k, v in opt.items() if k != "name"}
        q = rater.quote(age, gender, cfg.pop("monthly_benefit"),
                        mode=mode, state=state, **cfg)
        rows.append({
            "option": opt["name"],
            "monthly_benefit": opt["monthly_benefit"],
            "benefit_period": opt.get("benefit_period"),
            "inflation": opt.get("inflation"),
            "monthly_premium": q.get("modal_payment"),
            "annual_premium": q.get("annual_premium"),
        })
    return {"scenario": sc.get("label", name), "carrier": sc["carrier"],
            "applicant": f"{age}{gender[0].upper()}", "options": rows}


def run_budget(target_monthly, age, gender, scenario=None, carrier="ngl", mode="monthly", state=None):
    """'If they can spend $X/mo, how much benefit does that buy?' — solved per option
    config (holding benefit period/inflation of each option, solving the benefit) or,
    if no scenario given, for one default config."""
    rater = _load_carrier(carrier)
    configs = []
    if scenario and scenario in SCENARIOS:
        carrier = SCENARIOS[scenario]["carrier"]
        rater = _load_carrier(carrier)
        for opt in SCENARIOS[scenario]["options"]:
            configs.append((opt["name"], {k: v for k, v in opt.items()
                                          if k not in ("name", "monthly_benefit")}))
    else:
        configs.append(("Default (36-mo / 90-day / 3% compound)",
                        {"benefit_period": "36", "elimination": "90", "inflation": 0.03}))
    out = []
    for label, cfg in configs:
        r = rater.benefit_for_premium(target_monthly, age, gender, mode=mode, state=state, **cfg)
        out.append({"config": label, "buys_monthly_benefit": r["solved_monthly_benefit"],
                    "at_premium": target_monthly})
    return {"budget": target_monthly, "carrier": carrier,
            "applicant": f"{age}{gender[0].upper()}", "results": out}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--scenario", default="standard-3")
    ap.add_argument("--age", type=int, required=True)
    ap.add_argument("--gender", default="female")
    ap.add_argument("--state", default=None)
    ap.add_argument("--mode", default="monthly")
    ap.add_argument("--budget", type=float, default=None, help="target monthly premium (reverse quote)")
    a = ap.parse_args()
    if a.budget:
        print(json.dumps(run_budget(a.budget, a.age, a.gender, scenario=a.scenario,
                                    mode=a.mode, state=a.state), indent=2))
    else:
        print(json.dumps(run_scenario(a.scenario, a.age, a.gender, mode=a.mode, state=a.state), indent=2))
