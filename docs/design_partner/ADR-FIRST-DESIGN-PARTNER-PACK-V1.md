
# ADR First Design Partner Pack — v1

Status: CUSTOMER DEVELOPMENT / COMMERCIAL PILOT / NOT ARCHITECTURE AUTHORITY / NOT DOMAIN AUTHORITY

Release:

~~~
ADR v0.3 — Paid Design-Partner Pilot
software qualification = PAID_DESIGN_PARTNER_PILOT_CANDIDATE
commercial validation  = NOT_ESTABLISHED
~~~

Default first decision domain:

~~~
corn / late-season irrigation
~~~

## 1. What ADR is selling in the first pilot

The first paid pilot does not sell autonomous agronomy.

It sells one bounded capability:

Can this exact agronomic knowledge be used in this exact field and decision context, and can the system show the customer why?

The v0.3 customer loop is:

~~~
customer knowledge
  -> exact source/version
  -> candidate claims
  -> source context
  -> source-faithful review / qualification
  -> target context
  -> ApplicabilityAssessment
  -> Agronomist Workbench
  -> human review
~~~

The pilot must not promise automatic irrigation recommendations, equipment control, DecisionResult, RuntimeBinding, yield uplift, profit uplift, or commercial validation already established.

## 2. Ideal Customer Profile

The best first design partner is not "a farmer" in the abstract.

The target organization is:

A professional agronomy team that already owns irrigation knowledge/protocols, repeatedly applies those rules across many fields or customers, and currently relies on agronomists to decide whether a rule really applies to each field situation.

Preferred organization types:

- independent agronomy/advisory firms;
- irrigation advisory teams;
- large grower agronomy teams;
- agricultural retail/cooperative agronomy teams;
- digital agronomy companies with human agronomists in the loop;
- crop-production organizations with an internal agronomy function.

Preferred first-customer shape:

~~~
3-10 agronomists
corn / late-season irrigation
dozens or hundreds of field contexts
existing protocols / SOPs / Extension guidance
one digital field-data source
10-30 historical or live cases
one budget owner willing to run a paid 30-day pilot
~~~

These are commercial screening targets, not ADR authority requirements.

## 3. Buyer / user / technical roles

### Economic buyer

Typical titles:

- Head of Agronomy;
- Director of Crop Production;
- VP of Agronomy;
- Operations Director;
- Digital Agriculture Lead.

Economic problem:

~~~
our agronomic knowledge is difficult to reuse consistently
+
expert review is expensive
+
context differences are easy to miss
+
we cannot easily reconstruct why a rule was accepted or rejected
~~~

### Daily user

Typical roles:

- agronomist;
- crop advisor;
- irrigation specialist;
- field agronomist.

The daily user asks:

- Is this rule applicable?
- What information is missing?
- What conflicts?
- What measurement mismatch exists?
- What calibration is required?
- What source and version did this judgment come from?

### Technical owner

Typical roles:

- digital agronomy lead;
- farm-management-system owner;
- data engineer;
- IoT/irrigation platform owner.

They provide the context feed/API/CSV integration and maintain field identity mapping.

### Pilot champion

Usually a senior agronomist or digital-agronomy lead who already experiences the workflow pain and will compare ADR against real expert judgment.

## 4. Qualification scorecard before accepting a pilot

A prospect should normally satisfy at least 5 of these 7 conditions:

1. owns agronomic protocols, internal rules or curated knowledge;
2. has at least one working agronomist who can review ADR cases;
3. applies the same knowledge repeatedly across multiple fields/cases;
4. regularly encounters missing context, measurement mismatch, geography mismatch or knowledge conflict;
5. can provide 10-30 historical or current cases;
6. agrees to compare ADR output against human agronomist judgment case by case;
7. has a budget owner willing to pay for a bounded pilot.

Strong negative signals:

- "Give me an AI that automatically irrigates";
- no internal protocol or curated knowledge;
- only one field / one one-off decision;
- no agronomist available for review;
- unwilling to provide real or historical cases;
- wants a free demo but will not define a paid continuation decision;
- expects yield/profit guarantees.

## 5. Recommended first pilot scope

Freeze one decision domain:

~~~
corn / late-season irrigation
~~~

Customer provides:

~~~
3-10 source documents / protocols
20-100 candidate agronomy claims
10-30 real or historical target cases
1 agronomist review team
1 context provider
1 economic buyer / continuation decision owner
~~~

A typical source set may include a company late-season irrigation SOP, university or Extension guidance, sensor interpretation guidance, an irrigation cutoff protocol, and a customer-specific rule set.

## 6. What one pilot case looks like

Example target:

~~~
Field 127
2026-08-19 14:00

crop      = corn
stage     = R4
location  = Nebraska
sensor    = Watermark
root zone = 0-90 cm
reading   = ...
soil      = ...
previous irrigation = ...
~~~

Possible ADR outputs:

~~~
Knowledge A
-> DIRECTLY_APPLICABLE

Knowledge B
-> CONTEXT_GAP
   missing: 60-90 cm soil-water state

Knowledge C
-> CALIBRATION_NEEDED
   source measurement != target measurement

Knowledge D
-> KNOWLEDGE_CONFLICT

