# DEC-0030 — Agronomic Context Historical Timezone Boundary Resolution

Status: **ACCEPTED**

Date: 2026-09-02

## Context

The exact first Sustainable Corn planting-date context world now has accepted
authority for:

```text
semanticId = crop.planting_date
value = DATE 2011-05-03

temporalSupport.type = INTERVAL

availableAt =
  2026-08-30T13:00:00.000Z

source-native timezone identity =
  scheme = IANA
  zoneId = America/Chicago

ADR temporal frame =
  kind = LOCAL_CIVIL_DAY
  civilDate = 2011-05-03
  zoneId = America/Chicago
```

DEC-0029 deliberately stops before UTC offset, DST state, timezone-database version
or concrete effectiveInterval boundaries.

The frozen ContextDatum contract requires:

```text
effectiveInterval {
  start: RFC3339
  end: RFC3339
}
```

and canonicalizes RFC3339 timestamps to UTC ISO strings.

Therefore the first ContextDatum still cannot be assembled until the exact local
civil day is resolved against an exact historical timezone-rule authority.

## External timezone-rule authority

The proposed first rule source is the official IANA Time Zone Database release:

```text
release = 2026c
released = 2026-07-08
official data artifact = tzdata2026c.tar.gz
```

The IANA release announcement binds release 2026c to development commit:

```text
71f28b9ab3b67c0f9466803f6151812d4fc8e357
```

and publishes the SHA-512 checksum for the exact data-only release artifact:

```text
tzdata2026c.tar.gz
SHA-512 =
e0b4b7044b66fbc27bc21d13d18063abcdf78ab58d5ba5fd64bd1a88d86e9d495f45add4d8e65bb6c40249f9c94ca29b72c8ebba8d0e4c468f2965ac77932ef0
```

The version-numbered release artifact must be used.

The mutable convenience URL `tzdata-latest.tar.gz` is not authority.

## Exact IANA rule material

Within release 2026c, file `northamerica` establishes the modern US daylight rules:

```text
Rule US 2007 max - Mar Sun>=8 2:00 1:00 D
Rule US 2007 max - Nov Sun>=1 2:00 0    S
```

and the America/Chicago zone continuation:

```text
Zone America/Chicago ...
     -6:00 US C%sT
```

For 2011:

```text
second Sunday in March = 2011-03-13
first Sunday in November = 2011-11-06
```

The exact local civil day:

```text
2011-05-03
```

falls strictly after the 2011 spring transition and before the 2011 fall
transition.

Therefore under the pinned IANA 2026c rule world:

```text
base standard offset = -06:00
active US daylight save = +01:00
effective local UTC offset = -05:00
DST state = DAYLIGHT
```

for the entire exact local civil day 2011-05-03.

## Problem

ADR must not obtain the effectiveInterval by calling the host runtime's timezone
library and accepting whatever rule database happens to be installed.

The following are not acceptable authority:

- Node.js `Date` timezone rules;
- Python `zoneinfo` installed data;
- operating-system `/usr/share/zoneinfo`;
- ICU bundled timezone data;
- database-server timezone tables;
- browser timezone behavior;
- current IANA `latest` link without a fixed release;
- geographic common knowledge.

A concrete historical rule source/version must be content-addressed and reviewed.

## Decision

For the exact first accepted DEC-0029 local-civil-day world only, authorize the
historical timezone-rule resolution:

```text
local civil day:
  2011-05-03
  zoneId = America/Chicago

pinned rule authority:
  IANA tzdb release = 2026c
  artifact = tzdata2026c.tar.gz
  exact SHA-512 =
    e0b4b7044b66fbc27bc21d13d18063abcdf78ab58d5ba5fd64bd1a88d86e9d495f45add4d8e65bb6c40249f9c94ca29b72c8ebba8d0e4c468f2965ac77932ef0
  rule file = northamerica

resolved state:
  baseOffset = -06:00
  daylightSave = +01:00
  effectiveOffset = -05:00
  dstState = DAYLIGHT

local boundaries:
  start = 2011-05-03T00:00:00-05:00
  end   = 2011-05-04T00:00:00-05:00

canonical ContextDatum boundaries:
  effectiveInterval.start = 2011-05-03T05:00:00.000Z
  effectiveInterval.end   = 2011-05-04T05:00:00.000Z
```

The canonical public values are the two UTC `Z` timestamps because the frozen
ContextDatum timestamp normalizer canonicalizes equivalent RFC3339 offset forms to
`Date.toISOString()`.

## Exact direct predecessor

