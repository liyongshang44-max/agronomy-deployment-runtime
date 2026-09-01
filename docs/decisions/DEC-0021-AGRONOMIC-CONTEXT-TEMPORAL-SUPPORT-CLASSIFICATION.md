# DEC-0021 — Governed Agronomic Context Temporal Support Classification

Status: **ACCEPTED**

Date: 2026-09-01

## Context

DEC-0013 preserves the exact first Sustainable Corn source-recorded operation occurrence:

```text
siteid = SERF
sourceOperationCode = plant_corn
date = 2011-05-03

temporalSupport:
  kind = CALENDAR_DATE
  date = 2011-05-03
  precision = DAY
```

DEC-0016 establishes the exact first Context semantic/value mapping:

```text
PLANT / CROP:CORN
+
CALENDAR_DATE / 2011-05-03 / DAY
        ->
semanticId = crop.planting_date

value:
  type = DATE
  date = 2011-05-03
```

DEC-0016 deliberately does not project source `precision = DAY` into the Frozen Context Contract's `temporalSupport` field.

DEC-0017 through DEC-0020 establish the exact first epistemic, provenance and source-wire dimensions, but likewise do not establish temporal-support projection.

The Frozen Context Contract requires `ContextDatum.temporal_support` to be explicit. The existing A02 ContextDatum implementation preserves that field as semantic payload but does not derive its meaning from source evidence.

Therefore a new authority is required before the first Sustainable Corn value can legally claim a Context temporal-support class.

## Decision

For the exact accepted DEC-0020 predecessor world only, the first governed temporal-support classification is:

```text
source temporal support:
  kind = CALENDAR_DATE
  date = 2011-05-03
  precision = DAY

        ->

target Context temporal support:
  type = INTERVAL
```

The meaning of `INTERVAL` in this decision is narrow:

> the value-bearing source evidence applies over a calendar-day support class rather than an exact instantaneous clock reading.

DEC-0021 does not construct clock-time interval boundaries.

## Why INTERVAL

The source does not provide an exact event instant.

It preserves only:

```text
2011-05-03
precision = DAY
```

Therefore classifying the support as `INSTANT` would invent precision that the source does not provide.

The Frozen Context contract illustrates `temporal_support.type = INTERVAL`, while the A02 implementation preserves `temporalSupport.type` as semantic payload. Neither the illustrative contract example nor the non-architecture A02 implementation independently grants this Sustainable Corn mapping authority.

DEC-0021 itself establishes, for this exact first finite predecessor world only, that `CALENDAR_DATE / precision = DAY` may be classified as Context `temporalSupport.type = INTERVAL`. This decision therefore creates the reviewed bridge rather than deriving authority from implementation behavior or allowing an adapter to infer it silently.

## Exact predecessor closure

The first DEC-0021 authority must close through the exact accepted chain:

```text
DEC-0013 occurrence
        ↓
DEC-0014 semantic normalization
        ↓
DEC-0015 source-backed FARM identity
        ↓
DEC-0016 crop.planting_date / DATE 2011-05-03
        ↓
DEC-0017 ASSERTION
        ↓
DEC-0018 EXTERNAL_PROVIDER
        ↓
DEC-0019 providerId
        ↓
DEC-0020 sourceRef/contentHash
```

The validator must revalidate those exact predecessor authority records rather than trusting copied fields.

## Exact first source temporal closure

The first accepted source temporal support is exactly:

```text
kind = CALENDAR_DATE
date = 2011-05-03
precision = DAY
```

Any drift in:

- temporal kind;
- source date;
- source precision;
- predecessor occurrence identity;

must fail closed.

## Exact first target temporal support

The only first-slice target support is:

```text
temporalSupport.type = INTERVAL
```

The first authority rejects:

```text
INSTANT
POINT
TIMESTAMP
DAY
CALENDAR_DAY
UNKNOWN
```

for this exact predecessor world.

Those values are not globally prohibited. They are simply not authorized by this first reviewed mapping.

## No effectiveInterval authority

DEC-0021 does not create:

```text
effectiveInterval.start
effectiveInterval.end
```

In particular it does not infer:

```text
2011-05-03T00:00:00Z
2011-05-04T00:00:00Z
```

or any other timestamps.

A temporal-support class is not the same thing as concrete timestamp bounds.

## No timezone authority

The current accepted source chain does not establish an IANA timezone, UTC offset or DST rule for SERF.

The retained DEC-0015 identity evidence explicitly stops at source-backed FARM identity and does not establish timezone.

Therefore DEC-0021 does not infer:

```text
America/Chicago
Central Time
UTC-05
UTC-06
```

or any other timezone representation.

Even though the retained identity source includes `IA`, state identity does not itself constitute an accepted timezone mapping authority.

