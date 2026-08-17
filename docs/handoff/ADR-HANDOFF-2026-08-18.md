# Agronomy Deployment Runtime — Conversation Handoff — 2026-08-18

Status: **CONVERSATION HANDOFF ONLY — NOT ARCHITECTURE AUTHORITY**

This handoff supersedes the implementation state recorded in `docs/handoff/ADR-HANDOFF-2026-08-17.md` / Draft PR #40. PR #40 remains useful historical context for the D02 frontier, but it is materially stale and must not be used as current implementation state.

This document exists so the next conversation can resume without reconstructing the product thesis, standalone/GEOX boundary, authority order, the D02→D06 chain, Gate D, E01, the deliberate MVP reprioritization, P06/P07/P08, or the current v0.3 paid-pilot release frontier.

If this handoff conflicts with Frozen Architecture v1.0, Final Adjudication, Master Task Line, Version Slicing, merged implementation contracts, live repository facts, or exact CI evidence, the higher authority wins.

---

## 0. Repository / branch / PR facts at handoff

Repository:

```text
liyongshang44-max/agronomy-deployment-runtime
```

Actual/default `main` at this handoff:

```text
730c68e8b0d6d4589c8e2db20293e775da303bbd
```

That commit is the actual merge of:

```text
PR #53 — feat(v0.3): add pilot-grade P08 recovery and SLO controls
MTL-P08 — Pilot Recovery / Incident Replay / SLO
```

Exact P08 implementation candidate:

```text
ad43e3bc07442f02fa9b7e87dff44b97abe5ce4c
```

P08 actual-main verification:

```text
ADR Constitution
run: 32049874277
head/main: 730c68e8b0d6d4589c8e2db20293e775da303bbd
result: SUCCESS
```

Therefore:

```text
MTL-P08 = CLOSED
```

The current active software-engineering frontier is **not P08** and is **not E02**.

It is:

```text
ADR v0.3
Paid Design-Partner Pilot Candidate
Integrated Release Acceptance
```

Current release branch:

```text
feat/v0.3-paid-pilot-release-acceptance
```

Current exact head:

```text
5cdba2633ae6f6064ca36519ba7aea1607c81bfe
```

Current PR:

```text
PR #54 — test(v0.3): close paid-pilot integrated release acceptance
```

PR #54 current live state:

```text
OPEN
READY
1 commit
acceptance/docs/package wiring only
```

Exact candidate tree:

```text
c43c0c70c2fb2f492b375e5931e693485f343d17
```

Exact feature-head gate:

```text
run: 32051054471
job: 95450244905
result: SUCCESS
```

Exact synthetic merge candidate:

```text
4144ac356ac0fb0f0ccbdce82b35673a56ca7471
```

Draft merge-candidate gate:

```text
run: 32051383180
attempt: 1
job: 95451307233
result: SUCCESS
```

Ready-state independent revalidation has also already completed:

```text
run: 32051383180
attempt: 2
job: 95452548805
result: SUCCESS
```

Ready-state job steps all completed successfully:

```text
Constitutional static checks  SUCCESS
Constitutional acceptance     SUCCESS
Post Checkout                 SUCCESS
```

The exact current merge ref remains:

```text
refs/pull/54/merge
=
4144ac356ac0fb0f0ccbdce82b35673a56ca7471
```

The next conversation should therefore **not** rerun development or reopen P08. The remaining software-delivery frontier is only:

```text
final no-drift verification
        ↓
expected-head merge of PR #54 using 5cdba263...
        ↓
read actual refs/heads/main
        ↓
verify actual merge parents
        ↓
exact actual-main full-root CI
        ↓
only then:
ADR v0.3 SOFTWARE ENGINEERING CLOSED
release class = PAID_DESIGN_PARTNER_PILOT_CANDIDATE
commercial validation = NOT_ESTABLISHED
```

Important live-evidence note: the PR #54 body still says Ready-state revalidation remains. That prose is stale. Live Actions attempt 2 is newer authority and has already closed the Ready revalidation gate.

This handoff itself must remain docs-only and separate from PR #54.

---

# 1. Authority order — do not let implementation convenience override architecture

The authority order remains:

```text
Frozen Architecture v1.0
  > Final Architecture / Capability adjudication
  > Capability Map
  > Master Task Line
  > Version Slicing
  > merged implementation contracts / exact repository facts
  > current live PR / exact CI evidence
  > conversation handoff
```

Core governing files include:

```text
docs/architecture/ADR-STANDALONE-PRODUCT-ARCHITECTURE-v1.0.md
docs/architecture/ADR-REPO-CONSTITUTION-v1.0.md
docs/architecture/ADR-COMPLETE-COMPONENT-ARCHITECTURE-v1.0.md
docs/architecture/ADR-AGRONOMIC-CONTEXT-AND-PUBLIC-RUNTIME-CONTRACT-v1.0.md
docs/architecture/ADR-ARCHITECTURE-v1.0-FINAL-ADJUDICATION.md

docs/planning/ADR-CAPABILITY-MAP-01.md
docs/planning/ADR-CAPABILITY-MAP-01-FINAL-ADJUDICATION.md
docs/planning/ADR-MASTER-TASK-LINE-01.md
docs/planning/ADR-MASTER-TASK-LINE-01-REVIEW-ADJUDICATION.md
docs/planning/ADR-VERSION-SLICING-01.md
```

Permanent rule:

> If implementation difficulty appears to require reinterpretation of Architecture authority, do not silently encode the reinterpretation. Follow the frozen authority exactly or open an explicit adjudication path.

