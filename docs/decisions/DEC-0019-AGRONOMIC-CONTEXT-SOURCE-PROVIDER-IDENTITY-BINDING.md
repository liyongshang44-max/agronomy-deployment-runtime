# DEC-0019 — Governed Agronomic Context Source Provider Identity Binding

Status: **ACCEPTED**

Date: 2026-09-01

## Context

DEC-0018 established the first governed context provenance classification:

```text
crop.planting_date = DATE 2011-05-03
epistemicClass = ASSERTION
provenanceClass = EXTERNAL_PROVIDER
```

and bound that classification to the exact DEC-0013 occurrence value source:

```text
Source
SourceArtifact
SourceArtifact.contentHash
```

DEC-0018 deliberately did not publish a ContextDatum and did not decide the public ContextDatum source wire:

```text
source:
  provider_id
  source_ref
  content_hash
```

The Frozen Context Contract requires all three source-wire fields as non-empty strings, but it does not define a universal projection from ADR Source/SourceArtifact authority into those fields.

Existing repository usage confirms that `provider_id` is an integration/source namespace, not necessarily an epistemic class or an institution name.

Examples include:

```text
GEOX adapter:
  provider_id = GEOX

AuthorizedContextReference example:
  provider_id = customer-context-api
```

The current Sustainable Corn value source is different.

Its exact Source authority contains an origin locator of the form:

```text
https://github.com/isudatateam/datateam/blob/<exact-git-blob>/scripts/cscap/chicago.ipynb
```

and retained lineage records the upstream repository namespace:

```text
isudatateam/datateam
```

That establishes an exact repository-level external source namespace.

It does not establish that the correct provider identifier should be:

- `ISU`;
- `IOWA_STATE_UNIVERSITY`;
- `ISU_DATA_TEAM`;
- `GITHUB`;
- `github.com`;
- ADR storage ownership `org-a`;
- the ADR Source logicalId.

Those would each select a different identity abstraction.

## Decision

Introduce a distinct content-addressed authority:

`AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilation`

Its narrow purpose is:

> bind the exact accepted DEC-0018 value-source world to one exact public ContextDatum `source.providerId` namespace at a reviewed and source-backed granularity, without deciding `sourceRef`, `contentHash`, ContextDatum publication, temporal/spatial/unit/uncertainty, runtime, execution or Outcome authority.

For the first real Gold, the only accepted provider namespace candidate is:

```text
providerId = github.com/isudatateam/datateam
```

This identifier means only:

> the exact first value source is supplied through the reviewed GitHub repository namespace `isudatateam/datateam`.

It does not mean:

> GitHub authored the agronomic assertion.

It does not mean:

> Iowa State University has been globally resolved as a canonical provider entity.

It does not mean:

> every source under this repository has identical agronomic authority.

## Why repository-level namespace

The first value source is retained from one exact public GitHub repository.

A repository-level namespace is the narrowest useful provider identity that is:

- source-backed by the exact origin locator;
- stable across files/artifacts inside the same repository namespace;
- more specific than the host-only identity `github.com`;
- less semantically ambitious than an inferred institutional identity such as `ISU`;
- independent of ADR tenant/storage ownership;
- independent of the exact individual source artifact.

Therefore the first provider identifier is:

```text
github.com/isudatateam/datateam
```

## Not an institutional entity-resolution decision

DEC-0019 does not assert:

```text
github.com/isudatateam/datateam
=
Iowa State University
=
ISU Data Team
=
Sustainable Corn Project
```

No global organization identity graph is created.

The provider namespace is source-channel identity only.

A future explicit organization/provider identity authority may bind repository namespaces to institutions if needed.

## Not a generic URL parser

The accepted first mapping is finite.

DEC-0019 does not establish a repository-wide rule:

```text
https://github.com/<owner>/<repo>/...
  ->
github.com/<owner>/<repo>
```

for arbitrary sources.

The first exact origin world is individually reviewed.

A future generic provider-namespace normalization policy would require separate authority and Gold coverage.

## Mandatory predecessor closure

Publication must require the exact accepted:

`AgronomicRecordedOperationContextProvenanceClassificationCompilation`

That authority must be fully revalidated through its own validator.

The DEC-0019 classifier must recover through predecessor closure:

- exact DEC-0018 value Source ref;
- exact DEC-0018 value SourceArtifact ref;
- exact SourceArtifact content hash;
- exact DEC-0018 provenanceClass = `EXTERNAL_PROVIDER`;
- exact DEC-0017 epistemicClass = `ASSERTION`;
- exact target semantic/value.

