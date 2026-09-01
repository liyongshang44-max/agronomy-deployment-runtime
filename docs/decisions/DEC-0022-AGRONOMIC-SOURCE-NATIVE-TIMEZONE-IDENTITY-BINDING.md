# DEC-0022 — Governed Agronomic Source-Native Timezone Identity Binding

Status: **ACCEPTED**

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

## Exact co-predecessor closure

The first DEC-0022 authority must require **two exact accepted co-predecessors**:

1. the exact DEC-0021 temporal-support classification compilation;
2. the exact DEC-0015 source-backed target-identity binding compilation.

This is mandatory because DEC-0016 explicitly does not project target identity.
Therefore DEC-0015 is not transitively contained in the DEC-0016 → DEC-0021
authority chain and must not be fabricated as if it were.

Both co-predecessors must be fully revalidated through their own validators.

The DEC-0021 branch must recover at least:

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

DEC-0013
  exact occurrence:
    siteid = SERF
    operation = plant_corn
    date = 2011-05-03
    kind = CALENDAR_DATE
    precision = DAY
```

The DEC-0015 branch must independently recover:

```text
DEC-0015
  sourceNativeSubject = siteid / SERF
  target granularity = FARM

        ↓

same exact DEC-0013 parent occurrence
```

DEC-0022 must then prove **cross-predecessor convergence**:

```text
DEC-0021.parentOccurrenceCompilationRef
==
DEC-0015.parentOccurrenceCompilationRef
```

and the exact source-native subject recovered from DEC-0015 must equal the exact
DEC-0013 occurrence subject recovered through DEC-0021:

```text
siteid = SERF
```

Semantic equality must be canonical/value equality plus exact authority-ref equality
where refs are available; copied labels alone are not authority.

The timezone authority must not trust a copied `SERF` field from either branch
without this two-branch replay and convergence check.

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

## No DST-resolution or TZDB-version authority

DEC-0022 does not decide:

- whether DST was active on 2011-05-03;
- which UTC offset applies at either boundary of a future interval;
- transition rules;
- ambiguous/nonexistent local clock times;
- which IANA Time Zone Database / TZDB release is authoritative for replay.

The retained upstream source uses the zone identifier `America/Chicago`, but the
evidence does not freeze a particular timezone-database release.

A later concrete temporal projection must independently bind the timezone-rule basis
needed for reproducible historical offset resolution.

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
  targetIdentityBindingCompilationRef

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

- DEC-0021 temporal-support predecessor ref;
- DEC-0015 target-identity co-predecessor ref;
- exact cross-predecessor parent-occurrence convergence;
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
2. `TARGET_IDENTITY_BINDING_AUTHORITY_VERIFIED`;
3. `CO_PREDECESSOR_PARENT_OCCURRENCE_REF_EQUAL`;
4. `CO_PREDECESSOR_SOURCE_NATIVE_SUBJECT_EQUAL`;
5. `EXACT_PARENT_OCCURRENCE_VERIFIED`;
6. `EXACT_SOURCE_NATIVE_SUBJECT_SERF`;
7. `EXACT_DECAGON_TIMEZONE_EVIDENCE_ARTIFACT_VERIFIED`;
8. `EXACT_DECAGON_TIMEZONE_EVIDENCE_BLOB_VERIFIED`;
9. `EXACT_WATERTABLE_TIMEZONE_EVIDENCE_ARTIFACT_VERIFIED`;
10. `EXACT_WATERTABLE_TIMEZONE_EVIDENCE_BLOB_VERIFIED`;
11. `SOURCE_NATIVE_SERF_TIMEZONE_IDENTITY_VERIFIED`;
12. `TIMEZONE_SCHEME_IANA_VERIFIED`;
13. `TIMEZONE_ZONE_ID_AMERICA_CHICAGO_VERIFIED`;
14. `NO_OFFSET_INFERENCE`;
15. `NO_DST_RESOLUTION`;
16. `NO_TZDB_VERSION_AUTHORITY`;
17. `NO_CALENDAR_DATE_LOCAL_FRAME_BINDING`;
18. `NO_EFFECTIVE_INTERVAL_CONSTRUCTION`;
19. `NO_AVAILABLE_AT_CONSTRUCTION`;
20. `NO_GEOGRAPHIC_TIMEZONE_INFERENCE`;
21. `NO_GENERIC_SITE_TIMEZONE_RULE`;
22. `NO_UPSTREAM_CODE_EXECUTION_AS_AUTHORITY`;
23. `NO_CONTEXT_DATUM_PUBLICATION`;
24. `NO_UNIT_UNCERTAINTY_SPATIAL_VERTICAL_PROJECTION`;
25. `NO_DECISION_PROBLEM_POLICY_RUNTIME_EXECUTION_OUTCOME`;
26. `NO_INVERSE_OR_COMPLETENESS_INFERENCE`.

All mandatory checks are required for accepted publication.

## Proposed review dispositions

At minimum:

- `ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING`;
- `REJECT_RECORDED_OPERATION_CONTEXT_SOURCE_NATIVE_TIMEZONE_IDENTITY_BINDING`.

Rejected review cannot authorize publication.

## Content addressing

Changing any material element must change semantic identity or fail closure, including:

- DEC-0021 predecessor ref;
- DEC-0015 co-predecessor ref;
- exact shared DEC-0013 parent occurrence ref;
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
2. exact DEC-0015 target-identity authority is independently mandatory;
3. DEC-0021 and DEC-0015 must converge on the same exact DEC-0013 parent occurrence ref;
4. source-native subject recovered from both branches must match exactly;
5. exact DEC-0013 parent occurrence closure is mandatory;
6. exact source-native subject `SERF` is mandatory;
7. exact first timezone-evidence source artifact is mandatory;
8. exact Decagon source blob is mandatory;
9. exact second corroborating timezone-evidence source artifact is mandatory;
10. exact water-table source blob is mandatory;
11. exact `SERF -> America/Chicago` evidence is mandatory;
12. first timezone scheme can publish only as `IANA`;
13. first zoneId can publish only as `America/Chicago`;
14. `America/New_York` fails closed;
15. `US/Central` fails closed;
16. `Central Time` fails closed;
17. `CST` fails closed;
18. `CDT` fails closed;
19. fixed UTC-offset substitution fails closed;
20. source-native subject drift fails closed;
21. source evidence path drift fails closed;
22. source evidence blob/content drift fails closed;
23. incomplete review cannot publish;
24. unauthorized reviewer cannot publish;
25. rejected review cannot publish;
26. no UTC offset authority is created;
27. no DST-resolution authority is created;
28. no TZDB release/version authority is created;
29. no planting-date local-civil-frame binding is created;
30. no effectiveInterval authority is created;
31. no availableAt authority is created;
32. no geographic timezone lookup authority is created;
33. no generic site-to-timezone rule is created;
34. no ContextDatum/ContextManifest authority is created;
35. no unit/uncertainty/spatial/vertical authority is created;
36. no DecisionProblem/Policy/runtime/execution/Outcome authority is created;
37. no inverse/global completeness rule is created.

At least one positive case must use the exact accepted Sustainable Corn predecessor
world.

## Proposed first implementation slice

Only after explicit architecture acceptance and accepted documentation merge may
implementation begin.

The first implementation slice should contain only:

1. source-native timezone identity binding contract;
2. exact DEC-0021 predecessor closure;
3. exact DEC-0015 target-identity co-predecessor closure;
4. exact co-predecessor convergence on one DEC-0013 occurrence;
5. exact DEC-0013 source-native subject closure;
6. retained exact Decagon timezone-evidence artifact;
7. retained exact water-table timezone-evidence artifact;
8. source-evidence replay/verification;
9. review authority;
10. content-addressed publication/validation;
11. exact `SERF -> IANA America/Chicago` first binding;
12. real Sustainable Corn Gold;
13. mandatory fail-closed cases;
14. focused workflow wiring if required.

It must not contain:

- planting-date local-civil-frame interpretation;
- UTC offset resolution;
- DST resolution;
- TZDB release/version binding;
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
2. UTC offset / DST resolution and TZDB-version binding for concrete boundaries;
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
2. DEC-0021 and DEC-0015 are explicit co-predecessors rather than falsely treating DEC-0015 as transitively contained by DEC-0021;
3. both co-predecessors must converge on the same exact DEC-0013 parent occurrence and `SERF` subject;
4. the exact first identity is IANA `America/Chicago`;
5. source-native code evidence is used instead of Iowa/geographic inference;
6. evidence A and B are exact content-addressed source artifacts;
7. the decision binds timezone identity only;
8. no offset, DST result, or TZDB release/version is accepted;
9. no claim is made that planting-date `2011-05-03` is already a local civil day;
10. no effectiveInterval is accepted;
11. no availableAt is accepted;
12. no Frozen ContextDatum contract mutation is accepted;
13. no generic provider/site timezone mapping rule is accepted;
14. no ContextDatum/ContextManifest publication is accepted;
15. no unit/uncertainty/spatial/vertical authority is accepted;
16. no DecisionProblem/Policy/runtime/execution/Outcome authority is accepted;
17. implementation remains additive and does not weaken DEC-0013 through DEC-0021.

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


## Architecture acceptance

**ACCEPTED — 2026-09-01.**

Explicit architecture approval was provided by the user.

The accepted boundary is the decision exactly as written above: for the exact first Sustainable Corn predecessor world, the source-native subject `SERF` may bind to source-native timezone identity `scheme = IANA / zoneId = America/Chicago` using the reviewed content-addressed Sustainable Corn timezone evidence. This acceptance does not authorize planting-date local-civil-frame interpretation, UTC offset, DST resolution, TZDB release/version, concrete effectiveInterval boundaries, availableAt, Frozen ContextDatum mutation, unit/uncertainty/spatial/vertical projection, generic site-to-timezone normalization, DecisionProblem, Policy, runtime, execution, Outcome, inverse mapping, or completeness claims.
