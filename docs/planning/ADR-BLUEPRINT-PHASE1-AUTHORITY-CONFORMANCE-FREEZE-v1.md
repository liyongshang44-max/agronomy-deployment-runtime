# ADR Blueprint Phase 1 — Authority Conformance Freeze v1

Status: **BLUEPRINT PROGRAM CONFORMANCE FREEZE / DERIVED FROM EXISTING AUTHORITY**

This document freezes the GEOX Product Blueprint interpretation of ADR's already-accepted authority model for post-P5 program execution.

It is **not** a new architecture authority, does not amend Architecture v1.0, does not create a DEC, and does not create or modify any public authority object. If any statement here conflicts with the frozen architecture or an accepted DEC, the authoritative architecture/DEC wins.

Exact baseline for this adjudication:

```text
ADR main = 915394c3b53562751ac743aa1e6fe7dc4ef9a944
Blueprint program planning merge = 36cbb8341d258dcd29babde7795d989718545fa3
Historical-basis sufficiency proof merge = 915394c3b53562751ac743aa1e6fe7dc4ef9a944
```

## 1. Phase-1 adjudication result

The Blueprint does not expose a missing generic ADR authority class at this frontier.

The six Blueprint authority responsibilities map to existing frozen Architecture v1.0 objects and accepted DEC-defined bindings.

Therefore:

```text
NEW GENERIC AUTHORITY OBJECT = NOT JUSTIFIED
NEW DEC                      = NOT JUSTIFIED
DEC-0034                     = NOT REOPENED
ARCHITECTURE REDESIGN        = NOT REQUIRED
```

ADR-1 is therefore a conformance freeze over existing authority, not a new architecture design exercise.

## 2. Normative authority sources

This conformance map derives from, and does not supersede:

```text
docs/architecture/ADR-ARCHITECTURE-v1.0-FINAL-ADJUDICATION.md
docs/architecture/ADR-AGRONOMIC-CONTEXT-AND-PUBLIC-RUNTIME-CONTRACT-v1.0.md
docs/architecture/ADR-COMPLETE-COMPONENT-ARCHITECTURE-v1.0.md
docs/architecture/ADR-STANDALONE-PRODUCT-ARCHITECTURE-v1.0.md
docs/architecture/ADR-REPO-CONSTITUTION-v1.0.md

accepted DEC authority, including DEC-0031, DEC-0032 and DEC-0033

implemented K/A/R/S/D authority contracts and their historical validators
```

Architecture v1.0 Final Adjudication remains `FROZEN / NORMATIVE` and owns the canonical plane/object split.

## 3. Blueprint authority responsibility map

### 3.1 Knowledge Authority

Blueprint question:

```text
Which exact knowledge/source version was legally available and used?
```

Existing ADR authority answers through the Knowledge Control Plane:

```text
Source
SourceArtifact
Claim + SourceContext
QualifiedKnowledge
DerivedKnowledge + DerivedKnowledgeContext
KnowledgeRelease
```

Material rules:

- source logical identity is not source bytes;
- compilation binds exact SourceArtifact content;
- scientific qualification is independent from retrieval;
- KnowledgeRetrievalResult has retrieval provenance but no scientific authority;
- historical execution must retain exact knowledge/release refs, not latest lineage selection.

Blueprint ownership result:

```text
Knowledge Authority = ADR / ALREADY OWNED
```

### 3.2 Science / Rule Authority

Blueprint question:

```text
Which scientific assertion, transformation, model or policy semantics governed the decision,
and which executable implementation was qualified to realize that semantic specification?
```

Existing ADR authority answers through:

```text
QualifiedKnowledge / DerivedKnowledge
QualifiedTransformation
Model
Policy
Specification
Implementation
ImplementationConformance
CalibrationArtifact when material
```

Permanent separation:

```text
Specification != Implementation != ImplementationConformance
```

Registration of an executable does not establish semantic conformance.

Blueprint ownership result:

```text
Science / Rule Authority = ADR / ALREADY OWNED
```

### 3.3 Applicability Authority

Blueprint question:

```text
Why is this exact knowledge scientifically usable for this exact target/context/use?
```

