# ADR v0.1 — MTL-R03 RuntimeEligibility

Status: **IMPLEMENTATION CONTRACT / NON-ARCHITECTURE-AUTHORITY**

Baseline: `main @ c185a92869fbc1a8dcee86c0ebd4e9b27def8d1d` (R02 closed)

## 1. Purpose

R03 independently adjudicates whether the exact RuntimePlan contains at least one legal runtime world before any RuntimeBinding or DecisionResult exists.

Frozen public states:

```text
RUNTIME_ELIGIBLE
RUNTIME_ELIGIBLE_WITH_LIMITATIONS
INFORMATION_REQUIRED
NO_LEGAL_RUNTIME
```

R03 is runtime-legality authority only. It does not output `ACT`, `WAIT`, `ASK`, `ABSTAIN`, a selected action, agronomic correctness or DecisionResult.

## 2. Exact predecessors

R03 consumes only:

```text
AuthorityLedger
exact RuntimePlan read model
optional snapshot store required by exact upstream replay
```

The supplied RuntimePlan is recompiled/replayed through the R01/R02 exact-world validation path before eligibility is evaluated.

The public evaluator rejects additional predecessor fields. In particular these cannot influence R03:

```text
acquisitionOptions
runtimeBindingRef
runtimeEligibilityRef
selectedAction
decisionResultRef
```

The publisher has an independently closed input surface as well.

This prevents current-binding circularity and decision laundering.

## 3. Path-level legality

RuntimeEligibility is evaluated per RuntimePlan alternative path, not by flattening every plan gap into one global blocker.

Path dispositions are:

```text
LEGAL
LEGAL_WITH_LIMITATIONS
INFORMATION_REQUIRED
NO_LEGAL_RUNTIME
```

Each RuntimePlan alternative must contain exactly one RESULT node whose exact authority refs include that path's ApplicabilityAssessment.

The RESULT node's exact `openRequirementRefs` determine which requirements affect that alternative.

## 4. Information vs hard blockers

R03 re-derives the exact R02 InformationPlanningResult from the same RuntimePlan.

Any RuntimePlan requirement mapped to a valid R02 InformationRequirement is information-resolvable for the current path.

This matters because Applicability can produce both:

```text
MISSING_CONTEXT
APPLICABILITY_RUNTIME_DISPOSITION = BLOCKED
```

for the same unresolved fact. The BLOCKED disposition is derivative in that world. R03 therefore classifies the path as `INFORMATION_REQUIRED`, not `NO_LEGAL_RUNTIME`.

Likewise, a calibration requirement can produce:

```text
CALIBRATION_REQUIRED
APPLICABILITY_RUNTIME_DISPOSITION = CONDITIONAL
```

The calibration requirement is the substantive blocker; the derivative CONDITIONAL disposition does not create a second independent reason.

## 5. Hard reason mapping

Current minimal R03 maps non-information plan blockers into governed reason codes:

```text
CALIBRATION_REQUIRED
  -> CALIBRATION_AUTHORITY_REQUIRED

REPLAY_REQUIREMENT
  -> REPLAY_REQUIREMENT_UNSATISFIED

UNSUPPORTED_CONSTRAINT containing governed transform prohibition
  -> PROHIBITED_TRANSFORM

other unsupported semantic constraint
  -> UNRESOLVABLE_SEMANTICS

actual KnowledgeConflict code
  -> KNOWLEDGE_CONFLICT

other source-target applicability conflict/mismatch
  -> UNRESOLVABLE_SEMANTICS

SCIENTIFIC_USE PROHIBITED
  -> KNOWLEDGE_USE_PROHIBITED

SCIENTIFIC_USE REVOKED
  -> KNOWLEDGE_REVOKED

other non-qualified scientific use
  -> UNAUTHORIZED_KNOWLEDGE

DECISION_RELEVANCE NOT_RELEVANT
  -> KNOWLEDGE_NOT_DECISION_RELEVANT

standalone unresolved runtime disposition
  -> APPLICABILITY_RUNTIME_USE_BLOCKED
     or RUNTIME_USE_CONDITIONAL_UNRESOLVED
```

The reason vocabulary also reserves `NO_COMPATIBLE_MODEL`, `NO_COMPATIBLE_POLICY` and `DEPENDENCY_CYCLE` for future exercised spec/runtime paths. R03 does not fabricate Model/Policy/Implementation authority merely to exercise those codes.

## 6. Limitations

A path with no hard blocker and no open decision-material information requirement may still carry exact structured Applicability limitations.

Those paths become:

```text
LEGAL_WITH_LIMITATIONS
```

Bounded extrapolation is explicitly represented as a limitation if the ApplicabilityAssessment did not already carry an equivalent structured limitation.

R03 does not collapse limitations into scalar confidence or score.

## 7. Existence-of-legal-world precedence

Overall RuntimeEligibility is an existence test over path dispositions:

```text
if any LEGAL path exists
  -> RUNTIME_ELIGIBLE

else if any LEGAL_WITH_LIMITATIONS path exists
  -> RUNTIME_ELIGIBLE_WITH_LIMITATIONS

else if any INFORMATION_REQUIRED path exists
  -> INFORMATION_REQUIRED

else
  -> NO_LEGAL_RUNTIME
```

