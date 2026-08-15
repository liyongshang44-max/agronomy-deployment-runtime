# Agronomy Deployment Runtime — Conversation Handoff — 2026-08-16

Status: **CONVERSATION HANDOFF ONLY — NOT ARCHITECTURE AUTHORITY**

This handoff is intended to let the next conversation resume the work without reconstructing the product thesis, authority boundaries, repository state, current implementation frontier, or the failure modes already discovered.

If this handoff conflicts with frozen Architecture v1.0, planning authority, or repository facts, the higher authority wins.

---

## 0. Repository / branch / PR facts at handoff

Repository:

```text
liyongshang44-max/agronomy-deployment-runtime
```

Protected/default `main` at handoff:

```text
8d533f39f85a96877edba750ded9dd29c32ea818
```

That `main` commit closes:

```text
MTL-K05 — DerivedKnowledge / DerivedKnowledgeContext / Conflict
```

Active implementation branch:

```text
feat/v0.1-mtl-k06-knowledge-release
```

Active Draft PR:

```text
#16 — feat(v0.1): establish exact KnowledgeRelease authority
```

Implementation head before this handoff was written:

```text
74b01ab31ea450936a25c3cece6025bd9ab789ed
```

Latest observed PR merge ref used by CI:

```text
357a05c4a51af39a41d1cc822f91a0de5f00998f
```

Latest observed CI run on that implementation state:

```text
ADR Constitution
run: 31896176349
result: FAILURE
```

The failure is **not** constitutional static-boundary drift. Static checks passed. The failure is in `npm test`, specifically the current `MTL-K06 KnowledgeRelease` acceptance suite.

This handoff itself is written on a separate docs-only branch based on `main`:

```text
docs/handoff-2026-08-16
```

Do not confuse that docs branch with the K06 implementation branch.

---

# 1. Authority order — read this before changing architecture

The correct authority order is:

```text
Architecture authority
  > Capability planning authority
  > Master Task Line
  > Version slicing
  > Implementation PR
  > Conversation handoff
```

The current frozen / governing architecture files on `main` are:

```text
docs/architecture/ADR-STANDALONE-PRODUCT-ARCHITECTURE-v1.0.md
docs/architecture/ADR-REPO-CONSTITUTION-v1.0.md
docs/architecture/ADR-COMPLETE-COMPONENT-ARCHITECTURE-v1.0.md
docs/architecture/ADR-AGRONOMIC-CONTEXT-AND-PUBLIC-RUNTIME-CONTRACT-v1.0.md
docs/architecture/ADR-ARCHITECTURE-v1.0-FINAL-ADJUDICATION.md
```

Planning authority / implementation planning files include:

```text
docs/planning/ADR-CAPABILITY-MAP-01.md
docs/planning/ADR-CAPABILITY-MAP-01-FINAL-ADJUDICATION.md
docs/planning/ADR-MASTER-TASK-LINE-01.md
docs/planning/ADR-MASTER-TASK-LINE-01-REVIEW-ADJUDICATION.md
docs/planning/ADR-VERSION-SLICING-01.md
```

Important rule:

> If implementation difficulty appears to contradict frozen Architecture v1.0, do not silently reinterpret the architecture in code. Stop and open a decision/adjudication path.

---

# 2. The most important handoff: how this became an independent product

The project did **not** begin as a plan to build another standalone agricultural software company.

The original problem came from GEOX:

```text
How can agronomic knowledge enter GEOX at low cost,
be matched against the actual field context,
and be used safely when the field is or is not inside the knowledge's valid domain?
```

The first framing was roughly:

```text
agronomic document / expert knowledge
        ↓
low-cost extraction
        ↓
GEOX checks field conditions
        ↓
if matched → give agronomic guidance
if not matched → ask for more evidence / refuse / adapt
```

That framing was useful but incomplete. The key realization was that the difficult problem is **not simply getting agronomy into software**.

The difficult problem is:

