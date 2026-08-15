# ADR v0.1 — MTL-F03 IAM / Tenant / Knowledge-IP / Entitlement Implementation Contract

Status: **IMPLEMENTATION CONTRACT / NON-ARCHITECTURE-AUTHORITY**

Task: `MTL-F03 — IAM / Tenant / Knowledge-IP / Entitlement`

Baseline: `main @ 04e92f10579e6f8c68ee7550e8b67d5d0e632ae6`

Upstream authority remains Architecture v1.0, Capability Map 01, Master Task Line 01 and Version Slicing 01.

This task establishes authorization and knowledge-entitlement semantics. It does **not** implement user authentication, SSO, OIDC, enterprise directory synchronization, or a durable IAM database.

---

## 1. F03 authority boundary

F03 answers:

```text
Given an authenticated/asserted principal identity,
what operation is that principal authorized to perform,
on which scope,
against which exact knowledge-governance policy?
```

It does not answer:

```text
How was the principal authenticated?
Is the knowledge scientifically correct?
Is the knowledge qualified?
Is the knowledge applicable to a field?
Is a runtime/decision legal?
```

Authentication systems may later supply Principal identities. F03 consumes those identities and governs authorization/entitlement.

---

## 2. Principal and scoped role assignment

Initial principal classes:

```text
USER
SERVICE_ACCOUNT
```

A Principal carries stable organization/tenant/program identity assertions for authorization evaluation.

Permissions are granted through immutable/versioned `RoleAssignment` authority records. A RoleAssignment freezes:

```text
principal
role name
role-definition version
exact permission set
authorization scope
semantic hash
```

Role names are convenience/governance templates. Authorization depends on the exact permission set frozen into the RoleAssignment, not on mutable global role-name semantics.

The initial built-in role templates include:

```text
KNOWLEDGE_AUTHOR
AGRONOMY_REVIEWER
SCIENTIFIC_APPROVER
DEPLOYMENT_MANAGER
AGRONOMIST
AUDITOR
INTEGRATION_SERVICE
RUNTIME_SERVICE
COMPILER_SERVICE
```

The built-in compiler role deliberately lacks:

```text
knowledge.qualify
knowledge.deploy
deployment.production
```

so the Compiler cannot self-qualify or self-deploy its output.

---

## 3. Four orthogonal knowledge-governance dimensions

`KnowledgeGovernancePolicy` must carry four distinct authority dimensions:

### ownership
Who owns/controls the knowledge asset.

### visibilityPolicy
Who may inspect/read the knowledge object.

### qualificationScope
For which crop/use/decision/jurisdiction or other declared dimensions qualification may be granted.

### deploymentScope
For which organization/tenant/program/crop/use or other declared dimensions the knowledge may be deployed/used at runtime.

These dimensions are never collapsed into `PUBLIC/PRIVATE`.

Permanent invariants:

```text
visibility ≠ ownership
visibility ≠ deployment entitlement
qualification scope ≠ deployment scope
runtime tenant ≠ knowledge owner
```

A customer/program may be authorized to run proprietary knowledge without being authorized to inspect its content.

---

## 4. Double-gate authorization

A successful operation must satisfy both:

```text
Principal permission / RoleAssignment scope
AND
Resource-specific KnowledgeGovernancePolicy
```

Examples:

```text
Public visibility
+ no KNOWLEDGE_INSPECT permission
→ DENY

Scientific Approver permission
+ crop outside qualificationScope
→ DENY

Deployment Manager permission
+ target program outside deploymentScope
→ DENY

Runtime service permission
+ target inside deploymentScope
+ no human inspection visibility
→ runtime use may be ALLOW while inspection remains DENY
```

This prevents knowledge visibility, ownership or runtime tenant identity from laundering authorization.

---

## 5. Operation-specific semantics

### Knowledge inspection
Requires:

```text
KNOWLEDGE_INSPECT permission
+ RoleAssignment scope match
+ visibilityPolicy match
```

### Knowledge qualification authorization
Requires:

```text
KNOWLEDGE_QUALIFY permission
+ KNOWLEDGE_INSPECT permission
+ visibilityPolicy match
+ qualificationScope match
```

F03 only authorizes who may perform a future qualification operation. It does not create QualifiedKnowledge; that remains `MTL-K04`.

### Knowledge deployment authorization
Requires:

```text
KNOWLEDGE_DEPLOY permission
+ RoleAssignment scope match
+ deploymentScope match
```

Production deployment additionally requires:

```text
DEPLOY_PRODUCTION
```

Scientific qualification and production deployment remain independent authority chains.

### Runtime knowledge use
Requires:

```text
KNOWLEDGE_RUNTIME_USE permission
+ RoleAssignment scope match
+ deploymentScope match
```

Runtime use does not require human read visibility. This is intentional for proprietary knowledge execution under licensed programs.

---

## 6. AuthorizationDecision

Each authorization check returns an immutable, content-addressed `AuthorizationDecision` containing:

```text
operation
principal
exact KnowledgeGovernancePolicy ref
exact RoleAssignment refs
request/scope
allowed
reason codes
decisionHash
```

This makes the authorization basis reconstructable and auditable.

`AuthorizationDecision` is an authorization result, not scientific authority, applicability authority, RuntimeEligibility or DecisionResult.

The first implementation does not persist every decision into a durable event store. It freezes exact decision semantics so later API/persistence/observability layers can record the same object without inventing another authorization model.

---

## 7. Retrieval/runtime enforcement surface

F03 provides separate filters for:

```text
human inspectability
runtime deployability/use
```

This directly supports the constitutional requirement that tenant/IP enforcement happen below the UI layer.

Future Knowledge Retrieval (`C08 / MTL-A07`) must consume these entitlement semantics before candidate disclosure/use. It must not reimplement authorization with its own `PUBLIC/PRIVATE` shortcut.

---

## 8. Immutability and versioning

RoleAssignment and KnowledgeGovernancePolicy are published through the F02 AuthorityLedger reference semantics:

```text
kind + logicalId + version + semanticHash
```

Changing any authority-bearing field requires a new version. A published version cannot be changed in place.

AuthorizationDecision binds exact policy/assignment refs, so historical decisions remain attributable even after later permissions/policies change.

---

## 9. Explicit nonclaims

MTL-F03 does not establish:

```text
SSO / OIDC / MFA
password/session management
enterprise directory sync
durable IAM database
row-level database security implementation
Knowledge qualification itself
KnowledgeRelease
Deployment objects
Knowledge Retrieval
Applicability
RuntimeEligibility
DecisionResult
scientific correctness
```

The absence of those systems does not weaken the F03 claim, which is limited to the authorization/entitlement authority model and its executable acceptance.

---

## 10. Gate F closure condition

After MTL-F03 acceptance, Gate F may close only if the previously merged F01/F02 acceptance remains green:

```text
F01 standalone constitutional independence
+
F02 canonical identity / immutability / lineage / audit
+
F03 scoped authorization / tenant / knowledge-IP entitlement
```

Gate F still does not prove any Knowledge, Applicability, Runtime or Decision capability.
