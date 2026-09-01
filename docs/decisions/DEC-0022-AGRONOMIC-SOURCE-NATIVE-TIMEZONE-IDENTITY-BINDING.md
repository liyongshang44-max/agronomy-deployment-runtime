# DEC-0022 — Governed Agronomic Source-Native Timezone Identity Binding

Status: **PROPOSED**

Date: 2026-09-01

## Context

DEC-0021 establishes the first governed temporal-support classification for the exact
Sustainable Corn recorded-operation predecessor world:

```text
source:
  siteid = SERF
  date = 2011-05-03
  temporalSupport:
    kind = CALENDAR_DATE
    precision = DAY

        ->

Context:
  semanticId = crop.planting_date
  value = DATE 2011-05-03
  temporalSupport.type = INTERVAL
```

DEC-0021 deliberately does not establish:

- an IANA timezone;
- a UTC offset;
- DST interpretation;
- a claim that the source calendar date is a local civil day;
- concrete `effectiveInterval.start/end`;
- `availableAt`.

The Frozen Context Contract requires concrete `effective_interval` boundaries to be
RFC3339 timestamps. Therefore a future concrete DAY-to-timestamp projection cannot
legally invent a timezone.

The previously accepted DEC-0015 identity chain establishes the exact source-native
subject:

```text
siteid = SERF
target granularity = FARM
```

but DEC-0015 intentionally did not infer timezone from `IA`, geographic background
knowledge, address, coordinates, or any external timezone database.

A separate source audit now finds direct Sustainable Corn source-native timezone
identity evidence keyed by the same `SERF` site identifier.

## Exact source-native timezone evidence

The first evidence set is from the same public upstream repository already used by
the accepted Sustainable Corn chain:

```text
repository:
  isudatateam/datateam
```

### Evidence A — Decagon site-time handling

Path:

```text
src/isudatateam/cscap/plot_decagon.py
```

Exact Git blob:

```text
db36925e79a8858968ac846bb0713162372cd0ec
```

The exact source contains:

```python
tzname = (
    "America/Chicago"
    if uniqueid in ["ISUAG", "SERF", "GILMORE"]
    else "America/New_York"
)
```

and subsequently applies that value through Python `ZoneInfo`:

```python
df["v"] = df["v"].apply(lambda x: x.astimezone(ZoneInfo(tzname)))
```

For the exact source-native site identifier `SERF`, this code directly selects the
IANA timezone identifier:

```text
America/Chicago
```

### Evidence B — Water-table site-time handling

Path:

```text
src/isudatateam/cscap/plot_watertable.py
```

Exact Git blob:

```text
9d9f7e343acfe996f155a007fd0004b60e4bd606
```

The source independently contains the same site-keyed mapping:

```python
tzname = (
    "America/Chicago"
    if uniqueid in ["ISUAG", "SERF", "GILMORE"]
    else "America/New_York"
)
```

and uses that timezone value in both SQL time-zone conversion and pandas timezone
conversion.

This second path is corroborating source-native evidence that `SERF` is handled
under the `America/Chicago` timezone identity in the Sustainable Corn system.

### License

The upstream repository license is retained under exact Git blob:

```text
5c60615bfae390b40fe6fa096942c65b5b074ca7
```

## Important evidence limitation

The two exact code paths above are site/time handling for Sustainable Corn
sensor/measurement views.

They establish a source-native timezone identity associated with the site identifier
`SERF`.

They do **not** by themselves establish that every other Sustainable Corn data family
uses that timezone in the same way.

Most importantly, they do not prove that the separate recorded-operation value:

```text
plant_corn
date = 2011-05-03
```

must already be interpreted as:

```text
2011-05-03 in America/Chicago local civil time
```

That is a later and distinct temporal-frame binding question.

DEC-0022 therefore must stop at timezone identity.

## Decision

Introduce a distinct content-addressed authority for the exact first Sustainable Corn
world:

`AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilation`

Its narrow purpose is:

> bind the exact source-native subject identifier `SERF`, under exact DEC-0021
> predecessor closure, to the reviewed source-native IANA timezone identity
> `America/Chicago`, without yet applying that timezone to the planting-date
> calendar value or constructing timestamp boundaries.

