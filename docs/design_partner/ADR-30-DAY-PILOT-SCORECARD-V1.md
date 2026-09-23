
# ADR 30-Day Paid Pilot Scorecard — v1

Status: COMMERCIAL VALIDATION / PILOT MEASUREMENT / NOT DOMAIN AUTHORITY

Decision domain:

~~~
corn / late-season irrigation
~~~

## 1. Pre-registration

Complete before the first customer case.

Record:

~~~
organization
economic buyer
pilot champion
lead agronomist
technical owner
start date
end date
continuation-decision date
source documents
candidate claims
qualified claims admitted to pilot
historical/live cases
context provider
reviewers
~~~

## 2. Baseline measurement

Before showing ADR output, measure representative cases using the customer's current process.

For each baseline case record:

- agronomist;
- start/end time;
- documents/systems consulted;
- final conclusion;
- missing information identified;
- conflicts identified;
- measurement mismatch identified;
- confidence/review escalation;
- total active review minutes.

Do not invent baseline numbers retrospectively.

## 3. ADR case record

For every pilot case record:

~~~
case id
decision time
field/crop/season identity
knowledge refs evaluated
ADR product classification
review_required
missing-context items
conflicts
calibration needs
governed-transform needs
agronomist disposition
agronomist agreement/disagreement
ADR-assisted active review minutes
notes
~~~

## 4. Core review-quality metrics

Agreement: cases where agronomist agrees ADR identified the material applicability issue, divided by reviewed cases.

Do not turn agreement into a scientific correctness claim.

False-safe / missed-review: any case where ADR would have allowed routine/no-review handling but the agronomist identifies a material reason the case required review.

False escalation: cases where ADR requires review but the agronomist determines escalation was clearly unnecessary.

Context-gap discovery: material context gaps ADR found that the current workflow did not explicitly surface before ADR.

Conflict discovery: material knowledge conflicts surfaced before the agronomist independently identified them.

Measurement mismatch discovery: sensor/unit/support/calibration mismatches surfaced by ADR.

Any credible false-safe case is high severity and requires case-level root-cause review.

## 5. Workflow metrics

Track:

- median baseline review minutes;
- median ADR-assisted review minutes;
- p75/p90 when sample permits;
- cases reviewed per agronomist;
- source lookup minutes;
- context gathering minutes;
- repeated questions requiring ADR team support.

Faster is not automatically better. A faster process that creates missed-review risk is a failure.

## 6. Operational metrics

Track:

- API request success/failure;
- provider/integration failures;
- context-ingestion retry burden;
- support tickets/questions;
- customer-data mapping changes;
- unavailable-context frequency;
- ADR-team time per case/customer.

This determines whether the product is economically deployable.

## 7. Commercial metrics

Record:

~~~
customer paid initial pilot? yes/no
pilot price
customer requests extension? yes/no
customer willing to pay for extension? yes/no
proposed extension price
customer wants more fields? yes/no
customer wants more agronomists? yes/no
customer wants another decision domain? yes/no
primary reason to continue
primary reason not to continue
~~~

## 8. Weekly review

Week 1: data quality, source/claim quality, integration friction, and whether the selected use case is repeated enough.

Week 2: applicability patterns, context gaps, agronomist interpretation and any false-safe concern.

Week 3: workflow time, repeated escalation causes, provenance/explanation value and support burden.

Week 4: commercial continuation, what the customer will pay for next, and whether scale means more cases, users or another decision domain.

## 9. Suggested pilot decision thresholds

These are commercial operating targets, not architecture authority.

Minimum evidence volume:

~~~
>= 10 fully reviewed real/historical cases
preferred = 20-30
~~~

Mandatory commercial-decision condition:

~~~
no unresolved credible false-safe issue
~~~

Desired value signal:

~~~
material reduction in routine manual research/review effort
or
material improvement in issue detection / provenance quality
~~~

Commercial success additionally requires:

~~~
customer explicitly willing to pay to continue or expand
~~~

If the customer likes the demo but will not pay, commercial validation remains NOT_ESTABLISHED.

## 10. Final pilot adjudication

CONTINUE:
customer will pay for a defined expansion and no unresolved review-quality blocker exists.

CONTINUE WITH NARROWER SCOPE:
value exists but only for a smaller knowledge/domain/case class.

TECHNICALLY USEFUL / COMMERCIALLY UNPROVEN:
agronomists find value but no paid continuation exists.

STOP:
no material workflow/review value, unacceptable false-safe risk, or support/integration burden destroys economics.

## 11. Final report

The final customer report should contain:

1. exact pilot scope;
2. number/type of sources, claims and cases;
3. applicability outcome distribution;
4. material context gaps found;
5. conflicts found;
6. measurement/calibration mismatches found;
7. agronomist agreement/disagreement;
8. review-time comparison;
9. integration/support burden;
10. limitations/nonclaims;
11. paid continuation decision.

Do not turn pilot observations into generalized agronomic-effectiveness claims.
