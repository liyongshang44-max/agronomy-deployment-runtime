# ADR v0.1 — MTL-D03 RuntimeResult / RuntimeDatum Semantic Envelope

Status: **IMPLEMENTED CANDIDATE / NON-ARCHITECTURE-AUTHORITY**

Baseline: `main @ 41fde1e1bde08b2d3d3d6765bae0872a5e1ed713`

Task: `MTL-D03 — RuntimeResult / RuntimeDatum Semantic Envelope`

## 1. Purpose

D03 prevents rich runtime semantics from collapsing into a bare executor number after D02 dispatch.

D02 establishes which exact executable was dispatched, with which exact ContextDatum authority envelope, and captures opaque execution evidence. D03 consumes only a successful D02 execution envelope and materializes the semantic output as replayable `RuntimeResult` / `RuntimeDatum` objects.

The boundary is:

```text
D02 RuntimeExecutionEnvelope
  = exact execution evidence
  != semantic output authority

D03 RuntimeResult / RuntimeDatum
  = semantic runtime-output envelope
  != ContextDatum
  != DecisionResult
```

## 2. Permanent authority boundary: ContextDatum != RuntimeDatum

`ContextDatum` is target-world context authority admitted through the Context Contract and context-write governance path.

`RuntimeDatum` is an output produced by one exact runtime execution and retains that execution lineage.

They may share portable semantic dimensions, but they are different authority kinds:

```text
ContextDatum != RuntimeDatum
```

D03 does not publish, mutate or impersonate `ContextDatum`.

A RuntimeDatum produced by one RuntimeBinding cannot become input authority for that same RuntimeBinding. Any future admission into a future `ContextManifest` remains a separate context-resolution, temporal and epistemic adjudication.

## 3. D02 evidence is necessary but not sufficient

D03 accepts one normalized successful `adr.runtime-execution-envelope.v1`.

It requires:

- `status = SUCCEEDED`;
- exact RuntimeBinding identity;
- exact runtime node identity;
- exact Specification ref;
- exact Implementation ref;
- exact ImplementationConformance ref;
- exact input-envelope hash;
- exact opaque raw-output hash/integrity already enforced by D02;
- execution chronology.

A failed, malformed or identity-tampered D02 envelope cannot be upgraded into RuntimeResult.

D03 validates the exact frozen historical RuntimeBinding world. It does not re-run the current-use Deployment gate merely to replay historical output semantics.

## 4. Exact input lineage reconstruction

The frozen RuntimeResult contract requires exact input semantic hashes. D02 deliberately carries the aggregate `inputEnvelopeHash` rather than duplicating every input hash in its result envelope.

D03 therefore receives the exact `inputDatumRefs` used for D02 and reconstructs the D02 input envelope from authority:

```text
exact ContextDatum refs
+ exact frozen ContextManifest membership
+ exact S01 input ports
+ exact semantic ID/value type/unit/epistemic legality
+ exact RuntimeBinding/node/Specification/Implementation/Conformance tuple
        ↓
reconstructed D02 RuntimeExecutionInputEnvelope
        ↓
recomputed inputEnvelopeHash
```

The recomputed hash must equal the hash in the D02 execution envelope.

Only after that equality is proven may D03 expose the individual exact input semantic hashes in RuntimeResult.

The caller cannot supply or self-assert input hashes directly.

## 5. D03 executor semantic-output transport contract

D02 treats executor output as opaque JSON-compatible evidence. D03 recognizes a closed semantic transport shape inside that opaque output:

```text
adr.runtime-semantic-output.v1
```

Each output entry may carry only runtime evidence that the executor can legitimately produce at execution time:

- `semanticId` as an exact output-port selector;
- typed value;
- effective interval;
- forecast reference time/horizon when applicable;
- spatial support;
- vertical support;
- temporal support;
- uncertainty.

The executor is forbidden from self-authoring:

- unit;
- epistemic class;
- provenance class;
- Specification identity;
- ImplementationConformance identity.

Those semantics come from the exact frozen authority chain.

Bare numbers are rejected. D03 requires canonical typed values such as `DECIMAL`, `INTEGER`, `BOOLEAN`, `CATEGORY`, `TIMESTAMP`, `INTERVAL` or `SET`.

The public `packages/runtime-results` entrypoint exposes normalization, `collectRuntimeResult` and evidence-backed `validateRuntimeResult`. It intentionally does not expose unchecked `createRuntimeDatum` or `createRuntimeResult` minting helpers.

