# DEC-0033 — Governed ContextManifest Convergence and Evidence-Cutoff Ownership

Status: **ACCEPTED**

Date: 2026-09-03

## Decision statement

For the exact first Sustainable Corn planting-date target world, ADR may publish and
specialized-validate one standard A04 `ContextManifest` without creating a new
parallel manifest authority object or an additional convergence compilation.

The source-specific publication path must:

1. validate the exact ContextDatum through DEC-0031 specialized publication authority;
2. validate the exact DecisionProblem through DEC-0032 specialized publication
   authority;
3. prove that the DEC-0031 datum assembly and the DEC-0032 FARM target binding
   converge on the exact same DEC-0023
   `AgronomicRecordedOperationContextSpatialSupportClassificationCompilation`;
4. prove exact organization/tenant equality through the existing A02/A01/A04
   authorization scopes;
5. require `evidenceCutoff` as an explicit manifest-publisher input;
6. call the frozen generic A04 `publishContextManifest(...)` unchanged;
7. preserve the exact A04 publication input set;
8. specialized validation must replay DEC-0031, DEC-0032 and the shared DEC-0023
   lineage from the exact refs already frozen in the ContextManifest.

For the first finite world:

```text
datumRefs = [exact DEC-0031 planting-date ContextDatum]
resolvedReferenceReceiptRefs = []
```

No extra scientific, target or convergence ref is inserted into the public
ContextManifest wire or its A04 publication input set.

## Why this DEC exists

DEC-0031 established the first governed real-source ContextDatum.

DEC-0032 established the first standard A01 DecisionProblem whose FARM target
component is bound to exact source-backed DEC-0027 authority.

The frozen A04 ContextManifest already owns:

- exact DecisionProblem ref;
- exact ContextDatum membership;
- exact receipt membership;
- targetRef derived from DecisionProblem;
- logicalTime derived from DecisionProblem;
- evidenceCutoff;
- replay class;
- exact context.write authorization;
- immutable semantic identity and historical replay.

A fresh post-DEC-0032 audit found no missing generic A04 capability.

The remaining seam is narrower:

```text
Does this exact DEC-0031 ContextDatum
and this exact DEC-0032 DecisionProblem
belong to the same governed source-backed FARM world?
```

Generic A04 intentionally cannot answer that source-specific question.

DEC-0033 closes only that convergence proof.

## Fresh A04 authority audit

The live A04 implementation:

- validates exact DecisionProblem authority;
- derives manifest targetRef and logicalTime from that DecisionProblem;
- validates exact ContextDatum authority;
- requires every datum organization/tenant write scope to equal DecisionProblem
  organization/tenant;
- requires `ContextDatum.availableAt <= evidenceCutoff`;
- requires manifest publication time to be no earlier than evidenceCutoff;
- freezes exact DecisionProblem, datum and receipt refs in semantic identity;
- validates the exact publication input set;
- forbids hidden extra publication inputs.

Therefore DEC-0033 must not replace or widen A04.

## Why no new convergence compilation is needed

DEC-0031 and DEC-0032 required explicit internal compilation authorities because their
public A02/A01 objects do not themselves carry enough source-specific provenance to
prove those new semantic bindings.

A04 is different.

A standard ContextManifest already freezes the exact refs that matter:

```text
decisionProblemRef
datumRefs[]
resolvedReferenceReceiptRefs[]
evidenceCutoff
```

For the first DEC-0033 world, the exact `decisionProblemRef` can be specialized-
validated through DEC-0032 and the exact `datumRefs[0]` can be specialized-validated
through DEC-0031.

Those validators recover their internal predecessor authority.

Therefore an additional:

```text
AgronomicContextManifestConvergenceCompilation
```

would duplicate authority rather than close a missing provenance seam.

DEC-0033 explicitly rejects that redundant layer.

## Exact convergence rule

The DEC-0031 assembly contains:

```text
predecessorRefs.spatialSupportClassificationCompilationRef
```

The DEC-0032 chain contains:

```text
bindingCompilation
  -> exact DEC-0027 targetRef FARM projection
  -> parentContextSpatialSupportClassificationCompilationRef
```

DEC-0033 requires exact AuthorityRef equality:

```text
DEC-0031 spatialSupportClassificationCompilationRef
==
DEC-0032 / DEC-0027 parentContextSpatialSupportClassificationCompilationRef
```

Semantic similarity is insufficient.

A separately published semantically-equal DEC-0023 authority cannot replace the exact
shared predecessor.

## Source-backed target convergence

The shared DEC-0023 authority proves the common FARM lineage.

DEC-0033 must also revalidate that:

- DEC-0031 datum `spatialSupport.type = FARM`;
- DEC-0032 sourceBackedFarmId equals the exact target id revalidated through
  DEC-0027/DEC-0023;
- both chains close through the same source-backed DEC-0015 target identity.

DEC-0033 does not add farmId to ContextDatum.

The A02 public datum remains unchanged.

## Organization and tenant convergence

The Sustainable Corn source does not establish ADR organization or tenant.

DEC-0033 therefore uses only existing deployment authorization authority:

- DEC-0031 ContextDatum write scope;
- DEC-0032 DecisionProblem target/creator scope;
- A04 ContextManifest publisher scope.

All three organization/tenant scopes must be exactly equal.

This equality proves deployment-world convergence only.

It does not turn organization/tenant into source evidence.

## Evidence cutoff ownership

`evidenceCutoff` is not scientific source evidence.

It is the explicit boundary chosen by the manifest publisher for the evidence world
frozen by that ContextManifest.

DEC-0033 must not derive evidenceCutoff from:

- planting date;
- ContextDatum effectiveInterval start/end;
- ContextDatum availableAt;
- DecisionProblem logicalTime;
- DecisionProblem decisionDeadline;
- source acquisition time;
- current host clock;
- latest provider timestamp;
- timezone conversion output.

The publisher supplies an explicit RFC3339 timestamp.

A04 then remains authoritative for the temporal admissibility checks it already owns,
including:

```text
ContextDatum.availableAt <= evidenceCutoff
manifest publication occurredAt >= evidenceCutoff
```

## No invented evidence-cutoff / logical-time ordering rule

The frozen architecture carries both:

```text
logicalTime
evidenceCutoff
```

as distinct ContextManifest fields.

It does not currently freeze a universal rule that:

```text
evidenceCutoff <= logicalTime
```

or:

```text
evidenceCutoff <= decisionDeadline
```

DEC-0033 therefore must not invent such a global invariant.

A future use-specific no-lookahead or contemporaneous-decision policy may impose a
stricter rule through its own governed authority.

## First Gold temporal classification

The first DEC-0033 Gold may reuse the deterministic DEC-0032 DecisionProblem fixture.

That fixture has a historical logicalTime earlier than the DEC-0031 datum's
`availableAt`.

Therefore the Gold must be classified explicitly as:

```text
RETROSPECTIVE_MACHINE_ACCEPTANCE_CONTEXT_WORLD
```

It must not be described as:

- evidence available to an operator at the DecisionProblem logicalTime;
- a contemporaneous historical SERF decision;
- a no-lookahead runtime proof;
- a real customer decision.

The Gold's explicit evidenceCutoff must be no earlier than the exact DEC-0031
`availableAt`, as generic A04 already requires.

## Proposed source-specific publication bridge

Implementation should add an additive bridge equivalent to:

```text
publishAgronomicContextManifestFromGovernedWorld({
  ledger,
  sourceRegistry,
  timezoneRuleEvidence,

  decisionProblemRef,
  contextDatumRef,
  evidenceCutoff,

  logicalId,
  version,

  principal,
  authorizationDecisionAuditRef,
  audit
})
```

The bridge must:

1. specialized-validate `contextDatumRef` through DEC-0031;
2. specialized-validate `decisionProblemRef` through DEC-0032;
3. prove exact shared DEC-0023 AuthorityRef convergence;
4. prove exact organization/tenant convergence;
5. require explicit evidenceCutoff;
6. call standard A04 `publishContextManifest(...)` with:

```text
datumRefs = [contextDatumRef]
resolvedReferenceReceiptRefs = []
```

The caller cannot provide an alternative datum set or receipt set in the first
source-specific bridge.

## No hidden publication ref

A04 requires the direct publication input set to be exactly:

```text
DecisionProblem ref
+ exact ContextDatum refs
+ exact ResolvedContextDatumReceipt refs
+ exact context.write AuthorizationDecisionAudit ref
```