> How do we transport a scientific/agronomic statement from the conditions under which it was produced into a specific target decision context, without silently expanding its authority?

That led to a more precise decomposition:

```text
Source
  ↓
What did the source actually say?
  ↓
What may be recognized as qualified knowledge?
  ↓
Under what source/origin conditions did it hold?
  ↓
Does it survive transport to this TargetContext and purpose?
  ↓
What transformations/models/policies are legally composable?
  ↓
What exact runtime world is bound this time?
  ↓
Do remaining legal alternatives materially change the action?
  ↓
What happened after execution, and what can actually be learned?
```

This changed the product category.

The product is **not** fundamentally a PDF-to-knowledge extractor, an LLM agronomy chatbot, a rule engine, or a GEOX plugin.

Its technical definition became:

> **Agronomy Deployment Runtime is a governed platform that compiles the valid domain of agronomic knowledge into a traceable, replayable runtime world for a specific target context and decision purpose.**

A shorter formulation used during the design work was:

```text
Agronomy Compiler + Agronomy Runtime
```

with two different compilers:

```text
Scientific Compile:
Source → Claims → Qualified Knowledge

Runtime Compile:
DecisionProblem + Knowledge + TargetContext + Model + Policy
→ RuntimePlan → RuntimeBinding
```

This is the conceptual origin of the standalone repository.

---

# 3. Why it was separated from GEOX

The independent-product decision was deliberate and should not be casually reversed.

The product was frozen as independent from day one:

```text
independent product
independent repository
independent data model
independent API
independent release cycle
independent deployment
independent customer integrations
```

GEOX is now only:

```text
first-party integration
reference consumer
field-validation substrate
possible context/state/model/forecast/outcome provider
```

GEOX is explicitly **not**:

```text
ADR host
ADR schema authority
ADR scientific authority
required ADR core dependency
```

The dependency direction must remain:

```text
ADR public contracts / APIs
          ▲
          │
        GEOX
```

Never:

```text
ADR core
   │
   ▼
GEOX internals
```

The practical constitutional test is stronger than simply having a separate repo:

```text
NO @geox/* dependency
NO GEOX DB/schema/table dependency
NO MCFT/CAP/KBS/T3R1 semantic dependency
core packages cannot import adapters/*
scientific domain cannot call farm-provider URLs directly
adapters cannot grant qualification
adapters cannot invent transformations
remove adapters/geox → standalone core still builds/tests
GEOX repo unavailable → standalone acceptance still passes
```

This independence is already encoded in repository constitutional acceptance and must remain a permanent regression boundary.

---

# 4. What the standalone product actually owns

ADR owns the semantics and governance of **agronomic knowledge deployment**, not farm reality itself.

The frozen architecture assigns ADR authority over:

```text
Source provenance and SourceArtifact identity
Scientific compilation
Claim / SourceContext authority
Scientific qualification
DerivedKnowledge and conflict governance
KnowledgeRelease
Source/Derived origin → Target transport / Applicability
Qualified transformations
Model / Policy / Implementation semantic registries
ImplementationConformance
Calibration authority distinct from scientific knowledge
RuntimeProfile
Deployment control
Context-resolution contract
ContextManifest
KnowledgeRetrievalResult provenance
RuntimePlan
InformationRequirement
RuntimeEligibility
RuntimeBinding
RuntimeAlternativeSet
RuntimeDatum / normalized runtime results
DecisionRobustness
DecisionResult where configured authority permits
OutcomeEvaluation
Effect attribution authority where causality is claimed
Revision proposals
Tenant/IP governance, replay and audit
```

ADR may consume external:

```text
reality/context
evidence
state estimates
forecasts
model execution
policy execution
recommendations
execution records
outcomes
```

But ingesting them does not make ADR the owner of field truth, sensor truth, digital-twin state truth, machine execution authority, or human approval authority.

---

# 5. The architectural distinctions that must not collapse

