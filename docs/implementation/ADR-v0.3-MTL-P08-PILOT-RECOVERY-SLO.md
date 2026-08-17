# ADR v0.3 — MTL-P08 Pilot Recovery / Incident Replay / SLO

Status: IMPLEMENTATION CANDIDATE

Task: `MTL-P08`

Commercial slice: `v0.3 — Agronomist Pilot`

Exact implementation baseline: `main @ a08b51216e344b887eeb7817bdbcfa742a350ca0`

## 1. Pilot boundary

The v0.3 slice deliberately implements only the P08 recovery/SLO subset required by a paid design-partner pilot.

It does not attempt to complete the full enterprise production program in one step.

Included:

- fail-closed AuthorityLedger checkpoint validation and replay into a fresh ledger;
- exact semantic/audit/lineage identity preservation checks;
- incident classification from replayed P06 operational evidence;
- governed D06 `ABSTAIN` classification as a domain disposition rather than a generic server error;
- Deployment forward-suspend rollback evidence;
- pilot latency/success/provider-outage SLO projection;
- executable recovery/integrity acceptance.

Explicitly deferred unless a pilot contract requires it:

- automated cloud backup scheduling;
- multi-region HA/failover;
- enterprise disaster-recovery orchestration;
- production KMS/HSM integration;
- complete rate/quota/cost attribution platform;
- external compliance certification.

## 2. Recovery remains operational metadata

Permanent nonclaim:

`NONE_RECOVERY_OPERATIONS_METADATA_IS_NOT_DOMAIN_AUTHORITY`

A recovery checkpoint, incident record, rollback record or SLO report cannot create, replace or mutate Source, Knowledge, Context, Model, Policy, RuntimeBinding, DecisionResult or Outcome authority.

Recovery therefore means:

```text
validate retained authority facts
+ replay them into a fresh ledger
+ prove exact identities survived
```

It does not mean:

```text
rewind database state
or
rewrite historical authority to match current deployment
```

## 3. Authority checkpoint / restore

A pilot recovery checkpoint contains the complete retained AuthorityLedger snapshot plus:

- snapshot hash;
- semantic state hash;
- checkpoint hash;
- capture timestamp;
- explicit non-authority claim.

Restore accepts only a closed snapshot contract.

For every authority record it verifies that the exact `kind + semanticPayload` reproduces the frozen semantic hash.

For every lineage edge it verifies:

- exact endpoint refs exist;
- relation is governed;
- lineage hash is reproducible;
- exactly one retained lineage audit event closes the edge.

For every audit event it verifies:

- closed event shape;
- exact object/input refs exist in the same snapshot;
- event hash reproduces through the shared audit contract.

The restore path reconstructs a new `AuthorityLedger` by replaying original publication and lineage evidence. The recovered ledger must reproduce:

- all records;
- all lineage edges;
- all audit event identities;
- the checkpoint semantic-state hash.

This is intentionally stricter than a storage-engine database rewind. A partial snapshot with missing exact audit inputs is not described as a successful exact recovery.

## 4. Operational incident evidence

P08 does not trust a standalone P06 `OperationalTrace` merely because its `traceHash` can be recomputed.

Operational incident evidence is bound to:

```text
OperationalTrace
+
retained OperationalJobJournal snapshot
```

The P06 journal constructor first revalidates:

- job/idempotency identity;
- closed attempt shapes;
- attempt record hashes;
- governed failure classes;
- retry history;
- journal snapshot hash.

P08 then re-projects the exact job trace from that retained journal and requires canonical equality with the supplied trace before classification or SLO measurement.

An incident evidence snapshot may not mix another organization/tenant job.

This prevents a trace projection from being edited and rehashed while continuing to claim that it came from the retained P06 job history.

P06 journal hashes remain operational integrity evidence, not scientific/domain authority or a cryptographic signature claim.

## 5. Incident taxonomy

Pilot incident classes:

- `PROVIDER_OUTAGE`
- `RUNTIME_FAILURE`
- `PLATFORM_FAILURE`
- `GOVERNED_BLOCK`
- `DECISION_ABSTAIN`

Classification rules preserve the frozen P06/D06 distinction:

- provider failure remains provider outage;
- scientific/runtime ineligibility remains governed `BLOCKED`, not a service failure;
- failed execution carrying exact RuntimeBinding evidence can be classified as runtime failure;
- a validated D06 `ABSTAIN` remains a governed decision disposition;
- a generic self-authored object named `DecisionResult/ABSTAIN` cannot substitute for D06 validation.

`DECISION_ABSTAIN` explicitly has:

```text
transport class = DOMAIN_DISPOSITION
genericServerError = false
```

## 6. Deployment rollback

P08 rollback is forward operational control, not authority rewind.

A rollback record requires the current exact Deployment lifecycle state to be `SUSPENDED`, with the supplied exact `DeploymentControlDecision(SUSPEND)` as the current control tip.

The replayed incident organization/tenant must also match the exact Deployment scope. An incident from one tenant cannot be attached to another tenant's suspended Deployment merely because both exact refs are present in the same ledger.

