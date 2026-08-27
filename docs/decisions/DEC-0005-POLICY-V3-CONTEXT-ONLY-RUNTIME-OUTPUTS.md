# DEC-0005 — Policy v3: Context-Only Decision Logic with Explicit Optional Runtime Outputs

Status: **ACCEPTED**

Date: 2026-08-27

## Context

S01 established governed Policy specification authority. The accepted versions are adr.policy.v1 and adr.policy.v2.

Policy v2 adds governed material-action semantics while retaining the S01 requirement that requiredRuntimeOutputs be a non-empty list.

That requirement fits the execution-oriented Policy cases used to close the Model -> RuntimeResult -> Policy path, but the real-source KBS agronomic prohibition benchmark exposed valid Policy shapes that require only current ContextDatum/configuration semantics.

Examples include a Treatment 8nt context in which TILL remains an otherwise representable action while an agronomic constraint may prohibit it, and Treatment 7 context plus micro-plot identity used to evaluate an explicit exception.

The relevant current facts can be represented by ContextManifest members. The source does not establish a Model/Transformation output merely to make those Policies executable.

Relabeling ContextDatum/configuration semantics as RuntimeDatum outputs to satisfy Policy v2 would violate the existing ADR invariant: ContextDatum != RuntimeDatum.

The D02 RuntimeExecutionBroker already supports context-only Policy execution when a Policy has zero required runtime-output ports. The blocker is therefore the Policy specification contract, not the execution protocol.

D05 DecisionRobustness also currently recognizes Policy v2 as the governed material-action equivalence contract and must explicitly admit the new version if its action semantics remain identical.

## Proposed decision

Introduce adr.policy.v3.

Policy v1 and v2 remain immutable and exactly replayable.

Policy v3 inherits Policy v2 semantics unchanged except for one versioned capability: the requiredRuntimeOutputs field remains REQUIRED but may be the explicit empty array [].

An explicit empty array means: this Policy requires no upstream RuntimeDatum semantic outputs.

It does not mean runtime evidence is optional when the Policy actually declares runtime-output ports.

## Preserved Policy v2 semantics

Policy v3 retains without semantic weakening:

- decisionType;
- closed actionSpace;
- governed actionSemantics;
- exact material-action equivalence;
- required ContextDatum semantic inputs;
- exact decision-logic definition;
- threshold authority;
- operational constraints;
- jurisdiction constraints;
- human gate;
- fallback;
- abstention conditions;
- limitations;
- exact specification-management authorization;
- immutable semantic hashing and replay.

Policy v3 MUST require action semantics exactly as Policy v2 does.

## Runtime execution behavior

No new D02 execution contract is introduced.

For a Policy v3 with requiredRuntimeOutputs = [], D02 uses the existing ContextDatum-only path:

ContextManifest -> exact ContextDatum refs -> adr.runtime-execution-input.v1 -> adr.executor-request.v1.

No runtimeEntries are fabricated.

For a Policy v3 with non-empty requiredRuntimeOutputs, the existing evidence-backed post-D03 mixed-input execution rules remain unchanged.

Therefore Policy v3 is not a new runtime-input protocol and is not permission to bypass RuntimeDatum evidence.

## D05 action semantics

D05 must treat Policy v2 and Policy v3 as equivalent authority versions for governed material-action comparison when actionSemantics.equivalenceMode = EXACT_MATERIAL_PARAMETERS.

Policy v3 does not change MaterialActionSignature rules.

A Policy version that lacks governed action semantics remains ineligible for positive D05 action-equivalence authority.

## Fail-closed requirements