For the first finite slice, the only accepted mapping is:

```text
sourceNativeSubject:
  code = SERF

        ->

sourceTimezone:
  scheme = IANA
  zoneId = America/Chicago
```

## What the binding means

The accepted statement would mean only:

> the reviewed Sustainable Corn source code identifies the source-native site
> `SERF` with IANA timezone identity `America/Chicago` in the exact first
> authority world.

The binding does not mean:

> `2011-05-03` has already been converted into an interval.

It does not mean:

> the planting-date value is proven to use local midnight in
> `America/Chicago`.

It does not mean:

> the UTC offset on 2011-05-03 is already known or authorized.

## Exact predecessor closure

The first DEC-0022 authority must require the exact accepted DEC-0021 compilation.

That predecessor must be fully revalidated through its own validator.

The validator must recover at least:

```text
DEC-0021
  temporalSupport.type = INTERVAL

DEC-0020
  exact public sourceRef/contentHash

DEC-0019
  providerId = github.com/isudatateam/datateam

DEC-0018
  provenanceClass = EXTERNAL_PROVIDER

DEC-0017
  epistemicClass = ASSERTION

DEC-0016
  crop.planting_date = DATE 2011-05-03

DEC-0015
  exact source-native target identity = SERF / FARM

DEC-0013
  exact occurrence:
    siteid = SERF
    operation = plant_corn
    date = 2011-05-03
    kind = CALENDAR_DATE
    precision = DAY
```

The timezone authority must not trust a copied `SERF` field without predecessor
revalidation.

## Exact timezone-evidence closure

The first authority must bind the reviewed timezone identity to exact retained
source evidence.

At minimum the first Gold must retain and verify:

1. `src/isudatateam/cscap/plot_decagon.py`;
2. exact blob `db36925e79a8858968ac846bb0713162372cd0ec`;
3. the exact `SERF -> America/Chicago` timezone-selection evidence;
4. `src/isudatateam/cscap/plot_watertable.py`;
5. exact blob `9d9f7e343acfe996f155a007fd0004b60e4bd606`;
6. the independent matching `SERF -> America/Chicago` evidence;
7. the exact upstream license blob.

Changing evidence path, blob identity, subject code, or zone identifier must change
semantic identity or fail closed.

## Exact first source-native subject

The first timezone binding is finite to:

```text
SERF
```

It does not authorize bindings for:

- `ISUAG`;
- `GILMORE`;
- any other Sustainable Corn site;
- arbitrary Iowa farms;
- arbitrary provider targets.

Even though the same source code includes other site identifiers, DEC-0022 reviews
only the exact predecessor subject `SERF`.

## Exact first timezone identity

The only accepted first-slice timezone identity is:

```text
scheme = IANA
zoneId = America/Chicago
```

The following are not accepted substitutes for the same first authority:

```text
Central Time
CST
CDT
US/Central
UTC-06:00
UTC-05:00
America/New_York
Etc/UTC
```

Some aliases or offsets may describe related temporal facts, but they are not the
exact reviewed first identity.

## No UTC-offset authority

DEC-0022 does not establish:

```text
offset = -06:00
offset = -05:00
```

An IANA zone identity and an offset at a particular instant are different authority
claims.

The source also contains historical ingestion code that sometimes uses fixed
standard-time offsets for particular sensor files. DEC-0022 does not generalize those
ingestion details into the recorded-operation calendar-date world.

## No DST-resolution authority

DEC-0022 does not decide:

- whether DST was active on 2011-05-03;
- which UTC offset applies at either boundary of a future interval;
- transition rules;
- ambiguous/nonexistent local clock times.

A later authority may resolve IANA zone rules for a concrete temporal projection.

## No calendar-date temporal-frame binding

This is a mandatory boundary.

DEC-0022 does not establish:

```text
source date 2011-05-03
=
local civil date 2011-05-03 in America/Chicago
```

The accepted occurrence is a source-recorded `CALENDAR_DATE` with DAY precision.

Knowing the site's source-native timezone identity does not automatically prove that
this specific data field is encoded in that timezone's civil-day frame.

A later authority must explicitly decide whether the exact recorded-operation date
may consume the bound source-native timezone for civil-day interpretation.