A recurring working rule from this conversation is:

> When a downstream task reveals a missing predecessor authority, repair/version the predecessor separately rather than hardcoding the missing authority inside the downstream task.

---

# 2. Product origin — why ADR exists as a standalone product

The project began from a GEOX problem, not from a plan to build a separate generic agriculture platform.

The original question was approximately:

```text
How can GEOX use agronomic knowledge at low cost?
```

The first obvious model looked like:

```text
papers / protocols / agronomists
        ↓
LLM extraction
        ↓
structured rules
        ↓
match field conditions
        ↓
use advice
```

The key realization was that extraction is not the hard boundary.

The hard problem is:

> Under what governed conditions may a scientific/agronomic statement that was valid in SourceContext be transported into a specific TargetContext and DecisionProblem without silently expanding its meaning or authority?

That forced the decomposition that must remain intact:

```text
Source / SourceArtifact
        ↓
Claim
        ↓
source-faithful review
        ↓
scientific qualification
        ↓
QualifiedKnowledge / DerivedKnowledge / Conflict
        ↓
KnowledgeRelease
        ↓
DecisionProblem
        ↓
ContextDatum / Reference / Receipt / ContextManifest
        ↓
RuntimeProfile / Deployment
        ↓
KnowledgeRetrievalResult
        ↓
ApplicabilityAssessment
        ↓
RuntimePlan
        ↓
InformationRequirement
        ↓
RuntimeEligibility
        ↓
RuntimeBinding
        ↓
Specification / Implementation / ImplementationConformance
        ↓
Runtime Execution
        ↓
RuntimeResult / RuntimeDatum
        ↓
RuntimeAlternativeSet
        ↓
DecisionRobustness
        ↓
DecisionResult
        ↓
Outcome / Evaluation
```

The useful shorthand remains:

```text
Agronomy Compiler + Agronomy Runtime
```

with two separate compile stages:

```text
Scientific compile:
Source → Claims → Qualified/Derived Knowledge

Runtime compile:
DecisionProblem + Knowledge + exact Context + Profile/Deployment
→ Applicability → RuntimePlan → Eligibility → Binding → Execution
```

Do not collapse these into a single LLM inference surface.

---

# 3. Standalone relationship to GEOX — frozen boundary

ADR remains intentionally independent:

```text
independent repository
independent data model
independent API
independent authority model
independent deployment
independent release cycle
independent customer integration surface
```

GEOX is:

```text
first-party adapter
reference consumer
possible provider of context/state/model/outcome data
field-validation substrate
```

GEOX is not:

```text
ADR host
ADR schema authority
ADR scientific authority
ADR IAM authority
required ADR core dependency
```

Dependency direction:

```text
ADR public contracts / SDK / APIs
                ▲
                │
              GEOX
```

Never:

```text
ADR core
  ↓
GEOX internals / GEOX database / GEOX-specific ontology
```

Permanent checks include:

```text
NO @geox/* dependency in core
NO GEOX DB/table/schema authority in ADR core
NO MCFT/CAP/KBS/T3R1 vocabulary in ADR core ontology
core packages cannot depend on GEOX adapters
first-party adapters cannot grant scientific qualification
first-party adapters cannot invent transformations or decision authority
remove adapters/geox → standalone core remains valid
GEOX unavailable → non-GEOX reference acceptance remains valid
```

This boundary matters again in v0.3 release acceptance: required P03 Non-GEOX Reference Integration cannot be replaced by optional P04 GEOX integration.

---

# 4. Commercial thesis — retain as thesis, not PMF fact

The likely buyer-side scarcity is not merely access to agronomic information. Customers already possess agronomists, protocols, crop rules, models, research, supplier guidance and internal expertise.

The possible scarce resource is:

```text
agronomist throughput
```

The commercial thesis remains:

```text
customer already owns agronomy
        ↓
but cannot safely deploy it over many field/context combinations
without repeated expert reconstruction/review
        ↓
ADR turns governed agronomy into reusable,
traceable and replayable deployment/runtime authority
        ↓
experts focus on unresolved/material cases
```

Future empirical validation should prioritize:

```text
minutes / case
cases / agronomist
fields / agronomist
review / escalation rate
override rate
false-safe / false-resolved cases
integration burden
support burden
continuation willingness
paid expansion signal
```

Do not claim PMF, yield uplift, agronomic effectiveness, safety improvement or commercial success from repository acceptance tests.

---

# 5. What this conversation actually accomplished

The 2026-08-17 handoff stopped at:

```text
main @ d36564002aad64b3b010b72b66a8d661d8826582
S03 CLOSED
D02 first implementation exists
D02 head 1aff53862...
first exact-head root CI GREEN
no D02 PR yet
```

This conversation moved the repository through:

```text
D02 Runtime Execution Broker                    CLOSED
D03 RuntimeResult / RuntimeDatum                 CLOSED
D04 RuntimeAlternativeSet / Coverage Authority  CLOSED
S01 Policy action-semantics hardening            CLOSED
D02 post-D03 Policy RuntimeDatum input seam      CLOSED
A05 RuntimeProfile v2 robustness requirement     CLOSED
D05 DecisionRobustness / MaterialActionSignature CLOSED
D06 DecisionResult                               CLOSED
Gate D — continuous Decision Runtime Proof       CLOSED
E01 Outcome Ingress                              CLOSED

MVP reprioritization:
full E-track paused for paid-pilot path

P06 pilot async/idempotency/observability        CLOSED
P07 pilot security/retention/audit isolation     CLOSED
P08 pilot recovery/incident replay/SLO           CLOSED

CURRENT:
v0.3 paid-pilot integrated release acceptance   READY / FINAL MERGE FRONTIER
```