1. Policy v1 semantics remain unchanged.
2. Policy v2 must continue rejecting requiredRuntimeOutputs = [].
3. Policy v3 must require the requiredRuntimeOutputs field explicitly.
4. Policy v3 may accept requiredRuntimeOutputs = [].
5. Policy v3 with non-empty runtime-output ports must preserve existing port validation.
6. Policy v3 must require complete governed action semantics.
7. Policy v3 action semantics must cover exactly the Policy actionSpace.
8. D02 context-only execution must accept only exact ContextDatum authorities belonging to the frozen ContextManifest.
9. D02 must not manufacture RuntimeDatum or relabel a ContextDatum as RuntimeDatum.
10. D02 must continue using mixed post-D03 input only when runtime-output ports are actually required.
11. D05 may regard v3 Policy output as ACTION_AVAILABLE only under the same material-action validation required for v2.
12. Policy v3 must not itself create ApplicabilityAssessment, RuntimeEligibility, DecisionResult, execution truth, or Outcome.

## KBS predecessor use

DEC-0005 is motivated by a blocker discovered while testing DEC-0004, but it does not accept or implement agronomic prohibition authority.

If Policy v3 is later accepted, the KBS prohibition benchmark may be rerun against exact context-only v3 Policies so that an AgronomicPolicyConstraintCompilation can bind a semantically honest Policy rather than fake runtime outputs.

The dependency direction is:

Policy v3 capability
-> honest context-only governed Policy
-> candidate AgronomicPolicyConstraintCompilation binding.

ConstraintCompilation does not automatically make a Policy applicable, current, executable, or decision-authoritative.

## Authority boundary

Policy != Knowledge != AgronomicPolicyConstraintCompilation != ApplicabilityAssessment != RuntimeEligibility != RuntimeBinding != DecisionResult != execution evidence != Outcome.

Allowing an empty runtime-output requirement does not change those authority classes.

## Rejected alternatives

### Allow empty requiredRuntimeOutputs in Policy v2 in place

Rejected because accepted authority contracts must remain immutable and replayable.

### Put ContextDatum semantics into requiredRuntimeOutputs

Rejected because it collapses ContextDatum and RuntimeDatum epistemic/provenance classes merely to satisfy a schema requirement.

### Add a dummy runtime output

Rejected because it invents decision-input semantics unsupported by the source or computation graph.

### Add a new D02 execution protocol

Rejected because D02 already has a valid ContextDatum-only execution path when no RuntimeDatum input is required.

### Let D05 accept every future Policy version automatically

Rejected because material-action authority must fail closed. D05 explicitly admits only Policy contract versions whose action-equivalence semantics are known and governed.

## Acceptance targets

Candidate exact-head acceptance must prove:

1. v2 still rejects empty requiredRuntimeOutputs;
2. v3 accepts explicit empty requiredRuntimeOutputs;
3. v3 rejects omission of the field;
4. v3 retains exact v2 action-semantics requirements;
5. v1/v2 historical refs replay unchanged;
6. a v3 context-only Policy executes through the existing D02 ContextDatum-only request path;
7. that execution request contains no runtimeEntries;
8. D05 produces normal governed material-action evaluation for v3 rather than POLICY_ACTION_EQUIVALENCE_AUTHORITY_REQUIRED;
9. repository-wide Constitution remains green.

## Acceptance

Accepted on 2026-08-27 after explicit architecture approval.

The accepted Policy-v3 authority remains subject to the exact-head post-acceptance repository qualification gate before merge:

1. the exact accepted head must pass dedicated ADR Policy v3 qualification;
2. the same exact head must pass repository-wide ADR Constitution acceptance;
3. Policy v1/v2 historical replay must remain unchanged;
4. D02 must still prove that a context-only Policy v3 reuses the existing ContextDatum-only execution path without fabricating RuntimeDatum inputs;
5. D05 must still prove that Policy v3 receives governed material-action treatment under the same equivalence semantics as Policy v2.

Acceptance of DEC-0005 does not accept DEC-0004, does not itself publish AgronomicPolicyConstraintCompilation authority, does not create ApplicabilityAssessment, RuntimeEligibility, RuntimeBinding, DecisionResult, execution truth, or Outcome, and does not authorize merge until the exact accepted head completes those qualification gates.