## No effectiveInterval authority

DEC-0022 creates no:

```text
effectiveInterval.start
effectiveInterval.end
```

In particular it does not infer any of:

```text
2011-05-03T00:00:00-05:00
2011-05-04T00:00:00-05:00
2011-05-03T05:00:00Z
2011-05-04T05:00:00Z
2011-05-03T06:00:00Z
2011-05-04T06:00:00Z
```

No timestamp boundary is accepted by this decision.

## No availableAt authority

DEC-0022 does not select any clock as ContextDatum `availableAt`.

Source event date, provider publication time, Git history, SourceArtifact acquisition,
ADR ingestion, review and publication remain separate clocks.

## No timezone field is added to ContextDatum

The Frozen ContextDatum public shape does not currently expose a standalone timezone
field.

DEC-0022 therefore creates an internal governed predecessor authority for future
temporal projection.

It does not mutate the Frozen ContextDatum contract.

## No geographic inference

DEC-0022 does not derive timezone from:

- `IA`;
- Crawfordsville;
- Washington County;
- latitude/longitude;
- farm geometry;
- postal address;
- general geographic knowledge;
- an external timezone lookup service.

The first binding is source-native, not geocoded.

## No generic site-to-timezone rule

DEC-0022 does not create a global normalizer such as:

```text
Iowa -> America/Chicago
```

or:

```text
site code in source code list -> timezone
```

for arbitrary providers.

It accepts only the exact first source-backed `SERF` binding.

## No generic code-execution authority

The retained Python artifacts are reviewed source evidence.

ADR does not execute arbitrary upstream code in order to grant timezone authority.

The first implementation should replay/verify the exact evidence representation and
content identity, not import or execute upstream application code as trusted runtime
logic.

## No ContextDatum publication

DEC-0022 creates no:

- ContextDatum;
- ContextManifest;
- AuthorizedContextReference;
- ResolvedContextDatumReceipt.

The first ContextDatum remains incomplete after DEC-0022.

## No other Context dimensions

DEC-0022 does not decide:

- DATE unit representation;
- uncertainty;
- spatialSupport;
- geometryRef;
- verticalSupport;
- datum_id;
- ContextDatum publication authorization.

## No decision/runtime authority

DEC-0022 creates no:

- DecisionProblem;
- Policy;
- RuntimeProfile;
- RuntimePlan;
- RuntimeEligibility;
- RuntimeBinding;
- DecisionResult;
- ExecutionReceipt;
- Outcome.

## Proposed authority shape

Conceptually:

```text
AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBinding {
  contractVersion

  bindingId

  temporalSupportClassificationCompilationRef

  sourceNativeSubject {
    code
  }

  timezoneEvidence [
    {
      sourceRef
      sourceArtifactRef
      sourceArtifactContentHash
      sourceLocator
    }
  ]

  sourceTimezone {
    scheme
    zoneId
  }

  bindingRationale
}
```

Publication compilation should additionally contain:

- binding hash;
- timezone review ref;
- local lossless coverage;
- explicit limitations.

Exact implementation field names remain implementation-level after architecture
acceptance.

## Reviewer authority

Publication requires an explicit:

`AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingReviewDecision`

or equivalent governed review authority.

The review must bind the exact:

- DEC-0021 predecessor ref;
- DEC-0013 source-native subject `SERF`;
- exact retained timezone-evidence source refs;
- exact retained SourceArtifact refs;
- exact SourceArtifact content hashes;
- exact source locators/evidence slices;
- `scheme = IANA`;
- `zoneId = America/Chicago`;
- explicit nonclaims.

## Proposed mandatory review checks

An accepted review should confirm at least:

1. `TEMPORAL_SUPPORT_CLASSIFICATION_AUTHORITY_VERIFIED`;
2. `EXACT_PARENT_OCCURRENCE_VERIFIED`;
3. `EXACT_SOURCE_NATIVE_SUBJECT_SERF`;
4. `EXACT_DECAGON_TIMEZONE_EVIDENCE_ARTIFACT_VERIFIED`;
5. `EXACT_DECAGON_TIMEZONE_EVIDENCE_BLOB_VERIFIED`;
6. `EXACT_WATERTABLE_TIMEZONE_EVIDENCE_ARTIFACT_VERIFIED`;
7. `EXACT_WATERTABLE_TIMEZONE_EVIDENCE_BLOB_VERIFIED`;
8. `SOURCE_NATIVE_SERF_TIMEZONE_IDENTITY_VERIFIED`;
9. `TIMEZONE_SCHEME_IANA_VERIFIED`;
10. `TIMEZONE_ZONE_ID_AMERICA_CHICAGO_VERIFIED`;
11. `NO_OFFSET_INFERENCE`;
12. `NO_DST_RESOLUTION`;
13. `NO_CALENDAR_DATE_LOCAL_FRAME_BINDING`;
14. `NO_EFFECTIVE_INTERVAL_CONSTRUCTION`;
15. `NO_AVAILABLE_AT_CONSTRUCTION`;
16. `NO_GEOGRAPHIC_TIMEZONE_INFERENCE`;
17. `NO_GENERIC_SITE_TIMEZONE_RULE`;
18. `NO_UPSTREAM_CODE_EXECUTION_AS_AUTHORITY`;
19. `NO_CONTEXT_DATUM_PUBLICATION`;
20. `NO_UNIT_UNCERTAINTY_SPATIAL_VERTICAL_PROJECTION`;
21. `NO_DECISION_PROBLEM_POLICY_RUNTIME_EXECUTION_OUTCOME`;
22. `NO_INVERSE_OR_COMPLETENESS_INFERENCE`.

All mandatory checks are required for accepted publication.

## Proposed review dispositions

At minimum:

- `ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING`;
- `REJECT_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING`.

Rejected review cannot authorize publication.

## Content addressing

Changing any material element must change semantic identity or fail closure, including:

- DEC-0021 predecessor ref;
- source-native subject code;
- evidence Source refs;
- evidence SourceArtifact refs;
- evidence SourceArtifact content hashes;
- exact source locators/evidence slices;
- timezone scheme;
- timezone zoneId;
- review ref;
- rationale;
- limitations.

## Local completeness

For DEC-0022:

`losslessCoverage = COMPLETE`

would mean only:

> the exact first source-native timezone identity binding `SERF -> IANA
> America/Chicago` is represented with exact source evidence and predecessor closure.

It would not mean temporal projection is complete.

## First real-source Gold

The first Gold must reuse the exact accepted predecessor chain through DEC-0021 and
retain the exact Sustainable Corn timezone-evidence artifacts.

Positive binding:

```text
sourceNativeSubject.code = SERF

sourceTimezone:
  scheme = IANA
  zoneId = America/Chicago
```

The Gold must prove that aliases, offsets, different zone IDs, target drift, evidence
artifact drift, incomplete review, unauthorized review and rejected review cannot
publish for the same first predecessor world.

## Mandatory implementation acceptance cases

If DEC-0022 is accepted, implementation must prove at least:

1. exact DEC-0021 authority is mandatory;
2. exact DEC-0013 parent occurrence closure is mandatory;
3. exact source-native subject `SERF` is mandatory;
4. exact first timezone-evidence source artifact is mandatory;
5. exact Decagon source blob is mandatory;
6. exact second corroborating timezone-evidence source artifact is mandatory;
7. exact water-table source blob is mandatory;
8. exact `SERF -> America/Chicago` evidence is mandatory;
9. first timezone scheme can publish only as `IANA`;
10. first zoneId can publish only as `America/Chicago`;
11. `America/New_York` fails closed;
12. `US/Central` fails closed;
13. `Central Time` fails closed;
14. `CST` fails closed;
15. `CDT` fails closed;
16. fixed UTC-offset substitution fails closed;
17. source-native subject drift fails closed;
18. source evidence path drift fails closed;
19. source evidence blob/content drift fails closed;
20. incomplete review cannot publish;
21. unauthorized reviewer cannot publish;
22. rejected review cannot publish;
23. no UTC offset authority is created;
24. no DST-resolution authority is created;
25. no planting-date local-civil-frame binding is created;
26. no effectiveInterval authority is created;
27. no availableAt authority is created;
28. no geographic timezone lookup authority is created;
29. no generic site-to-timezone rule is created;
30. no ContextDatum/ContextManifest authority is created;
31. no unit/uncertainty/spatial/vertical authority is created;
32. no DecisionProblem/Policy/runtime/execution/Outcome authority is created;
33. no inverse/global completeness rule is created.