The distinction is material:

```text
normalizeRuntimeResult(result)
  = structural + identity/hash self-consistency
  != proof that result came from a particular D02 execution

validateRuntimeResult({ result, executionEnvelope, exact input refs })
  = normalize result
  + replay exact D02 evidence through collectRuntimeResult
  + require complete semantic equality
```

The authoritative D03 materialization/validation path therefore closes the D02 execution, frozen RuntimeBinding world and exact input lineage together. A self-consistent JSON object cannot substitute for execution evidence.

## 6. Model output semantics

For a `Model`, D03 derives fixed output semantics from the exact S01 output port:

```text
semantic ID       <- exact Model output port
value type         <- exact Model output port
unit               <- exact Model output port
measurement convention (if present) <- exact Model output port
epistemic class    <- exact single Model output epistemic class
provenance class   <- MODEL
```

S01 already restricts Model output epistemic classes to:

- `DERIVED`;
- `STATE_ESTIMATE`;
- `FORECAST`;
- `MODEL_PRIOR`.

Therefore D03 cannot relabel model output as `OBSERVATION`.

The executor supplies the runtime value/time/support/uncertainty evidence, which D03 validates and binds under the exact Specification semantics.

## 7. QualifiedTransformation output semantics

S01 v1 `QualifiedTransformation` supports the explicit epistemic rule `PRESERVE`.

D03 therefore preserves the output epistemic identity from the exact input `ContextDatum`, but it does **not** copy the input provenance class onto a newly executed RuntimeDatum. A sensor-origin observation that was transformed by ADR is not itself a fresh `SENSOR` execution artifact.

For D03 v1 a QualifiedTransformation RuntimeDatum records:

```text
epistemic class  <- exact input ContextDatum (PRESERVE)
provenance class <- PLATFORM
```

The original evidence source is not lost: exact input ContextDatum semantic hashes and the D02 input-envelope hash remain bound into RuntimeResult. `PLATFORM` therefore describes truthful transformation execution provenance rather than overwriting the origin lineage.

The exact governed transformation may change semantic representation and unit according to its S01 output contract, but D03 v1 does not invent authority for an undeclared resampling operation. It therefore requires exact preservation of:

- effective interval;
- spatial support;
- vertical support;
- temporal support.

When `uncertaintyConsequence.mode = PRESERVE`, uncertainty must also remain exactly equal to the input uncertainty envelope.

If a future transformation specification authorizes governed support or uncertainty transformation semantics, that must first exist in S01 authority before D03 may recognize it.

## 8. Policy execution is not RuntimeDatum

S01 `Policy` declares required context/runtime inputs and decision/action logic, but it does not declare a semantic data output port.

D03 therefore fails closed for Policy execution:

```text
Policy action/disposition != RuntimeDatum
```

D03 must not manufacture an arbitrary semantic ID to turn an action, disposition or recommendation into data authority.

Policy/decision authority remains downstream in the D05/D06 decision path.

## 9. Time, support and uncertainty are mandatory semantic dimensions

Every RuntimeDatum carries:

- effective interval;
- spatial support;
- vertical support (nullable where semantically inapplicable);
- temporal support;
- uncertainty.

These dimensions are part of the output semantic hash and cannot be silently dropped.

For `FORECAST` output, D03 additionally requires:

- forecast reference time;
- forecast horizon;
- horizon equal to the RuntimeDatum effective interval;
- reference time not later than horizon start.

Non-forecast output cannot carry forecast metadata.

## 10. RuntimeDatum identity and semantic hash

`RuntimeDatum` uses:

```text
contractVersion = adr.runtime-datum.v1
authorityClass  = RUNTIME_OUTPUT_SEMANTIC_DATUM
```

The deterministic `runtimeDatumId` is derived from:

```text
executionId
+ semanticId
```

The `outputSemanticHash` covers the complete semantic and runtime lineage envelope, including:

- execution identity;
- RuntimeBinding;
- runtime node;
- Specification;
- Implementation;
- ImplementationConformance;
- semantic ID/value/unit;
- measurement convention when present;
- epistemic/provenance classes;
- effective/forecast time;
- support;
- uncertainty.

Replay rejects any identity or semantic-hash mismatch.

## 11. RuntimeResult identity and evidence replay

