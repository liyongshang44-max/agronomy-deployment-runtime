# ADR v0.3 — MTL-P06 Pilot-Grade Async / Idempotency / Operational Observability

Status: IMPLEMENTATION CANDIDATE

Task: `MTL-P06`

Commercial slice: `v0.3 — Agronomist Pilot`

Exact implementation baseline: `main @ 0b5fe3a301f753d6ab2d27f43ef252a57daf98af`

## 1. Scope

This slice closes the pilot-grade portion of P06 needed before ADR can be treated as a paid design-partner pilot candidate. It adds an operational job journal and observability surface around already-authoritative ADR capabilities. It creates no new scientific, runtime, decision, or evaluation authority.

The frozen boundary is:

```text
OperationalJob / Attempt / Trace / Metrics
!=
Authority object
!=
Agronomic evidence
```

Permanent nonclaim:

`NONE_OPERATIONAL_METADATA_IS_NOT_DOMAIN_AUTHORITY`

## 2. Pilot operational job identity

`adr.operational-job.v1` binds:

- organization and optional tenant scope;
- operation name;
- caller idempotency key;
- canonical exact input AuthorityRefs.

The job id is deterministic. A second request using the same organization/tenant + operation + idempotency key but different exact inputs fails closed with `IDEMPOTENCY_KEY_REUSE_WITH_DIFFERENT_INPUTS`.

The execution-facing idempotency key is the exact deterministic `jobId`, so an operated capability can bind its own retry-safe publication/dispatch semantics to the same stable execution identity.

## 3. Attempt journal and retry semantics

`adr.operational-job-attempt.v1` records each attempt separately.

Attempt states:

- `RUNNING`;
- `SUCCEEDED`;
- `FAILED` for provider/integration/platform failures;
- `BLOCKED` for scientific/runtime ineligibility.

Terminal attempts cannot be overwritten. A later successful retry therefore does not erase the prior failed attempt.

A successful job is terminal for the same job id: later retry requests return `REPLAYED_SUCCESS` and do not redispatch the executor.

A non-retryable failed/blocked attempt returns `RETRY_BLOCKED_NON_RETRYABLE`; callers must create a materially new operational job when the underlying inputs/decision world change.

An interrupted persisted `RUNNING` attempt can be recovered explicitly as:

```text
FAILED
PLATFORM_TRANSIENT_FAILURE
ATTEMPT_INTERRUPTED
retryable=true
```

before another attempt begins. Recovery preserves the interrupted attempt as history rather than deleting or overwriting it.

## 4. Retry-safe authority creation proof

P06 does not invent a second idempotency mechanism inside domain authority. It composes operational job identity with the existing F02 immutable/idempotent AuthorityLedger contract.

Executable acceptance uses the real ContextDatum publication path:

```text
attempt 1
  -> publishes exact ContextDatum
  -> provider acknowledgement failure
  -> operational attempt FAILED

attempt 2
  -> retries same exact ContextDatum publication
  -> AuthorityLedger returns same exact authority
  -> one ContextDatum version remains
  -> operational attempt SUCCEEDED

attempt 3
  -> REPLAYED_SUCCESS
  -> executor is not redispatched
```

This proves operational retry does not require mutation or duplication of immutable authority.

## 5. Failure taxonomy

Pilot P06 freezes these operational classes:

- `PROVIDER_FAILURE`;
- `INTEGRATION_FAILURE`;
- `AUTHORIZATION_FAILURE`;
- `SCIENTIFIC_INELIGIBILITY`;
- `RUNTIME_INELIGIBILITY`;
- `PLATFORM_TRANSIENT_FAILURE`;
- `PLATFORM_PERMANENT_FAILURE`;
- `UNCLASSIFIED_PLATFORM_FAILURE`.

Scientific/runtime ineligibility is projected as `BLOCKED`, not as provider/platform failure. Unknown exceptions fail closed as `UNCLASSIFIED_PLATFORM_FAILURE` and their exception message is not copied into trace output.

## 6. Tenant-aware trace and metrics surface

`NON_AUTHORITY_OPERATIONAL_TRACE` contains only:

- organization/tenant scope;
- deterministic job and attempt identities;
- operation name;
- exact input/output AuthorityRefs;
- timestamps/durations;
- terminal status;
- structured failure class/code/retryability.

It deliberately omits:

- arbitrary error messages;
- credentials/secrets;
- authority semantic payloads;
- customer agronomic values;
- the caller idempotency key.

Therefore observability can answer which exact KnowledgeRelease / RuntimeProfile / Deployment / ContextManifest / RuntimeBinding participated in an event without copying proprietary authority payloads into logs.

Metrics aggregation is scope-closed: traces from different organization/tenant scopes cannot be combined by the built-in summary surface.

## 7. Snapshot / restart contract

The operational journal exports `adr.operational-job-journal.v1`, including every job and attempt plus an integrity hash. A reconstructed journal revalidates:

- job semantic identity;
- idempotency scope uniqueness;
- sequential attempt identity;
- attempt record hashes;
- terminal-history constraints.

This gives a durable persistence adapter a deterministic persistence/restart contract without making the operational journal itself an AuthorityLedger.

Pilot P06 does not claim multi-region consensus, horizontally distributed lease arbitration, backup/restore, disaster recovery, or SLO compliance. Those remain P08/full production concerns.

## 8. Positive acceptance

The root-wired `test:pilot-operations` proves:

- deterministic job identity and exact-input idempotency binding;
- same idempotency key cannot be rebound to changed inputs;
- real ContextDatum publication remains one immutable authority version across a failed-then-successful retry;
- success replay does not redispatch executor side effects;
- persisted interrupted attempts remain historical failures before retry;
- provider failure and scientific ineligibility remain different operational states/classes;
- non-retryable scientific block does not loop blindly;
- exact backbone refs are retained in traces without semantic payload copying;
- unknown exception text/secrets are not emitted into traces;
- cross-tenant operational metric aggregation fails closed;
- snapshot tampering fails closed;
- terminal attempt history cannot be overwritten;
- traces are not accepted as AuthorityRefs.

## 9. Explicit nonclaims

This implementation does not prove:

- production HA or exactly-once delivery across arbitrary distributed workers;
- backup/restore or disaster recovery;
- SLO/error-budget compliance;
- secret storage/rotation or retention/legal-hold policy;
- P07 or P08 closure;
- scientific correctness, runtime eligibility, DecisionResult correctness, agronomic effectiveness, or causal benefit.

P06 observability is operational evidence only. It cannot be used as ContextDatum, RuntimeDatum, Outcome, Qualification, Applicability, RuntimeEligibility, DecisionResult, or EffectAttribution authority.