## No availableAt authority

DEC-0021 does not create ContextDatum `availableAt`.

The following clocks remain semantically distinct and must not be substituted:

- source event date;
- source publication time;
- SourceArtifact acquisition time;
- ADR ingestion time;
- ADR materialization time;
- review/publication time.

A later authority must decide which timestamp, if any, legally represents ContextDatum availability for this source-derived datum.

## No DATE-to-timestamp conversion

The mapped Context value remains:

```text
value:
  type = DATE
  date = 2011-05-03
```

DEC-0021 does not change the value to `TIMESTAMP` or `INTERVAL`.

`value.type` and `temporalSupport.type` remain different semantic dimensions.

## No unit authority

DEC-0021 does not decide the required ContextDatum `unit` string for a DATE-valued semantic.

## No uncertainty authority

DEC-0021 does not infer:

```text
uncertainty.type = NONE
```

or any other uncertainty form.

Source day precision and agronomic-event uncertainty are not equivalent concepts.

## No target/spatial authority

DEC-0021 does not project the DEC-0015 FARM identity into:

- `spatialSupport`;
- `geometryRef`;
- field/plot/zone identity;
- DecisionProblem targetRef.

## No verticalSupport decision

DEC-0021 does not decide whether `verticalSupport` is null or any other value.

## No ContextDatum publication

DEC-0021 creates no:

- ContextDatum;
- ContextManifest;
- AuthorizedContextReference;
- ResolvedContextDatumReceipt.

The first ContextDatum remains incomplete after DEC-0021.

## No generic precision mapping rule

This decision does not establish a global rule:

```text
precision = DAY
-> temporalSupport.type = INTERVAL
```

for every provider, semantic or source family.

The first mapping is finite and authority-local to the exact Sustainable Corn predecessor world.

A future generic precision-normalization policy would require independent architecture and cross-source qualification.

## Review requirements

The first review must confirm at least:

1. exact DEC-0020 predecessor closure;
2. exact DEC-0013 occurrence closure;
3. exact source temporal kind `CALENDAR_DATE`;
4. exact source date `2011-05-03`;
5. exact source precision `DAY`;
6. exact target semantic `crop.planting_date`;
7. exact target value `DATE 2011-05-03`;
8. target temporal-support class exactly `INTERVAL`;
9. no instant-level precision inference;
10. no timezone/offset/DST inference;
11. no effectiveInterval construction;
12. no availableAt construction;
13. no value-type mutation;
14. no unit/uncertainty inference;
15. no target/spatial/vertical projection;
16. no ContextDatum publication;
17. no DecisionProblem/Policy/runtime/execution/Outcome authority;
18. no inverse or completeness claim.

## Completion meaning

`COMPLETE` for DEC-0021 would mean only:

> the exact first Sustainable Corn `CALENDAR_DATE / DAY` source temporal support is governed as Context `temporalSupport.type = INTERVAL`, while retaining the date as a DATE-valued semantic and without inventing timestamp boundaries or timezone authority.

It would not mean the first ContextDatum is publishable.

## Remaining seams after DEC-0021

At least the following remain unresolved:

1. timezone authority;
2. UTC offset / DST interpretation;
3. DAY -> concrete RFC3339 effectiveInterval bounds;
4. availableAt;
5. DATE semantic unit representation;
6. uncertainty;
7. target identity -> spatialSupport;
8. verticalSupport null/applicability;
9. ContextDatum datum_id;
10. ContextDatum publication authority for this predecessor world;
11. ContextManifest inclusion;
12. field/plot/zone/season identity;
13. planned-vs-actual reconciliation;
14. execution reconciliation;
15. Outcome linkage.

## Future temporal chain

```text
DEC-0016
DATE semantic/value
        ↓
DEC-0021
temporalSupport.type = INTERVAL
        ↓
future source-backed timezone authority
        ↓
future effectiveInterval projection
        ↓
future availableAt authority
        ↓
future governed ContextDatum projection
```

The ordering is intentional: support classification does not grant timestamp-boundary authority.


## Architecture acceptance

Explicit architecture approval was provided by the user on 2026-09-01.

The accepted boundary is the decision exactly as written above: for the exact first Sustainable Corn predecessor world, source temporal support `CALENDAR_DATE / 2011-05-03 / precision = DAY` may be classified as Context `temporalSupport.type = INTERVAL`. This acceptance does not authorize concrete `effectiveInterval` timestamp bounds, timezone/UTC-offset/DST inference, `availableAt`, DATE-to-TIMESTAMP conversion, unit or uncertainty projection, target/spatial/vertical projection, ContextDatum/ContextManifest publication, generic DAY-to-INTERVAL normalization, DecisionProblem, Policy, runtime, execution, Outcome, inverse mapping, or completeness claims.
