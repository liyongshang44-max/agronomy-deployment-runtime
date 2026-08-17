# ADR v0.1 — MTL-D04 RuntimeAlternativeSet / Coverage Authority

Status: **IMPLEMENTATION CANDIDATE — NOT ARCHITECTURE AUTHORITY**

Task line: `MTL-D04`
Capability: `C18 RuntimeAlternativeSet`

This implementation contract follows the frozen v1.0 architecture and the Master Task Line. It does not amend architecture authority.

## 1. Purpose

D04 freezes the exact decision-material runtime-path universe that a later robustness evaluation is allowed to compare.

The problem it closes is simple:

```text
run a convenient subset
!=
prove robustness over the legal alternative universe
```

`RuntimeAlternativeSet` is therefore an immutable coverage authority object. It is not a decision, not a confidence score and not a robustness result.

Permanent separation:

```text
RuntimePlan
!= RuntimeEligibility
!= RuntimeBinding
!= RuntimeAlternativeSet
!= DecisionRobustness
```

## 2. Exact predecessors

D04 consumes the historical authority chain already frozen by earlier gates:

- exact `RuntimeEligibility`;
- its exact `RuntimePlan` identity (`planId`, `planHash`, compiler version);
- zero or more exact historical `RuntimeBinding` authorities selected from that same eligibility universe;
- exact DecisionProblem / Deployment / RuntimeProfile / ContextManifest lineage retained by RuntimeEligibility;
- exact ApplicabilityAssessment authorities used by each RuntimePlan path.

D04 does not perform a new runtime dispatch and therefore does not re-authorize execution.

Historical validation is intentionally based on frozen authority/audit lineage rather than current Deployment state. A later Deployment suspension does not rewrite what alternatives were historically covered.

## 3. D04 v1 declared coverage domain

The current RuntimePlan compiler enumerates semantic knowledge/applicability alternative paths. RuntimeEligibility adjudicates every such path as:

- `LEGAL`;
- `LEGAL_WITH_LIMITATIONS`;
- `INFORMATION_REQUIRED`;
- `NO_LEGAL_RUNTIME`.

D04 v1 therefore declares its bounded universe as:

```text
EXACT_RUNTIME_PLAN_PATHS_ADJUDICATED_BY_RUNTIME_ELIGIBILITY
```

The generation method is fixed:

```text
ADR_RUNTIME_ALTERNATIVE_ENUMERATOR@1
```

Callers cannot replace this method, pass their own candidate list, self-author exclusion reasons or provide a completeness class.

## 4. Implementation variance is not silently claimed covered

A single semantic RuntimePlan path may potentially have more than one conformant Implementation / ImplementationConformance realization.

The current RuntimePlan/RuntimeProfile contracts do not provide a governed, frozen universe of such implementation alternatives. D04 therefore does not claim that implementation variance has been exhaustively covered.

The frozen D04 v1 generation metadata states:

```text
implementation variance
= outside D04 v1 coverage domain
= requires a separate governed material dimension before it may affect coverage claims
```

D04 v1 admits at most one exact RuntimeBinding per semantic RuntimePlan path. Supplying two bindings for one path is rejected rather than silently redefining the coverage universe.

This is a nonclaim, not an equivalence assertion. D04 does **not** say all conformant implementations are numerically identical.

## 5. Included bindings

An included world is represented by an exact RuntimeBinding ref plus the exact path lineage:

- `pathId`;
- `runtimeBindingRef`;
- `knowledgeRef`;
- `applicabilityAssessmentRef`.

Every included binding must replay as historical D01 authority and must bind:

- the same exact RuntimeEligibility;
- the same RuntimePlan identity;
- the same DecisionProblem;
- the same Deployment;
- the same RuntimeProfile;
- the same ContextManifest;
- one historically `LEGAL` or `LEGAL_WITH_LIMITATIONS` path.

A binding from another eligibility universe cannot be spliced into the set.

## 6. Excluded candidates are first-class coverage evidence

Every RuntimePlan path that is not included remains explicit in `excludedCandidates`.

D04 derives exclusion class from exact RuntimeEligibility authority:

```text
historically legal path without included binding
  -> LEGAL_PATH_BINDING_NOT_INCLUDED

INFORMATION_REQUIRED
  -> INFORMATION_REQUIRED

NO_LEGAL_RUNTIME
  -> NO_LEGAL_RUNTIME
```

The original RuntimeEligibility reason codes are retained separately as `sourceReasonCodes`.

Therefore D04 cannot make a missing path disappear by omission.

## 7. Exact coverage ledger

The immutable coverage ledger contains:

- `candidatePathIds` — every exact RuntimeEligibility alternative path;
- `legalPathIds` — every path historically legal for runtime composition;
- `includedPathIds` — legal paths with an included exact RuntimeBinding;
- `uncoveredLegalPathIds` — legal paths without an included binding.