At least one positive case must use the exact accepted Sustainable Corn predecessor
world.

## Proposed first implementation slice

Only after explicit architecture acceptance and accepted documentation merge may
implementation begin.

The first implementation slice should contain only:

1. source-native timezone identity binding contract;
2. exact DEC-0021 predecessor closure;
3. exact DEC-0013 source-native subject closure;
4. retained exact Decagon timezone-evidence artifact;
5. retained exact water-table timezone-evidence artifact;
6. source-evidence replay/verification;
7. review authority;
8. content-addressed publication/validation;
9. exact `SERF -> IANA America/Chicago` first binding;
10. real Sustainable Corn Gold;
11. mandatory fail-closed cases;
12. focused workflow wiring if required.

It must not contain:

- planting-date local-civil-frame interpretation;
- UTC offset resolution;
- DST resolution;
- effectiveInterval;
- availableAt;
- unit;
- uncertainty;
- spatialSupport;
- verticalSupport;
- ContextDatum;
- ContextManifest;
- DecisionProblem;
- Policy;
- runtime;
- execution;
- Outcome.

## Future temporal chain

If accepted and implemented, the temporal frontier would become:

```text
DEC-0016
DATE semantic/value
        ↓
DEC-0021
temporalSupport.type = INTERVAL
        ↓
DEC-0022
SERF source-native timezone identity
= IANA America/Chicago
        ↓
future explicit calendar-date temporal-frame binding
        ↓
future concrete IANA-zone/date boundary resolution
        ↓
future effectiveInterval projection
        ↓
future availableAt authority
        ↓
future governed ContextDatum projection
```

The additional calendar-date temporal-frame seam is intentional.

A site timezone identity does not by itself prove how an unrelated date-only field is
encoded.

## Remaining seams after DEC-0022

Even if DEC-0022 is accepted and implemented, at least the following remain unresolved:

1. whether `2011-05-03` consumes the SERF source-native timezone as a local civil day;
2. UTC offset / DST resolution for concrete boundaries;
3. DAY -> RFC3339 effectiveInterval bounds;
4. availableAt;
5. DATE semantic unit representation;
6. uncertainty;
7. target identity -> spatialSupport;
8. verticalSupport null/applicability;
9. ContextDatum datum_id;
10. ContextDatum publication authority;
11. ContextManifest inclusion;
12. field/plot/zone/season identity;
13. planned-versus-actual reconciliation;
14. execution reconciliation;
15. Outcome linkage.

## Acceptance targets

Before this architecture may be accepted, review must confirm:

1. direct source-native timezone evidence exists for `SERF`;
2. the exact first identity is IANA `America/Chicago`;
3. source-native code evidence is used instead of Iowa/geographic inference;
4. evidence A and B are exact content-addressed source artifacts;
5. the decision binds timezone identity only;
6. no offset or DST result is accepted;
7. no claim is made that planting-date `2011-05-03` is already a local civil day;
8. no effectiveInterval is accepted;
9. no availableAt is accepted;
10. no Frozen ContextDatum contract mutation is accepted;
11. no generic provider/site timezone mapping rule is accepted;
12. no ContextDatum/ContextManifest publication is accepted;
13. no unit/uncertainty/spatial/vertical authority is accepted;
14. no DecisionProblem/Policy/runtime/execution/Outcome authority is accepted;
15. implementation remains additive and does not weaken DEC-0013 through DEC-0021.

## Post-acceptance gate

Before accepted DEC-0022 documentation may merge:

1. repository-wide ADR Constitution MUST pass on the exact accepted documentation head;
2. PR MUST remain docs-only;
3. no package/runtime/schema/workflow/acceptance mutation may be included;
4. no existing accepted contract may be changed;
5. PR base MUST remain the expected protected `main`;
6. accepted exact head MUST be recorded before merge.

Only after accepted documentation merge and post-merge Constitution success may
implementation begin.
