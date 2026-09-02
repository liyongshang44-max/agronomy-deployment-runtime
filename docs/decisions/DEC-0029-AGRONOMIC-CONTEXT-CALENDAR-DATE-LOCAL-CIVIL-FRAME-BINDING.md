# DEC-0029 — Agronomic Context Calendar-Date Local-Civil Frame Binding

Status: **PROPOSED**

Date: 2026-09-02

## Context

The exact first Sustainable Corn planting-date context world now has accepted authority for:

```text
semanticId = crop.planting_date
value = DATE 2011-05-03
temporalSupport.type = INTERVAL

source-native subject = SERF
source-native timezone identity =
  scheme = IANA
  zoneId = America/Chicago
```

The date itself was accepted through DEC-0013/DEC-0016.

The temporal support classification was accepted through DEC-0021.

The source-native timezone identity was accepted through DEC-0022.

DEC-0022 deliberately stopped before asserting that the exact recorded-operation
calendar date is expressed in the civil-day frame of the bound source-native
timezone.

That boundary remains correct.

A fresh source audit confirms:

- the retained operations notebook reads `operations.valid` as the planting date;
- the retained semantic code treats the value as a Python datetime/date-like
  calendar value;
- the source system has direct `SERF -> America/Chicago` timezone-selection
  evidence in other Sustainable Corn time-series paths;
- no retained operations query applies `AT TIME ZONE`, `tz_convert`,
  `tz_localize`, or another explicit timezone conversion to
  `operations.valid`;
- no retained source artifact states that the planting-date field itself is already
  encoded as an America/Chicago civil-day value.

Therefore source evidence alone still does not prove the local-civil frame.

However, a concrete ContextDatum effectiveInterval cannot be produced until ADR makes
an explicit governed interpretation choice about the temporal frame of this exact
calendar-date fact.

## Problem

The accepted facts:

```text
date = 2011-05-03
precision = DAY
timezone identity = America/Chicago
```

are not yet sufficient to authorize:

```text
local civil day =
  2011-05-03 in America/Chicago
```

because timezone identity and date-field temporal frame are distinct semantics.

The following hidden inference is forbidden:

```text
SERF uses America/Chicago somewhere
        ->
every date-like field for SERF is an America/Chicago civil date
```

Likewise, ADR must not use operating-system timezone behavior or a timezone library as
silent semantic authority.

A separate explicit interpretation authority is required.

## Decision

For the exact first Sustainable Corn planting-date world only, authorize ADR to bind:

```text
source calendar date:
  2011-05-03
  precision = DAY

source-native subject:
  SERF

source-native timezone identity:
  IANA America/Chicago

        ->

temporal frame:
  kind = LOCAL_CIVIL_DAY
  civilDate = 2011-05-03
  zoneScheme = IANA
  zoneId = America/Chicago
```

This is an ADR-governed interpretation binding.

It is not a claim that the upstream source explicitly declared:

```text
operations.valid is stored in America/Chicago local civil time
```

The accepted statement is narrower:

> for this exact first context projection, ADR elects to interpret the accepted
> source-recorded DAY-precision calendar date within the already accepted source-native
> SERF timezone identity.

## Why this is a governed interpretation, not a source fact

The retained source directly supports two separate facts:

1. the exact planting operation carries calendar date `2011-05-03`;
2. the source system associates SERF with IANA timezone identity
   `America/Chicago`.

It does not directly contain a third statement joining those facts.

DEC-0029 supplies that join as an explicit semantic policy decision.

This prevents the join from being hidden inside:

- JavaScript Date construction;
- Python datetime/ZoneInfo behavior;
- PostgreSQL session timezone;
- OS timezone defaults;
- CI runner locale;
- runtime host locale;
- generic geographic knowledge.

## Exact direct predecessor

The direct predecessor is the exact accepted
`AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilation`
from DEC-0022.

That predecessor must be fully revalidated through its own validator.

The revalidated predecessor must close exactly to:

```text
targetContextSemantic:
  semanticId = crop.planting_date
  value.type = DATE
  value.date = 2011-05-03

source temporal descriptor:
  kind = CALENDAR_DATE
  date = 2011-05-03
  precision = DAY

source-native subject:
  identifierName = siteid
  code = SERF

sourceTimezone:
  scheme = IANA
  zoneId = America/Chicago
```

The implementation must not accept a caller-provided zone or date independently of
the validated predecessor.

## Exact first temporal-frame binding

The only accepted first binding is:

```text
temporalFrame {
  kind = LOCAL_CIVIL_DAY
  civilDate = 2011-05-03
  zoneScheme = IANA
  zoneId = America/Chicago
}
```