A large part of the work has been preventing apparently convenient object mergers that destroy authority semantics.

The frozen distinctions include:

```text
Source ≠ SourceArtifact ≠ Claim ≠ QualifiedKnowledge ≠ DerivedKnowledge

SourceContext ≠ DerivedKnowledgeContext ≠ TargetContext ≠ ContextManifest

KnowledgeRelease ≠ RuntimeProfile ≠ Deployment

Specification ≠ Implementation ≠ ImplementationConformance

DerivedKnowledge ≠ CalibrationArtifact

RuntimePlan ≠ RuntimeAlternativeSet ≠ RuntimeBinding

RuntimeEligibility ≠ DecisionDisposition ≠ DecisionResult

ContextDatum ≠ RuntimeDatum

Outcome ≠ CausalEffect

Knowledge ≠ Transformation ≠ Model ≠ Policy ≠ Implementation
```

These separations are not style preferences. They prevent one authority class from silently laundering another.

The most important examples:

```text
QUALIFIED ≠ APPLICABLE
APPLICABLE ≠ RUNTIME_ELIGIBLE
RUNTIME_ELIGIBLE ≠ ACT
OUTCOME ≠ CAUSAL EFFECT
```

---

# 6. SourceContext → TargetContext is the central scientific transport problem

The most important conceptual development in the design was to stop thinking of applicability as a generic similarity score.

The intended semantic relation is:

```text
Transport(
  Knowledge,
  SourceContext,
  TargetContext,
  Purpose
)
```

not:

```text
field similarity score > threshold
```

`SourceContext` means the governed scientific/empirical environment in which the knowledge was produced.

`TargetContext` means the real target environment in which the knowledge may be deployed.

Applicability should be claim-/knowledge-specific and condition-specific.

Representative dispositions are:

```text
DIRECTLY_APPLICABLE
APPLICABLE_WITH_GOVERNED_TRANSFORM
CALIBRATION_REQUIRED
BOUNDED_EXTRAPOLATION
UNRESOLVED
CONFLICT
NOT_RELEVANT
```

A single critical conflict may invalidate use even if many supporting dimensions match. Therefore do not reduce applicability to one global numerical score unless a future qualified scientific method explicitly defines such a score.

A useful earlier condition-level model was:

```text
MATCH
ADJUSTABLE
UNKNOWN
CONFLICT
NOT_RELEVANT
```

with condition criticality such as:

```text
REQUIRED
ADJUSTABLE
SUPPORTING
```

The runtime behavior should remain fail-closed for scientifically material unknown/conflict states.

---

# 7. Context is not just flat key/value data

The design converged on `ContextDatum` as the basic context atom rather than a dumb field map.

A datum needs semantics such as:

```text
semantic_id
value
unit
epistemic_class
provenance_class
effective interval
available_at
spatial support
vertical support
uncertainty
source / provider identity
semantic/content hash
```

A key unresolved design issue was originally whether epistemic status and provenance should be one enum. The architecture direction separated them conceptually:

```text
epistemic_class
  e.g. OBSERVATION / ASSERTION / DERIVED / STATE_ESTIMATE / CONFIGURATION / MODEL_PRIOR

provenance_class
  e.g. USER / MACHINERY / SENSOR / REMOTE_SENSING / EXTERNAL_PROVIDER / CUSTOMER_SYSTEM / MODEL
```

The reason is that e.g. “grower says planting date = May 20” has both an epistemic status and a provenance source; collapsing those dimensions makes downstream reasoning ambiguous.

For runtime compilation, do **not** let Applicability read an open, moving context pool.

The architecture introduces immutable:

```text
ContextManifest
```

which freezes the exact context world used for one compilation, including exact resolved external-reference receipts.

This is essential for replay and for preventing mixed-time worlds.

---

# 8. Adapters must never become scientific authority

Adapters are translation boundaries only.

Example of legal adapter behavior:

```text
external provider says:
soil VWC = 0.31 m3/m3 at 100 mm depth

adapter → canonical ContextDatum
```

Illegal adapter behavior:

```text
adapter silently decides:
100 mm VWC == root-zone water storage
```

That second step is a semantic transformation and requires qualified Transformation / Model / Applicability authority.

This rule exists because otherwise semantic corruption simply moves from “LLM hallucination” into connectors.

---

# 9. Scientific knowledge, commercial policy, and vendor material must remain separate

One important product/business conclusion from the earlier research was that companies that “own agronomy” often use agronomy to support:

```text
input sales
customer retention
stewardship / compliance
product performance
agronomist productivity
field-result data capture
```

That means proprietary agronomy can carry commercial incentives.

ADR must therefore distinguish, rather than collapse:

```text
university/scientific trial evidence
legal/regulatory label constraint
vendor efficacy evidence
manufacturer agronomy recommendation
commercial product preference
```

Commercial preference belongs in Policy, not disguised as scientific Knowledge.

This is important to the long-term product category: the platform should be able to deploy a customer's agronomy without pretending every company-authored recommendation is neutral scientific authority.

---

# 10. Commercial thesis that produced the product — not yet proven PMF

The strongest commercial hypothesis from the product research is not “farmers will pay for AI agronomy.”

The stronger hypothesis is:

> agricultural organizations already possess agronomy, but deploying it consistently, safely, locally, and at scale consumes scarce agronomist labor and creates governance risk.

Potential value therefore comes from:

```text
agronomist throughput
fewer routine field reviews
faster response
more acres / customers per agronomist
central agronomy deployed into local context
consistent governance across regions / customers
explicit escalation when local evidence is insufficient
replay/audit/compliance
```

The likely first product form discussed was closer to:

```text
Agronomist Copilot
→ Agronomist Runtime
→ Advisory
→ Controlled Automation later
```

rather than an autonomous grower chatbot.

A particularly attractive first-customer hypothesis was independent/regional crop consulting organizations where agronomy itself is a paid service and the business can directly value:

```text
minutes per field
fields reviewed per agronomist
acres per agronomist
escalation rate
override rate
customer retention
gross margin per agronomist
```

This is still a **commercial thesis**, not proven PMF.

A recommended falsifiable pilot shape was:

```text
one real workflow
customer agronomy
customer fields
customer agronomists
shadow mode first
```

Measure whether the same agronomist team can safely cover materially more routine work without hiding important disagreement or evidence gaps.

If the product does not materially improve agronomist throughput, gross margin, response quality, governance, or risk, the commercial thesis should be downgraded even if the architecture is technically elegant.

Do not confuse technical replay/authority acceptance with commercial validation.

---

# 11. Product planes and long-term backbone

The frozen product architecture has three main planes plus governance fabric.

## Knowledge Control Plane

```text
Source
  ↓
SourceArtifact
  ↓
Scientific Compiler
  ↓
Claims + SourceContext
  ↓
Qualification
  ↓
QualifiedKnowledge
  ↓
DerivedKnowledge + DerivedKnowledgeContext / Conflict
  ↓
KnowledgeRelease
```

Separate registries then feed runtime composition:

```text
Transformations
Models
Policies
Implementations
Conformance
Calibration
        ↓
RuntimeProfile
        ↓
Deployment
```

## Deployment Runtime Plane

```text
DecisionProblem
       +
Context inputs / authorized references
       ↓
Context Resolution
       ↓
ContextManifest
       ↓
Knowledge Retrieval
       ↓
KnowledgeRetrievalResult
       ↓
Origin → Target Transport / Applicability
       ↓
RuntimeCandidates
       ↓
Runtime Compiler
       ↓
RuntimePlan DAG
       ↓
InformationRequirements
       ↓
RuntimeEligibility
       ↓
RuntimeBinding(s)
       ↓
RuntimeAlternativeSet
       ↓
Implementation execution
       ↓
RuntimeResults / RuntimeDatum
       ↓
DecisionRobustness
       ↓
DecisionResult when authority mode permits
       ↓
ACT / WAIT / ASK / ABSTAIN
```

