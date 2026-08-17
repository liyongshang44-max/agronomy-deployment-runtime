# ADR v0.3 — MTL-P07 Pilot Security / Secrets / Retention / Audit Export

Status: IMPLEMENTATION CANDIDATE

Task: `MTL-P07`

Commercial slice: `v0.3 — Agronomist Pilot`

Exact implementation baseline: `main @ 647bbbea3284349dbe8b76186a49a629508d8829`

## 1. Scope

This slice implements the pilot-grade security-operational controls required after P06 and before the v0.3 paid design-partner pilot candidate can close.

It deliberately remains outside scientific/runtime/domain authority:

```text
Secret metadata
Retention directives/status
Security events
Audit export package
!=
Source / SourceArtifact semantic authority
!=
Knowledge authority
!=
Context / Runtime / Decision / Outcome authority
```

Permanent nonclaim:

`NONE_SECURITY_OPERATIONS_METADATA_IS_NOT_DOMAIN_AUTHORITY`

P07 therefore does not mutate existing authority semantic identity to encode operational storage, retention or export state.

## 2. Dedicated security permissions

P07 adds three scoped permissions:

```text
security.secret.manage
security.secret.use
security.retention.manage
```

No frozen built-in role receives them implicitly.

Existing `AUDITOR` remains exactly `audit.read`; it can authorize a tenant-scoped audit export but receives no secret or retention control authority.

Security operations require exact published RoleAssignment evidence and replayable `AuthorizationDecisionAudit`. A self-consistent copied authorization payload without the direct `AUTHORIZATION_<OP>_ALLOW` audit closure is rejected.

## 3. Pilot secret isolation

`PilotSecretVault` keeps secret bytes in a module-private storage seam. Returned/stored operational metadata contains only:

- exact organization/tenant scope;
- secret id;
- revision;
- deterministic opaque secret handle;
- non-authority metadata hash.

Secret values are excluded from:

- AuthorityLedger;
- metadata hashes;
- security-event fields;
- audit-export payloads.

`SECRET_MANAGE` and `SECRET_USE` are separate permissions. Same secret id in different tenants resolves to independent storage identities.

Allowed store/rotate/read operations and denied operations are emitted as structured security events without copying exception messages or secret values.

### Pilot limitation

This is an in-process pilot isolation contract, not a production KMS/HSM claim. It does not claim durable secret persistence, automatic rotation scheduling, hardware-backed keys, multi-region replication or disaster recovery. Those operational-production concerns belong to later P08/full production infrastructure.

## 4. Rights-aware and tenant-scoped SourceArtifact retention

`PilotSecureArtifactStore` remains content-addressed at the evidence level, but retained-byte storage identity is explicitly scoped by:

```text
organization / tenant scope
+ exact contentHash
```

The store exposes only scoped read/write probes:

```text
putForScope(scope, bytes)
hasForScope(scope, contentHash)
getForScope(scope, contentHash)
```

It intentionally exposes no legacy unscoped `put/get/has` path and no public `delete/remove` path.

This distinction matters because `contentHash` is global evidence identity, not tenant authorization. Two tenants retaining identical bytes may therefore have the same exact content hash while occupying two independent tenant-scoped storage keys. A caller presenting another tenant scope does not resolve the first tenant's retained object unless that tenant independently retained the same content.

`SourceRegistry` remains backward-compatible with the existing legacy exact-artifact store contract, but when supplied a scoped store it derives the storage scope from the exact Source ownership authority for both materialization and reads. The caller does not get to rewrite Source ownership in order to select retained bytes.

Deletion is available only through `ArtifactRetentionController`, which binds:

- exact SourceArtifact ref;
- exact content hash;
- exact Source ownership scope;
- exact rightsSnapshot hash;
- exact retention mode/window;
- legal-hold state;
- audit-export permission;
- exact-replay preservation requirement;
- exact scoped retention authorization.

Current pilot modes:

```text
RETAIN
DELETE_AFTER
```

Deletion fails closed when any of the following is true:

```text
RIGHTS_BASIS_MISMATCH
LEGAL_HOLD_ACTIVE
EXACT_REPLAY_PROTECTED
RETENTION_REQUIRES_PRESERVATION
RETENTION_WINDOW_ACTIVE
```

The default is `preserveExactReplay = true`.

Every retention directive revision remains in append-only operational history; replacing the current directive does not erase a prior legal hold or preservation control record.

If deletion is explicitly authorized after the retention window with exact-replay protection disabled, the immutable SourceArtifact authority record is not rewritten. Operational material availability becomes:

`EXACT_MATERIAL_UNAVAILABLE`

This is truthful storage state; it does not pretend the old authority semantic identity changed or silently continue claiming the bytes are retained. Consumers requiring exact bytes will fail at actual material read.

## 5. Customer knowledge is not training authority

P07 provides no training/inference entitlement grant.

For an exact customer SourceArtifact:

- cross-tenant target → `CROSS_TENANT_TRAINING_DENIED_BY_DEFAULT`;
- same-tenant target → `TRAINING_NOT_AUTHORIZED_BY_P07`.

Thus successful retention/storage does not imply permission to use customer knowledge for training, cross-tenant inference, or another tenant’s product behavior.

## 6. Tenant-safe audit export