`RuntimeResult` uses:

```text
contractVersion = adr.runtime-result.v1
authorityClass  = RUNTIME_EXECUTION_SEMANTIC_RESULT
```

It binds:

- deterministic RuntimeResult identity;
- exact D02 execution identity;
- exact execution-evidence hash;
- RuntimeBinding/node/Specification/Implementation/Conformance refs;
- exact D02 input-envelope hash;
- exact individual input semantic hashes;
- execution start/completion timestamps;
- one or more RuntimeDatum objects;
- complete result semantic hash.

The deterministic RuntimeResult identity is derived from:

```text
executionId
+ RuntimeBinding
+ runtimeNodeId
```

An exact successful D02 execution with the same exact input authorities therefore replays to the same D03 identity and hashes.

`validateRuntimeResult` re-collects that expected result from exact D02 evidence and requires complete semantic equality. This catches a forged result that is internally self-consistent but binds a different execution-evidence hash or lineage.

A RuntimeDatum from another execution cannot be spliced into an otherwise valid RuntimeResult.

## 12. Historical replay is distinct from current-use authorization

D02 must revalidate current Deployment and ImplementationConformance before a new dispatch.

D03 historical normalization answers a different question: what semantic result did this already-recorded exact execution produce?

Therefore:

```text
later Deployment suspension
  -> blocks new D02 dispatch
  != invalidates historical RuntimeResult replay
```

D03 relies on exact frozen historical RuntimeBinding relations for replay and never converts historical replay into current-use authorization.

## 13. Acceptance surface

D03 is root-wired through:

```text
npm run test:runtime-results
```

which runs:

```text
acceptance/runtime-results/run.mjs
acceptance/runtime-results/integrity.mjs
```

The hardened candidate covers at least:

### Positive

- Model `STATE_ESTIMATE` output;
- Model `FORECAST` output with reference time/horizon;
- Model `DERIVED` output with measurement convention;
- multi-output Model result;
- exact hash/identity replay;
- evidence-backed RuntimeResult replay validation;
- QualifiedTransformation epistemic/support/uncertainty preservation with truthful `PLATFORM` execution provenance.

### Fail-closed / nonclaim

- public package exposes no unchecked RuntimeDatum/RuntimeResult creator;
- self-consistent forged RuntimeResult cannot replace exact D02 execution evidence;
- failed D02 execution cannot become RuntimeResult;
- executor cannot self-author unit/epistemic/provenance;
- bare number rejected;
- output value-type mismatch rejected;
- output semantic-ID substitution rejected;
- missing/illegal forecast metadata rejected;
- exact input refs must reproduce D02 input-envelope hash;
- RuntimeDatum/RuntimeResult hash tampering rejected;
- cross-execution datum splicing rejected;
- MODEL provenance cannot produce OBSERVATION;
- RuntimeDatum cannot normalize as ContextDatum;
- historical replay survives later Deployment suspension while new dispatch remains blocked;
- QualifiedTransformation cannot silently mutate support;
- `PRESERVE` transformation cannot silently mutate uncertainty.

## 14. Nonclaims

D03 does **not** claim:

```text
RuntimeDatum == ContextDatum
RuntimeResult == DecisionResult
RuntimeResult == scientific correctness
successful execution == semantic validity without D03 checks
normalizeRuntimeResult == evidence-backed execution validation
historical RuntimeResult replay == current Deployment authorization
Model output == OBSERVATION
executor-declared unit/epistemic/provenance == authority
aggregate inputEnvelopeHash alone == recoverable exact input lineage
RuntimeDatum == automatic future ContextManifest member
Policy action/disposition == RuntimeDatum
RuntimeResult == agronomic recommendation authority
input provenance class == truthful provenance of a later transformation execution
```

D03 also does not create new Knowledge, Specification, Implementation, Conformance, Deployment or Context authority.

## 15. Closure rule

This implementation document does not itself close D03.

D03 becomes CLOSED only after the repository delivery sequence is satisfied:

1. exact feature-head full-root CI;
2. independent authority/security/fail-closed review;
3. hardened exact feature head;
4. Draft PR merge-candidate full-root CI;
5. final exact diff review;
6. Ready-state candidate revalidation;
7. expected-head merge;
8. actual protected-main SHA verification;
9. exact-main full-root CI.

Only then does MTL-D03 unlock MTL-D04.