This is the main story of the conversation.

---

# 6. Exact PR / merge progression

High-value implementation progression:

```text
PR #41
MTL-D02 Runtime Execution Broker
head 48af7dcd9c76ee0580aa845d0e6a51fac8413ad4
merge 41fde1e1bde08b2d3d3d6765bae0872a5e1ed713
CLOSED

PR #42
MTL-D03 RuntimeResult / RuntimeDatum
head 6fe03007b338f2a1e6e8d9776cea98222931f858
merge efc76cb35d029239fb1a98d0c7026c795879a9df
CLOSED

PR #43
MTL-D04 RuntimeAlternativeSet / coverage authority
head 7a7a75bb9d129283136407d95895f19ea07fcd57
merge 37064185119244a1da7704b98647b89222b4886d
CLOSED

PR #44
S01 Policy action-semantics hardening
merge 551ff1a2c3010e924e2ac2da31f905d8e948fdaa
CLOSED

PR #45
D02 post-D03 Policy RuntimeDatum input seam
merge ef30669925def9c843ec93c48cea3a98be7632f7
CLOSED

PR #46
A05 RuntimeProfile v2 robustness requirement
merge 60c45d8a7ebb2df95abc96c92ddc91da0bc2d07e
CLOSED

PR #47
MTL-D05 DecisionRobustness / MaterialActionSignature
merge 935469fc3b47554cc05ec7defbd25325356dfa8f
CLOSED

PR #48
MTL-D06 DecisionResult
merge 7929b87922e92223fc4186ba7e1caa2eea502081
CLOSED

PR #49
Gate D — continuous Decision Runtime Proof
head fe5bf22058b5779542e9a3e51f0fbc35659e9cdb
merge 4f3e591e62381f1c7de09c23bdc0f34d190d2d32
CLOSED

PR #50
MTL-E01 Outcome Ingress
head bc68dfdc928556460c97dabffa210f1536c274d3
merge 0b5fe3a301f753d6ab2d27f43ef252a57daf98af
CLOSED

PR #51
MTL-P06 pilot operations
merge 647bbbea3284349dbe8b76186a49a629508d8829
CLOSED

PR #52
MTL-P07 pilot security / retention / audit isolation
merge a08b51216e344b887eeb7817bdbcfa742a350ca0
CLOSED

PR #53
MTL-P08 pilot recovery / incident replay / SLO
head ad43e3bc07442f02fa9b7e87dff44b97abe5ce4c
merge 730c68e8b0d6d4589c8e2db20293e775da303bbd
CLOSED

PR #54
v0.3 Paid Design-Partner Pilot integrated release acceptance
head 5cdba2633ae6f6064ca36519ba7aea1607c81bfe
OPEN / READY
CURRENT FRONTIER
```

---

# 7. D02 — Runtime Execution Broker

D02 was not accepted from its first green.

The broker dispatches only the exact executable relation frozen by D01/S01/S02/S03:

```text
RuntimeBinding
+
Specification
+
Implementation
+
ImplementationConformance
+
exact Context input authority
→
deterministic execution identity
```

Before any new dispatch reaches an executor it revalidates:

```text
current Deployment
current ImplementationConformance
exact bound executable tuple
frozen execution environment
exact ContextDatum inputs
ContextManifest membership
Specification semantic/unit/value-type/epistemic contract
```

Permanent rule:

```text
historical binding replay
!=
permission for current execution
```

Current Deployment/Conformance revalidation occurs before cached retry replay. The idempotency cache is not an authority bypass.

Independent review hardened:

```text
runtime-node identity
execution identity
rawOutputHash integrity
single dispatch clock
completion-clock regression
timer cleanup
explicit retry disposition
current-use revalidation before cache replay
```

Permanent nonclaims:

```text
process-local idempotency != distributed exactly-once
timeout != remote cancellation
timeout != proof of no external side effects
HTTP success != semantic validity
raw execution output != RuntimeResult authority
```

---

# 8. D03 — RuntimeResult / RuntimeDatum

Permanent distinction:

```text
ContextDatum != RuntimeDatum
```

Runtime output may not be laundered into historical context evidence.

D03 reconstructs exact D02 input evidence from:

```text
execution envelope
+
exact input datum refs
+
exact Specification input semantics
```

and requires reconstructed `inputEnvelopeHash` to match the D02 envelope.

Important API distinction:

```text
normalizeRuntimeResult()
=
self-consistent structure only

validateRuntimeResult(...)
=
D02-evidence-backed historical authority
```

Fixed output semantics come from S01 Specification, not executor self-report.

The executor may provide runtime evidence such as typed value, effective/forecast time, support and uncertainty. It cannot self-author semantic ID, unit, epistemic class, Specification, conformance or scientific authority.

D03 intentionally does not manufacture Policy output as RuntimeDatum.

---

# 9. D04 — RuntimeAlternativeSet / coverage authority

Permanent distinction:

```text
RuntimePlan
!= RuntimeEligibility
!= RuntimeBinding
!= RuntimeAlternativeSet
!= DecisionRobustness
```

D04 reconstructs coverage from:

```text
RuntimePlan candidate paths
+
historical RuntimeEligibility adjudication
+
exact included RuntimeBindings
```

Current v1 completeness rule:

```text
all historically legal semantic paths included
→ EXHAUSTIVE_ENUMERATION

any historically legal path omitted
→ INCOMPLETE
```

Non-legal paths remain explicit governed exclusions and do not by themselves make legal-path coverage incomplete.

Current upstream contracts do not freeze an implementation-alternative universe. Therefore `EXHAUSTIVE_ENUMERATION` means exhaustive only over the declared RuntimePlan semantic-path domain.

It is not scientific correctness or DecisionRobustness.

D04 refuses to fabricate `BOUNDED_ENVELOPE` or `GOVERNED_COVERAGE` without a governed upstream coverage/sampling authority.

---

# 10. Two predecessor gaps discovered before D05

D05 exposed two requirements already implied by frozen architecture but not yet implemented upstream.

They were repaired separately rather than hardcoded inside D05.

## 10.1 Policy v2 action-equivalence authority

`adr.policy.v1` lacked the action-equivalence contract required to decide which action differences are material.

The fix preserved v1 historical replay and introduced `adr.policy.v2`.

Policy v2 freezes action semantics including:

```text
actionCode
parameter name
semanticId
valueType
unit
required
material
```

Current equivalence mode:

```text
EXACT_MATERIAL_PARAMETERS
```

Action code itself is material.

This gives D05 a governed reason that, for example, `10 mm != 30 mm`; D05 does not invent that rule.

## 10.2 RuntimeProfile v2 robustness requirement

A05 v1 was intentionally minimal and did not define which coverage classes are sufficient for positive robustness authority.

The fix preserved historical v1 and introduced `adr.runtime-profile.v2` with:

```text
comparisonMode = EXACT_MATERIAL_ACTION_SIGNATURE
allowed sufficient coverage classes
```

`INCOMPLETE` can never be sufficient.

Historical v1 profiles therefore fail closed to `UNRESOLVED` where positive robustness authority requires v2.

---

# 11. D02 post-D03 Policy RuntimeDatum seam

The original D02 correctly blocked Policies requiring RuntimeDatum because D03 did not yet exist. After D03 was implemented, that predecessor seam had to be closed.

The dependency direction was deliberately preserved:

Wrong:

```text
D02 imports D03
D03 imports D02
```

Correct:

```text
D02 exposes a private prepared mixed-input capability
        ↑
D03 validates RuntimeResult evidence
        ↓
constructs trusted RuntimeDatum input
        ↓
calls D02 prepared capability
```

Public legacy D02 execution remains ContextDatum-only.

Important fail-closed rules:

```text
every supplied RuntimeResult must satisfy a required Policy semantic
unused RuntimeResult evidence is rejected
duplicate semantic source is rejected
```

Most importantly, a valid RuntimeDatum from another runtime world cannot be spliced into the target Policy merely because semantic ID/unit match.

Producer and target Policy bindings must agree on the governed runtime world:

```text
RuntimeEligibility
RuntimePlan
DecisionProblem
Deployment
RuntimeProfile
ContextManifest
selected path
logical time
```

---

# 12. D05 — DecisionRobustness / MaterialActionSignature

D05 derives action identity from exact Policy v2 authority plus exact successful Policy execution evidence.

Executor provides only:

```text
actionCode
typed parameter values
```

Executor does not author:

```text
semanticId
unit
material flag
equivalence rule
```

Robustness classes:

```text
ROBUST
SENSITIVE
UNRESOLVED
```

Permanent coverage rule:

```text
coverage insufficient
→ UNRESOLVED
```

D05 cannot call an incomplete universe robust simply because the worlds observed so far happen to agree.

Positive `ROBUST` requires:

```text
RuntimeProfile-sufficient coverage
+
complete included worlds
+
same exact Policy equivalence authority
+
successful action evidence for every included world
+
one MaterialActionSignature group
```

---

# 13. D06 — DecisionResult

D06 materializes:

```text
ACT
WAIT
ASK
ABSTAIN
```

Action semantics and disposition semantics remain distinct.

A MaterialAction whose action code text happens to be `WAIT` is still an `ACT` disposition if the governed Policy action is robust. DecisionDisposition WAIT is a separate fallback/reevaluation authority.

Permanent rules:

```text
RUNTIME_ONLY → no ADR DecisionResult
SENSITIVE → never ACT
UNRESOLVED → never ACT
```

`ASK` requires exact InformationRequirement authority.

Where no actionable information requirement exists, governed Policy fallback may yield `WAIT` or `ABSTAIN`.

`EXTERNAL_POLICY` does not allow ADR to fabricate the external owner's decision.

DecisionResult remains explicitly:

```text
not human approval
not machine execution authority
```

---

# 14. Gate D — continuous decision runtime proof

PR #49 closed Gate D with an integration proof, not by merely concatenating six unit suites.

The continuous chain is:

```text
DecisionProblem / Deployment / RuntimeProfile / RuntimeEligibility
        ↓
exact Model RuntimeBinding
        ↓
D02 conformant Model execution
        ↓
D03 evidence-backed RuntimeResult / RuntimeDatum
        ↓
exact Policy RuntimeBinding consuming that RuntimeDatum
        ↓
D04 RuntimeAlternativeSet
        ↓
D05 ROBUST DecisionRobustness
        ↓
D06 structured ACT DecisionResult
```

Gate D additionally freezes:

```text
Policy receives exact RuntimeDatum/result/evidence hashes, not a substituted value
Model and Policy RuntimeBindings remain distinct authorities
RuntimeDatum support matches target field ContextDatum support
execution chronology is monotonic
forged RuntimeResult evidence cannot enter Policy execution
legacy ContextDatum-only execution cannot bypass required RuntimeDatum
historical RuntimeDatum cannot bypass current Deployment suspension
```