Audit export requires exact `audit.read` authorization over one deterministic export request and one canonical set of exact root refs.

The export follows the AuthorityLedger audit dependency closure from those exact roots. For every included object, tenant scope must be proven either directly from the authority semantics or through exact audit-input ancestry.

Fail-closed conditions include:

```text
AUDIT_SCOPE_UNPROVEN
AUDIT_SCOPE_AMBIGUOUS
AUDIT_EXPORT_AUTHORITY_NOT_FOUND
AUDIT_EXPORT_INPUT_AUTHORITY_MISSING
CROSS_TENANT_AUDIT_EXPORT_DENIED
RETENTION_CONTROLLER_REQUIRED
RIGHTS_BASIS_MISMATCH
ARTIFACT_AUDIT_EXPORT_DENIED
```

A missing exact audit input is never silently skipped; an export that cannot close the exact dependency chain is not described as complete.

When a SourceArtifact enters the export closure, its current exact rights/retention directive must explicitly allow audit export.

## 7. Sanitized export surface

The pilot export contains:

- exact AuthorityRefs;
- sanitized audit events;
- sanitized lineage relations;
- hashes of audit/lineage detail payloads.

It does not contain:

- authority `semanticPayload`;
- Source/Knowledge private titles or rights payloads;
- SourceArtifact raw bytes;
- raw audit `details`.

Frozen flags:

```text
semanticPayloadIncluded = false
rawSourceArtifactBytesIncluded = false
```

An audit package can therefore prove exact authority-chain identities without turning `audit.read` into a generic proprietary knowledge read entitlement.

## 8. Security event logging

`SecurityEventJournal` is tenant-filtered operational metadata, not AuthorityLedger authority.

Pilot events include:

- secret stored/rotated/read;
- denied secret store/read attempts;
- retention-directive changes;
- allowed/denied artifact deletion;
- allowed/denied audit export.

Events retain actor, scope, resource identity, outcome, reason code, timestamp and authorization ref where available. They do not copy secret bytes or arbitrary exception text.

## 9. Acceptance

Root-wired P07 acceptance proves:

### Authorization

- dedicated security permissions exist;
- built-in roles do not silently gain them;
- permission types cannot substitute for one another;
- foreign-tenant role assignments contribute no authority;
- AUDITOR remains audit-only;
- recorded decisions bind exact RoleAssignments without a fake KnowledgeGovernancePolicy.

### Positive operations

- same secret id remains isolated across tenants;
- rotation/read works without secret-value leakage;
- legal hold blocks deletion;
- exact-replay protection blocks deletion;
- explicit retention expiry can remove bytes without mutating SourceArtifact authority;
- tenant audit export closes exact same-tenant Source/SourceArtifact dependencies;
- raw bytes/private semantic payloads remain absent;
- foreign-tenant audit export fails closed;
- no P07 training-use grant exists.

### Integrity / hardening

- artifact store has no public unscoped read/write or direct delete bypass;
- identical bytes across two tenants preserve one evidence content hash while retaining independent tenant-scoped storage keys;
- wrong-tenant scoped retained-byte lookup fails closed;
- SourceRegistry reads scoped storage from exact Source ownership;
- rights policy can deny an otherwise-authorized auditor;
- fake AuthorizationDecisionAudit cannot authorize storage;
- unprovable scope fails closed;
- exact forbidden export keys/values are tested without broad-substring false positives;
- cross-tenant retention control is rejected;
- security events remain tenant-scoped non-authority metadata;
- rights-based export denial emits a DENY security event;
- missing exact audit input fails closed and is logged;
- directive revisions retain history;
- rejected secret operations are logged without secret/error-message leakage.

## 10. Validation and hardening history

One early root run failed only because the integrity test searched for the substring `semanticPayload` and therefore matched the legitimate flag name `semanticPayloadIncluded:false`.

The test was corrected to recursively reject the exact forbidden key `semanticPayload` while separately asserting `semanticPayloadIncluded === false`. No security implementation or export allowance was weakened.

A later independent review found a substantive isolation seam: the first `PilotSecureArtifactStore` design used global `put/get(contentHash)` storage. Source authority carried tenant ownership, but direct possession of that store object plus a known hash could bypass the intended tenant-storage boundary. Merely teaching `SourceRegistry` to pass scope was insufficient while the store still exposed the legacy global API.

The final pilot contract therefore removed unscoped `put/get/has`, keyed retained bytes by tenant scope plus content hash, bound retention status/deletion to exact Source ownership scope, and added a dedicated regression proving that identical bytes in two tenants retain independent storage identities. The first root run after that hardening exposed only a stale integrity fixture still calling `store.put(...)`; the fixture was migrated to the scoped contract without weakening the isolation rule.

## 11. Explicit nonclaims

This P07 pilot slice does not prove:

- production KMS/HSM or durable secret persistence;
- full legal-hold workflow integrations;
- external compliance certification;
- arbitrary cross-organization shared-authority audit entitlement;
- full backup/restore or disaster recovery;
- SLO/error-budget compliance;
- P08 closure;
- scientific correctness, recommendation quality, agronomic effectiveness, causal benefit, or commercial validation.

P08 remains responsible for the recovery/SLO/incident-replay subset required by the v0.3 pilot contract.
