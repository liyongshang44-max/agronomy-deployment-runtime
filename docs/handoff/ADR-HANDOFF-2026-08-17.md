# Agronomy Deployment Runtime — Conversation Handoff — 2026-08-17

Status: **CONVERSATION HANDOFF ONLY — NOT ARCHITECTURE AUTHORITY**

This handoff is intended to let the next conversation resume ADR without reconstructing the product thesis, standalone/GEOX boundary, authority order, the implementation chain closed in this conversation, the repository/CI facts, or the current D02 execution-broker frontier.

If this handoff conflicts with frozen Architecture v1.0, final adjudication, Master Task Line, repository facts, or exact CI evidence, the higher authority wins.

---

## 0. Repository / branch / PR facts at handoff

Repository:

```text
liyongshang44-max/agronomy-deployment-runtime
```

Actual/default `main` at this handoff:

```text
d36564002aad64b3b010b72b66a8d661d8826582
```

That commit is the merge of:

```text
PR #39 — feat(v0.1): qualify ImplementationConformance authority
MTL-S03 — ImplementationConformance Qualification
```

It closes the executable predecessor chain required before D02:

```text
S01 Specification Authority
        ↓
S02 Implementation Registry
        ↓
S03 ImplementationConformance
        ↓
D02 Runtime Execution Broker may now execute a bound specification relation
```

Current active implementation branch:

```text
feat/v0.1-mtl-d02-implementation-broker
```

Current D02 head:

```text
1aff53862ffbb19a74ff472d28d72e6f9290a749
```

Current D02 commit:

```text
feat(d02): implement exact runtime execution broker
```

Current D02 CI evidence:

```text
ADR Constitution
run: 31974561931
head: 1aff53862ffbb19a74ff472d28d72e6f9290a749
result: SUCCESS
```

D02 is already root-wired into `npm test`:

```text
test:implementation-broker =
  acceptance/implementation-broker/run.mjs
  acceptance/implementation-broker/integrity.mjs
  acceptance/implementation-broker/idempotency.mjs
  acceptance/implementation-broker/hardening.mjs
```

Current D02 acceptance surface declared by those suites:

```text
positive:     8
integrity:   12
idempotency:  4
hardening:    4
----------------
total:       28
```

At the time of this handoff there is **no D02 PR yet** and no D02 implementation-contract document yet.

The correct frontier is therefore:

```text
MTL-D02 — Runtime Execution Broker
implementation exists
first exact-head full-root CI is GREEN
independent review / implementation contract / Draft PR / merge-ref gates remain
```

This handoff itself must remain docs-only and separate from the active D02 branch.

Historical docs handoff PR #17 is still open and now stale. It records the K06 frontier and should not be used as the current implementation state after this handoff supersedes it.

There are also stale historical implementation Drafts still open, notably old K05 PR #14. They are not current frontiers and should not be mistaken for active work.

Repository-governance note:

```text
main protected = false
classic branch protection = off
```

The project currently relies on exact-head / merge-ref / exact-main procedural gates rather than enforced GitHub branch protection. Do not describe `main` as technically protected unless repository rules are later added.

---

# 1. Authority order — do not let implementation convenience override architecture

The correct authority order remains:

```text
Frozen Architecture v1.0
  > Final Architecture / Capability adjudication
  > Capability Map
  > Master Task Line
  > Version Slicing
  > merged implementation contracts / exact repository facts
  > active implementation PR
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

> If implementation difficulty appears to require reinterpretation of Architecture authority, do not silently encode the reinterpretation. Either follow the frozen authority exactly or open an explicit adjudication path.

---

# 2. Product origin — why ADR exists as a standalone product

The project began from a GEOX problem, not from a plan to build a separate agronomy software company.

The original question was roughly:

```text
How can GEOX use agronomic knowledge at low cost?
```

The first obvious solution looked like:

```text
PDF / expert agronomy
        ↓
LLM extraction
        ↓
structured knowledge
        ↓
match field conditions
        ↓
use advice
```

The conversation then identified that knowledge extraction is not the hard boundary.

The hard problem is:

> How can a scientific/agronomic statement be transported from its SourceContext into a specific TargetContext and DecisionProblem without silently expanding its authority?

That forced a decomposition that must remain intact:

```text
Source / SourceArtifact
        ↓
Claim
        ↓
Source-faithful review
        ↓
Scientific qualification
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
RuntimeResult / DecisionRobustness / DecisionResult
```

The product category therefore became:

> **Agronomy Deployment Runtime is a governed platform that compiles the valid domain of agronomic knowledge into a traceable, replayable runtime world for a specific target context and decision purpose.**

A useful shorthand remains:

```text
Agronomy Compiler + Agronomy Runtime
```

with two distinct compile stages:

```text
Scientific compile:
Source → Claims → Qualified/Derived Knowledge

