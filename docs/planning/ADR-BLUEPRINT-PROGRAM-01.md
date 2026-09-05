# ADR Blueprint Program 01 — Authority Model, Historical Reproducibility, Decision Migration, Cross-Domain Consumption, Production Graduation

Status: **BLUEPRINT-ALIGNED PLANNING DERIVATION / NON-ARCHITECTURE-AUTHORITY**

Planning baseline:

```text
ADR repository = liyongshang44-max/agronomy-deployment-runtime
ADR main       = f4d10233a24ccaea3ae8712e6456e87d691afe3c
```

External integration substrate observed before this planning cutover:

```text
GEOX repository = liyongshang44-max/GEOX
GEOX P5 merge   = f41dde8d44de95e71748e756e048e0166c1916b7
```

The GEOX reference above is external implementation evidence only. It is not ADR architecture authority and does not alter ADR semantics.

---

## 0. Authority precedence and purpose

This document changes **implementation-program sequencing**, not Architecture v1.0.

It is subordinate to the existing normative authority set, including:

- Repository Constitution v1.0;
- Domain Model v1.0;
- Complete Component Architecture v1.0;
- Agronomic Context & Public Runtime Contract v1.0;
- Standalone Product Architecture v1.0;
- DEC-0001 and later accepted DEC records;
- Architecture v1.0 Final Adjudication;
- merged authority contracts and executable acceptance evidence on current `main`.

If this planning document conflicts with any accepted architecture or contract, the accepted architecture or contract wins.

The existing Capability Map, Master Task Line, Version Slicing and implementation contracts remain valid decomposition/history. This program does not delete or retroactively rewrite them. It changes the **primary post-integration frontier** from local implementation growth to Blueprint-driven authority closure.

The program starts from one strategic conclusion:

```text
P1–P5 governed GEOX integration substrate
        = sufficient to stop growing runtime seams by default

next primary question
        != what runtime wire can be added next?

next primary question
        = what authority must ADR prove for the GEOX Product Blueprint?
```

No `P6 = more runtime wiring` task is implied by this document.

---

## 1. ADR responsibility boundary under the Product Blueprint

ADR is responsible for proving and preserving the authority chain needed to answer:

```text
Which governed knowledge/rule version was used?
Why was it applicable to this exact target/context world?
What target and decision scope was actually bound?
What evidence was available at decision time?
Which runtime/specification/implementation world was used?
What result was produced?
Which immutable authorities reproduce that result and its basis?
```

The Blueprint-level ADR responsibility set is therefore:

```text
Knowledge Authority
Science / Rule Authority
Applicability Authority
Target-Scope & Context-Binding Authority
Runtime / Evaluation Authority
Decision-Basis Attribution / Provenance Authority
```

For this program, **Decision-Basis Attribution / Provenance** means provenance of the decision basis and authority graph. It does **not** mean causal attribution of later field outcomes.

Permanent distinction:

```text
Decision-basis provenance != EffectAttributionAssessment
DecisionResult              != Outcome
Outcome                     != CausalEffect
```

ADR explicitly does **not** own the following Blueprint authorities:

```text
Field-State Authority              -> MCFT / state authority domain
Subject Identity Authority         -> Identity domain
Human Approval Authority           -> B-Line
Execution / Dispatch Authority      -> B-Line
Enterprise Asset Qualification     -> Asset Core
```

ADR may consume governed references from those domains where a later integration contract permits it. Consumption does not transfer ownership.

---

## 2. Permanent identity boundary

The Blueprint program freezes three identities as distinct unless an external governed correspondence authority explicitly relates them:

```text
Provider Native Subject Identity
        !=
ADR Target-Scope / Context-Binding Authority
        !=
GEOX Field Subject Identity
```

Examples of forbidden inference:

```text
provider plot code == ADR FARM target           // forbidden by naming similarity alone
ADR FARM target   == GEOX FIELD                 // forbidden by object-kind similarity alone
routing field id  == scientific subject identity // forbidden by data routing alone
geometry overlap  == subject equality            // forbidden without governed identity authority
```

ADR may preserve provider-native identifiers as provenance and may bind an ADR `DecisionProblem.targetRef` / `ContextManifest` world. It must not mint GEOX Field identity authority.

A later Asset Core chain may combine:

```text
Subject Binding Ref
MCFT Qualified State Ref
ADR Qualified Decision Ref
B-Line Approval / Execution Ref
...
```

but that composition does not authorize ADR to collapse the participating identities.

---

## 3. Existing authority substrate mapped to Blueprint responsibilities

