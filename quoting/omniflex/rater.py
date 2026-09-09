#!/usr/bin/env python3
"""Manhattan Life Omniflex Short-Term Care (STC) premium calculator.

Model verified to the penny against a real StrateCision Omniflex illustration
(TX, male 61, 3 designs). A quote is:

  base   = facility_annual + home_care_annual            # each: rate/$10 x daily/10
  base  *= 1.10 (smoker)  *= 0.90 (spousal)
  annual = round(base + rx_annual, 2)                    # + prescription-drug benefit
  modal  = round(annual x modal_factor, 2)               # + a $25 one-time policy fee

Facility and the home-care rider carry INDEPENDENT daily benefit, benefit
period, and elimination period. Inflation (5% simple) switches the facility and
home-care tables to their inflation variant. Rates from the carrier's Exhibit 1
PDFs (MI: ManhattanLife/AT7002; TX: SLAC/AL7060). Rx premium is not adjusted by
smoker/spousal. The facility/home-care cash benefits equal 50% of the daily
benefit (an included feature; no separate premium).
"""
import json, os
HERE=os.path.dirname(os.path.abspath(__file__))
R=json.load(open(os.path.join(HERE,'rates.json')))
BPS=R['benefit_periods']; EPS=set(R['elim_periods']); F=R['factors']; RXM=R['rx_max']; FEE=R['policy_fee']

def _rate(state, tbl, ep, age, bp):
    if bp not in BPS: raise ValueError(f"Benefit period must be one of {BPS} days.")
    if ep not in EPS: raise ValueError(f"Elimination period must be one of {sorted(EPS)} days.")
    return R['rates'][state][tbl][str(ep)][str(age)][BPS.index(bp)]

def quote(state, age, facility_daily, facility_bp=360, facility_ep=0,
          home_care=False, hc_daily=None, hc_bp=360, hc_ep=0,
          inflation=False, rx_max=300, smoker=False, spousal=False, mode='monthly'):
    state=state.upper()
    if state not in R['rates']: raise ValueError(f"Omniflex is only filed for {list(R['rates'])} here.")
    if not (45<=age<=89): raise ValueError("Issue age must be 45-89.")
    if facility_daily<=0 or facility_daily%10: raise ValueError("Facility daily benefit must be a multiple of $10.")
    a=str(age); steps=[]
    fac=_rate(state,'facility_infl' if inflation else 'facility_none',facility_ep,age,facility_bp)*(facility_daily/10.0)
    steps.append((f"facility {facility_daily}/day, {facility_bp}-day, {facility_ep}-day EP", round(fac,2)))
    hc=0.0
    if home_care:
        hcd=hc_daily if hc_daily else facility_daily
        if hcd<=0 or hcd%10: raise ValueError("Home-care daily benefit must be a multiple of $10.")
        hc=_rate(state,'homecare_infl' if inflation else 'homecare_none',hc_ep,age,hc_bp)*(hcd/10.0)
        steps.append((f"home care {hcd}/day, {hc_bp}-day, {hc_ep}-day EP", round(hc,2)))
    rx=0.0
    if rx_max:
        if rx_max not in RXM: raise ValueError(f"Rx max must be one of {RXM}.")
        rx=R['rates'][state]['rx'][a][RXM.index(rx_max)]
        steps.append((f"+ {rx} Rx benefit (${rx_max}/yr)", round(fac+hc+rx,2)))
    sub=fac+hc+rx
    if smoker: sub*=F['smoker']; steps.append((f"x {F['smoker']} smoker", round(sub,2)))
    if spousal: sub*=F['spousal']; steps.append((f"x {F['spousal']} spousal", round(sub,2)))
    annual=round(sub,2)
    mf=F[mode]
    return {'carrier':'omniflex','state':state,'company':R['states'][state]['company'],
            'issue_age':age,'facility_daily':facility_daily,'facility_bp':facility_bp,'facility_ep':facility_ep,
            'home_care':bool(home_care),'hc_daily':(hc_daily if home_care else None),'hc_bp':(hc_bp if home_care else None),
            'hc_ep':(hc_ep if home_care else None),'inflation':bool(inflation),'rx_max':rx_max,
            'smoker':bool(smoker),'spousal':bool(spousal),'annual_premium':annual,'mode':mode,'modal_factor':mf,
            'modal_payment':round(annual*mf,2),'policy_fee':FEE,
            'facility_pool':facility_daily*facility_bp,
            'hc_pool':((hc_daily or facility_daily)*hc_bp if home_care else 0),'steps':steps}

if __name__=='__main__':
    # illustration: TX M61, three designs
    for lbl,kw in [
      ('col1',dict(facility_daily=400,facility_ep=0,home_care=True,hc_daily=300,hc_ep=0,inflation=True)),
      ('col2',dict(facility_daily=300,facility_ep=90,home_care=True,hc_daily=300,hc_ep=0,inflation=True)),
      ('col3',dict(facility_daily=100,facility_ep=0,home_care=True,hc_daily=100,hc_ep=0,inflation=False))]:
        r=quote('TX',61,**kw); print(lbl,'monthly',r['modal_payment'],'annual',r['annual_premium'])