The Source authority must then be replayed and its exact source metadata used as reviewed provider-namespace evidence.

## Exact first source namespace

For the first Gold, the exact value Source must retain the reviewed origin locator rooted at:

```text
https://github.com/isudatateam/datateam/
```

and the exact first provider namespace must be:

```text
github.com/isudatateam/datateam
```

Changing the Source ref or its content-addressed semantic payload requires new review.

## Exact provider identity is material

Changing:

```text
github.com/isudatateam/datateam
```

to any of the following must change semantic identity or fail publication:

```text
github.com
isudatateam
datateam
github.com/isudatateam
github.com/other/datateam
ISU
IOWA_STATE_UNIVERSITY
GITHUB
org-a
```

Provider identity cannot be supplied as an arbitrary display label.

## Proposed authority shape

Conceptually:

```text
AgronomicRecordedOperationContextSourceProviderIdentityBinding {
  contractVersion

  bindingId

  contextProvenanceClassificationCompilationRef

  valueSource {
    sourceRef
    sourceArtifactRef
    sourceArtifactContentHash
  }

  sourceNamespaceEvidence {
    exactOriginLocator
  }

  providerId

  bindingRationale
}
```

Publication compilation should additionally contain:

- binding hash;
- provider-identity review ref;
- local lossless coverage;
- explicit limitations.

Exact implementation field names remain implementation-level after architecture acceptance.

## No sourceRef wire projection

DEC-0019 does not decide ContextDatum:

```text
source.sourceRef
```

The following remain open possibilities and are not accepted here:

- ADR Source authority ref serialization;
- ADR SourceArtifact authority ref serialization;
- DEC-0013 occurrence authority ref;
- source locator serialization;
- Git blob/path reference;
- occurrence-specific provider-native locator.

That is a separate source-reference projection seam.

## No contentHash wire projection

DEC-0019 does not decide whether public ContextDatum:

```text
source.contentHash
```

should represent:

- whole SourceArtifact content hash;
- exact occurrence evidence hash;
- normalized occurrence semantic hash;
- another explicitly governed value-source snapshot hash.

The first DEC-0018 authority binds SourceArtifact content hash for value-source closure, but that does not automatically choose public ContextDatum source-wire hash granularity.

## No ContextDatum publication

DEC-0019 creates no:

- ContextDatum;
- ContextManifest;
- AuthorizedContextReference;
- ResolvedContextDatumReceipt.

It establishes only one provider namespace binding.

## No provenance rewrite

DEC-0019 preserves:

```text
provenanceClass = EXTERNAL_PROVIDER
```

It does not change provenance to:

```text
PLATFORM
CUSTOMER_SYSTEM
MACHINERY
```

because providerId and ProvenanceClass answer different questions.

## No epistemic rewrite

DEC-0019 preserves:

```text
epistemicClass = ASSERTION
```

Repository/provider identity does not upgrade the datum to OBSERVATION.

## No provider reputation authority

Provider identity does not establish source quality, scientific truth, execution verification or confidence.

The repository namespace must not be used to infer:

- source reliability score;
- scientific qualification;
- execution correctness;
- agronomic outcome.

## No ADR ownership inference

The Source Registry ownership:

```text
organizationId = org-a
tenantId = tenant-a
```

describes ADR governance/storage scope.

It must not become providerId.

## No Source logicalId projection

The ADR Source logicalId is an internal authority identity.

DEC-0019 does not silently publish it as public providerId.

## No semantic-source provider substitution

DEC-0014 semantic-normalization evidence comes from the same upstream repository in the first Gold, but that does not erase source roles.

DEC-0019 consumes the exact DEC-0018 value-source routing.

If future semantic interpretation evidence comes from another provider namespace, it must not replace the provider identity of the value source.

## Reviewer authority

Publication requires an explicit:

`AgronomicRecordedOperationContextSourceProviderIdentityBindingReviewDecision`

or equivalent governed review authority.

The review must bind the exact:

- DEC-0018 provenance classification ref;
- value Source ref;
- value SourceArtifact ref;
- value SourceArtifact content hash;
- source origin locator;
- proposed providerId;
- target semantic/value;
- epistemicClass;
- provenanceClass.

## Proposed mandatory review checks

An accepted review should confirm at least:

1. `CONTEXT_PROVENANCE_CLASSIFICATION_AUTHORITY_VERIFIED`;
2. `EXACT_VALUE_SOURCE_VERIFIED`;
3. `EXACT_VALUE_SOURCE_ARTIFACT_VERIFIED`;
4. `EXACT_VALUE_SOURCE_CONTENT_HASH_VERIFIED`;
5. `EXACT_SOURCE_ORIGIN_LOCATOR_VERIFIED`;
6. `REPOSITORY_PROVIDER_NAMESPACE_VERIFIED`;
7. `PROVIDER_ID_EXACTLY_GITHUB_COM_ISUDATATEAM_DATATEAM`;
8. `PROVENANCE_CLASS_EXTERNAL_PROVIDER_PRESERVED`;
9. `EPISTEMIC_CLASS_ASSERTION_PRESERVED`;
10. `TARGET_CONTEXT_SEMANTIC_VERIFIED`;
11. `TARGET_CONTEXT_VALUE_VERIFIED`;
12. `NO_INSTITUTIONAL_ENTITY_RESOLUTION`;
13. `NO_HOST_ONLY_PROVIDER_ID_COLLAPSE`;
14. `NO_ADR_OWNERSHIP_TO_PROVIDER_INFERENCE`;
15. `NO_SOURCE_LOGICAL_ID_TO_PROVIDER_INFERENCE`;
16. `NO_GENERIC_URL_TO_PROVIDER_RULE`;
17. `NO_SOURCE_REF_WIRE_PROJECTION`;
18. `NO_CONTENT_HASH_WIRE_PROJECTION`;
19. `NO_CONTEXT_DATUM_PUBLICATION`;
20. `NO_AVAILABLE_AT_OR_EFFECTIVE_INTERVAL_INFERENCE`;
21. `NO_TARGET_OR_SPATIAL_PROJECTION`;
22. `NO_UNIT_OR_UNCERTAINTY_INFERENCE`;
23. `NO_DECISION_PROBLEM_OR_POLICY_INFERENCE`;
24. `NO_RUNTIME_EXECUTION_OR_OUTCOME_INFERENCE`;
25. `NO_INVERSE_OR_COMPLETENESS_INFERENCE`.

All mandatory checks are required for accepted publication.

## Proposed review dispositions

At minimum:

- `ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING`;
- `REJECT_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING`.

Rejected review cannot authorize publication.

## Content addressing

Changing any material binding element must change semantic identity or fail review closure, including:

- DEC-0018 predecessor ref;
- value Source ref;
- value SourceArtifact ref;
- value SourceArtifact content hash;
- exact source origin locator;
- providerId;
- provider-identity review ref;
- binding rationale;
- limitations.

## Local completeness

For DEC-0019:

`losslessCoverage = COMPLETE`

means only:

> the first exact providerId binding for the exact DEC-0018 value-source world is represented without inventing sourceRef/contentHash or another ContextDatum field.

It does not mean the ContextDatum source object is complete.

## First real-source Gold

The first Gold must reuse the exact accepted chain:

```text
DEC-0013
  source-recorded occurrence

DEC-0014
  plant_corn -> PLANT / CROP:CORN

DEC-0016
  crop.planting_date = DATE 2011-05-03

DEC-0017
  epistemicClass = ASSERTION

DEC-0018
  exact occurrence Source/SourceArtifact
  provenanceClass = EXTERNAL_PROVIDER
```

Accepted provider binding candidate:

```text
providerId = github.com/isudatateam/datateam
```

The Gold must prove that provider IDs such as `github.com`, `ISU`, `GITHUB`, `org-a`, another repository namespace, or the ADR Source logicalId cannot publish for the same predecessor world.

## Mandatory implementation acceptance cases

If DEC-0019 is accepted, implementation must prove at least:

1. exact DEC-0018 authority is mandatory;
2. exact value Source closure is mandatory;
3. exact value SourceArtifact closure is mandatory;
4. exact artifact content hash is mandatory;
5. exact source origin locator is material;
6. target semantic/value is preserved;
7. epistemicClass `ASSERTION` is preserved;
8. provenanceClass `EXTERNAL_PROVIDER` is preserved;
9. first real-source providerId can publish as `github.com/isudatateam/datateam`;
10. `github.com` fails closed;
11. `isudatateam` fails closed;
12. `github.com/isudatateam` fails closed;
13. another repository namespace fails closed;
14. `ISU` fails closed;
15. `IOWA_STATE_UNIVERSITY` fails closed;
16. `GITHUB` fails closed;
17. ADR ownership `org-a` fails closed;
18. ADR Source logicalId fails closed;
19. Source ref drift fails closed;
20. SourceArtifact ref drift fails closed;
21. SourceArtifact content-hash drift fails closed;
22. source origin-locator drift fails closed;
23. incomplete review cannot publish;
24. unauthorized reviewer cannot publish;
25. rejected review cannot publish;
26. no sourceRef wire field is created;
27. no public source contentHash wire field is created;
28. no ContextDatum/ContextManifest authority is created;
29. no temporal/spatial/unit/uncertainty authority is created;
30. no DecisionProblem/Policy/runtime authority is created;
31. no ExecutionReceipt/Outcome authority is created;
32. no inverse/global completeness rule is created.