This is a planning map, not a new authority taxonomy.

| Blueprint responsibility | Existing authority substrate on ADR main | Current Blueprint assessment | Phase-1 implication |
| --- | --- | --- | --- |
| Knowledge Authority | Source / SourceArtifact; K03 source-faithful authority; K04 ScientificQualificationDecision / QualifiedKnowledge; K05 DerivedKnowledge; K06 KnowledgeRelease | **ADVANCED** | Map exact version/release lineage used by one historical decision; do not invent a second knowledge bundle. |
| Science / Rule Authority | K04 scientific qualification conditions; QualifiedKnowledge limitations; Specification authority; Policy; Implementation; ImplementationConformance; runtime policy evidence where material | **ADVANCED, DECISION-BASIS CLOSURE NOT YET PROVEN AS ONE PRODUCT VIEW** | Reconstruction must identify the exact scientific/rule/specification authority actually material to the decision, including explicit empty binding sets where the runtime used none. |
| Applicability Authority | A07 KnowledgeRetrievalResult; A08 immutable ApplicabilityAssessment; A09/S01 paths where governed transform is material | **ADVANCED** | Historical reconstruction must preserve exact source→target transport basis and must not recompute against current/latest context or qualification authority. |
| Target-Scope & Context-Binding Authority | A01 DecisionProblem; A02 ContextDatum; A03 resolved-reference receipts; A04 ContextManifest; DEC-0030/0031/0032/0033 amendments | **ADVANCED** | Freeze exact targetRef, logicalTime, evidenceCutoff, context membership, availability chronology and replay class; preserve identity non-equivalence. |
| Runtime / Evaluation Authority | R01 RuntimePlan; R02 InformationRequirement; R03 RuntimeEligibility; D01 RuntimeBinding; D02 broker; D03 RuntimeDatum/RuntimeResult; D04 RuntimeAlternativeSet; D05 DecisionRobustness; D06 DecisionResult | **ADVANCED, HISTORICAL END-TO-END PRODUCT CLOSURE NOT YET PROVEN** | Start from one exact DecisionResult ref and prove that the historical runtime world can be reconstructed without current/latest lookups or operator-supplied predecessor selection. |
| Decision-Basis Attribution / Provenance | canonical exact refs and semantic hashes; authority ledger audits; A04 historical binding; D01 replay authority; D05 evaluation evidence; D06 replay reconstruction | **PARTIAL / PHASE-1 PRIMARY GAP** | Determine whether the existing ref graph already forms a complete historical decision basis. If yes, expose/qualify the composition without creating new authority. If no, identify the one irreducible missing authority before any DEC proposal. |

Important existing semantics that this program reuses rather than replaces:

```text
K06: KnowledgeRelease freezes exact knowledge members; no latest-wins.
A04: ContextManifest freezes DecisionProblem, targetRef, logicalTime,
     evidenceCutoff, exact datum/receipt membership and replay class.
A08: ApplicabilityAssessment binds exact retrieval/knowledge/origin context/
     ContextManifest/DecisionProblem authority.
D01: RuntimeBinding is RUNTIME_COMPOSITION_REPLAY_AUTHORITY and historical
     validation deliberately avoids current/latest R03 validation.
D06: DecisionResult validation reconstructs from frozen DecisionRobustness
     + decidedAt and replays D04/R03/Policy/InformationRequirement/
     RuntimeBinding authority.
```

Therefore Phase 1 begins with a **sufficiency proof**, not a schema proposal.

---

# ADR-1 — Authority Model Freeze

## Objective

Freeze the Blueprint-facing interpretation of the already accepted ADR object graph: which authoritative object answers which question, where its authority begins, and where it permanently stops.

ADR-1 is primarily an adjudication/composition task. It must not create a new generic object merely because existing authority is distributed across multiple objects.

## Required Blueprint chain

The program-level chain is:

```text
Governed Knowledge / Scientific Rule
        ↓
Applicability Determination
        ↓
Target-Scope + Context Binding
        ↓
Runtime Composition / Evaluation Binding
        ↓
Decision / Evaluation Result
        ↓
Decision-Basis Provenance
```

This chain is a planning view over existing authority; it does not collapse the underlying types.

Permanent non-collapse rules include:

```text
KnowledgeRelease       != ApplicabilityAssessment
ContextManifest         != Field-State Authority
RuntimeEligibility      != DecisionResult
RuntimeBinding          != scientific correctness
DecisionResult          != Human Approval
DecisionResult          != Machine Execution
Provider subject        != ADR target
ADR target              != GEOX Field
Decision provenance     != causal effect attribution
```