Gate D does not claim human approval, machine execution, Outcome, effectiveness or causal benefit.

---

# 15. E01 — Outcome Ingress

PR #50 implemented immutable post-decision Outcome evidence.

Permanent distinction:

```text
Outcome != ContextDatum != RuntimeDatum != DecisionResult
```

Outcome may represent post-decision Observation/Assertion/Derived/StateEstimate evidence but cannot be a future forecast relabeled as realized outcome.

Association modes support exact ADR-bound evidence or retained content-addressed external decision/execution evidence without fabricating ADR refs.

Dedicated permission:

```text
outcome.write
```

Dedicated role:

```text
OUTCOME_INGRESS_SERVICE
```

Existing integration roles did not silently gain Outcome authority.

Permanent nonclaim:

```text
favorable Outcome
!= causal effect authority
!= automatic Knowledge upgrade
!= automatic Policy change
!= Deployment change
!= conformance change
```

---

# 16. Strategic decision — stop E02 and finish the paid-pilot MVP

After E01, the natural full-architecture sequence would have continued through E02/E03/E04/Gate E.

The user asked how much MVP work actually remained. Version Slicing was re-read rather than assuming that MVP meant full Architecture v1.0.

The key conclusion was:

> The first monetizable software slice is ADR v0.3 Paid Design-Partner Pilot, not full Gate E / v1.0.

The required paid-pilot slice is:

```text
Gate A
A11 Agronomist Workbench
P01 Public API
P02 SDK / Generic Integration
P03 Non-GEOX Reference Integration
pilot-grade P06
pilot-grade P07
pilot P08 recovery/SLO subset
integrated release acceptance
```

P04 GEOX is useful but optional.

D01–D06, Gate D and E01 had already moved beyond what v0.3 strictly required.

Therefore E02 was intentionally deprioritized.

Correct MVP completion path became:

```text
P06
→ P07
→ P08 pilot subset
→ v0.3 integrated release acceptance
→ Paid Design-Partner Pilot Candidate
```

Do not interpret unfinished E02 as a v0.3 software blocker.

---

# 17. P06 — pilot async / idempotency / observability

P06 introduced a non-domain-authority operational layer:

```text
OperationalJob
OperationalJobAttempt
OperationalJobJournal
OperationalTrace
OperationalMetrics
```

Job identity derives from organization/tenant/operation/idempotency key/exact input authority refs.

Permanent operational semantics:

```text
same exact job retry → same operational identity
failed attempt → retained in journal history
retry success → does not erase previous failure
successful job → terminal
non-retryable failure → cannot be fabricated into later success after restore
```

Failure taxonomy distinguishes provider/integration/authorization/scientific/runtime/platform failures.

Scientific/runtime ineligibility remains governed BLOCKED behavior, not generic service failure.

Operational metadata permanent nonclaim:

```text
NONE_OPERATIONAL_METADATA_IS_NOT_DOMAIN_AUTHORITY
```

Important hardening found after initial green:

```text
snapshot restore originally allowed payload widening if integrity hash was recomputed
restored history could theoretically fabricate success after a non-retryable failure
```

Both were closed with executable fail-closed acceptance.

P06 merged via PR #51.

Actual main after P06:

```text
647bbbea3284349dbe8b76186a49a629508d8829
```

---

# 18. P07 — pilot security / secrets / retention / audit export

P07 adds security-operation controls without changing scientific/domain semantic identity.

It covers:

```text
secret use/manage
artifact retention
security events
audit export
tenant/IP isolation
```

## 18.1 Secret isolation

Secret values do not enter semantic authority, hashes, audit export payloads or operational logs.

Built-in roles were not silently expanded to receive secret/retention permissions.

## 18.2 Audit export

Audit export is not a full ledger dump.

It starts from exact root refs and computes dependency closure. Default export contains refs/hashes, lineage and sanitized audit metadata, not proprietary semantic payloads, raw SourceArtifact bytes or secret values.

If exact dependency closure cannot be proven, export fails closed rather than silently skipping missing authority.

Denied security operations also leave DENY security events.

## 18.3 Retention

Retention directives preserve historical control changes instead of retaining only a mutable current value.

Operational deletion does not rewrite historical Source/Knowledge authority.

## 18.4 Critical cross-tenant storage seam found after CI was already green

The initial P07 secure store still exposed effectively global content-hash access:

```text
put(contentHash)
get(contentHash)
has(contentHash)
```

SourceRegistry knew tenant ownership, but the underlying bytes store did not enforce tenant scope. A caller with direct store capability and a known hash could theoretically reach another tenant's bytes.

CI was already GREEN.

That green result was explicitly rejected as insufficient.

The final implementation uses tenant-scoped storage identity:

```text
organization
+
tenant
+
contentHash
→ exact storage key
```

Legacy unscoped put/get/has APIs were removed.

Regression acceptance proves:

```text
same content hash in tenant A/B remains separate storage scope
wrong tenant cannot read bytes
legacy unscoped accessors do not exist
retention status/delete bind exact Source ownership scope
```

Permanent lesson:

> Root CI GREEN does not eliminate the need for independent security review.

P07 merged via PR #52.

Actual main after P07:

```text
a08b51216e344b887eeb7817bdbcfa742a350ca0
```

---

# 19. P08 — pilot recovery / incident replay / SLO

P08 implements only the v0.3 paid-pilot subset. It does not claim enterprise DR.