The direct predecessor is the exact accepted
`AgronomicContextCalendarDateLocalCivilFrameBindingCompilation` from DEC-0029.

That predecessor must be fully revalidated through its own authority validator.

It must close exactly to:

```text
targetContextSemantic:
  semanticId = crop.planting_date
  value.type = DATE
  value.date = 2011-05-03

sourceTemporalDescriptor:
  kind = CALENDAR_DATE
  date = 2011-05-03
  precision = DAY

sourceNativeSubject:
  identifierName = siteid
  code = SERF

sourceTimezone:
  scheme = IANA
  zoneId = America/Chicago

temporalFrame:
  kind = LOCAL_CIVIL_DAY
  civilDate = 2011-05-03
  zoneScheme = IANA
  zoneId = America/Chicago

interpretationClass =
  ADR_GOVERNED_SOURCE_DATE_FRAME_BINDING
```

Caller-provided date, zone, offset or boundaries are not authority.

## Exact timezone-rule source retention

Implementation must retain exact reviewed timezone-rule evidence.

At minimum it must retain and content-address:

1. exact official IANA 2026c release identity;
2. exact `tzdata2026c.tar.gz` release artifact identity/checksum;
3. exact `northamerica` rule material required for:
   - US 2007+ spring rule;
   - US 2007+ fall rule;
   - America/Chicago base/rule binding;
4. exact reviewed derivation of the 2011 transition dates.

The authority validator must replay the retained rule bytes.

It must not merely compare a caller-supplied string saying `2026c`.

## Exact 2011 transition derivation

The 2026c source rules require:

```text
spring:
  Mar Sun>=8 at 02:00 local
```

For Gregorian calendar year 2011:

```text
March Sundays = 6, 13, 20, 27
first Sunday >= 8 = 13
spring transition date = 2011-03-13
```

The fall rule requires:

```text
Nov Sun>=1 at 02:00 local
```

For 2011:

```text
November Sundays = 6, 13, 20, 27
first Sunday >= 1 = 6
fall transition date = 2011-11-06
```

No timezone database is needed to calculate these Gregorian calendar rule dates
once the exact rule expressions are already accepted.

## Exact offset derivation

The America/Chicago zone rule supplies:

```text
STDOFF = -06:00
RULES = US
```

The active US rule during 2011-05-03 supplies:

```text
SAVE = +01:00
```

Therefore:

```text
-06:00 + 01:00 = -05:00
```

The offset result must be reproduced from exact retained rule material.

It must not be supplied by the host runtime.

## EffectiveInterval derivation

DEC-0029 establishes a whole local civil day.

The local start is:

```text
2011-05-03T00:00:00-05:00
```

The next local civil-day boundary is:

```text
2011-05-04T00:00:00-05:00
```

Because no transition occurs within 2011-05-03, both boundaries use the same
effective offset.

Canonical UTC conversion yields:

```text
2011-05-03T05:00:00.000Z
2011-05-04T05:00:00.000Z
```

DEC-0030 authorizes only these exact boundaries for the exact first world.

## No interval-open/closed semantics

The frozen ContextDatum contract stores only:

```text
{ start, end }
```

and requires end not to precede start.

It does not encode an interval-closure field.

DEC-0030 therefore does not invent:

- closed;
- open;
- half-open;
- inclusive-end;
- exclusive-end

semantics beyond the exact two boundary timestamps.

A future consumer must follow the frozen ContextDatum contract and must not infer a
new interval-closure policy from this DEC.

## No generic timezone-resolution engine authority

DEC-0030 does not establish:

```text
any IANA zone + any date -> effectiveInterval
```

It does not authorize an unrestricted timezone compiler.

The first authority is finite to:

```text
crop.planting_date
DATE 2011-05-03
SERF
America/Chicago
LOCAL_CIVIL_DAY
IANA tzdb 2026c
```

## No mutable latest-rule authority

The implementation must not depend on:

```text
tzdata-latest.tar.gz
```

or another mutable latest alias.

If a later DEC chooses a newer tzdb release, that new version must receive its own
reviewed authority or an explicit governed version-upgrade rule.

## No silent rule upgrade

A future IANA release must not silently change the semantic identity of an already
published DEC-0030 compilation.

The exact rule release/version and evidence hashes are material to compilation
identity.

## No operating-system fallback

If exact retained 2026c rule evidence is missing or mismatched, validation must
fail closed.

It must not fall back to host timezone data even if the host returns the same
`-05:00` result.

## No upstream-source timezone claim

DEC-0029 remains an ADR-governed local-civil interpretation.

