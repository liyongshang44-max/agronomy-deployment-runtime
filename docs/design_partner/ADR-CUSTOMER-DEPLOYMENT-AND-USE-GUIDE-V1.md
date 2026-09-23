
# ADR Customer Deployment and Use Guide — v1

Status: CUSTOMER PILOT OPERATIONS / DEPLOYMENT GUIDE / NOT ARCHITECTURE AUTHORITY / NOT DOMAIN AUTHORITY

Release:

~~~
ADR v0.3 — Paid Design-Partner Pilot
~~~

## 1. The deployment rule

For v0.3, the customer does not normally deploy ADR source code.

The supported first-pilot model is:

~~~
ADR team
  hosts and operates ADR
        +
customer
  supplies knowledge, users and context
        +
customer users
  access ADR through HTTPS API / SDK / Workbench
~~~

The customer does not need to clone the ADR repository, run npm packages, operate AuthorityLedger infrastructure, deploy GEOX/MCFT, or build a recommendation engine.

Self-hosted ADR, customer-VPC deployment and on-prem deployment are not claimed v0.3 delivery modes. If a customer requires them, scope them separately rather than improvising them inside the pilot.

## 2. Recommended first-customer topology

For the first design partners, use a customer-isolated managed deployment.

~~~
Customer systems
  |
  | HTTPS / SDK / scheduled export
  v
Customer Context Provider
  |
  v
ADR Pilot API
  |
  +-- customer-specific authority/checkpoint state
  +-- customer-specific retained context snapshots
  +-- customer-specific bearer/principal bindings
  |
  v
ADR ApplicabilityAssessment
  |
  v
Agronomist Workbench API / UI surface
  |
  v
Customer agronomist review
~~~

For the first 1-3 customers, prefer one managed pilot deployment/state boundary per design partner rather than prematurely optimizing for shared multi-tenant infrastructure.

This is an operational-isolation recommendation, not a new ADR semantic rule.

## 3. What the ADR team deploys

The ADR team is responsible for:

- exact qualified ADR release;
- thin HTTP deployment host;
- TLS/public endpoint;
- persistent checkpoint storage;
- retained context snapshot storage;
- health/readiness monitoring;
- customer tenant/principal bootstrap;
- bearer credential issuance;
- customer-specific authorization decisions;
- Workbench access mappings;
- recovery/redeploy validation;
- OpenAPI and TypeScript SDK access.

The customer receives:

~~~
ADR base URL
tenant identifier
principal identities
bearer credentials
OpenAPI document
TypeScript SDK option
Workbench access
onboarding checklist
support contact
retention/offboarding terms
~~~

## 4. What the customer supplies

Knowledge package:

- 3-10 irrigation SOPs/protocols/guides;
- source owner;
- current/obsolete status;
- intended geography/crop/season where known;
- mandatory/preferred/advisory/reference status;
- rights/retention restrictions.

Agronomist reviewers:

- one lead agronomist;
- optionally one second reviewer for disagreement measurement.

Context provider:

- API;
- database/export endpoint;
- scheduled JSON/CSV;
- structured manual upload for the first pilot.

Pilot cases:

- 10-30 real or historical cases with field, crop, season, decision time, relevant measurements, measurement method where material, and known management history where material.

## 5. Real customer bootstrap

A customer instance must not start from the synthetic smoke world.

The ADR team creates a validated customer bootstrap containing:

~~~
customer organization / tenant
principal identities
role assignments
authorization decision evidence
initial qualified knowledge authorities
Workbench inspection authorizations
context-provider identity
retention/security policy metadata
~~~

The deployment restores that bootstrap through the existing ADR recovery-checkpoint path.

No customer authority is created by editing raw storage or bypassing ADR publication/authorization services.

## 6. Recommended principal model

A first pilot usually needs four principal types.

pilot-admin:
- coordinates customer onboarding and limited operational workflow;
- cannot fabricate agronomic authority.

agronomist-user:
- reads Workbench cases;
- inspects provenance/context/applicability;
- performs human review workflow.

context-provider-service:
- publishes ContextDatum under explicit authorization;
- optionally publishes/resolves ContextReference when late-bound context is required.

auditor/pilot-reviewer:
- inspects agreed pilot evidence/audit export;
- receives no general write authority.

Bearer tokens are bound to exact principals. Token principal and request principal must match.

## 7. Knowledge onboarding is not "upload and trust"

Correct flow:

~~~
customer document
  -> Source / SourceArtifact
  -> candidate Claim
  -> source context
  -> human/source-faithful review
  -> ScientificQualificationDecision
  -> eligible Knowledge authority
~~~

Only then can that knowledge enter retrieval/applicability.

A PDF, web page or internal SOP does not become QualifiedKnowledge merely because it was uploaded.

## 8. Context onboarding

For late-season irrigation, define an explicit context dictionary before integration.

Typical context families:

- field identity;
- crop identity;
- season;
- biological/growth stage where required;
- soil/water measurements;
- measurement semantic/unit;
- vertical/root-zone support where required;
- effective time;
- available-at time;
- provenance/source identity.