Knowledge E
-> UNRESOLVED
   crop-stage authority unavailable
~~~

The pilot agronomist records whether ADR identified the right issue, missed an important issue, blocked something they would accept, allowed something that should have required review, and changed review time.

## 7. 30-day pilot structure

### Days 0-5 — Contract and data readiness

Freeze one decision domain, one customer tenant, source-document set, case sample, agronomist reviewers, one context provider, success metrics, and one commercial continuation decision owner.

No expansion to new crops or new decision domains during this period.

### Days 5-10 — Knowledge onboarding

For each source:

1. preserve exact source and version;
2. extract candidate claims;
3. preserve source context;
4. complete source-faithful review;
5. qualify only claims suitable for the stated pilot use.

Uploading a document does not automatically make it QualifiedKnowledge.

### Days 8-15 — Context integration

Connect one context provider.

Preferred order:

1. direct API;
2. stable JSON/CSV export;
3. structured manual upload for pilot only.

Identity mapping must be explicit for organization/tenant, field, zone where used, crop, season, effective time, available-at time, and measurement semantics.

### Days 12-25 — Case execution

Run 10-30 cases. Deliberately include likely matches, missing-context cases, geography/scope mismatches, measurement/calibration mismatches, conflicting knowledge and unknown cases.

### Days 25-30 — Commercial adjudication

Review what ADR found, what agronomists agreed/disagreed with, time saved or added, false-safe/missed-review evidence, integration/support burden, and whether the customer will pay to continue or expand.

The final question is:

~~~
Will the customer pay to continue using ADR?
~~~

not:

~~~
What additional ADR architecture can we build?
~~~

## 8. Success metrics

Pre-register before the first real case.

Safety/review quality:

- false-safe / missed-review count;
- material context gaps ADR failed to surface;
- unnecessary escalations;
- knowledge conflicts correctly surfaced;
- measurement/calibration mismatches correctly surfaced.

Workflow value:

- baseline agronomist minutes per case;
- ADR-assisted minutes per case;
- cases reviewed per agronomist per day;
- proportion of routine cases requiring full manual research;
- percentage of cases with immediately inspectable provenance.

Commercial value:

- customer willingness to renew;
- willingness to expand to more fields/knowledge;
- willingness to introduce another agronomist/team;
- support/integration burden;
- price resistance and reason.

Any credible false-safe case should trigger case-level root-cause review rather than being averaged away.

## 9. Recommended commercial structure

For the first 1-3 design partners, sell a fixed-scope paid pilot rather than per-acre pricing.

Recommended commercial frame:

~~~
30-day founding design-partner pilot
US$15,000-25,000
~~~

Use the lower end when customer context is already clean and structured, source documents are few, one agronomist team is involved, and integration burden is low.

Use the upper end when data mapping is material, protocols are numerous or inconsistent, multiple reviewers are involved, or onboarding support is substantial.

The price covers onboarding, source/claim preparation, hosted pilot environment, one context integration, 10-30 evaluated cases, weekly review and a final evidence report. It is not a fee for guaranteed agronomic benefit.

## 10. Commercial continuation gate

Before kickoff, both parties should agree on a continuation event such as:

~~~
If ADR meets the agreed review-quality threshold
and demonstrates a meaningful reduction in expert review effort,
the customer will evaluate a paid 3-6 month expansion.
~~~

Do not accept a pilot with no decision owner and no defined continuation decision.

## 11. First meeting questions

Current workflow:

- Walk me through the last time an agronomist decided whether a protocol applied to a specific field.
- What documents or systems did they check?
- How long did it take?
- Who reviewed the conclusion?
- What is usually missing?

Knowledge:

- Which irrigation protocols are actually used today?
- Are they internal, university/Extension, vendor, customer-specific, or mixed?
- How are versions tracked?
- What happens when two sources disagree?
- Which rules are mandatory versus advisory?

Context:

- Which field/crop/stage/soil/water measurements are available?
- What system holds them?
- Are measurement semantics consistent across sensors?
- Can historical decision-time context be reconstructed?
- Which context is routinely missing?

Economics:

- How many agronomists perform this review?
- How many cases per week/month?
- What happens when a rule is applied in the wrong context?
- Is the cost primarily labor, delay, rework, quality risk, or customer trust?
- Who owns the budget?

Pilot commitment:

- Can you provide 10-30 real or historical cases?
- Will agronomists review ADR case by case?
- Who will decide whether the pilot continues?
- If it works, what would you buy next?

## 12. Disqualifying language from our side

Do not pitch:

- AI irrigation autopilot;
- guaranteed better decisions;
- safe recommendation engine;
- automatic agronomy;
- guaranteed higher yield;
- replacement for agronomists.

Preferred framing:

ADR helps an agronomy team determine whether a piece of agricultural knowledge actually fits the current field and decision context before that knowledge enters an operational workflow.

## 13. Companion documents

Customer deployment and daily-use instructions:

~~~
docs/design_partner/ADR-CUSTOMER-DEPLOYMENT-AND-USE-GUIDE-V1.md
~~~

30-day measurement and commercial adjudication:

~~~
docs/design_partner/ADR-30-DAY-PILOT-SCORECARD-V1.md
~~~