## Evaluation Plane

```text
Execution + Outcome
       ↓
OutcomeEvaluation
       ↓
EffectAttributionAssessment where causal claims are made
       ↓
Calibration / Knowledge / Transformation / Model / Policy revision proposals
       ↓
Control-plane review
       ↓
new version if authorized
```

The six long-term backbone objects are:

```text
KnowledgeRelease
RuntimeProfile
Deployment
ContextManifest
RuntimeBinding
DecisionRobustness
```

---

# 12. What is already complete in the repository

## 12.1 Architecture / planning

Architecture v1.0 has been frozen and final-adjudicated.

The major conceptual disputes already closed include:

```text
standalone product boundary
GEOX relationship
authority ownership
tenancy/IP dimensions
KnowledgeRelease vs RuntimeProfile vs Deployment
SourceContext vs TargetContext vs ContextManifest
adapter restrictions
scientific vs commercial authority
runtime eligibility vs action/decision separation
replay/immutability direction
```

Do not reopen these because a later implementation is inconvenient.

## 12.2 Gate F is implemented

The repository has already implemented and accepted:

```text
MTL-F01 — Repo Constitution / standalone CI
MTL-F02 — Canonical Identity / Immutability / Lineage / Replay / Audit
MTL-F03 — IAM / Tenant / Knowledge-IP / Entitlement
```

This established the standalone multi-tenant authority substrate.

## 12.3 Knowledge track through K05 is merged

The following are already on `main`:

```text
MTL-K01 — Source / SourceArtifact exact materialization
MTL-K02 — Scientific Compiler candidate pipeline
MTL-K03 — Claim + SourceContext source-faithful authority
MTL-K04 — Scientific Qualification / QualifiedKnowledge
MTL-K05 — DerivedKnowledge / DerivedKnowledgeContext / Conflict
```

Important established behaviors include:

```text
Source ≠ exact artifact bytes
Compiler produces candidate only, never qualification
Claim remains source-faithful
SourceContext preserves NOT_REPORTED rather than inventing conditions
QualifiedKnowledge is scientific-use authority only
revocation/requalification are immutable lineage
DerivedKnowledge retains all exact origins
DerivedKnowledgeContext cannot impersonate one arbitrary SourceContext
newest-wins / LLM preference / simple averaging cannot resolve scientific conflict
CALIBRATION_REQUIRED does not create CalibrationArtifact or DerivedKnowledge by implication
conflict/resolution authority revalidates exact authorization, audit and lineage
```

Current `main` therefore represents a complete authority foundation plus K01–K05, but **not yet Gate K**.

---

# 13. Current active task — MTL-K06 KnowledgeRelease

The exact task goal from the Master Task Line is:

> Freeze deployable Qualified/Derived Knowledge into an exact release without mixing Model/Policy/Implementation/rollout state.

The intended authority chain is:

```text
QualifiedKnowledge / DerivedKnowledge
        ↓ exact member authority + entitlement
KnowledgeReleasePublicationDecision
        ↓
KnowledgeRelease
```

The semantic payload of `KnowledgeRelease` is intentionally only:

```text
memberRefs = exact canonical QualifiedKnowledge / DerivedKnowledge refs
```

Publication governance is kept in a separate object so that:

```text
KnowledgeRelease ≠ RuntimeProfile ≠ Deployment
```

The K06 implementation work has already added or explored:

```text
exact release member set
publisher release authorization
member deployment entitlement
cross-owner composition without ownership transfer
release publication decision
known-conflict publication governance
active conflict-resolution state tracking
release lifecycle decisions
release supersession lineage
predecessor control authorization concept
owner-side future-use entitlement revocation concept
historical replay mode concept
generic-ledger laundering guards
same-release governance retry guard
no latest-version drift
```

