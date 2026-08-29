#!/usr/bin/env python3
"""Manhattan Life Omniflex Short-Term Care (STC) premium calculator.

Rates from the carrier's Exhibit 1 premium-rate PDFs (Michigan: ManhattanLife
Insurance and Annuity Co., form AT7002; Texas: Standard Life and Casualty
Insurance Co., form AL7060). Rates are an ANNUAL premium per $10 of daily
benefit, indexed by issue age (45-89), benefit period (90/180/270/360 days),
and elimination period (0/20/30/60/90/100 days). Home care is an additive
rider at the same daily benefit; inflation switches both tables to their
inflation variant. Smoker +10%, spousal -10%, then the modal factor.

PENDING: confirm the additive home-care assembly against a real Omniflex
illustration (facility + home-care rider premiums summed at the same daily
benefit / EP / benefit period).
"""
import json, os
HERE=os.path.dirname(os.path.abspath(__file__))
R=json.load(open(os.path.join(HERE,'rates.json')))
BPS=R['benefit_periods']; EPS=set(R['elim_periods']); F=R['factors']

def quote(state, age, daily_benefit, benefit_period, elim_period,
          inflation=False, home_care=False, smoker=False, spousal=False, mode='monthly'):
    state=state.upper()
    if state not in R['rates']: raise ValueError(f"Omniflex is only filed for {list(R['rates'])} here.")
    if not (45<=age<=89): raise ValueError("Issue age must be 45-89.")
    if benefit_period not in BPS: raise ValueError(f"Benefit period must be one of {BPS} days.")
    if elim_period not in EPS: raise ValueError(f"Elimination period must be one of {sorted(EPS)} days.")
    if daily_benefit<=0 or daily_benefit%10: raise ValueError("Daily benefit must be a positive multiple of $10.")
    bi=BPS.index(benefit_period); ep=str(elim_period); a=str(age); units=daily_benefit/10.0
    fac=R['rates'][state]['facility_infl' if inflation else 'facility_none'][ep][a][bi]
    hc =R['rates'][state]['homecare_infl' if inflation else 'homecare_none'][ep][a][bi] if home_care else 0.0
    steps=[(f"facility rate {fac}"+(f" + home-care rate {hc}" if home_care else "")+f" per $10 x {units:g} units", round((fac+hc)*units,2))]
    annual=(fac+hc)*units
    if smoker: annual*=F['smoker']; steps.append((f"x {F['smoker']} smoker load", round(annual,2)))
    if spousal: annual*=F['spousal']; steps.append((f"x {F['spousal']} spousal discount", round(annual,2)))
    annual=round(annual,2)
    mf=F[mode]; 
    return {'carrier':'omniflex','state':state,'company':R['states'][state]['company'],
            'issue_age':age,'daily_benefit':daily_benefit,'benefit_period':benefit_period,
            'elim_period':elim_period,'inflation':bool(inflation),'home_care':bool(home_care),
            'smoker':bool(smoker),'spousal':bool(spousal),'annual_premium':annual,
            'mode':mode,'modal_factor':mf,'modal_payment':round(annual*mf,2),
            'benefit_pool':daily_benefit*benefit_period,'steps':steps}

if __name__=='__main__':
    r=quote('MI',60,150,180,60,inflation=False,home_care=True,mode='monthly')
    print(json.dumps(r,indent=2))