The arrays are derived, canonical and replay-checked.

Completeness follows mechanically:

```text
uncoveredLegalPathIds.length == 0
  -> EXHAUSTIVE_ENUMERATION

uncoveredLegalPathIds.length > 0
  -> INCOMPLETE
```

An empty legal universe can therefore be exhaustively accounted for while containing zero runnable worlds. This is a coverage fact only; it cannot become `ROBUST`.

## 8. Completeness vocabulary and current implementation boundary

The frozen architecture vocabulary remains:

- `EXHAUSTIVE_ENUMERATION`;
- `BOUNDED_ENVELOPE`;
- `GOVERNED_COVERAGE`;
- `INCOMPLETE`.

Current RuntimeProfile authority has no qualified coverage/sampling-method predecessor. D04 v1 therefore only materializes:

- `EXHAUSTIVE_ENUMERATION`;
- `INCOMPLETE`.

Attempts to construct `BOUNDED_ENVELOPE` or `GOVERNED_COVERAGE` fail closed with:

```text
D04_GOVERNED_COVERAGE_AUTHORITY_NOT_IMPLEMENTED
```

Those stronger coverage methods require explicit upstream authority before D04 may recognize them.

## 9. Material uncertainty/conflict dimensions

D04 does not average or erase alternative structure.

When the exact RuntimePlan contains more than one path, D04 records a deterministic `RUNTIME_PLAN_ALTERNATIVE` material dimension over those exact path IDs.

For each exact ApplicabilityAssessment conflict, D04 also records an `APPLICABILITY_CONFLICT` dimension containing:

- exact source ApplicabilityAssessment ref;
- affected path ID;
- exact conflict detail;
- deterministic dimension identity.

A copied payload that removes a material dimension may remain structurally parseable, but evidence-backed validation rebuilds the set and rejects it as a replay mismatch.

## 10. No probability laundering

D04 has no probability/confidence field.

A probability scalar cannot replace path coverage accounting. Unknown fields such as `probabilityScore` are rejected by the exact contract.

Likewise D04 cannot contain:

- `ROBUST`;
- `SENSITIVE`;
- `UNRESOLVED`;
- ACT/WAIT/ASK/ABSTAIN;
- action semantics.

Frozen nonclaim:

```text
NONE_COVERAGE_AUTHORITY_IS_NOT_DECISION_ROBUSTNESS
```

Those semantics belong to D05/D06.

## 11. Publication authority

The D04 publisher accepts only:

- `ledger`;
- `logicalId`;
- `version`;
- exact `runtimeEligibilityRef`;
- exact `includedRuntimeBindingRefs`;
- audit metadata.

It does not accept:

- completeness class;
- coverage arrays;
- excluded candidates;
- exclusion reasons;
- material dimensions;
- generation method overrides;
- probabilities;
- robustness status.

The publication actor must equal the historical runtime principal that published the exact RuntimeEligibility. The D04 audit closes over all material exact refs plus the original runtime authorization decision.

## 12. Historical replay

`validateRuntimeAlternativeSet()`:

1. verifies the stored semantic hash;
2. validates every included RuntimeBinding using D01 historical replay;
3. verifies exact RuntimeEligibility historical publication authority;
4. rebuilds included/excluded path accounting;
5. rebuilds material dimensions;
6. rebuilds completeness;
7. requires the rebuilt semantic hash to equal the frozen D04 authority ref;
8. verifies the exact D04 publication audit.

Validation mode:

```text
EXACT_FROZEN_HISTORICAL_COVERAGE_NO_LATEST_LOOKUP
```

A later Deployment suspension does not invalidate historical coverage evidence and does not authorize a new execution.

## 13. Acceptance boundary

Positive acceptance covers:

- exhaustive multi-path legal coverage;
- incomplete coverage when one legal path is omitted;
- explicit governed exclusions for non-legal paths;
- exact empty-legal-universe accounting;
- exact historical replay;
- frozen completeness vocabulary.

Fail-closed acceptance covers:

- caller-authored completeness;
- convenient subset relabeled complete;
- unsupported bounded/governed coverage methods;
- probability-score laundering;
- robustness-status laundering;
- foreign binding splicing;
- duplicate binding for one semantic path;
- copied generic ledger record pretending to be D04 authority;
- material alternative-dimension erasure;
- implementation-variance coverage laundering;
- historical replay after Deployment suspension.

## 14. D05 handoff

D04 gives D05 one exact question to answer against one frozen universe:

```text
Given this exact RuntimeAlternativeSet,
do the material actions produced by its included legal worlds remain equivalent?
```

D05 must not return `ROBUST` when D04 reports `INCOMPLETE`.

D04 itself never answers that question.