Permanent nonclaim:

```text
NONE_RECOVERY_OPERATIONS_METADATA_IS_NOT_DOMAIN_AUTHORITY
```

## 19.1 Recovery is not database rewind

Recovery checkpoints bind a complete retained AuthorityLedger snapshot and validate record semantic hashes, lineage hashes, audit-event hashes, reference closure and state/checkpoint hashes.

Restore reconstructs a fresh ledger with the same records, lineage edges, audit identities and semantic-state hash.

Rollback may not erase historical Binding/Decision authority.

## 19.2 Incident evidence must be journal-bound

A standalone OperationalTrace is only a projection and can be self-rehashed after mutation.

Therefore P08 incident/SLO evidence requires:

```text
OperationalTrace
+
retained P06 OperationalJobJournal snapshot
```

P08 reprojects the trace from journal evidence and requires canonical equality before classification or SLO use.

## 19.3 Incident taxonomy

Pilot classes:

```text
PROVIDER_OUTAGE
RUNTIME_FAILURE
PLATFORM_FAILURE
GOVERNED_BLOCK
DECISION_ABSTAIN
```

Scientific/runtime ineligibility remains BLOCKED, not service failure.

D06 ABSTAIN is validated through real DecisionResult authority and is explicitly:

```text
transport class = DOMAIN_DISPOSITION
genericServerError = false
```

Permanent rule:

```text
ABSTAIN != HTTP 500
```

## 19.4 Forward-suspend rollback

Rollback requires current exact Deployment lifecycle state `SUSPENDED` plus the exact current SUSPEND control tip.

Rollback is:

```text
FORWARD_SUSPEND_NO_DATABASE_REWIND
```

Incident organization/tenant must match Deployment scope.

## 19.5 Pilot SLO semantics

Observations must fall inside `[windowStart, windowEnd)`.

The same exact jobId cannot be counted twice.

Cross-tenant aggregation is rejected.

A major late review finding concerned retry accounting.

Wrong model:

```text
only inspect terminal attempt
```

That would allow:

```text
provider failure
→ retry success
→ final job success
→ provider outage disappears
```

Final semantics deliberately separate:

```text
job success/error = terminal job outcome
```

from:

```text
providerOutageCount = all retained failed attempts with failureClass=PROVIDER_FAILURE
```

Therefore a provider failure followed by successful retry remains a successful job **and** consumes provider outage budget.

## 19.6 P08 hardening history

Independent review caught and closed:

```text
D06 validator return-shape / target-scope binding mistake
standalone/rehashed trace manipulation
historical SLO-window relabeling
cross-tenant incident-to-Deployment rollback attachment
duplicate-job SLO inflation
provider-retry success erasing prior outage attempts
```

Final PR #53:

```text
candidate: ad43e3bc07442f02fa9b7e87dff44b97abe5ce4c
merge:     730c68e8b0d6d4589c8e2db20293e775da303bbd
```

Actual-main CI:

```text
32049874277 SUCCESS
```

P08 is CLOSED.

---

# 20. CURRENT FRONTIER — PR #54 v0.3 integrated release acceptance

This is the section the next conversation should start from.

PR:

```text
#54 — test(v0.3): close paid-pilot integrated release acceptance
```

Exact base:

```text
730c68e8b0d6d4589c8e2db20293e775da303bbd
```

Exact head:

```text
5cdba2633ae6f6064ca36519ba7aea1607c81bfe
```

Exact tree:

```text
c43c0c70c2fb2f492b375e5931e693485f343d17
```

Exact synthetic merge candidate:

```text
4144ac356ac0fb0f0ccbdce82b35673a56ca7471
```

Current PR state:

```text
OPEN
READY
```

Changed files are acceptance-only:

```text
acceptance/v0.3-pilot-release/fixture.mjs
acceptance/v0.3-pilot-release/run.mjs
acceptance/v0.3-pilot-release/integrity.mjs
docs/implementation/ADR-v0.3-PAID-PILOT-RELEASE-ACCEPTANCE.md
package.json
```

No core/domain authority implementation changes.

The release proof composes already-closed v0.3 requirements:

```text
Gate A
A11 Agronomist Workbench
P01 Public API
P02 SDK + Generic Integration
P03 Non-GEOX Reference Integration
P06 pilot operations
P07 pilot security/retention/audit
P08 pilot recovery/SLO
```

Release-specific acceptance:

```text
positive: 6/6
integrity/nonclaim: 6/6
```

Feature exact-head evidence:

```text
run 32051054471
job 95450244905
SUCCESS
```

Draft exact merge-candidate evidence:

```text
run 32051383180
attempt 1
job 95451307233
SUCCESS
```

Ready-state exact revalidation evidence:

```text
run 32051383180
attempt 2
job 95452548805
SUCCESS
```

The PR body still lists Ready revalidation as remaining. That text is stale; live Actions evidence is newer and authoritative.

---

# 21. What v0.3 integrated release deliberately does NOT require

Although this conversation implemented D01–D06, Gate D and E01, the v0.3 paid-pilot slice deliberately terminates at Gate-A/A11 expert workflow plus standalone integration/operations.

It does not fabricate a requirement for:

```text
RuntimeEligibility
RuntimeBinding
DecisionRobustness
DecisionResult
autonomous execution
Outcome evaluation
```

for the first paid design-partner pilot.

The release proof also deliberately preserves Non-GEOX independence. Optional P04 GEOX integration cannot replace required P03.

---

# 22. Exact next steps — do not restart implementation