DEC-0033 must preserve that invariant.

It must not insert:

- DEC-0031 assembly compilation ref;
- DEC-0032 binding compilation ref;
- DEC-0023 spatial compilation ref;
- a new convergence compilation ref;

into A04 `inputRefs`.

It must also not smuggle those refs through generic A04 audit metadata as hidden
manifest predecessors.

The exact ContextDatum and DecisionProblem refs are sufficient replay roots for the
specialized validator.

## Specialized validation

Implementation should add a validator equivalent to:

```text
validateAgronomicContextManifestGovernedWorldAuthority(...)
```

It must:

1. run generic A04 `validateContextManifestAuthority`;
2. require exactly one datum and zero resolved receipts for the first finite world;
3. specialized-validate that datum through DEC-0031;
4. specialized-validate the DecisionProblem through DEC-0032;
5. recover both internal target lineages;
6. require exact shared DEC-0023 AuthorityRef equality;
7. require exact organization/tenant convergence;
8. require the manifest datum ref to equal the exact specialized DEC-0031 datum ref;
9. require the manifest DecisionProblem ref to equal the exact specialized DEC-0032
   DecisionProblem ref;
10. retain A04 evidenceCutoff unchanged.

A generic A04 ContextManifest that references the exact specialized DEC-0031 datum and
exact specialized DEC-0032 DecisionProblem and satisfies these conditions is valid
DEC-0033 authority.

DEC-0033 does not require a second "published through bridge" marker because the
ContextManifest already carries all exact authority refs necessary to reproduce the
proof.

## No generic A04 mutation

DEC-0033 must not change:

- `adr.context-manifest.v1`;
- A04 semantic identity;
- A04 replay class derivation;
- A04 exact publication input set;
- A04 context.write authorization;
- generic A04 support for other ContextDatum/DecisionProblem worlds.

The source-specific bridge is additive only.

## No A03 fabrication

The first DEC-0031 ContextDatum is an inline standard ContextDatum backed by retained
source evidence and DEC-0031 assembly authority.

DEC-0033 must not fabricate:

- AuthorizedContextReference;
- ResolvedContextDatumReceipt;

merely to populate A04 receipt fields.

Therefore the first finite manifest uses:

```text
resolvedReferenceReceiptRefs = []
replayClass = EXACT
```

under the existing A04 rule for inline immutable ContextDatum membership.

## No target identity injection into ContextDatum

DEC-0033 does not modify the A02 datum public wire.

In particular it does not add:

- farmId;
- targetRef;
- organizationId;
- tenantId;
- geometryRef.

Target identity remains carried by DecisionProblem/A04 and recovered from DEC-0031
internal lineage only for convergence proof.

## No decision-intent upgrade

The first DEC-0032 Gold decision intent is a deterministic machine-acceptance fixture.

Publishing a ContextManifest around it does not turn that fixture into a real
agronomic decision.

DEC-0033 must preserve the classification:

```text
DETERMINISTIC_MACHINE_ACCEPTANCE_FIXTURE_NOT_SOURCE_DERIVED
```

and the first ContextManifest Gold must remain a mechanism proof.

## First Gold

The first cumulative DEC-0033 Gold should replay, in one AuthorityLedger:

```text
exact retained Sustainable Corn source world
        ↓
DEC-0031 governed ContextDatum
        +
DEC-0032 governed DecisionProblem
        ↓
exact shared DEC-0023 FARM lineage
        +
explicit publisher-selected evidenceCutoff
        ↓
standard A04 ContextManifest
```

Expected public world:

```text
ContextManifest {
  decisionProblemRef = exact DEC-0032 DecisionProblem
  targetRef = exact DecisionProblem targetRef
  logicalTime = exact DecisionProblem logicalTime
  evidenceCutoff = explicit publisher input
  datumRefs = [exact DEC-0031 ContextDatum]
  resolvedReferenceReceiptRefs = []
  replayClass = EXACT
}
```

Gold classification:

```text
RETROSPECTIVE_MACHINE_ACCEPTANCE_CONTEXT_WORLD
```

## Mandatory negative Gold

At minimum fail closed for:

- generic ContextDatum matching visible fields but lacking DEC-0031 authority;
- generic DecisionProblem matching visible fields but lacking DEC-0032 authority;
- wrong DEC-0031 datum ref;
- wrong DEC-0032 DecisionProblem ref;
- DEC-0031 spatial predecessor ref drift;
- DEC-0032 / DEC-0027 spatial predecessor ref drift;
- semantically equal but different DEC-0023 AuthorityRef convergence;
- FARM lineage mismatch;
- organization mismatch;
- tenant mismatch;
- caller-supplied second datum;
- caller-supplied receipt;
- empty datum set;
- ContextDatum availableAt after evidenceCutoff;
- manifest publication before evidenceCutoff;
- evidenceCutoff inferred from planting date;
- evidenceCutoff inferred from effectiveInterval;
- evidenceCutoff inferred from availableAt by bridge logic rather than explicit caller
  input;
- evidenceCutoff inferred from DecisionProblem logicalTime/deadline;
- missing CONTEXT_WRITE authorization;
- wrong ContextManifest logical-id authorization;
- denied context.write;
- wrong RoleAssignment;
- audit actor mismatch;
- hidden convergence ref inserted into A04 publication input set;
- ContextDatum farmId/targetRef injection;
- fabricated A03 receipt/reference;
- claim of contemporaneous/no-lookahead decision authority;
- RuntimeProfile/Deployment/Retrieval/Applicability/RuntimePlan creation;
- Policy/runtime execution/DecisionResult/Outcome creation.

## Publication authorization

DEC-0033 introduces no new permission.

Actual ContextManifest publication still requires existing A04:

```text
context.write
```

for:

```text
resourceType = CONTEXT_MANIFEST
resourceId = exact ContextManifest logicalId
organizationId / tenantId = exact DecisionProblem target scope
```

DEC-0031 scientific authority and DEC-0032 target authority do not grant manifest
write permission.

## Local completeness

If DEC-0033 is accepted and implemented successfully:

```text
FIRST REAL-SOURCE TARGET CONTEXT WORLD = COMPLETE
```

Specifically:

```text
retained source evidence
  -> governed ContextDatum
  -> source-backed DecisionProblem FARM target
  -> immutable ContextManifest
```

This means the first target-context world can be frozen and replayed.

It does not mean:

- a real deployment decision intent exists;
- a contemporaneous/no-lookahead decision has been proven;
- a KnowledgeRelease is applicable;
- RuntimeProfile/Deployment is bound;
- RuntimeEligibility exists;
- RuntimeBinding exists;
- DecisionResult exists.

## Next frontier after closure

After DEC-0033 implementation closure, Context-side DEC expansion should stop.

The next step should be a read-only real-source compatibility audit across:

```text
A05 RuntimeProfile
A06 Deployment
A07 Retrieval
A08 Applicability
R01 RuntimePlan
R02 InformationRequirement
R03 RuntimeEligibility
D01 RuntimeBinding
```

A new DEC should be opened only for an actual authority seam discovered by that audit.

Existing generic capabilities should be reused unchanged whenever they already accept
the exact DEC-0033 world.

## Architecture acceptance gate

Before implementation may begin:

1. DEC-0033 must receive explicit user acceptance;
2. the accepted documentation head must receive fresh Constitution qualification;
3. accepted docs must close through the normal Draft/Ready path;
4. qualified head -> merge must have `files=[]`;
5. post-merge Constitution must succeed.

Only then may an independent DEC-0033 implementation branch start.

## Final decision statement

DEC-0033 proposes exactly one source-specific closure rule:

> A standard A04 ContextManifest is sufficient to represent the first governed
> Sustainable Corn target-context world when its exact ContextDatum validates through
> DEC-0031, its exact DecisionProblem validates through DEC-0032, and those two
> authorities converge on the exact same DEC-0023 FARM lineage. Evidence cutoff is an
> explicit manifest-publisher boundary governed by existing A04 temporal checks. No
> new convergence compilation, hidden publication ref, A04 contract mutation, target
> injection into ContextDatum or fabricated A03 receipt is required.

No RuntimeProfile, Deployment, retrieval, applicability, RuntimePlan,
RuntimeEligibility, RuntimeBinding, Policy execution, DecisionResult or Outcome
authority is accepted by this proposal.