Changing the date, source subject, zone scheme or zone id is material.

## No UTC boundary authority

DEC-0029 does not authorize any concrete RFC3339 interval boundary.

It does not establish:

```text
effectiveInterval.start
effectiveInterval.end
```

It does not establish any UTC instant.

A later authority must independently bind an exact historical timezone-rule basis
and resolve this local civil day into concrete boundaries.

## No UTC offset authority

DEC-0029 does not establish:

- `-05:00`;
- `-06:00`;
- any other UTC offset.

It does not determine whether daylight saving time was active on 2011-05-03.

## No DST authority

DEC-0029 creates no DST-state result.

It does not establish:

- STANDARD;
- DAYLIGHT;
- transition state;
- ambiguous/nonexistent local time handling.

## No TZDB authority

DEC-0029 does not select or freeze a timezone-database release.

It does not establish:

- tzdata version;
- IANA tzdb release;
- historical rule file;
- zoneinfo package version;
- OS timezone database version.

A later concrete boundary-resolution authority must explicitly bind that dependency.

## No generic DATE-to-local-frame rule

DEC-0029 must not establish:

```text
all DATE values use the source timezone
```

or:

```text
all SERF date fields use America/Chicago
```

or:

```text
all planting dates are local civil dates
```

The first binding is finite to:

```text
crop.planting_date
DATE 2011-05-03
exact Sustainable Corn predecessor world
```

## No provider-global rule

DEC-0029 does not establish:

```text
github.com/isudatateam/datateam
  -> all dates use America/Chicago
```

Other sites in the same provider may use different timezone identities.

Other source fields may have timestamp semantics independent of this calendar-date
binding.

## No geographic inference

The interpretation does not derive timezone from:

- Iowa;
- SERF display name;
- coordinates;
- farm address;
- state boundary;
- generic timezone lookup.

The zone identity must come only from accepted DEC-0022 authority.

## No source mutation

DEC-0029 does not modify:

- occurrence evidence;
- sourceRef;
- contentHash;
- providerId;
- source artifact;
- source-native date.

The source fact remains `2011-05-03`.

## No effective-time narrowing beyond DAY

DEC-0021 remains the temporal-support classification authority.

DEC-0029 does not claim a planting instant, planting hour, or exact operation
duration.

The semantic remains one local civil day at DAY precision.

## No availableAt mutation

DEC-0028 remains the availability authority.

DEC-0029 does not modify:

```text
availableAt = 2026-08-30T13:00:00.000Z
```

Availability chronology and effective-time chronology remain distinct.

## No ContextDatum publication

DEC-0029 does not create or publish ContextDatum.

It creates only the missing temporal-frame interpretation authority required before
concrete effectiveInterval resolution.

No ContextManifest, DecisionProblem, AuthorizedContextReference or
ResolvedContextDatumReceipt is created.

## Authority shape

Introduce a content-addressed authority:

`AgronomicContextCalendarDateLocalCivilFrameBindingCompilation`

Conceptually:

```text
AgronomicContextCalendarDateLocalCivilFrameBindingCompilation {
  contractVersion

  bindingId

  parentSourceNativeTimezoneIdentityBindingCompilationRef

  targetContextSemantic {
    semanticId
    value
  }

  sourceTemporalDescriptor {
    kind = CALENDAR_DATE
    date = 2011-05-03
    precision = DAY
  }

  sourceNativeSubject {
    identifierName = siteid
    code = SERF
  }

  sourceTimezone {
    scheme = IANA
    zoneId = America/Chicago
  }

  temporalFrame {
    kind = LOCAL_CIVIL_DAY
    civilDate = 2011-05-03
    zoneScheme = IANA
    zoneId = America/Chicago
  }

  interpretationClass =
    ADR_GOVERNED_SOURCE_DATE_FRAME_BINDING

  rationale
  semanticReviewRef
  compilationHash
  limitations
}
```

Exact implementation field names remain implementation-level after architecture
acceptance.

## Reviewer authority

Publication requires an explicit:

`AgronomicContextCalendarDateLocalCivilFrameBindingReviewDecision`

or equivalent governed review authority.

The review must bind the exact:

- DEC-0022 predecessor ref;
- target semantic/value;
- source calendar date;
- DAY precision;
- source-native subject SERF;
- timezone scheme IANA;
- timezone id America/Chicago;
- temporal-frame kind LOCAL_CIVIL_DAY;
- interpretation class;
- explicit non-source-claim rationale.

## Mandatory review checks

An accepted review should confirm at least:

1. `PARENT_SOURCE_NATIVE_TIMEZONE_AUTHORITY_VERIFIED`;
2. `EXACT_TARGET_CONTEXT_SEMANTIC_VERIFIED`;
3. `EXACT_SOURCE_CALENDAR_DATE_VERIFIED`;
4. `EXACT_SOURCE_DAY_PRECISION_VERIFIED`;
5. `EXACT_SOURCE_NATIVE_SUBJECT_SERF_VERIFIED`;
6. `EXACT_TIMEZONE_SCHEME_IANA_VERIFIED`;
7. `EXACT_TIMEZONE_ZONE_ID_AMERICA_CHICAGO_VERIFIED`;
8. `LOCAL_CIVIL_DAY_FRAME_EXPLICITLY_AUTHORIZED`;
9. `CIVIL_DATE_EQUALS_SOURCE_CALENDAR_DATE`;
10. `FRAME_ZONE_EQUALS_ACCEPTED_SOURCE_NATIVE_TIMEZONE`;
11. `ADR_INTERPRETATION_NOT_UPSTREAM_SOURCE_CLAIM`;
12. `NO_GENERIC_DATE_TO_SOURCE_TIMEZONE_RULE`;
13. `NO_PROVIDER_GLOBAL_TIMEZONE_RULE`;
14. `NO_GEOGRAPHIC_TIMEZONE_INFERENCE`;
15. `NO_UTC_OFFSET_RESOLUTION`;
16. `NO_DST_RESOLUTION`;
17. `NO_TZDB_VERSION_BINDING`;
18. `NO_EFFECTIVE_INTERVAL_BOUNDARIES`;
19. `NO_AVAILABLE_AT_MUTATION`;
20. `NO_SOURCE_PROJECTION_MUTATION`;
21. `NO_CONTEXT_DATUM_PUBLICATION`;
22. `NO_CONTEXT_MANIFEST_OR_DECISION_PROBLEM_PUBLICATION`;
23. `NO_POLICY_RUNTIME_EXECUTION_OR_OUTCOME_INFERENCE`.

All mandatory checks are required for accepted publication.

## Review dispositions

At minimum:

- `ACCEPT_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING`;
- `REJECT_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING`.

Rejected review cannot authorize publication.

## Content addressing

Changing any material element must change semantic identity or fail review closure,
including:

- DEC-0022 predecessor ref;
- target semantic/value;
- source calendar date;
- source precision;
- source-native subject;
- timezone scheme;
- timezone zoneId;
- temporal-frame kind;
- civil date;
- interpretation class;
- rationale;
- semantic review decision.

## First Gold

The first Gold should replay the exact accepted DEC-0022 Sustainable Corn world and
prove only:

```text
crop.planting_date = DATE 2011-05-03

source temporal descriptor:
  CALENDAR_DATE
  2011-05-03
  DAY

source-native subject:
  SERF

accepted source-native timezone:
  IANA America/Chicago

        ->

ADR temporal frame:
  LOCAL_CIVIL_DAY
  civilDate = 2011-05-03
  zoneId = America/Chicago
```

The Gold must fail closed for at least:

- wrong predecessor authority;
- predecessor ref drift;
- target semantic/value drift;
- source date drift;
- precision drift;
- source subject drift;
- timezone scheme drift;
- timezone id drift;
- caller-supplied alternate zone;
- UTC offset injection;
- DST result injection;
- TZDB-version injection;
- effectiveInterval boundary injection;
- generic DATE rule;
- provider-global timezone rule;
- geographic inference claim;
- incomplete review;
- unauthorized reviewer;
- rejected review;
- review/publication mismatch.

## Consequences

Positive:

- closes the explicit semantic seam left open by DEC-0022;
- makes the date/timezone join visible, reviewable and content-addressed;
- prevents host/runtime timezone behavior from becoming hidden authority;
- preserves the distinction between source fact and ADR interpretation;
- prepares the exact local civil day required for later historical timezone-rule
  resolution.

Costs:

- this is an ADR interpretation choice, not a source-native field declaration;
- a separate historical timezone-rule authority is still mandatory;
- effectiveInterval remains unresolved after this DEC;
- the first ContextDatum still cannot be published after this DEC alone.

## Remaining work after acceptance

After DEC-0029 is accepted and implemented, the first planting-date temporal path
still requires one dedicated concrete boundary-resolution authority.

That next authority must bind:

1. an exact timezone-rule source/version for `America/Chicago`;
2. the exact historical rule applicable to local civil day `2011-05-03`;
3. concrete RFC3339 start/end boundaries;
4. explicit handling of interval semantics;
5. exact audit/provenance of the rule resolution.

Only after that effectiveInterval seam is closed should ADR perform final
ContextDatum assembly/publication audit.

DEC-0029 does not pre-authorize either step.