## ADR-1 deliverable

A Blueprint Authority Matrix must be frozen against exact current contracts and must answer, for every material authority class:

```text
owner
semantic identity
immutable/ref identity
publication authority
historical validation rule
current/latest dependence, if any
replay class
explicit nonclaims
cross-domain inputs
cross-domain outputs
```

The matrix must distinguish at least:

```text
Knowledge identity/version
Scientific qualification/rule identity
Applicability identity
DecisionProblem target/scope identity
ContextManifest/evidence-cutoff identity
Runtime plan/binding identity
Implementation/conformance identity when material
DecisionResult identity
Decision-basis provenance
```

## ADR-1 exit gate

ADR-1 closes only when:

1. every Blueprint responsibility is mapped to accepted authority objects or explicitly marked as an evidenced gap;
2. Provider Native Subject / ADR Target / GEOX Field identities remain distinct;
3. Field-State, Subject Identity, Approval, Execution and Asset Qualification remain outside ADR ownership;
4. no existing authority object is silently broadened by planning prose;
5. no new DEC is introduced unless ADR-2 produces an irreducible authority gap.

---

# ADR-2 — Historical Decision Reproducibility

## Objective

Given one exact historical `DecisionResult` reference, reconstruct the authority world that was actually available and used at decision time.

The target is not:

```text
"run today's system and get a similar answer"
```

The target is:

```text
historical DecisionResult exact ref
        ↓
exact historical decision basis
        ↓
truthful replay / basis-reconstruction classification
        ↓
reproduced DecisionResult semantics and provenance
```

## Required reconstruction

Starting input must be limited to:

```text
exact DecisionResult ref
+ governed immutable authority ledger / content-addressed stores already
  required by the accepted contracts
```

The operator must not have to manually supply the predecessor refs that make the answer work.

The reconstruction must recover, when material to that historical decision:

```text
decidedAt
DecisionProblem + decisionAuthorityMode
ADR targetRef / scope / logicalTime / decision deadline
ContextManifest + evidenceCutoff
exact ContextDatum / resolved receipt membership
context replay class
exact KnowledgeRelease
exact selected QualifiedKnowledge / DerivedKnowledge
exact scientific qualification and origin-context authority
exact KnowledgeRetrievalResult
exact ApplicabilityAssessment and transport basis
exact RuntimePlan/compiler identity
exact RuntimeEligibility
exact RuntimeBinding + selected alternative
exact Specification / Policy / Implementation / ImplementationConformance refs
  when material
exact explicit empty binding classes when none were used
exact RuntimeAlternativeSet
exact DecisionRobustness
exact Policy-result references / fallback / humanGate where material
DecisionDisposition
structured action / ASK / WAIT / ABSTAIN semantics
publication audit closure
```

A proof may compute a canonical **non-authoritative reconstruction digest** over the recovered exact refs and semantics for comparison/evidence. The existence of such a digest does not itself create a new ADR authority object.

## No-lookahead rule

Historical reconstruction must prove:

```text
no current/latest knowledge lookup
no current/latest ContextDatum redirect
no current/latest applicability recomputation
no current/latest RuntimeEligibility rewrite
no later evidence with availableAt > historical evidenceCutoff
no later scientific qualification/lifecycle event rewriting old basis
no later Deployment/RuntimeProfile/Policy/Implementation version replacing
  an exact historical ref
```

A later same-logical-id version must be deliberately introduced in acceptance and must not change the historical reconstruction.

## Replay truthfulness

ADR-2 does not require every external/provider world to become `EXACT` artificially.

The rule is:

```text
EXACT where accepted ReplayClass authority supports exact replay;
otherwise reconstruct the exact immutable basis that ADR retained and report
truthfully the weakest governed replay class / unresolved external dependency.
```

`PROVIDER_DEPENDENT` or `NON_REPLAYABLE` must never be promoted to `EXACT` by copying labels or retaining only hashes without the required authority bytes/receipts.

## Positive and negative proof

The first executable ADR-2 qualification should reuse an already accepted real decision world rather than add new agronomic science merely for testing. Preferred candidates are the existing real planting or same-target KBS decision chains.

The qualification must prove at least:

- exact historical positive reconstruction from one DecisionResult ref;
- reconstructed result equals the frozen DecisionResult semantics;
- evidence cutoff excludes later-arriving decision-material context;
- newer same-lineage Knowledge/Context/Deployment/Policy versions do not rewrite history;
- forged cross-world individually-valid refs are rejected;
- forged target/context membership is rejected;
- forged ACT/ASK/WAIT/ABSTAIN that does not reproduce from upstream authority is rejected;
- Provider Native Subject / ADR Target / GEOX Field equality is never inferred;
- approval and execution authority remain absent.

## Sufficiency adjudication before architecture work

ADR-2 must produce one of two engineering conclusions:

### Existing graph sufficient

If the exact DecisionResult reference and accepted immutable stores deterministically close the full historical basis, Phase 1 should implement only the minimum read/reconstruction/verification surface needed to expose that fact.

No new DEC is justified merely to give the composition a prettier name.

### Irreducible authority gap proven

If reconstruction requires a decision-material fact that is not recoverable from any accepted exact ref/audit/snapshot relation, the failure must be recorded precisely:

```text
missing authority question
existing objects inspected
why no accepted object owns the fact
real decision worlds affected
why a read model/projection cannot solve it
```

Only then may a new generic authority contract / DEC be considered.

One synthetic test inconvenience is not enough. DEC burden remains high and DEC-0034 is not reopened by this planning document.

## ADR-2 exit gate

ADR-2 closes when one historical DecisionResult can be reproduced or truthfully basis-reconstructed from its exact ref with no latest lookup and with an independently verifiable provenance closure.

At that point ADR can answer the enterprise question:

> What exactly did ADR know, bind, execute/evaluate and conclude at this historical decision point?

without asking a downstream system to redo scientific or applicability adjudication.

---

# ADR-3 — Real ADR Decision Authority + Shadow Migration

## Objective

Move agronomic scientific decision authority out of GEOX-owned legacy decision logic only after ADR-1/ADR-2 prove the authority model and historical basis.

Target product flow:

```text
MCFT Qualified State
        ↓ governed context ingestion / binding
ADR ContextManifest + Applicability
        ↓
ADR Runtime / Policy
        ↓
ADR DecisionResult
        ↓
GEOX Recommendation projection / orchestration / commercial representation
        ↓
B-Line Approval / Execution
```

GEOX Recommendation may remain a product object. It must not duplicate or silently override ADR scientific authority after cutover.

## Migration method

ADR-3 starts with an explicit inventory of decision-material scientific logic still resident in GEOX, including `decision_engine_v1.ts` or its current successor surfaces.

Cutover is prohibited initially.

The required migration mode is:

```text
legacy GEOX decision
        vs
ADR authoritative candidate decision

same governed input world where legally comparable
        ↓
shadow dual-run
        ↓
comparison + attribution
        ↓
divergence classification
```

Divergence must distinguish at least:

```text
same material action
material parameter/timing difference
applicability difference
context/evidence-cutoff difference
knowledge/rule-version difference
runtime/spec/implementation difference
authority-mode difference
identity/correspondence not established
legacy behavior with no defensible authority basis
ADR abstention/information-required where legacy acted
```

A mismatch is evidence. It must not be auto-repaired by translating one action into another or choosing whichever system is operationally convenient.

## ADR-3 exit gate

ADR-3 closes only after:

- real same-domain shadow coverage is sufficient to evaluate authority migration;
- divergences have decision-basis provenance rather than opaque output diffs;
- ADR DecisionResult authority is shown to cover the intended decision class;
- GEOX projection does not mint scientific, approval or execution authority;
- authority cutover is a separately accepted decision from runtime availability.

---

# ADR-4 — Qualified Cross-Domain Consumption / Asset Core Seam

## Objective

Make an ADR result independently verifiable as a qualified authority leg in a larger enterprise asset graph.

The downstream consumer should be able to verify:

```text
this exact ADR DecisionResult exists
this exact decision basis is internally authority-closed
this exact historical basis/replay classification is truthful
this exact target/context scope is what ADR bound
this exact result does not claim approval/execution/field-state/identity authority
```

The downstream consumer should **not** need to re-decide:

```text
whether the source knowledge was scientifically qualified
whether the source→target applicability assessment was valid
which runtime/policy world ADR actually used
whether the historical DecisionResult reproduces from ADR authority
```

Those are ADR responsibilities.

## Cross-domain composition boundary

A future Asset Core composition may reference, for example:

```text
Subject Binding Ref                // external identity authority
MCFT Qualified State Ref           // field-state authority
ADR Qualified Decision Ref         // ADR decision/basis authority
B-Line Approval / Execution Ref    // approval/execution authority
Insurance Authority Ref            // external domain
...
```