The rollback record freezes:

- exact Deployment ref;
- exact SUSPEND control ref;
- exact incident hash;
- exact authority refs that must remain resolvable;
- `FORWARD_SUSPEND_NO_DATABASE_REWIND` mode;
- `semanticMutationAllowed = false`.

Rollback verification proves the Deployment is still suspended, the incident still matches the Deployment scope, and all preserved authority refs remain resolvable.

No rollback API field exists for Model, Policy or Knowledge semantic overrides. Such changes require new governed authority through the existing control path.

## 7. Pilot SLO

SLO reports are derived only from P06 trace/journal evidence that replays successfully.

Pilot measurements:

- total jobs;
- service-eligible jobs;
- succeeded jobs;
- failed jobs;
- governed blocked jobs;
- incomplete/running jobs;
- provider-outage count;
- success basis points;
- nearest-rank p95 terminal duration.

Frozen interpretation:

```text
BLOCKED scientific/runtime ineligibility
!=
service failure
```

Therefore governed blocked cases do not enter the service-success error denominator.

Provider failures remain visible as their own outage budget rather than being collapsed into scientific ineligibility or a generic runtime failure.

Retry semantics deliberately separate final job outcome from provider-outage accounting. Final success/failure is computed from the terminal job outcome, while `providerOutageCount` is derived from all retained P06 attempts classified `PROVIDER_FAILURE`. Therefore a provider failure followed by a successful retry remains a successful job while still consuming one provider-outage event; retry cannot erase the historical outage from the pilot SLO.

Every trace used for a report must have its terminal/running observation anchored inside the declared report window; a caller cannot relabel historical traces as current-window SLO evidence.

Cross-tenant trace aggregation is rejected by the underlying P06 observability contract.

Each exact P06 operational `jobId` may contribute at most once to a report. Duplicate evidence for the same job is rejected before aggregation, preventing denominator or success-rate inflation by repeated inclusion of one successful job.

## 8. Acceptance focus

Positive acceptance proves:

1. fresh-ledger restore preserves records, lineage and audit identities;
2. provider outage classification from exact P06 journal-bound evidence;
3. runtime failure classification remains distinct;
4. real validated D06 `ABSTAIN` is not a generic 500;
5. rollback requires real Deployment SUSPEND and preserves historical authority refs;
6. SLO excludes governed BLOCKED cases from service errors.

Integrity acceptance proves:

1. semantic-record mutation remains detectable even if outer checkpoint hashes are recomputed;
2. recovery payload widening fails closed;
3. a modified/rehashed trace cannot contradict its retained P06 journal snapshot;
4. cross-tenant SLO aggregation fails closed;
5. rollback rejects feature/semantic override fields;
6. rollback cannot be claimed before exact SUSPEND authority exists;
7. a generic self-authored `ABSTAIN` cannot become D06 incident evidence;
8. traces outside the declared SLO window are rejected;
9. an incident from another tenant cannot drive Deployment rollback;
10. the same exact operational job cannot be counted twice in one SLO report.

Retry/SLO acceptance additionally proves that a `PROVIDER_FAILURE` attempt followed by a successful retry yields a successful terminal job while retaining the provider outage in the outage budget.

Latest full-root hardening evidence before this documentation synchronization: P08 positive `6/6`, integrity `10/10`, provider retry/outage accounting `PASS`, with the complete repository acceptance suite green.

## 9. Hardening history

The first implementation run exposed two real contract mistakes rather than architecture blockers: the D06 validator result was initially treated as if the returned semantic payload itself carried the authority ref, and DecisionProblem scope was initially read from the wrong field. The final implementation binds `decision.record.ref` and `decision.decisionProblem.semanticPayload.targetRef` from the real D06 validation result.

Independent review also rejected trusting a standalone, self-rehashable `OperationalTrace`; P08 now requires the retained P06 journal snapshot and re-projects the trace before incident classification or SLO measurement.

A later green staging candidate was deliberately not frozen. Independent review found two additional manipulation seams outside the then-current tests: an incident from tenant A could otherwise be associated with a tenant B rollback, and a caller could repeat one successful operational job in the SLO input array. Both are now fail-closed executable regressions.

A final reviewer pass found a subtler SLO accounting defect: the initial projection looked only at the terminal attempt, so a transient provider failure followed by a successful retry would report the job as successful but incorrectly report zero provider outages. P08 now takes terminal job success/error from the final outcome and provider-outage count from all retained failed attempts by class. The dedicated retry regression freezes that distinction.

## 10. Explicit nonclaims

This pilot P08 slice does not prove:

- automatic offsite backup durability;
- multi-zone/multi-region recovery point objectives;
- full production RTO/RPO compliance;
- enterprise infrastructure rollback;
- a cryptographic signature service for operational telemetry;
- complete rate/quota/cost attribution;
- agronomic correctness, recommendation quality, causal benefit or commercial validation.

After P08 closes, v0.3 still requires an integrated release acceptance over the paid-pilot workflow before the repository can call the software a `Paid Design-Partner Pilot Candidate`.