Independent implementation review produced:

```text
docs/implementation/ADR-v0.1-MTL-K06-KNOWLEDGE-RELEASE.md
docs/implementation/ADR-v0.1-MTL-K06-REVIEW-ADJUDICATION.md
```

on the feature branch.

---

# 14. Current K06 blocker — exact CI facts

Latest observed CI on implementation head `74b01ab...` checked out PR merge ref `357a05c4...`.

Constitutional static checks passed.

All pre-K06 acceptance groups in that run passed, including:

```text
constitution
authority
authorization
source materialization
scientific compiler
source-faithful authority
qualification
derived knowledge / conflict
```

The current failure is specifically:

```text
test:knowledge-release
15 total
9 passed
6 failed
```

The six failing tests were:

### 1. Active conflict-resolution drift not detected

Expected:

```text
release published with known conflict state
↓
active conflict resolution changes later
↓
release becomes stale for new use
```

Observed: no error was raised.

This means the read-side current-governance comparison is still incomplete or not using the correct active-resolution state.

### 2. New release supersession does not yet require exact predecessor control

Expected missing predecessor-control authority to fail.

Observed: no error.

This is a serious authority boundary. A publisher who can publish a new member set must not automatically gain authority to supersede an old release.

### 3. Foreign organization lifecycle/supersession seizure is not yet blocked

Expected another organization to fail when trying to seize release lifecycle or supersession control.

Observed: no error.

The controller boundary must remain anchored to the original publication authority / organization / tenant / target as designed.

### 4. Historical replay after later QualifiedKnowledge revocation fails

Expected:

```text
old release historical replay = valid
new current use = invalid
```

Observed historical validation still failed because `QualifiedKnowledge` was treated as having no active scientific use.

This means `allowHistorical` is not yet correctly propagated or interpreted through the exact QK validation path.

### 5. Historical replay of DerivedKnowledge fails after later input QK revocation

Expected historical replay to revalidate immutable provenance/lineage without applying later current-use revocation as a rewrite of history.

Observed `validateDerivedKnowledgeAuthority` still failed on revoked input authority.

Historical mode must propagate through the whole dependency closure, not just the top-level release validator.

### 6. Same exact release identity / different governance test fails too early

Expected:

```text
RELEASE_PUBLICATION_RETRY_MISMATCH
```

Observed:

```text
RELEASE_AUTHORIZATION_DENIED
```

This means the fixture/request path currently hits entitlement authorization before reaching the intended ambiguous-governance retry seam. The test and/or service ordering must be corrected so the intended invariant is actually exercised.

---

# 15. Additional K06 acceptance files exist but are not yet wired into npm test

The feature branch currently contains:

```text
acceptance/knowledge-release/run.mjs
acceptance/knowledge-release/integrity.mjs
acceptance/knowledge-release/entitlement.mjs
acceptance/knowledge-release/conflict-coverage.mjs
```

However the current `package.json` still says:

```text
"test:knowledge-release": "node acceptance/knowledge-release/run.mjs"
```

So the supplementary integrity/entitlement/conflict-coverage acceptance files are present but **not yet part of the authoritative CI command**.

This is an important current-state fact. Do not declare K06 complete merely because one supplemental file passes manually.

Before Gate K closure, wire all intended K06 acceptance files into the real root test command and run the full exact-head suite.

---

# 16. Important K06 review findings already discovered

Do not regress these while fixing the six current failures.

## 16.1 Publication authority laundering

A generic ledger object with `kind = KnowledgeRelease` is not legitimate merely because its refs resolve.

It must have exact publication authority, exact publisher audit, exact member entitlement authority and complete upstream closure.

## 16.2 Ambiguous publication retry

Because `KnowledgeRelease` semantic identity is intentionally only `{memberRefs}`, the same logical id/version/member set must not be rebound to a different publisher/target/entitlement governance world.