At least one positive case must use the exact real Sustainable Corn predecessor chain.

## Proposed first implementation slice

Only after explicit acceptance and accepted documentation merge may implementation begin.

The first implementation slice should contain only:

1. provider identity binding contract;
2. exact DEC-0018 predecessor closure;
3. exact value Source/SourceArtifact/content-hash closure;
4. exact source origin-locator closure;
5. review authority;
6. content-addressed publication/validation;
7. first finite providerId binding;
8. real Sustainable Corn Gold;
9. mandatory fail-closed cases;
10. focused workflow wiring if required.

It must not contain:

- sourceRef public wire projection;
- source contentHash public wire projection;
- ContextDatum publication;
- availableAt;
- effectiveInterval;
- timezone;
- spatialSupport;
- geometry;
- unit;
- uncertainty;
- temporalSupport projection;
- DecisionProblem;
- Policy;
- runtime;
- execution;
- Outcome.

## Future authority chain

If accepted and implemented:

```text
DEC-0013 occurrence
      +
DEC-0014 operation semantic
      |
      v
DEC-0016 semantic/value mapping
      |
      v
DEC-0017 epistemic classification
      |
      v
DEC-0018 provenance classification
      |
      v
DEC-0019 provider identity binding
      |
      +---- future sourceRef/contentHash projection
      +---- future temporal projection
      +---- future target/spatial projection
      +---- future unit/uncertainty projection
      |
      v
future governed ContextDatum projection
```

No downstream arrow is pre-accepted by DEC-0019.

## Explicitly unresolved after DEC-0019

Even if accepted and implemented, the following remain unresolved:

1. ContextDatum source.sourceRef;
2. ContextDatum source.contentHash;
3. exact source-wire hash granularity;
4. effectiveInterval;
5. availableAt;
6. timezone / UTC offset;
7. DAY -> RFC3339 interval interpretation;
8. unit for DATE semantic;
9. uncertainty;
10. temporalSupport projection;
11. DEC-0015 target identity -> spatialSupport;
12. ContextDatum publication;
13. ContextManifest inclusion;
14. field/plot/zone/season identity;
15. cross-provider canonical identity;
16. institutional/provider entity resolution;
17. planned-versus-actual reconciliation;
18. execution reconciliation;
19. Outcome linkage.

## Acceptance targets

Before this architecture may be accepted, review must confirm:

1. providerId is a source/provider namespace, not ProvenanceClass or EpistemicClass;
2. exact DEC-0018 value-source closure is mandatory;
3. repository-level namespace is the accepted first granularity;
4. the exact first providerId is `github.com/isudatateam/datateam`;
5. no institutional entity identity is inferred;
6. no generic URL parsing rule is accepted;
7. no ADR ownership/logicalId mapping is accepted;
8. sourceRef/contentHash wire projection remains unresolved;
9. no ContextDatum publication is implied;
10. no temporal/spatial/unit/uncertainty projection is implied;
11. no DecisionProblem/Policy/runtime/execution/Outcome authority is created;
12. implementation remains additive and does not weaken DEC-0013/0014/0016/0017/0018.

## Post-acceptance gate

Before accepted DEC-0019 documentation may merge:

1. repository-wide ADR Constitution MUST pass on the exact accepted documentation head;
2. PR MUST remain docs-only;
3. no package/runtime/schema/workflow/acceptance mutation may be included;
4. no existing accepted contract may be changed;
5. PR base MUST remain the expected protected `main`;
6. accepted exact head MUST be recorded before merge.

Only after accepted documentation merge and post-merge Constitution success may implementation begin.

## Acceptance

**ACCEPTED — 2026-09-01.**

Explicit architecture approval was provided by the user by instructing continuation under the accepted project plan.

The accepted boundary is the decision exactly as written above: the exact DEC-0018 Sustainable Corn value-source world may bind public ContextDatum `source.providerId` only to the reviewed repository-level provider namespace `github.com/isudatateam/datateam`. No institutional entity resolution, generic URL-to-provider normalization rule, ADR ownership/logicalId projection, public `sourceRef` projection, public `source.contentHash` projection, ContextDatum publication, temporal/spatial/unit/uncertainty projection, DecisionProblem, Policy, runtime, execution, Outcome, inverse mapping, or completeness authority is accepted.