ADR-4 does not design the entire Asset Core object model. It proves that the ADR leg is independently qualified and safely composable.

No equality may be inferred merely because two domain refs describe the same commercial field. The Subject Binding authority remains external.

## ADR-4 exit gate

ADR-4 closes when an external consumer can validate the ADR authority leg from exact refs/digests/contracts without importing ADR's mutable internal runtime state and without re-adjudicating science/applicability.

The likely first enterprise target is the ADR leg of a future:

```text
Qualified Insured Field Outcome Chain
```

but this planning document creates no insurance or Asset Core authority.

---

# ADR-5 — Production Graduation

## Objective

Graduate runtime availability and decision authority in explicit, separately governed steps.

The production ladder is:

```text
explicit one-shot read-only observation
        ↓
repeatable governed observation
        ↓
shadow production consumer
        ↓
continuous read-only shadow
        ↓
authoritative decision production
```

The first rung is supported by the completed GEOX P5 integration substrate, but that external runtime seam does not authorize the later rungs.

Forbidden shortcut:

```text
one-shot observer
→ add cron/scheduler
→ call it production authority
```

Two independent graduations must remain visible:

```text
Runtime Availability Graduation
        !=
Decision Authority Graduation
```

A process can be continuously available while remaining read-only/non-authoritative. Conversely, an accepted ADR decision contract does not authorize installation into production.

## ADR-5 exit gate

Before authoritative production decision service is allowed, ADR-1 through ADR-4 must be closed for the intended decision class and production-specific evidence must separately establish:

- governed credentials/endpoints and principal ownership;
- runtime identity/version and deployment authority;
- replay/audit retention;
- fail-closed behavior under missing authority;
- operational isolation from MCFT and B-Line principals;
- no accidental approval/dispatch/execution authority;
- rollback/suspension semantics;
- monitoring that does not alter scientific authority.

Production graduation remains a later phase. This document does not authorize production activation.

---

## 4. Immediate frontier — Blueprint Phase 1

The current primary frontier is exactly:

```text
ADR BLUEPRINT PHASE 1
= ADR-1 Authority Model Freeze
+ ADR-2 Historical Decision Reproducibility
```

It is **not** ADR-3 cutover and it is **not** ADR-5 production activation.

Immediate execution sequence:

```text
1. Freeze Blueprint Authority Matrix against current accepted contracts.
2. Select one already-accepted real DecisionResult world.
3. Attempt DecisionResult-ref-only historical basis reconstruction.
4. Introduce controlled later-version drift and no-lookahead negatives.
5. Adjudicate whether the existing exact-ref graph is authority-complete.
6. If complete: expose/qualify the composition with no new DEC.
7. If incomplete: freeze the exact missing authority question before any DEC.
```

The first implementation/research PR after this planning baseline should therefore be a **Historical Decision Basis Reconstruction acceptance**, not another GEOX runtime seam.

---

## 5. Program anti-regression rules

The following rules remain mandatory across ADR-1 through ADR-5:

```text
canonical equality, not JSON insertion-order equality
exact refs, not logical-id latest redirects
no lookahead beyond evidenceCutoff
recommendation != historical operation
decision != approval
decision != execution
outcome != causal effect
correspondence != equality
FARM != FIELD
provider subject != ADR target != GEOX field
stored bytes preserve evidence; they do not create source authority
replay storage preserves authority evidence; it does not mint authority
package/installability proof != scientific authority
runtime availability != decision authority
qualified bundle != public/commercial release
```

Any new commit supersedes prior exact-head qualification evidence for that candidate.

---

## 6. Program state at creation

At the creation baseline:

```text
ADR INFRASTRUCTURE / GOVERNED INTEGRATION      = ADVANCED
ADR BLUEPRINT AUTHORITY MODEL                  = NOT YET FROZEN AS PROGRAM VIEW
ADR HISTORICAL DECISION REPRODUCIBILITY        = PARTIAL / DISTRIBUTED
ADR REAL DECISION AUTHORITY MIGRATION          = NOT YET CUT OVER
ADR ASSET-CORE QUALIFIED AUTHORITY LEG          = NOT IMPLEMENTED
ADR PRODUCTION DECISION AUTHORITY               = NOT AUTHORIZED
```

The expected first improvement is not another runtime integration feature. It is a stronger answer to:

```text
Given this exact historical ADR decision,
show the exact knowledge, applicability, target/context, evidence cutoff,
runtime/rule world and provenance that made it this decision —
without using today's latest state.
```

That is the governing Phase-1 product test.