DEC-0030 does not retroactively claim that Sustainable Corn explicitly encoded
`operations.valid` as timezone-aware local civil time.

The source fact and ADR interpretation remain distinct.

## No availableAt mutation

DEC-0028 remains the authority for:

```text
availableAt = 2026-08-30T13:00:00.000Z
```

DEC-0030 does not modify evidence availability chronology.

## No semantic/value mutation

The value remains:

```text
crop.planting_date = DATE 2011-05-03
```

DEC-0030 does not convert the public value type from DATE to TIMESTAMP.

The resolved timestamps belong only to `effectiveInterval`.

## No support/unit/uncertainty mutation

DEC-0021 remains temporal-support authority.

DEC-0023 remains spatial-support authority.

DEC-0024 remains unit authority.

DEC-0025 remains vertical-support authority.

DEC-0026 remains uncertainty authority.

DEC-0030 modifies none of them.

## No targetRef mutation

DEC-0027 remains FARM target-ref component authority.

DEC-0030 creates no target identity or targetRef fields.

## No ContextDatum publication

DEC-0030 establishes only concrete effectiveInterval field authority.

It does not assemble or publish ContextDatum.

No ContextManifest, DecisionProblem, AuthorizedContextReference,
ResolvedContextDatumReceipt, Policy, RuntimePlan, DecisionResult, execution or
Outcome authority is created.

## Authority shape

Introduce a content-addressed authority:

`AgronomicContextHistoricalTimezoneBoundaryResolutionCompilation`

Conceptually:

```text
AgronomicContextHistoricalTimezoneBoundaryResolutionCompilation {
  contractVersion

  resolutionId

  parentCalendarDateLocalCivilFrameBindingCompilationRef

  targetContextSemantic
  localCivilFrame

  timezoneRuleAuthority {
    provider = IANA_TZDB
    release = 2026c
    releaseCommit = 71f28b9ab3b67c0f9466803f6151812d4fc8e357
    dataArtifact = tzdata2026c.tar.gz
    sha512 = e0b4...32ef0
    ruleFile = northamerica
    retainedEvidenceRefs [...]
  }

  historicalResolution {
    springTransitionDate = 2011-03-13
    fallTransitionDate = 2011-11-06
    baseOffset = -06:00
    daylightSave = +01:00
    effectiveOffset = -05:00
    dstState = DAYLIGHT
  }

  localBoundaryProjection {
    start = 2011-05-03T00:00:00-05:00
    end = 2011-05-04T00:00:00-05:00
  }

  effectiveInterval {
    start = 2011-05-03T05:00:00.000Z
    end = 2011-05-04T05:00:00.000Z
  }

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

`AgronomicContextHistoricalTimezoneBoundaryResolutionReviewDecision`

or equivalent governed review authority.

The review must bind the exact:

- DEC-0029 predecessor ref;
- semantic/value;
- local civil frame;
- IANA release identity;
- exact data-artifact checksum;
- exact retained rule evidence;
- US spring/fall rules;
- America/Chicago zone rule;
- derived 2011 transition dates;
- base offset;
- daylight save;
- effective offset;
- DST state;
- local boundaries;
- canonical UTC effectiveInterval.

## Mandatory review checks

An accepted review should confirm at least:

1. `PARENT_LOCAL_CIVIL_FRAME_AUTHORITY_VERIFIED`;
2. `EXACT_TARGET_CONTEXT_SEMANTIC_VERIFIED`;
3. `EXACT_LOCAL_CIVIL_DAY_VERIFIED`;
4. `EXACT_ZONE_ID_AMERICA_CHICAGO_VERIFIED`;
5. `IANA_TZDB_PROVIDER_VERIFIED`;
6. `IANA_RELEASE_2026C_VERIFIED`;
7. `IANA_TZDATA_2026C_ARTIFACT_VERIFIED`;
8. `IANA_TZDATA_2026C_SHA512_VERIFIED`;
9. `EXACT_NORTHAMERICA_RULE_EVIDENCE_VERIFIED`;
10. `AMERICA_CHICAGO_BASE_OFFSET_RULE_VERIFIED`;
11. `US_2007_PLUS_SPRING_RULE_VERIFIED`;
12. `US_2007_PLUS_FALL_RULE_VERIFIED`;
13. `2011_SPRING_TRANSITION_DATE_VERIFIED`;
14. `2011_FALL_TRANSITION_DATE_VERIFIED`;
15. `LOCAL_DAY_WITHIN_DAYLIGHT_PERIOD_VERIFIED`;
16. `BASE_OFFSET_MINUS_06_VERIFIED`;
17. `DAYLIGHT_SAVE_PLUS_01_VERIFIED`;
18. `EFFECTIVE_OFFSET_MINUS_05_VERIFIED`;
19. `DST_STATE_DAYLIGHT_VERIFIED`;
20. `LOCAL_BOUNDARIES_VERIFIED`;
21. `CANONICAL_UTC_EFFECTIVE_INTERVAL_VERIFIED`;
22. `NO_HOST_TIMEZONE_DATABASE_AUTHORITY`;
23. `NO_MUTABLE_LATEST_RULE_AUTHORITY`;
24. `NO_GENERIC_TIMEZONE_RESOLUTION_RULE`;
25. `NO_INTERVAL_CLOSURE_SEMANTICS_INVENTED`;
26. `NO_AVAILABLE_AT_MUTATION`;
27. `NO_CONTEXT_DATUM_PUBLICATION`;
28. `NO_CONTEXT_MANIFEST_OR_DECISION_PROBLEM_PUBLICATION`;
29. `NO_POLICY_RUNTIME_EXECUTION_OR_OUTCOME_INFERENCE`.

All mandatory checks are required for accepted publication.

## Review dispositions

At minimum:

- `ACCEPT_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION`;
- `REJECT_CONTEXT_HISTORICAL_TIMEZONE_BOUNDARY_RESOLUTION`.

Rejected review cannot authorize publication.

## Content addressing

Changing any material element must change semantic identity or fail review closure,
including:

- DEC-0029 predecessor;
- local date;
- zone id;
- tzdb provider;
- tzdb release;
- release artifact checksum;
- retained rule bytes;
- transition-date derivation;
- base/daylight/effective offset;
- DST state;
- local boundaries;
- canonical effectiveInterval;
- rationale;
- semantic review decision.

## First Gold

The first Gold should replay exact DEC-0029 and exact retained IANA 2026c rule
evidence and prove only:

```text
LOCAL_CIVIL_DAY
2011-05-03
America/Chicago