The next conversation should **not** restart from D02, P08 or E02 and should **not** run a repository-wide audit before acting.

Start from:

```text
main      = 730c68e8b0d6d4589c8e2db20293e775da303bbd
PR        = #54
head      = 5cdba2633ae6f6064ca36519ba7aea1607c81bfe
candidate = 4144ac356ac0fb0f0ccbdce82b35673a56ca7471
Ready run = 32051383180 attempt 2 / job 95452548805 SUCCESS
```

Then do exactly:

```text
1. Re-read refs/heads/main
2. Re-read PR #54 head
3. Re-read refs/pull/54/merge
4. Confirm:
     main      = 730c68e8...
     head      = 5cdba263...
     candidate = 4144ac35...
5. Confirm no unresolved review thread
6. Do not change the branch if no new blocker exists
7. Merge #54 using expected_head_sha:
     5cdba2633ae6f6064ca36519ba7aea1607c81bfe
8. Read refs/heads/main again
9. Record actual merge SHA
10. Verify actual merge parents are:
      old main 730c68e8...
      exact head 5cdba263...
11. Run/read exact actual-main ADR Constitution full-root CI
12. Only after actual-main SUCCESS declare:
      ADR v0.3 software engineering = CLOSED
      release class = PAID_DESIGN_PARTNER_PILOT_CANDIDATE
      commercial validation = NOT_ESTABLISHED
```

Do not rerun Ready-state CI again simply because the PR prose says it remains. Live attempt 2 has already closed that gate.

Rerun only if main/head/candidate changes or review introduces a new blocker.

---

# 23. After #54 closes — recommended next priority

If commercial validation remains the priority, do **not** automatically resume E02.

Move to real paid design-partner pilot work.

Pilot evidence should measure:

```text
minutes per case
manual review reduction
cases per agronomist
escalation / unresolved rate
override rate
false-safe / false-resolved cases
integration burden
support burden
time to onboard customer knowledge/context
paid continuation signal
paid expansion signal
```

The strongest commercial evidence is not “this looks useful”. It is:

```text
customer pays
uses it on real cases
continues
expands
```

If the strategic priority later becomes full Architecture v1.0, then return to the formal Evaluation track (likely E02 according to the current Master Task Line) after re-reading the live planning authority.

---

# 24. Software status versus commercial status

After #54 closes on actual main:

```text
software engineering: v0.3 CLOSED
release class: PAID_DESIGN_PARTNER_PILOT_CANDIDATE
commercial validation: NOT_ESTABLISHED
```

Do not relabel this as:

```text
PMF
commercial GO
enterprise-production ready
commercial MVP validated
```

The repository will have proved only that the software slice required to run a governed paid design-partner pilot coexists and passes integrated acceptance.

It will not have proved that customers will pay enough for it.

---

# 25. Important failure modes and lessons from this conversation

## 25.1 Root CI GREEN can still hide a real security defect

P07 is the strongest example. The full root suite was already green when independent review found the unscoped artifact-store capability.

Permanent response:

```text
CI GREEN
!= independent security/authority review complete
```

## 25.2 Root wiring matters

A test that exists but is not reached through root `npm test` is not release evidence.

Always verify:

```text
package.json root wiring
actual suite output
actual counts
```

## 25.3 Draft / Ready / actual-main are different subjects

Required delivery sequence:

```text
feature exact head
↓
Draft synthetic merge candidate
↓
independent final review
↓
Ready-state exact candidate revalidation
↓
expected-head merge
↓
actual refs/heads/main
↓
actual-main full-root CI
```

Never collapse these into a single green check.

## 25.4 GitHub PR prose can become stale

PR #54 itself is a current example: its body still lists Ready revalidation as remaining, while live Actions attempt 2 has already passed.

Live repository evidence wins.

## 25.5 Merge-ref SHA is not actual-main SHA

Never declare closure from `refs/pull/N/merge`.

After merge always read `refs/heads/main` and verify the actual-main CI.

## 25.6 Historical replay is not current-use authority

Across Knowledge, Release, Deployment, Conformance, Binding and Execution:

```text
historical replayability
!= permission for current new use
```

## 25.7 Operational metadata is not domain authority

P06/P07/P08 metadata such as jobs, traces, SLO, retention, security events, recovery checkpoints and rollback plans do not become scientific/runtime/decision authority.

## 25.8 Do not fabricate authority just to unblock a downstream task

Examples from this conversation:

```text
D05 needed material-action equivalence
→ S01 Policy v2

D05 needed robustness coverage requirement
→ A05 RuntimeProfile v2

Policy needed RuntimeDatum
→ D02 post-D03 seam

P08 needed trustworthy incident trace
→ bind OperationalTrace to retained P06 journal snapshot
```

The wrong answer would have been local hardcoding inside the downstream package.

## 25.9 ContextDatum and RuntimeDatum remain distinct

Never regress:

```text
RuntimeDatum → ContextDatum
```

for convenience.

## 25.10 Coverage completeness is not robustness

Never regress:

```text
EXHAUSTIVE_ENUMERATION = ROBUST
```

D04 and D05 remain separate authorities.

## 25.11 ABSTAIN is not infrastructure failure

Permanent:

```text
DecisionResult ABSTAIN != generic HTTP/server failure
```

## 25.12 Rollback is not database rewind

P08 rollback is forward control/suspension. Historical Binding/Decision authority stays intact.

## 25.13 Successful retry does not erase provider outage

Permanent P08 SLO rule:

```text
terminal job success
and
prior provider failure
can both be true
```

