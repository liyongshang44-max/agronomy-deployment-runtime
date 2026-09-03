# DEC-0032 Sustainable Corn DecisionProblem FARM Target Binding Gold Provenance

This Gold replays the exact Sustainable Corn target-identity authority through
DEC-0027 and then proves the DEC-0032 source-backed A01 publication seam.

## Real-source authority

The only source-derived DecisionProblem field established by this Gold is:

```text
targetRef.farmId =
  exact DEC-0027 target_src_<64hex>
```

That value is revalidated through the full retained Sustainable Corn lineage used by
DEC-0027.

No new external evidence is introduced by DEC-0032.

## Deployment-owned fixture authority

The Gold supplies deterministic machine-acceptance deployment scope:

```text
organizationId = org-a
tenantId = tenant-a
```

These values are test fixture scope, not Sustainable Corn source facts.

They prove only that DEC-0032 preserves the A01 rule that organization/tenant belong
to the authorized creator/deployment.

## Decision-intent fixture

The Gold supplies explicit deterministic A01 decision-intent fields.

They are classified:

```text
DETERMINISTIC_MACHINE_ACCEPTANCE_FIXTURE_NOT_SOURCE_DERIVED
```

They must not be interpreted as:

- a real Sustainable Corn operator request;
- a historical decision made at SERF;
- an agronomic recommendation;
- a source-derived use purpose;
- a real GEOX/customer deployment intent.

The fixture uses `RUNTIME_ONLY` so it cannot create final DecisionResult authority.

## Publication authority split

The binding reviewer proves only the exact DEC-0027 farmId lineage and the ownership
separation required by DEC-0032.

The A01 creator independently requires replayable:

```text
decision.problem.create
```

authorization for the exact organization/tenant and DecisionProblem logical id.

The binding review does not grant A01 creation permission.

## Specialized proof

The positive DecisionProblem is a standard A01 `DecisionProblem`.

Its direct publication audit additionally binds the exact
`AgronomicDecisionProblemFarmTargetBindingCompilation`.

A second generic A01 DecisionProblem with identical visible fields is deliberately
published under valid A01 authorization and then rejected by the specialized
DEC-0032 validator because it lacks that direct binding proof.

## Nonclaims

This Gold does not create or authorize:

- ContextManifest;
- evidenceCutoff authority;
- fieldId, seasonId or zoneId;
- geometry or geometryRef;
- ContextDatum farm identity;
- Policy;
- runtime execution;
- DecisionResult;
- Outcome.

DEC-0032 is only the source-backed FARM target-component binding seam into A01.