Exact retry is legal only if publication governance is identical.

## 16.3 Conflict-resolution drift

It is not enough to freeze only `KnowledgeConflict` refs. Active resolution refs are also part of publication governance and must be checked for current-use drift.

## 16.4 Conflict hiding by member omission

A known conflict must not disappear simply because the publisher includes one side but omits the competing member.

The adjudicated direction is:

```text
release member set ∩ conflict member set ≠ ∅
→ conflict remains relevant publication-governance input
```

This prevents cherry-picking one side of a known conflict and pretending the conflict does not exist.

## 16.5 Cross-owner entitlement persistence

A one-time cross-owner release entitlement must not become an irrevocable perpetual license.

The member owner needs future-use control while historical replay remains preserved.

## 16.6 Generic current-state poisoning

Forged lifecycle objects or generic `supersedes` edges must not poison current release state merely by object kind.

Read-side status must revalidate exact authority chains.

---

# 17. Pitfalls already encountered — avoid repeating them

## Pitfall A — treating “standalone repo” as proof of independence

Independence is only real if enforced by CI and dependency direction.

Do not reintroduce GEOX/MCFT/CAP/KBS/T3R1 semantics into ADR core because they are convenient test fixtures.

## Pitfall B — letting LLM output become scientific authority

The compiler can compile/extract proposals. It cannot self-qualify them.

The permanent principle is:

```text
LLM can compile knowledge.
LLM cannot grant itself production/scientific authority.
```

## Pitfall C — source claim and platform judgment mixing

Claim must remain what the source says.

Platform review/qualification/applicability must be separate authority objects.

Do not “correct the paper” by silently rewriting Claim.

## Pitfall D — collapsing SourceContext and TargetContext

SourceContext is the origin domain of knowledge.

TargetContext is the deployment target.

Applicability is transport between them, not generic field similarity.

## Pitfall E — adapter semantic inference

Adapters translate. They do not infer agronomy.

If a conversion changes scientific meaning, it belongs in governed Transformation/Model authority.

## Pitfall F — qualification becoming applicability

`QUALIFIED` only means allowed for a specified scientific use under qualification authority.

It does not mean the knowledge applies to the current field.

## Pitfall G — applicability becoming action

Even applicable knowledge may not produce a legal runtime or a stable action.

The intended flow remains:

```text
Applicability
→ RuntimeEligibility
→ RuntimeBinding / RuntimeAlternatives
→ DecisionRobustness
→ ACT / WAIT / ASK / ABSTAIN
```

## Pitfall H — global applicability score

Do not replace critical-condition adjudication with one arbitrary score.

A single REQUIRED conflict can invalidate an otherwise high-similarity context.

## Pitfall I — treating missing field data as permission to guess

Unknown target conditions must remain unknown unless resolved through valid context/evidence/state/model authority.

The system may request evidence, ask a human, use a qualified state estimate, or abstain.

Do not persistence-fill facts.

## Pitfall J — current-state rules destroying historical replay

This is the exact seam K06 is currently exposing.

Current eligibility and historical replay are different questions.

Later revocation/supersession must block new use without rewriting the authority world that existed at the original decision time.

## Pitfall K — generic ledger object kind treated as sufficient authority

The shared ledger is a persistence/replay substrate, not scientific legitimacy by itself.

Downstream validators must reconstruct upstream authority, audit and lineage.

## Pitfall L — writing extra acceptance files but not wiring them into CI

This happened in K06.

The existence of `integrity.mjs`, `entitlement.mjs`, or `conflict-coverage.mjs` does not count until root `npm test` executes them.

## Pitfall M — declaring success from the feature head without merge-ref evidence

GitHub PR CI checks a merge ref. Exact feature-head results and merge-ref results are not interchangeable.

Before merging, verify the exact feature head, the generated merge ref, and all required checks.

---

# 18. Exact next plan

The next conversation should **not** jump to Applicability yet.

