# ADR v0.1 — D02 Post-D03 Policy RuntimeDatum Input Hardening

Status: **IMPLEMENTATION HARDENING CANDIDATE — NOT ARCHITECTURE AUTHORITY**

Predecessors:

- MTL-D02 Implementation Broker;
- MTL-D03 RuntimeResult / RuntimeDatum;
- S01 Policy specification authority.

Discovered while preparing MTL-D05 DecisionRobustness.

## 1. Gap being closed

D02 originally shipped before D03 existed. Its broker therefore deliberately rejected a Policy whose exact specification declared non-empty `requiredRuntimeOutputs`.

After D03 closure that guard became stale: valid Model/Transformation outputs now exist as evidence-backed RuntimeResult / RuntimeDatum envelopes, but Policy execution still had no legal way to consume them.

D05 cannot compare Policy actions until an exact Policy can actually execute over exact upstream runtime evidence.

This hardening closes that execution seam. It does not implement D05 robustness semantics.

## 2. Permanent authority invariants

The following remain unchanged:

```text
ContextDatum != RuntimeDatum
RuntimeResult != DecisionResult
historical result evidence != current execution authorization
current-binding RuntimeDatum cannot justify its own RuntimeBinding
D02 opaque output capture != D03 semantic validation
```

A RuntimeDatum is not inserted into ContextManifest merely because a later Policy consumes it.

## 3. Dependency direction

D03 already depends on D02. D02 therefore must not import D03 or runtime-results, which would create a circular semantic authority dependency.

The dependency direction remains:

```text
D03/runtime-results
  validates exact RuntimeResult evidence
        ↓
  prepares evidence-bound RuntimeDatum entries
        ↓
D02 private prepared-input capability
  revalidates current RuntimeBinding/Deployment/Conformance
        ↓
  dispatches exact Policy implementation
```

D02 never claims that an arbitrary caller-supplied runtime object is semantically valid.

## 4. Versioned mixed execution input

Legacy ContextDatum-only execution remains:

```text
adr.runtime-execution-input.v1
```

Post-D03 Policy execution uses:

```text
adr.runtime-execution-input.v2
```

The v2 mixed envelope binds the exact execution authority tuple plus two distinct input collections:

- `contextEntries[]` — exact ContextDatum authorities that belong to the frozen ContextManifest;
- `runtimeEntries[]` — exact evidence-bound RuntimeDatum semantic envelopes selected from validated RuntimeResults.

The two collections are never collapsed into one generic datum type.

## 5. Runtime input evidence

Each v2 runtime entry retains:

- RuntimeResult identity;
- RuntimeResult semantic hash;
- original D02 execution-evidence hash;
- RuntimeDatum identity;
- RuntimeDatum output semantic hash;
- semantic ID;
- full RuntimeDatum semantic envelope.

The public bridge `executePolicyWithRuntimeResults()` accepts each upstream result together with:

- the original D02 execution envelope;
- the original exact ContextDatum refs used by that execution.

It calls D03 `validateRuntimeResult()` before the result may become a Policy input. A self-consistent JSON object is insufficient; the exact D02 execution and input lineage must replay.

## 6. Exact Policy input matching

After evidence validation, only exact S01 `requiredRuntimeOutputs` are selected.

Each selected RuntimeDatum must match the Policy input port on:

- semantic ID;
- portable value type;
- unit;
- allowed epistemic class.

Missing semantics, unit mismatch, epistemic mismatch, duplicate semantic sources or invalid evidence fail closed.

## 7. Self-authorization prohibition

A RuntimeDatum whose producing `runtimeBindingRef` equals the Policy RuntimeBinding currently being dispatched is rejected:

```text
RUNTIME_EXECUTION_RUNTIME_INPUT_SELF_AUTHORIZATION
```

This preserves the frozen rule:

```text
current-binding RuntimeDatum cannot justify its own binding
```

Runtime outputs may enter later execution worlds only through a separate exact binding relation and the applicable evidence/context rules.

## 8. Current-use revalidation remains D02 authority

Upstream RuntimeResult evidence may be historical. That does not weaken current Policy execution gates.

Immediately before dispatch, D02 still revalidates:

- exact RuntimeBinding historical authority;
- current Deployment runtime eligibility;
- exact current ImplementationConformance validity/control state;
- exact execution environment and capabilities.

Therefore a valid historical RuntimeResult cannot bypass a later Deployment suspension or Conformance revocation.

## 9. Public/private execution surface

Existing public broker API remains ContextDatum-only:

```text
RuntimeExecutionBroker.execute({ inputDatumRefs })
```

A Policy requiring RuntimeDatum inputs still fails on that legacy path with:

```text
RUNTIME_EXECUTION_POLICY_UPSTREAM_RESULT_REQUIRED
```

The new mixed-input broker capability is intentionally not exported from `packages/implementation-broker/src/index.mjs`.

The public post-D03 path is exported from runtime-results:

```text
executePolicyWithRuntimeResults(...)
```

This keeps evidence validation on the D03 side of the dependency boundary.

## 10. Executor request contract

Legacy executor request remains:

```text
adr.executor-request.v1
inputEntries[]
```

Mixed Policy request is:

```text
adr.executor-request.v2
contextEntries[]
runtimeEntries[]
```

The exact mixed input envelope is hashed into D02 execution identity and idempotency identity. RuntimeResult/RuntimeDatum evidence therefore participates materially in the downstream Policy execution identity.

## 11. D02 output semantics remain unchanged

D02 still treats executor output as opaque canonical JSON-compatible evidence.

For Policy execution this means D02 may capture a structured action-shaped raw output, but D02 does not decide whether that output satisfies Policy v2 action semantics and does not produce a DecisionResult.

The existing envelope still states:

```text
semanticValidation = NOT_PERFORMED_D03_REQUIRED
```

D05 will normalize/validate Policy action evidence against exact Policy v2 semantics before producing MaterialActionSignature / robustness semantics.

## 12. Error taxonomy additions

The D02 taxonomy now explicitly includes post-D03 mixed-input failures including:

- `RUNTIME_EXECUTION_RUNTIME_INPUT_EVIDENCE_INVALID`;
- `RUNTIME_EXECUTION_RUNTIME_INPUT_REQUIRED`;
- `RUNTIME_EXECUTION_RUNTIME_INPUT_SELF_AUTHORIZATION`;
- `RUNTIME_EXECUTION_PREPARED_INPUT_WORLD_MISMATCH`;
- `RUNTIME_EXECUTION_PREPARED_BROKER_REQUIRED`.

These are input/current-use failures, not scientific or decision outcomes.

## 13. Acceptance boundary

End-to-end acceptance proves:

```text
ContextDatum
  → Model D02 execution
  → D03 RuntimeResult/RuntimeDatum
  → exact Policy requiredRuntimeOutputs
  → D02 mixed-input Policy dispatch
```

It also proves fail-closed behavior for:

- legacy broker path with runtime-output requirement;
- forged RuntimeResult evidence;
- unit mismatch;
- missing required RuntimeDatum semantic;
- Deployment suspension after upstream evidence exists;
- public implementation-broker surface not exposing the prepared capability.

Further hardening covers mixed-input identity/idempotency and current-binding self-authorization before closure.

## 14. D05 handoff

After this hardening is CLOSED on actual protected main, D05 may consume successful Policy D02 execution envelopes and exact Policy v2 action semantics to normalize Policy action evidence.

D05 must still fail closed when:

- Policy is legacy v1 and lacks governed material equivalence;
- action output does not satisfy exact Policy v2 action schema;
- D04 coverage is insufficient;
- material actions differ across legal included worlds.