This prevents a hard-blocked sibling alternative from poisoning another fully legal world.

It also prevents a path that can become legal by obtaining decision-material information from being incorrectly collapsed to `NO_LEGAL_RUNTIME` merely because another alternative is already impossible.

Path-level diagnostics are retained even when they do not determine the overall state.

## 8. Mixed-alternative proof

The acceptance suite constructs a real two-member KnowledgeRelease:

- candidate A remains directly applicable and structurally legal;
- candidate B is independently qualified but carries exact `CALIBRATION_REQUIRED` transport authority.

Both candidates share the same exact DecisionProblem, Deployment, RuntimeProfile, ContextManifest and retrieval world and receive separately validated ApplicabilityAssessments.

R03 proves:

```text
candidate A -> LEGAL
candidate B -> NO_LEGAL_RUNTIME / CALIBRATION_AUTHORITY_REQUIRED

overall -> RUNTIME_ELIGIBLE
legalRuntimeCandidateCount = 1
hardBlockedCandidateCount = 1
```

No candidate is dropped or ranked away.

## 9. InformationRequirement relation

R03 consumes the exact information-need identities generated by R02:

```text
requirementId
semanticHash
```

An acquisition option cannot influence R03 because the evaluator does not accept acquisition options as input.

Therefore:

```text
AcquisitionOption exists != evidence exists
InformationRequirement OPEN != automatically NO_LEGAL_RUNTIME
InformationRequirement SATISFIED != automatically RUNTIME_ELIGIBLE
```

R03 always re-evaluates the converged exact RuntimePlan.

## 10. Immutable RuntimeEligibility authority

R03 publishes `adr.runtime-eligibility.v1` as immutable AuthorityLedger kind:

```text
RuntimeEligibility
```

Authority class:

```text
RUNTIME_LEGALITY_AUTHORITY
```

The semantic payload freezes:

- exact plan identity (`planId + planHash + compilerVersion`);
- DecisionProblem ref;
- Deployment ref;
- RuntimeProfile ref;
- ContextManifest ref;
- KnowledgeRetrievalResult ref;
- exact ApplicabilityAssessment refs;
- overall eligibility state;
- legal/information-pending/hard-blocked candidate counts;
- decision-material InformationRequirement identities when relevant;
- structured limitations;
- governed reason codes;
- every path-level evaluation;
- explicit no-decision-authority marker.

## 11. Publication authority and audit closure

R03 does not invent a new IAM permission.

Publication is performed by the exact runtime principal already authorized for the bound Deployment and recorded in the validated KnowledgeRetrievalResult.

The immutable publication audit is fixed to:

```text
PUBLISH_RUNTIME_ELIGIBILITY
```

and closes over exact refs for:

```text
DecisionProblem
Deployment
RuntimeProfile
ContextManifest
KnowledgeRetrievalResult
all ApplicabilityAssessments
exact runtime authorization decision audit
```

Caller-supplied audit input refs cannot redefine the authority set.

Validation reproduces the semantic hash, exact RuntimePlan identity, current upstream legality result and publication audit/principal closure.

Historical replay across later lifecycle drift is **not claimed by this R03 slice**. The current validator checks current exact authority. A later historical-runtime replay contract must be explicit rather than implied.

## 12. Nonclaims

R03 explicitly freezes:

```text
RUNTIME_ELIGIBLE != agronomically correct
RUNTIME_ELIGIBLE != ACT
RUNTIME_ELIGIBLE != RuntimeBinding
RUNTIME_ELIGIBLE_WITH_LIMITATIONS != confidence score
INFORMATION_REQUIRED != ASK DecisionResult
NO_LEGAL_RUNTIME != agronomic failure
RuntimeEligibility != DecisionResult
```

`decisionAuthorityClaim` is exactly:

```text
NONE_RUNTIME_ELIGIBILITY_IS_NOT_DECISION
```

## 13. Acceptance history

`test:runtime-eligibility` is wired into root `npm test` from the first substantive R03 implementation run.

First exact root-wired R03 head `4260370dec0ee3254991bf24116094efa500a15b`, run `31948249068`: **GREEN**.

Exact counts:

```text
positive:   7 / 7
integrity: 12 / 12
total:     19 / 19
```

All prior F/K/A/Gate-A/P01-P04/R01/R02 regressions passed in the same root run.

Independent review identified one proof-strength gap: the original multi-alternative acceptance covered two legal paths but not a mixed legal/hard-blocked world.

Final hardening added an exact two-candidate mixed world with one direct legal candidate and one real calibration-blocked candidate.

Hardened head `aab1bb444e30f4eea0eff99533105fef1d350c67`, root run `31948407709`: **GREEN**.

Current R03 suite after hardening:

```text
positive:   8 / 8
integrity: 12 / 12
total:     20 / 20
```

R03 is CLOSED only after final documentation head, exact feature-head full root CI, Draft merge-ref CI, independent authority review, Ready-state candidate revalidation, expected-head merge, actual-main verification and exact-main full root CI are GREEN.