The immediate task is to finish `MTL-K06` and close Gate K.

Recommended order:

```text
1. Re-read this handoff + frozen K06 task + K06 review adjudication.

2. Reconfirm repository facts:
   main = 8d533f39...
   PR #16 still open/draft
   implementation branch/head
   latest merge ref / CI run

3. Fix the six currently failing run.mjs tests one by one,
   without weakening authority semantics.

4. Wire:
   run.mjs
   integrity.mjs
   entitlement.mjs
   conflict-coverage.mjs
   into test:knowledge-release.

5. Run full root acceptance:
   F01–F03
   K01–K05 regression
   all K06 suites.

6. Do a final independent authority-chain review,
   especially:
   - publication legitimacy
   - owner entitlement
   - active conflict/resolution drift
   - historical replay
   - predecessor-control supersession
   - lifecycle control
   - generic-ledger poisoning
   - same-release governance ambiguity

7. Only when exact feature head and PR merge ref are both green,
   move PR #16 out of Draft and merge exact SHA.

8. After merge, verify protected/default main exact SHA.

9. Only then declare:
   Gate K — Deployable Knowledge Authority = CLOSED.
```

Do not weaken a failing test merely to make CI green. If a failure reveals a real architecture contradiction, stop and adjudicate rather than coding around it.

---

# 19. What happens after Gate K

Once K06 is truly merged, the product can move into the Context / Decision / Applicability track.

The logical next frontier is:

```text
MTL-A01 — DecisionProblem / Use-Purpose Authority
MTL-A02 — Agronomic Context Contract / ContextDatum
MTL-A03 — Reference Resolution
MTL-A04 — ContextManifest
MTL-A05 — Minimal RuntimeProfile
MTL-A06 — Minimal Deployment
MTL-A07 — Knowledge Retrieval
MTL-A08 — Applicability Core
MTL-A09 — Governed Transform Path (conditional)
MTL-A10 — Escalation Read Model
MTL-A11 — Agronomist Workbench Core
```

The most important principle for the next phase:

> KnowledgeRelease proves which knowledge is recognized. It still does not prove that the knowledge applies to a specific field.

Gate K proves:

```text
exact SourceArtifact
→ source-faithful compile
→ Claim + SourceContext
→ scientific qualification
→ derived/conflict governance
→ exact KnowledgeRelease
```

Gate K does **not** prove:

```text
field applicability
legal runtime existence
correct action
commercial value
yield improvement
causal effect
```

That is precisely why the next track exists.

---

# 20. Likely first meaningful standalone-product demonstration

After the Applicability track is operational, a high-value demonstration should not be “we can parse a paper.”

A stronger demonstration is:

```text
customer agronomy / protocol
        ↓
source-faithful compiled knowledge
        ↓
qualified release
        ↓
real customer field context
        ↓
applicability / information gaps
        ↓
fields partitioned into:

NO REVIEW NEEDED
WATCH
AGRONOMIST REVIEW
MISSING EVIDENCE
SCIENTIFIC CONFLICT
```

Then measure whether an agronomist can safely handle materially more acreage/fields while preserving explicit escalation.

This is where the independent product thesis becomes commercially falsifiable.

GEOX can be one excellent reference provider of context/state/forecast/outcome data for this demonstration, but the demonstration should remain possible with another customer's REST/batch/FMIS/context stack.

That is the practical meaning of “standalone product.”

---

# 21. One-sentence product definition to carry forward

If the next conversation needs one sentence before reading the full architecture, use this:

> **Agronomy Deployment Runtime is an independent, multi-tenant agronomy authority and runtime platform that turns governed scientific/agronomic knowledge into a context-specific, replayable computational world without granting the knowledge more authority than its source, qualification, transport conditions, runtime composition, or observed outcomes justify.**

And the shortest engineering rule is:

```text
Scientific authority must survive every boundary explicitly.
Nothing gains authority merely because software can compute it.
```