Runtime compile:
DecisionProblem + Knowledge + exact Context + Profile/Deployment
→ Applicability → RuntimePlan → Eligibility → Binding → Execution
```

Do not collapse those two compilers into one LLM inference surface.

---

# 3. Standalone relationship to GEOX — frozen product boundary

ADR is intentionally independent:

```text
independent product
independent repository
independent data model
independent API
independent release cycle
independent deployment
independent customer integrations
```

GEOX is:

```text
first-party integration
reference consumer
field-validation substrate
possible provider of context/state/model/forecast/outcome surfaces
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
GEOX internals / GEOX database / GEOX-specific semantic vocabulary
```

Permanent constitutional checks include:

```text
NO @geox/* dependency in core
NO GEOX DB/table/schema authority in ADR core
NO MCFT/CAP/KBS/T3R1 vocabulary in ADR core ontology
core packages cannot import adapters/*
adapters cannot grant scientific qualification
adapters cannot invent transformations
remove adapters/geox → standalone core remains valid
GEOX unavailable → standalone reference acceptance remains valid
```

This boundary was actively tested during P03/P04 and must not be reopened casually.

---

# 4. Commercial thesis — retain as thesis, not PMF fact

The commercial insight developed in the previous handoff still matters, but remains a hypothesis.

The likely buyer-side scarcity is not merely “access to agronomic information.” Organizations already possess agronomists, protocols, models, crop rules, research, supplier guidance and internal knowledge.

The possible scarce resource is:

```text
agronomist throughput
```

The commercial thesis is therefore:

```text
organizations possess agronomy
        ↓
agrimony cannot be deployed safely/consistently at field scale without heavy expert review
        ↓
ADR converts governed agronomy into reusable deployment/runtime authority
        ↓
expert attention can focus on unresolved/high-risk cases
```

Future empirical validation should prioritize:

```text
minutes / field
fields / agronomist
acres / agronomist
review / escalation rate
override rate
response time
gross margin / agronomist
```

Do not claim PMF, yield uplift, agronomic effectiveness, safety improvement or commercial success from repository acceptance tests.

---

# 5. What this conversation actually accomplished

The original 2026-08-16 handoff stopped at:

```text
main @ 8d533f39...
K05 merged
K06 failing 6 acceptance seams
Gate K still open
```

This conversation moved the repository far beyond that state.

The broad closure sequence is now:

```text
K06 KnowledgeRelease              CLOSED
Gate K                            CLOSED

A01 DecisionProblem               CLOSED
A02 ContextDatum                  CLOSED
A03 Context Reference/Receipt     CLOSED
A04 ContextManifest               CLOSED
A05 Minimal RuntimeProfile        CLOSED
A06 Deployment                    CLOSED
A07 Knowledge Retrieval           CLOSED
A08 Applicability                 CLOSED
A10 Escalation Read Model         CLOSED
A11 Agronomist Workbench          CLOSED
Gate A                            CLOSED

P01 Public API/OpenAPI             CLOSED
P02 SDK/Generic Integration        CLOSED
P03 Non-GEOX Reference Integration CLOSED
P04 GEOX First-Party Adapter       CLOSED

R01 RuntimePlan DAG                CLOSED
R02 InformationRequirement        CLOSED
R03 RuntimeEligibility            CLOSED
Gate R                            CLOSED

D01 RuntimeBinding                CLOSED

S01 Specification Authority       CLOSED
S02 Implementation Registry       CLOSED
S03 ImplementationConformance     CLOSED

CURRENT:
D02 Runtime Execution Broker      ACTIVE
```

This is not a cosmetic amount of movement: the repository has transitioned from “governed KnowledgeRelease not yet closed” into “exact qualified executable runtime world can now be dispatched through a broker.”

---

# 6. K06 / Gate K — important corrections from the original handoff

The old handoff recorded six K06 failures plus unwired acceptance.

Those issues were closed in this conversation. The key corrections were not test-specific patches; they closed governance semantics:

```text
active conflict-resolution drift must stale current release
supersession must require predecessor control authority
foreign organization cannot take lifecycle/supersession control
historical replay must survive later QK/DK revocation
retry identity must compare the complete publication governance world
owner/member entitlement control must be explicit and replayable
```

All four K06 suites were wired into root CI:

```text
run.mjs
integrity.mjs
entitlement.mjs
conflict-coverage.mjs
```

Gate K then closed.

Permanent lesson:

> A single happy-path suite going green is not a Gate closure. Root wiring, integrity, entitlement, conflict/lifecycle and exact merge/main subjects matter.

---

# 7. A-track — Decision/Context/Applicability authority now exists

## A01 — DecisionProblem

A01 established only decision-scope authority:

```text
decision type
target scope
logical time
horizon
objective
constraints
action space
use purpose/use class
decision-authority mode
deadline
```

It does not contain an agronomic conclusion or DecisionResult.

Important hardening discovered here:

- generic `AuthorityLedger.publish()` audit vocabulary is not sufficient authorization;
- `decision.problem.create` was introduced as an explicit F03 scoped authority;
- AuthorizationDecision must bind exact resourceId;
- constraints cannot launder downstream recommendation/applicability/decision authority;
- `RUNTIME_ONLY` can never be upgraded into final DecisionResult authority.

## A02 — ContextDatum

ContextDatum now separates:

```text
EpistemicClass
ProvenanceClass
```

and retains:

```text
semantic_id
value/value_type
unit
effective/available time
spatial/vertical/temporal support
uncertainty
source identity
```

Adapter/source reliability cannot silently upgrade assertion → observation or observation → state estimate.

## A03 — AuthorizedContextReference / Receipt

The repository now supports reference-not-copy provider access while preserving exact resolution evidence.

Critical semantics:

```text
EXACT
CONTENT_ADDRESSED_EXTERNAL
PROVIDER_DEPENDENT
NON_REPLAYABLE
```

Credentials never enter semantic identity.

## A04 — ContextManifest

A04 freezes one exact DecisionProblem target-context world.

It prevents:

```text
latest-value drift
mutable context-pool reads
datum substitution after manifest creation
runtime output retroactively entering old context
```

## A05 — Minimal RuntimeProfile

A05 deliberately proved a legal minimal profile without fake Model/Policy/Implementation/Calibration refs.

This was essential later: S-track became a conditional executable path instead of a schema-fill requirement.

## A06 — Deployment

Deployment separates:

```text
runtime environment:
  DEVELOPMENT / STAGING / PRODUCTION

rollout stage:
  DRAFT / SANDBOX / SHADOW / PILOT / PRODUCTION / SUSPENDED / DEPRECATED
```

It cannot change RuntimeProfile/KnowledgeRelease semantics.

## A07 — KnowledgeRetrievalResult

Retrieval is explicitly non-scientific evidence:

```text
retrieval hit ≠ applicable
retrieval miss ≠ scientific false
ranking ≠ truth
```

Runtime-use entitlement is not human-inspection entitlement.

## A08 — ApplicabilityAssessment

Applicability now transports KnowledgeOriginContext into exact TargetContext/DecisionProblem.

Distinct statuses such as conflict, missing context, bounded extrapolation, calibration required and unsupported transport remain structurally distinct.

Important permanent boundary:

```text
Applicability ≠ Runtime Legality ≠ Decision
```

## A10/A11 / Gate A

A10 is a non-authority escalation projection.
A11 is the Agronomist Workbench core.
Gate A proved a full Source→Knowledge→Context→Applicability→Escalation workflow without creating RuntimeEligibility/DecisionResult.

---

# 8. P-track — standalone product integration proof

## P01 — Public API / OpenAPI

P01 exposed the closed Gate-A authority surfaces without creating a generic ledger-publish API.

Important security conclusion:

```text
AuthorizationDecisionAudit ref = replayable evidence
!= bearer capability
```

Bearer subject must match the declared ADR principal.

## P02 — SDK / Generic Integration

P02 established platform-neutral SDK/integration contracts.

Independent review closed three concrete security defects before merge:

```text
exact response identity validation
prototype-pollution protection in mapping paths
reserved role activation enforcement
```

## P03 — Non-GEOX Reference Integration

P03 proved ADR independence with a customer-like field platform using unrelated raw schema.

Important strengthening:

- source plot + metric were frozen as exact adapter scope;
- the exact ContextDatum created through the SDK had to be the same ref later frozen into ContextManifest;
- semantically equivalent duplicate test objects were rejected as too weak a proof.

## P04 — GEOX First-Party Adapter

P04 then added GEOX as a downstream first-party adapter without changing ADR ontology.

Important real upstream facts discovered during implementation:

```text
GEOX facts table does not expose ingested_at
soil_moisture observation has no installation depth in the base row
unit may be nullable
```

Therefore the adapter:

- keeps adapter retrieval chronology separate from GEOX storage semantics;
- never invents a GEOX ingested_at;
- refuses to promote generic soil_moisture into exact VWC without explicit unit/depth;
- never promotes shallow VWC into root-zone state;
- treats GEOX confidence and allowed_actions as source evidence, not ADR qualification/decision authority.

---

# 9. Gate R — planning, information requirements and legality

## R01 — RuntimePlan DAG

R01 is deterministic compiler IR, not authority to execute.

It now closes:

```text
DecisionProblem
Deployment
RuntimeProfile
ContextManifest
KnowledgeRetrievalResult
ApplicabilityAssessment[]
```

into:

```text
RuntimeCandidates
RuntimePlan DAG
alternative paths
structured openRequirements
```

Important lesson from R01:

The first green CI was invalid because R01 tests were not wired into root `npm test`.

That false-green was explicitly superseded.

R01 then exposed real fixture/contract bugs only after root wiring.

Permanent rule:

> Every new capability acceptance must be root-wired before a GREEN can be treated as readiness evidence.

## R02 — InformationRequirement / Acquisition Planning

R02 converts only information-addressable plan gaps into explicit needs/options.

It does not convert calibration/conflict/scientific-use blockers into fake “go collect data” tasks.

Key distinction:

```text
AcquisitionOption ≠ evidence
InformationRequirement SATISFIED ≠ RuntimeEligibility
UNSATISFIABLE ≠ NO_LEGAL_RUNTIME
```

Nested requirements are authenticated by replaying the exact origin RuntimePlan, preventing a caller from self-hashing a widened acceptable-evidence contract.

## R03 — RuntimeEligibility

R03 established the four frozen legality states:

```text
RUNTIME_ELIGIBLE
RUNTIME_ELIGIBLE_WITH_LIMITATIONS
INFORMATION_REQUIRED
NO_LEGAL_RUNTIME
```

The key algorithmic insight is path-level existence semantics:

> If at least one legal runtime world exists, a blocked sibling must not drag the global state into NO_LEGAL_RUNTIME.

Conversely, a derivative applicability BLOCKED caused by missing context remains information-addressable and must not be upgraded into a hard no-runtime conclusion.

Gate R is now CLOSED.

---

# 10. D01 — RuntimeBinding

D01 freezes exactly one adjudicated legal runtime world.

It proves:

```text
what exact authority objects were used
```

It does **not** prove:

```text
scientific correctness
action correctness
safety
DecisionResult
```

The first D01 implementation was later hardened to validate cross-object historical relationships, not merely that each individual ref/hash was valid.

Historical replay now checks relationships such as:

```text
Deployment → RuntimeProfile → KnowledgeRelease
ContextManifest → DecisionProblem
Retrieval → Decision/Deployment/Profile/Release/Knowledge
Applicability → Retrieval/Knowledge/Manifest/Decision
```

A set of individually valid objects from different historical worlds must fail closed.

D01 also explicitly keeps:

```text
calibrationBindings = []
implementation/spec bindings = []
```

for the minimal non-executable path until S-track authority exists.

S03 has now activated the conditional executable seam:

```text
Specification@hash
+ Implementation@hash
+ ImplementationConformance@hash
```

may be frozen into RuntimeBinding when current conformance is valid.

---

# 11. Why D02 was temporarily blocked and why S01→S03 had to be done first

After D01, the next intuitive step looked like D02 Runtime Execution Broker.

Master Task Line / Final Adjudication correctly blocked that shortcut.

D02 requires an actually executable specification relation:

```text
D01 RuntimeBinding
+
S03 ImplementationConformance for the specification actually executed
```

At that time RuntimeBinding had no Model/Policy/Transformation/Implementation/Conformance binding.

Creating a fake no-op model/executor merely to make D02 run would have violated the architecture.

Therefore the correct dependency path was:

```text
D01 closed
  ↓
S01 Specification Authority
  ↓
S02 Implementation Registry
  ↓
S03 ImplementationConformance
  ↓
D02 unlocked
```

This is an important handoff lesson: task numbering is not a license to bypass conditional predecessors.

---

# 12. S01 — Specification Authority

S01 established three distinct specification authorities:

```text
QualifiedTransformation
Model
Policy
```

and preserved:

```text
Specification ≠ Implementation ≠ ImplementationConformance
```

F03 gained explicit:

```text
specification.manage
```

No existing built-in role silently received it.

Important semantics:

### QualifiedTransformation

- semantic input/output contracts;
- method hash;
- applicability domain;
- uncertainty consequences;
- limitations;
- explicit epistemic preservation;
- cannot silently upgrade epistemic authority.

### Model

- purpose;
- semantic IO;
- evidence/state requirements;
- parameter slots;
- knowledge authority kinds;
- measurement conventions;
- applicability/calibration requirements;
- computational definition;
- output cannot masquerade as Observation.

### Policy

- decision type;
- action space;
- required semantic/runtime inputs;
- decision logic;
- threshold authority;
- human/fallback/abstention/operational constraints;
- Policy remains decision logic, not Knowledge.

S01 specific root acceptance closed at 32 tests.

---

# 13. S02 — Implementation Registry

S02 introduced executable identity without claiming conformance.

F03 gained:

```text
implementation.manage
```

Core provider vocabulary is platform neutral:

```text
INTERNAL
HTTP
CUSTOMER
FIRST_PARTY
WASM
BATCH
```

A first attempt used `GEOX` as a core provider type. Constitution correctly rejected that. The scanner was **not weakened**; the ontology was corrected to `FIRST_PARTY`.

Implementation freezes:

```text
provider type
exact execution locator
implementationDigest
artifact contentHash
runtime metadata
operational constraints
```

Important distinction:

```text
implementationDigest = executable implementation identity/fingerprint
artifact.contentHash = exact registered artifact content identity
```

They are both material but need not be equal.

Registration explicitly states:

```text
conformanceClaim = NONE_REGISTRATION_ONLY
```

No Specification ref is allowed in Implementation authority.

That relation belongs only to S03.

S02 root acceptance closed at 32 tests.

---

# 14. S03 — ImplementationConformance

S03 is now merged as PR #39 and is the current `main` closure.

It establishes:

```text
exact Specification@hash
+
exact Implementation@hash
+
qualification evidence
→
exact ImplementationConformance@hash
```

F03 gained:

```text
implementation.conformance.qualify
```

with separate exact QUALIFY / REVOKE / SUPERSEDE controls.

The qualifier is independent from spec manager and implementation manager.

Conformance freezes:

```text
qualification method id/hash
complete PASS compatibility suite
input/output semantic hashes from exact S01 spec
implementation digest + artifact hash from exact S02 authority
runtime/version/platform/architecture
technical runtime environments
required capabilities
known limitations
validity interval
```

Lifecycle:

```text
REVOKE → blocks new use, historical replay remains
SUPERSEDE → requires distinct successor over same exact spec↔implementation relation
competing terminal controls → fail closed
```

The first S03 GREEN was intentionally not accepted as final.

Independent review found a real missing condition:

> S03 had qualified the relation, but RuntimeBinding had not yet been forced to bind the exact Specification + Implementation + ImplementationConformance trio.

PR #39 therefore also activated the conditional D01 executable seam.

RuntimeBinding now supports one optional executable binding in S03 v1:

```text
specificationExecutionBinding =
  exact specification ref
  exact implementation ref
  exact implementation-conformance ref
  available capabilities
```

Actual runtime/version/platform/architecture derive from Implementation.
Runtime environment derives from Deployment.
Logical time derives from ContextManifest.
Current conformance is revalidated before new Binding publication.
Historical Binding preserves the exact frozen trio even after later conformance lifecycle changes.

S03 acceptance:

```text
authorization:              8
positive/replay:            8
integrity/nonclaim:         9
lifecycle:                  6
RuntimeBinding integration: 8
------------------------------
total:                     39
```

S03 does not execute anything. It only unlocks D02.

---

# 15. CURRENT FRONTIER — D02 Runtime Execution Broker

This is the section the next conversation should start from.

Current branch:

```text
feat/v0.1-mtl-d02-implementation-broker
```

Current exact head:

```text
1aff53862ffbb19a74ff472d28d72e6f9290a749
```

Current root CI:

```text
run 31974561931
result SUCCESS
```

There is no D02 PR yet.
There is no D02 implementation-contract document yet.
Do not declare D02 closed from this first green.

## 15.1 What D02 currently implements

Package:

```text
packages/implementation-broker/src/
  contract.mjs
  registry.mjs
  idempotency.mjs
  broker.mjs
  index.mjs
```

Core surface:

```text
ImplementationExecutorRegistry
RuntimeExecutionBroker
RuntimeExecutionIdempotencyStore
```

The broker requires an exact RuntimeBinding with exactly one executable S03 relation.

Before dispatch it revalidates:

```text
RuntimeBinding authority
current Deployment runtime-active state
current ImplementationConformance
bound spec/implementation/conformance relation
frozen execution environment
exact ContextDatum inputs
exact ContextManifest membership
spec input semantic/unit/value-type/epistemic contract
```

A zero-executable-binding D01 RuntimeBinding cannot dispatch.

## 15.2 Input authority

Current `execute()` surface is deliberately closed:

```text
ledger
runtimeBindingRef
inputDatumRefs
```

Caller cannot override:

```text
implementationRef
implementationConformanceRef
dispatchClass
runtimeEnvironment
rawInputs
```

Any such hidden predecessor/override fails closed.

Every execution input must be:

```text
valid ContextDatum authority
AND member of the exact frozen ContextManifest
AND match the bound Specification input contract
```

Matching includes:

```text
semanticId
unit
valueType
epistemicClass
```

Duplicate semantic inputs are rejected.

## 15.3 Model/Policy limitations intentionally enforced in D02 v1

D02 v1 does not fake parameter/calibration authority.

If a Model has a required parameter slot:

```text
RUNTIME_EXECUTION_PARAMETER_BINDING_REQUIRED
```

until exact parameter/calibration binding authority exists.

A Policy that requires upstream RuntimeDatum outputs cannot execute yet:

```text
RUNTIME_EXECUTION_POLICY_UPSTREAM_RESULT_REQUIRED
```

because D03 semantic RuntimeDatum/RuntimeResult authority is not implemented.

This is correct fail-closed behavior, not missing convenience functionality.

## 15.4 Executor registration / dispatch

`ImplementationExecutorRegistry` registers an executor against the exact Implementation ref.

There is no implementation fallback/substitution.

If only another Implementation is registered:

```text
RUNTIME_EXECUTOR_NOT_REGISTERED
```

Dispatch class must match provider semantics.

Current broker supports normalized distinction:

```text
INTERNAL
EXTERNAL
```

including HTTP-style external implementations.

Important nonclaim:

> The current test executor callback is a broker/reference transport seam. It is not yet a claim that a production HTTP client, retry policy, credential system, network SLO or remote executor deployment is shipped.

## 15.5 Execution identity / idempotency

Execution identity is deterministically derived from:

```text
exact RuntimeBinding ref
runtime node id
exact input envelope hash
```

Runtime node identity derives from:

```text
RuntimeBinding
Specification
Implementation
ImplementationConformance
```

Idempotency behavior is already executable:

```text
sequential exact retry → one executor invocation
concurrent exact retry → coalesced to one invocation
failed exact execution → cached; retry does not duplicate side effects
different binding/input authority world → different execution identity
```

This is important because D02 must never turn transport retries into duplicate external side effects.

## 15.6 Output semantics

D02 intentionally captures **opaque raw execution output** only.

Success envelope contains:

```text
rawOutput
rawOutputHash
semanticValidation = NOT_PERFORMED_D03_REQUIRED
```

A successful HTTP status is not semantic validity.

Explicitly:

```text
HTTP 200 ≠ conformance
HTTP 200 ≠ agronomic correctness
HTTP 200 ≠ RuntimeResult authority
```

D02 creates no RuntimeResult or RuntimeDatum ledger side effect.

That belongs to D03.

## 15.7 Failure normalization

Current broker normalizes:

```text
transport throw → RUNTIME_EXECUTION_TRANSPORT_ERROR
timeout         → RUNTIME_EXECUTION_TIMEOUT
invalid opaque output capture → RUNTIME_EXECUTION_OUTPUT_INVALID
```

Failures remain execution-envelope facts, not semantic decision results.

## 15.8 D02 current acceptance

Root-wired suites:

```text
run.mjs          8
integrity.mjs   12
idempotency.mjs  4
hardening.mjs    4
------------------
current total   28
```

The first exact-head run is GREEN.

Do not treat 28/28 + first GREEN as closure until the rest of the gate protocol below is complete.

---

# 16. What the next conversation should do first

The next conversation should **not** restart from S03 or re-audit the full repository.

Start at:

```text
main  = d36564002aad64b3b010b72b66a8d661d8826582
D02   = feat/v0.1-mtl-d02-implementation-broker
head  = 1aff53862ffbb19a74ff472d28d72e6f9290a749
CI    = 31974561931 GREEN
PR    = none yet
```

Recommended next sequence:

```text
1. Independent D02 authority/security review on 1aff5386...
2. Verify D02 task/capability requirements against actual implementation
3. Check timeout / failure / idempotency semantics for hidden ambiguity
4. Check external executor seam for credential/network nonclaims
5. Check execution chronology and clock semantics
6. Check exact current Deployment/Conformance revalidation at dispatch
7. Check raw output capture cannot become semantic authority
8. Check no RuntimeResult/RuntimeDatum side effects
9. Add any missing executable acceptance discovered by review
10. Write D02 implementation contract
11. Re-run exact final feature head full root CI
12. Open Draft D02 PR
13. Run Draft merge-ref full root CI
14. Independent final diff review
15. Mark Ready
16. Revalidate Ready-state exact merge candidate independently
17. exact-head merge
18. read actual main from branch ref
19. run exact-main full root CI
20. only then declare D02 CLOSED
```

Do not skip directly from first branch GREEN to Ready/merge.

---

# 17. D02 review questions that remain valuable

These are not asserted blockers yet. They are the highest-value review questions for the next conversation.

## 17.1 Production-external transport nonclaim

The current executor registry dispatches a registered callback for INTERNAL/EXTERNAL classes.

Before describing D02 as production external execution, verify whether the task requires:

```text
real network transport
credential boundary
retry/backoff policy
external request signing
durable idempotency store
production timeout/SLO behavior
```

If those are not required by D02 v1, preserve the explicit nonclaim instead of overbuilding.

## 17.2 Idempotency durability

Current `RuntimeExecutionIdempotencyStore` proves deterministic in-process behavior.

Do not claim durable exactly-once execution across process crash/restart unless a durable store is explicitly implemented and tested.

The current architectural requirement is better phrased as:

```text
exact execution identity + replay-safe idempotency semantics
```

not:

```text
globally exactly-once distributed execution
```

unless later implemented.

## 17.3 Timeout side effects

A timeout can occur after the downstream executor has actually started work.

The broker currently caches the timeout envelope for that execution identity, which prevents ADR from dispatching the same exact execution again through this store.

Independent review should verify the nonclaim around downstream cancellation/remote side effects.

## 17.4 Runtime execution chronology

Verify that:

```text
execution clock
startedAt
completedAt
Deployment active interval
ImplementationConformance validity
```

are consistent and cannot be caller-controlled through hidden fields.

## 17.5 Current vs historical execution

D01/S03 preserve historical replay of what was bound.

D02 dispatch is a **current new-use action** and therefore correctly revalidates current Deployment + current Conformance before dispatch.

Do not add an `allowHistorical=true` execution shortcut that allows revoked/expired conformance to be executed merely because an old RuntimeBinding can still be replayed.

Historical replay is evidence; it is not permission to execute again.

---

# 18. After D02 — expected downstream dependency direction

Do not jump to P05 merely because public product tasks exist.

The likely authority chain after D02 remains:

```text
D02 Runtime Execution Broker
        ↓
D03 RuntimeResult / semantic output validation
        ↓
D04 RuntimeAlternativeSet / coverage
        ↓
DecisionRobustness / DecisionResult chain as authorized by Master Task Line
        ↓
Outcome / Evaluation capability
        ↓
P05 full pilot decision loop when all required Gate R/D/E predecessors exist
```

Always re-read the current Master Task Line before opening each branch; do not infer task numbering from conversation memory.

---

# 19. Important failure modes and lessons from this conversation

## 19.1 False-green from unwired tests

R01 exposed the clearest example:

```text
Actions GREEN
but new acceptance not in root npm test
→ GREEN is invalid readiness evidence
```

Permanent response:

```text
check package.json root wiring
read actual suite output counts
never trust job color alone
```

## 19.2 Draft→Ready merge ref is a new subject

GitHub may recompute or temporarily clear `merge_commit_sha` when a Draft PR becomes Ready.

Therefore:

```text
Draft merge-ref GREEN
!=
Ready-state merge-ref GREEN
```

Every Ready transition in this conversation was followed by re-reading candidate SHA and independently running that exact candidate.

Keep doing this.

## 19.3 Merge API SHA is not final repository fact

After merge, always read:

```text
branches/main
```

The merge API response has previously been misread / treated as a candidate value.

The only closure subject is the actual branch ref plus exact-main CI.

## 19.4 Generic audit vocabulary is not authorization

A01 demonstrated that a caller can construct audit action/details strings.

Therefore:

```text
audit metadata != authority
```

Authorization must be replayable from exact immutable RoleAssignment/AuthorizationDecision authority.

This principle was reused throughout A/S-track.

## 19.5 Built-in roles must not silently gain new capability

New permissions added during this conversation include examples such as:

```text
decision.problem.create
runtime.profile.manage
specification.manage
implementation.manage
implementation.conformance.qualify
```

No existing built-in role should silently receive them.

Explicit RoleAssignment authority is intentional.

## 19.6 Same semantic object retry must not rebind governance

Repeated publication of the same exact identity by a second authorized manager must not rewrite who originally governed/published the immutable object.

This became explicit acceptance in multiple tracks.

## 19.7 Historical replay is not current-use authority

Across Knowledge, Release, Deployment, Applicability, Binding and Conformance:

```text
historical replayability
!=
permission for current new use
```

Later revoke/suspend/deprecate/expiry can block current use while exact historical evidence remains replayable.

## 19.8 Do not fabricate authority just to make task numbering continuous

Examples:

```text
A05 did not create fake Model/Policy
A09 was not fabricated merely because numbering skipped
D02 was blocked until real S01/S02/S03 executable authority existed
D02 does not fabricate RuntimeResult because D03 is not done
```

This is one of the most important working-method rules in the repository.

## 19.9 First-party does not mean privileged

P04 and S02 both caught this.

`GEOX` cannot become ADR core ontology merely because it is first-party.

First-party adapters/executors must use platform-neutral public contracts and receive no scientific or decision privilege.

## 19.10 Test failures can be test-quality failures — but prove it

Several red runs were caused by fixture/assertion defects rather than implementation semantics.

The correct method is:

```text
read exact failure
show why authority contract is not violated
fix only the faulty fixture/assertion
rerun exact head
```

Never weaken a real contract simply to restore green.

---

# 20. Repository hygiene / stale branches and PRs

Current active implementation:

```text
feat/v0.1-mtl-d02-implementation-broker
```

Historical PR #17 is an outdated K06 handoff and should be superseded by this handoff.

Historical PR #14 is an old K05 Draft and no longer represents current main.

There are also temporary verification/gate branches created during earlier exact-SHA CI work. The connector has not always exposed branch deletion reliably in every session. Do not infer that an old `verification/*` or `gate/*` branch represents an active implementation frontier; check whether it differs from main and whether it has a PR.

This conversation also created several empty docs-branch refs while preparing the new handoff. They contain no implementation changes and should be treated as repository-hygiene cleanup only, not as work frontiers.

If convenient, the next conversation may clean stale docs/gate branches after D02 is safely gated, but branch cleanup must not delay the active implementation frontier.

---

# 21. Exact milestone/PR chain relevant to this handoff

The important merged PR chain from the applicability/runtime portion is:

```text
#20  A03 Context Reference Resolution
#21  A04 ContextManifest
#22  A05 Minimal RuntimeProfile
#23  A06 Deployment
#24  A07 Knowledge Retrieval
#25  A08 Applicability
#26  A10 Escalation Read Model
#27  A11 Agronomist Workbench
#28  Gate A
#29  P01 Public API/OpenAPI
#30  P02 SDK/Generic Integration
#31  P03 Non-GEOX Reference Integration
#32  P04 GEOX First-Party Adapter
#33  R01 RuntimePlan DAG
#34  R02 InformationRequirement
#35  R03 RuntimeEligibility
#36  D01 RuntimeBinding
#37  S01 Specification Authority
#38  S02 Implementation Registry
#39  S03 ImplementationConformance
```

Earlier A01/A02/K06 work was also closed before this chain and is required authority, but the next conversation does not need to re-audit it unless D02 exposes an exact upstream contradiction.

---

# 22. Current mental model for the next engineer/conversation

Do not think of ADR as:

```text
rules engine
model orchestrator
agronomy chatbot
GEOX microservice
LLM knowledge extractor
```

The repository now has a much more exact architecture:

```text
Science authority
  Source → Claim → Qualification → Knowledge → Release

Decision/context authority
  DecisionProblem + exact ContextManifest

Deployment authority
  RuntimeProfile + Deployment

Transport/applicability authority
  Retrieval + Applicability

Planning/legality authority
  RuntimePlan + InformationRequirement + RuntimeEligibility

Frozen execution-world authority
  RuntimeBinding

Executable semantics authority
  Specification + Implementation + ImplementationConformance

Current frontier
  RuntimeExecutionBroker
```

The purpose of D02 is only to faithfully execute the **already frozen legal executable world**.

D02 must not become a second planner, second applicability engine, second policy engine, second qualification system, or DecisionResult generator.

The broker should be boring in exactly the right way:

```text
validate exact authority world
freeze exact input envelope
dispatch exact implementation
preserve execution identity/idempotency
capture opaque output/failure
make no semantic claim beyond execution facts
```

That is the correct standard for the current frontier.

---

# 23. Final handoff state

The repository is no longer at the K06/Applicability design frontier recorded in the 2026-08-16 handoff.

The current state is:

```text
Standalone product architecture: FROZEN
Gate K:                      CLOSED
Gate A:                      CLOSED
Gate R:                      CLOSED
D01 RuntimeBinding:          CLOSED
S01 Specification:           CLOSED
S02 Implementation Registry:CLOSED
S03 Conformance:             CLOSED

main:
d36564002aad64b3b010b72b66a8d661d8826582

active implementation:
MTL-D02 Runtime Execution Broker

branch:
feat/v0.1-mtl-d02-implementation-broker

head:
1aff53862ffbb19a74ff472d28d72e6f9290a749

first exact-head root CI:
31974561931 — GREEN

current D02 acceptance surface:
28 tests across positive/integrity/idempotency/hardening

D02 PR:
NOT YET CREATED

D02 implementation contract:
NOT YET WRITTEN
```

The next conversation should resume from D02 independent review and gate closure, not reconstruct product history or restart S03.

The most important permanent boundary remains:

```text
Knowledge validity
≠ Applicability
≠ Runtime Legality
≠ Runtime Binding
≠ Execution success
≠ Semantic RuntimeResult
≠ Decision
≠ Outcome / effectiveness
```

ADR exists precisely to keep those claims separate and make every promotion of authority explicit, replayable and reviewable.