ADR must not infer measurement semantics from field names.

For example, sensor_value = 60 is insufficient if the real distinction is Watermark 60 cb versus capacitance 60%.

## 9. Public v0.3 API

Customer integration uses:

~~~
POST /v1/decision-problems
POST /v1/context-data
POST /v1/context-references
POST /v1/context-references/{reference_id}/resolutions
POST /v1/context-manifests
POST /v1/knowledge-retrieval-results
POST /v1/applicability-assessments

GET  /v1/workbench/cases/{assessment_id}
GET  /v1/workbench/escalations
~~~

Deployment/support endpoints may additionally expose:

~~~
GET /healthz
GET /ready
GET /openapi.json
~~~

The pilot does not expose:

~~~
/recommend
/runtime-eligibility
/runtime-bindings
/decision-results
~~~

## 10. Simplest customer integration

Do not begin with full automation.

Start with:

~~~
customer documents
  -> ADR onboarding

customer exports field context JSON/CSV once per case
  -> context-provider mapping
  -> POST /v1/context-data

ADR pilot workflow
  -> decision problem
  -> context manifest
  -> retrieval
  -> applicability

customer agronomist
  -> Workbench review
~~~

Automate the context feed only after semantic mapping is proven on initial cases.

## 11. Integrated customer use

Once mapping is stable:

~~~
customer field platform
     |
     | authenticated HTTPS
     v
POST /v1/context-data
     |
     v
ADR immutable ContextDatum
     |
     +--> ContextManifest
     +--> Knowledge Retrieval
     +--> ApplicabilityAssessment
     |
     v
GET /v1/workbench/cases/{assessment_id}
~~~

The customer production system may link to ADR case status. v0.3 must not treat ADR output as an automatic action command.

## 12. Day-to-day agronomist experience

The agronomist should see answers to:

- What knowledge is being checked?
- What source/version did it come from?
- What field/context is it being checked against?
- What matched?
- What is missing?
- What conflicts?
- Is calibration required?
- What limitations apply?
- Why was this classified this way?
- Does this require my review?

Customer-facing language can use Applicable, Missing information, Conflict, Calibration required, Governed transformation required and Review required.

Internally ADR preserves exact governed vocabulary. NO_REVIEW_CANDIDATE must never be presented as SAFE.

## 13. End-to-end workflow

1. Choose one decision problem.
2. Select eligible qualified knowledge.
3. Freeze target context at the decision-time cutoff.
4. Retrieve candidate knowledge.
5. Run applicability.
6. Review the case in Workbench.
7. Record human pilot feedback.

Human feedback is pilot/workbench evidence. It does not rewrite historical applicability authority.

## 14. Customer-live readiness checklist

Before calling a customer tenant LIVE:

- exact ADR protected-main release identified;
- customer-specific deployment/state boundary created;
- persistent storage attached;
- recovery checkpoint validates;
- synthetic bootstrap disabled;
- real customer bootstrap installed;
- customer token/principal bindings installed;
- /ready passes;
- one authorized ContextDatum write passes;
- unauthorized/principal-mismatch write fails closed;
- one Workbench case is readable by the correct agronomist;
- another tenant/principal cannot read it;
- redeploy/restart preserves checkpoint state;
- retention/offboarding terms agreed;
- customer data is not used as training authority.

## 15. Data and security boundary

ADR pilot data is customer scoped.

Preserve exact source identity/version, exact authority refs, tenant scope, provenance, audit history and retention policy.

Customer content retention does not imply training permission, cross-customer reuse or cross-tenant inference permission.

Do not send credentials through agronomic context payloads. Credentials belong in deployment secret management.

## 16. Backup and recovery

Minimum paid-pilot requirement:

~~~
persistent ADR checkpoint storage
+
recovery-checkpoint validation
+
restart/redeploy recovery proof
~~~

A paid agreement should also define an operational backup/export cadence appropriate to the pilot.

v0.3 does not claim enterprise multi-region disaster recovery.

## 17. Offboarding

At pilot completion:

1. export agreed audit/evidence package;
2. export customer-owned source inventory/refs where contractually agreed;
3. freeze final pilot scorecard;
4. record continuation/no-continuation decision;
5. apply agreed retention/deletion policy;
6. revoke customer bearer credentials;
7. preserve only evidence allowed by rights/retention terms.

## 18. What the customer should not deploy

Do not ask the customer to deploy GEOX, MCFT, the ADR source repository, AuthorityLedger manually, recommendation/runtime modules, or a custom transformation service hidden inside ContextProvider.

If on-prem/VPC/self-hosting is required, treat it as a separately scoped commercial/infrastructure requirement.

## 19. Current internal hosted environment

The current internal acceptance environment proves the thin hosted v0.3 deployment can run with Docker, persistent checkpoint volume, /ready, exact protected-main deployment and synthetic-bootstrap-off restart recovery.

It remains an internal smoke state until a real customer bootstrap replaces the synthetic acceptance state.

The internal smoke tenant must not be relabeled as a customer tenant.
