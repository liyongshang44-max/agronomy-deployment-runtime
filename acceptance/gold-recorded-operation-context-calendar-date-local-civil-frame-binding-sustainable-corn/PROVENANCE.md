# DEC-0029 Sustainable Corn Calendar-Date Local-Civil Frame Gold Provenance

Status: **PUBLIC REAL-SOURCE CUMULATIVE GOLD**

This Gold replays the exact DEC-0022 Sustainable Corn timezone-identity world and
adds only the explicit DEC-0029 calendar-date temporal-frame interpretation.

## Exact predecessor world

The predecessor closes to:

```text
crop.planting_date = DATE 2011-05-03

source temporal descriptor:
  kind = CALENDAR_DATE
  date = 2011-05-03
  precision = DAY

source-native subject:
  siteid = SERF

accepted source-native timezone identity:
  scheme = IANA
  zoneId = America/Chicago
```

The retained source directly supports the calendar date and the independent
SERF -> America/Chicago timezone identity.

The retained operations path does not directly declare that
`operations.valid` is encoded in that local civil frame.

## Accepted DEC-0029 interpretation

The Gold therefore publishes only:

```text
temporalFrame:
  kind = LOCAL_CIVIL_DAY
  civilDate = 2011-05-03
  zoneScheme = IANA
  zoneId = America/Chicago

interpretationClass:
  ADR_GOVERNED_SOURCE_DATE_FRAME_BINDING
```

This is an explicit ADR-governed semantic join.

It is not an upstream source-field declaration.

## What this Gold does not establish

It creates no authority for:

- UTC offset;
- DST state;
- TZDB release/version;
- RFC3339 effectiveInterval boundaries;
- availableAt;
- ContextDatum publication;
- ContextManifest or DecisionProblem publication.

The exact local civil day is therefore still not a UTC interval.

## No generic rule

Passing this Gold does not establish:

```text
all DATE values use source timezone
all SERF date fields use America/Chicago
all provider dates use America/Chicago
```

The mapping is finite to the exact first Sustainable Corn planting-date world.

## Negative acceptance

The Gold fails closed for at least:

- wrong predecessor kind/ref;
- semantic/value drift;
- source calendar-date or precision drift;
- source-native subject drift;
- timezone scheme/id drift;
- substitution of an upstream-source-declared interpretation class;
- UTC offset injection;
- DST result injection;
- TZDB version injection;
- effectiveInterval injection;
- availableAt mutation;
- generic DATE/provider/geographic timezone rules;
- downstream publication widening;
- incomplete review;
- unauthorized reviewer;
- rejected review;
- review/publication mismatch.

Passing this Gold means only that ADR may interpret the exact accepted
`2011-05-03 / DAY` source calendar date within the exact accepted
`SERF -> IANA America/Chicago` timezone identity as one local civil day,
under explicit reviewed authority.