Do not collapse final job outcome and failed-attempt accounting.

## 25.14 Test failures can be fixture failures — but prove it

Legitimate fixture/test issues found during this conversation included:

```text
non-canonical fake SHA hex
incorrect copied constants
wrong RuntimeProfile authority mode
wrong D06 validator return-shape assumption
over-broad substring leak assertion
```

Correct method:

```text
read exact first failure
prove the production authority contract
fix only the fixture if the fixture is wrong
rerun exact head
```

Never dismiss a red run as “just a test” without proof.

## 25.15 GitHub contents API stale-SHA protection is useful

A P08 write was correctly rejected because the content blob SHA was stale.

Refetch the current blob and retry the exact intended update. Do not bypass content-version protection.

---

# 26. Things the next conversation should NOT do

Do not:

```text
restart from the D02-era PR #40 handoff
treat PR #40 as current state
re-open D03/D04/D05/D06 without a real blocker
resume E02 before #54 software closure
claim P08 is still active
claim v0.3 is CLOSED before #54 actual-main CI
claim commercial validation from release acceptance
require GEOX for the paid-pilot release proof
fold D/E runtime requirements into v0.3 merely because they exist
treat operational traces as domain authority
turn ABSTAIN into HTTP 500 semantics
use DB rewind as rollback
use successful retry to erase prior provider outage
assume a green CI eliminates independent security review
```

---

# 27. Stale handoff handling

Historical handoff:

```text
PR #40
docs/handoff/ADR-HANDOFF-2026-08-17.md
```

is now stale for current implementation state.

This handoff should supersede it.

Recommended handling:

```text
new docs branch:
docs/handoff-2026-08-18

new handoff:
docs/handoff/ADR-HANDOFF-2026-08-18.md

old PR #40:
close as superseded
```

The docs handoff PR must remain docs-only and must not be treated as PR #54 acceptance evidence.

---

# 28. Machine-readable checkpoint

```yaml
repository: liyongshang44-max/agronomy-deployment-runtime
handoff_date_local: 2026-08-18
handoff_status: CONVERSATION_HANDOFF_ONLY
architecture_authority: false

actual_main:
  sha: 730c68e8b0d6d4589c8e2db20293e775da303bbd
  source: PR_53_P08_MERGE
  ci:
    run: 32049874277
    result: SUCCESS

closed_major_frontiers:
  - MTL-D02
  - MTL-D03
  - MTL-D04
  - S01_POLICY_ACTION_SEMANTICS_HARDENING
  - D02_POST_D03_POLICY_RUNTIMEDATUM_INPUT
  - A05_RUNTIMEPROFILE_V2_ROBUSTNESS
  - MTL-D05
  - MTL-D06
  - GATE_D
  - MTL-E01
  - MTL-P06
  - MTL-P07
  - MTL-P08

current_frontier:
  task: ADR_V0_3_PAID_PILOT_INTEGRATED_RELEASE_ACCEPTANCE
  branch: feat/v0.3-paid-pilot-release-acceptance
  pr: 54
  pr_state: OPEN_READY
  head: 5cdba2633ae6f6064ca36519ba7aea1607c81bfe
  tree: c43c0c70c2fb2f492b375e5931e693485f343d17
  base: 730c68e8b0d6d4589c8e2db20293e775da303bbd
  synthetic_merge_candidate: 4144ac356ac0fb0f0ccbdce82b35673a56ca7471

feature_head_gate:
  run: 32051054471
  job: 95450244905
  result: SUCCESS

draft_merge_gate:
  run: 32051383180
  attempt: 1
  job: 95451307233
  result: SUCCESS

ready_state_gate:
  run: 32051383180
  attempt: 2
  job: 95452548805
  result: SUCCESS

release_acceptance:
  positive: 6
  integrity_nonclaim: 6
  core_authority_changes: false

remaining_software_delivery_steps:
  - FINAL_NO_DRIFT_VERIFY
  - EXPECTED_HEAD_MERGE_PR_54
  - READ_ACTUAL_MAIN
  - VERIFY_MERGE_PARENTS
  - EXACT_MAIN_FULL_ROOT_CI

software_status_now: RELEASE_CANDIDATE_NOT_YET_ACTUAL_MAIN_CLOSED

software_status_after_remaining_gates:
  version: ADR_v0.3
  engineering: CLOSED
  release_class: PAID_DESIGN_PARTNER_PILOT_CANDIDATE

commercial_validation:
  status: NOT_ESTABLISHED

deprioritized_for_mvp:
  - MTL-E02
  - later_E_track
  - full_enterprise_DR
  - multi_region_HA
  - full_v1_0_completion

next_phase_if_commercial_priority_remains:
  - paid_design_partner_onboarding
  - preregistered_pilot_success_criteria
  - manual_review_reduction_measurement
  - minutes_per_case_measurement
  - escalation_and_override_measurement
  - integration_support_burden_measurement
  - paid_continuation_signal
  - paid_expansion_signal
```

---

# 29. One-sentence handoff

> **ADR has moved from the old D02 frontier through D02–D06, Gate D, E01 and the complete P06/P07/P08 v0.3 productionization subset; P08 is merged and actual-main GREEN at `730c68e8…`; PR #54 is already Ready with feature, Draft merge-candidate and Ready-state full-root gates GREEN, so the only correct next action is final no-drift → expected-head merge → actual-main CI, after which v0.3 software engineering may be declared `PAID_DESIGN_PARTNER_PILOT_CANDIDATE`, while commercial validation remains explicitly unproven.**