IANA tzdata2026c
  -> America/Chicago = -06:00 + US rules
  -> 2011 DST active on 2011-05-03
  -> effective offset = -05:00

local:
  [2011-05-03T00:00:00-05:00,
   2011-05-04T00:00:00-05:00]

canonical:
  effectiveInterval.start =
    2011-05-03T05:00:00.000Z
  effectiveInterval.end =
    2011-05-04T05:00:00.000Z
```

The Gold must fail closed for at least:

- wrong predecessor kind;
- predecessor ref drift;
- local date drift;
- zone drift;
- wrong tzdb provider;
- mutable/latest release reference;
- wrong release version;
- wrong release checksum;
- missing retained rule evidence;
- altered northamerica rule bytes;
- wrong spring transition derivation;
- wrong fall transition derivation;
- standard-time `-06:00` substitution;
- arbitrary caller offset;
- arbitrary caller DST state;
- arbitrary effectiveInterval;
- host timezone fallback;
- semantic DATE->TIMESTAMP mutation;
- availableAt mutation;
- incomplete review;
- unauthorized reviewer;
- rejected review;
- review/publication mismatch.

## Consequences

Positive:

- closes the final unresolved field-level timestamp authority for the first
  ContextDatum;
- makes historical timezone resolution reproducible independently of host runtime;
- pins an exact official timezone-rule release and checksum;
- preserves local-civil interpretation as a separate DEC-0029 authority;
- produces the exact RFC3339 values required by the frozen ContextDatum contract.

Costs:

- IANA 2026c becomes a material scientific/runtime dependency for this exact
  historical projection;
- version upgrades require separate governed treatment;
- the implementation must retain exact external rule evidence rather than relying
  on system timezone packages;
- this remains a finite first-world compiler rather than a general timezone engine.

## Remaining work after acceptance

If DEC-0030 is accepted and implemented, the known required ContextDatum fields for
the first Sustainable Corn planting-date world will have field-level authority.

The next step should then be a dedicated final assembly/publication audit.

That audit must determine whether the already accepted authorities are sufficient
to publish one exact ContextDatum through A02, including:

- exact semantic/value;
- unit;
- epistemicClass;
- provenanceClass;
- effectiveInterval;
- availableAt;
- spatialSupport;
- verticalSupport;
- temporalSupport;
- uncertainty;
- source;
- caller-selected opaque logicalId/version;
- scoped CONTEXT_WRITE authorization;
- audit closure;
- public materialization.

DEC-0030 does not pre-authorize final ContextDatum publication.
