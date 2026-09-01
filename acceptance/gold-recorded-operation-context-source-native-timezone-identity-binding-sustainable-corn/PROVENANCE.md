# DEC-0022 Sustainable Corn Source-Native Timezone Identity Gold Provenance

This Gold is a public real-source acceptance fixture for the first
`AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilation`.

## Exact co-predecessor graph

DEC-0022 does not pretend that DEC-0015 is transitively contained by the
DEC-0016 -> DEC-0021 context-semantic chain.

The Gold explicitly constructs and independently validates two co-predecessors:

```text
DEC-0021 temporal-support branch
  -> exact DEC-0013 parent occurrence

DEC-0015 target-identity branch
  -> exact DEC-0013 parent occurrence
```

Publication succeeds only when both branches converge on the same exact authority ref
and source-native subject:

```text
siteid = SERF
```

The DEC-0015 branch remains:

```text
SERF -> source-backed FARM identity
```

and does not itself grant timezone authority.

## Existing recorded-operation predecessor

The first branch reuses the exact accepted Sustainable Corn chain:

```text
DEC-0013
  siteid = SERF
  operation = plant_corn
  date = 2011-05-03
  temporal kind = CALENDAR_DATE
  precision = DAY

DEC-0014
  plant_corn -> PLANT / CROP:CORN

DEC-0016
  crop.planting_date = DATE 2011-05-03

DEC-0017
  epistemicClass = ASSERTION

DEC-0018
  provenanceClass = EXTERNAL_PROVIDER

DEC-0019
  providerId = github.com/isudatateam/datateam

DEC-0020
  exact public sourceRef + exact row-level contentHash

DEC-0021
  temporalSupport.type = INTERVAL
```

## DEC-0015 identity evidence

The explicit target-identity co-predecessor reuses:

- upstream repository: `isudatateam/datateam`
- path: `htdocs/cscap/dl/sites.html`
- exact Git blob: `3145c0fe0099fedd1bb82e6af9e588b785234d80`
- exact retained byte range: `2692:2900`
- exact upstream license blob:
  `5c60615bfae390b40fe6fa096942c65b5b074ca7`

That source identifies `SERF` as the Southeast Research and Demonstration Farm at
Iowa State University and supports only the accepted source-backed FARM identity.

## Timezone evidence A — Decagon

- upstream repository: `isudatateam/datateam`
- path: `src/isudatateam/cscap/plot_decagon.py`
- exact Git blob: `db36925e79a8858968ac846bb0713162372cd0ec`
- exact retained byte range: `1170:1301`

The retained bytes are exactly:

```python
    tzname = (
        "America/Chicago"
        if uniqueid in ["ISUAG", "SERF", "GILMORE"]
        else "America/New_York"
    )
```

## Timezone evidence B — Water table

- upstream repository: `isudatateam/datateam`
- path: `src/isudatateam/cscap/plot_watertable.py`
- exact Git blob: `9d9f7e343acfe996f155a007fd0004b60e4bd606`
- exact retained byte range: `2106:2237`

The retained bytes independently contain the same exact site-keyed timezone mapping.

Both artifacts are retained as exact SourceArtifacts. The implementation replays
the byte ranges, recomputes their evidence hashes, and compares exact expected UTF-8
text. It does not import or execute the upstream Python as trusted runtime logic.

## Accepted Gold meaning

The Gold supports only:

```text
source-native subject:
  siteid = SERF

        ->

source timezone identity:
  scheme = IANA
  zoneId = America/Chicago
```

This is an internal governed predecessor authority for future temporal projection.

## Explicit nonclaims

The Gold does not establish:

- that `2011-05-03` is encoded as an America/Chicago local civil day;
- UTC offset `-05:00` or `-06:00`;
- whether DST is active at a future interval boundary;
- any TZDB release/version;
- historical timezone-rule replay basis;
- `effectiveInterval.start`;
- `effectiveInterval.end`;
- `availableAt`;
- DATE-to-TIMESTAMP conversion;
- unit;
- uncertainty;
- spatialSupport;
- geometry;
- verticalSupport;
- ContextDatum;
- ContextManifest;
- DecisionProblem;
- Policy;
- runtime;
- execution;
- Outcome;
- a generic Iowa-to-timezone rule;
- a generic site-code-to-timezone rule.

The Frozen ContextDatum contract is not changed and no standalone public timezone
field is added.

## Negative acceptance

The Gold fails closed for at least:

- aliases and alternate zone IDs;
- fixed UTC-offset substitution;
- source-native subject drift;
- timezone evidence byte-range drift;
- timezone evidence-hash drift;
- co-predecessor parent occurrence ref divergence;
- attempted UTC-offset/DST/TZDB/local-frame/effectiveInterval/availableAt widening;
- incomplete review;
- unauthorized reviewer;
- rejected review.

Passing this Gold means only that the exact first Sustainable Corn source-native site
identity `SERF` has an explicitly governed IANA timezone identity
`America/Chicago`, under exact two-branch predecessor convergence and exact retained
source evidence.