Existing ADR authority answers through:

```text
KnowledgeRelease
→ KnowledgeRetrievalResult
→ ApplicabilityAssessment
→ RuntimeCandidates / RuntimePlan
```

`ApplicabilityAssessment` is the authority boundary for source-to-target transport/applicability. Historical validation replays the exact retrieval authority, DecisionProblem, ContextManifest/snapshots, exact QualifiedKnowledge or DerivedKnowledge origin authority, and recomputes the assessment.

Retrieval is not applicability. Similarity is not applicability. Runtime eligibility is not applicability.

Blueprint ownership result:

```text
Applicability Authority = ADR / ALREADY OWNED
```

### 3.4 Target-Scope & Context-Binding Authority

Blueprint questions:

```text
What target did this decision concern?
What context was admitted?
What evidence world was frozen?
Who selected decision intent versus source-backed target facts?
```

Existing ADR authority answers through:

```text
DecisionProblem
ContextDatum
ContextManifest
ResolvedContextDatumReceipt where applicable
```

and the accepted source-specific bindings in DEC-0031 / DEC-0032 / DEC-0033.

DEC-0031 freezes governed assembly into a standard ContextDatum without creating a competing public ContextDatum type.

DEC-0032 freezes independent ownership of:

```text
source-backed FARM component -> source-backed target authority
deployment organization/tenant -> authorized A01 creator
decision intent -> authorized A01 creator
```

It does not authorize callers to invent or infer FIELD / SEASON / ZONE / geometry.

DEC-0033 freezes ContextManifest convergence and makes `evidenceCutoff` an explicit manifest-publisher boundary. `evidenceCutoff` is not scientific source evidence and is not derived from host time, latest provider time, planting date, logicalTime or source acquisition time.

Permanent identity separation for Blueprint integration:

```text
Provider Native Subject Identity
!= ADR Target-Scope / Context-Binding Authority
!= GEOX Field Subject Identity
```

A correspondence relation between namespaces does not collapse them into one identity authority.

Blueprint ownership result:

```text
Target-Scope & Context-Binding Authority = ADR / ALREADY OWNED
Subject Identity Authority                = NOT ADR
```

### 3.5 Runtime / Decision Evaluation Authority

Blueprint questions:

```text
Which runtime world was legal?
Which exact runtime/evaluator implementation was used?
What alternative universe was evaluated?
What decision was produced?
```

Existing ADR authority answers through:

```text
RuntimeProfile
Deployment
DecisionProblem
ContextManifest
KnowledgeRetrievalResult
ApplicabilityAssessment
RuntimePlan
InformationRequirement
RuntimeEligibility
RuntimeBinding
RuntimeAlternativeSet
RuntimeResult / RuntimeDatum where applicable
DecisionRobustness
DecisionResult when decision authority mode permits
```

Material separations:

```text
RuntimePlan != RuntimeAlternativeSet != RuntimeBinding
RuntimeEligibility != DecisionDisposition != DecisionResult
DecisionResult != human approval
DecisionResult != dispatch
DecisionResult != machine execution
```

For `decision_authority_mode = RUNTIME_ONLY`, ADR must stop at runtime legality/results and must not fabricate DecisionResult authority.

Blueprint ownership result:

```text
Runtime / Decision Evaluation Authority = ADR / ALREADY OWNED
```

Post-outcome effect evaluation remains the separate Evaluation Plane and must not be conflated with decision-time runtime evaluation.

### 3.6 Decision-Basis Attribution / Provenance Authority

Blueprint question:

```text
Can a historical decision be traced to the immutable authorities and evidence world that actually governed it?
```

Existing authority is distributed intentionally across exact AuthorityRefs, immutable semantic hashes, publication audit closure and historical validators. `DecisionResult` is the decision authority root when decision authority exists; it is not a container that duplicates every predecessor payload.

The accepted Phase-1 historical reconstruction proof demonstrates that one exact historical `DecisionResult` ref plus governed immutable ledger/snapshot stores can reconstruct the material basis through the existing graph, including:

```text
D06 DecisionResult
→ D05 DecisionRobustness
→ D04 RuntimeAlternativeSet
→ D01 RuntimeBinding
→ R03 RuntimeEligibility + exact RuntimePlan reconstruction
→ historical Deployment / RuntimeProfile
→ A08 ApplicabilityAssessment
→ KnowledgeRetrievalResult
→ ContextManifest / evidenceCutoff / exact snapshots
→ QualifiedKnowledge or DerivedKnowledge scientific authority
→ historical Specification / Implementation / ImplementationConformance
→ publication audit closure
```

The proof also establishes that valid later ContextDatum evidence with `availableAt` after the historical evidence cutoff, plus later-version anti-latest tripwires, does not rewrite the reconstructed historical basis.

The reconstruction digest used by that acceptance is reproducibility evidence only and is not a new AuthorityRef.

Blueprint ownership result:

```text
Decision-Basis Attribution / Provenance Authority = ADR / ALREADY OWNED
Causal Effect Attribution Authority                = SEPARATE EVALUATION AUTHORITY
```

Permanent invariant:

```text
Outcome != CausalEffect
```

## 4. Explicit non-ownership map

The Blueprint program must not expand ADR across these boundaries:

```text
Field-State Authority
  -> MCFT / qualified field-state authority

Provider / enterprise Subject Identity Authority
  -> Identity domain / source-native identity authority

GEOX Field Subject Identity Authority
  -> GEOX identity domain

Human Approval Authority
  -> B-Line

Dispatch / Machine Execution Authority
  -> B-Line

Execution Receipt Authority
  -> execution domain / B-Line governed execution path

Enterprise Asset Qualification
  -> Asset Core
```

ADR may consume exact external authority refs required for its own scope. Consumption does not transfer ownership.

## 5. Cross-domain composition rule

The Blueprint integration must preserve exact-world composition.

A valid ADR authority from one target world cannot be composed with a valid identity/correspondence/state authority from another target world merely because both are individually real or qualified.

Required rule:

```text
same intended governed subject / target world
+ explicit qualified correspondence where namespaces differ
+ exact immutable authority refs
= composable candidate
```

Not sufficient:

```text
string equality
fixture coincidence
crop/domain similarity
same provider name
same farm nickname
geometry resemblance
latest-version selection
```

## 6. Historical reproducibility conclusion from PR #202

At `main @ 915394c3b53562751ac743aa1e6fe7dc4ef9a944`, the first Blueprint Phase-1 existing-graph sufficiency acceptance has established:

```text
input:
  exact historical DecisionResult ref
  governed immutable ledger/snapshot stores

operator-supplied predecessor refs:
  0

latest lookup required:
  false

valid later evidence rewrite:
  false

new generic authority object required:
  false
```

This is evidence that ADR-2's remaining gap is product-level discoverability/consumption of an already-sufficient authority graph, not a missing historical authority class.

## 7. ADR-1 closure criteria

ADR-1 is considered Blueprint-conformance closed when this mapping is qualified and merged without changing underlying authority semantics, and no contradictory accepted architecture/DEC authority is found.

Closure means:

```text
Blueprint responsibility ownership is unambiguous
existing authority objects answer the required authority questions
non-ownership boundaries remain explicit
historical basis composition is proven sufficient
new DEC burden is not met
```

Closure does **not** mean:

```text
ADR-2 product API complete
ADR-3 cutover authorized
GEOX scientific decision authority migrated
Asset Core seam implemented
production authority granted
```

## 8. Next frontier after ADR-1 closure

The next Blueprint task remains ADR-2, but the problem is narrowed to a product interface:

```text
Given an exact historical DecisionResult ref,
expose a deterministic read-only reconstruction of the already-governed historical basis
without creating a new authority object or widening decision/approval/execution authority.
```

Any such API/read model must preserve:

- exact-ref replay only;
- no latest selection;
- immutable evidence-cutoff semantics;
- canonical deterministic output;
- explicit distinction between authority refs and derived read-model digest;
- zero approval/dispatch/execution authority;
- zero causal-attribution claim.

That interface requires its own implementation qualification. It is not authorized merely by this conformance map.
