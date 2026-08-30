# DEC-0015 Sustainable Corn Target Identity Gold Provenance

This Gold is a public real-source acceptance fixture for the first
`AgronomicRecordedOperationTargetIdentityBindingCompilation`.

## Parent occurrence source

The parent occurrence reuses the exact retained DEC-0013 bootstrap source:

- upstream repository: `isudatateam/datateam`
- path: `scripts/cscap/chicago.ipynb`
- Git blob: `4847e7b3b4aad42193de3f5f0da6f81f6b62dc50`
- retained parent event: `siteid=SERF / plant_corn / 2011-05-03 / DAY`

The notebook source remains a bootstrap persisted-query source and is not
misrepresented as the preferred published XLSX Field Operations row.

## Identity source

- upstream repository: `isudatateam/datateam`
- path: `htdocs/cscap/dl/sites.html`
- exact Git blob: `3145c0fe0099fedd1bb82e6af9e588b785234d80`
- exact retained UTF-8 byte range: `2692:2900`
- upstream LICENSE Git blob:
  `5c60615bfae390b40fe6fa096942c65b5b074ca7`

The exact source range binds the source-native code `SERF` to the named
"Southeast Research and Demonstration Farm" at Iowa State University.

## Accepted Gold meaning

The Gold supports only:

```text
Sustainable Corn parent source namespace
siteid = SERF
        ->
source-backed target identity
granularity = FARM
```

It does not establish FIELD, PLOT, ZONE, SEASON, geometry, timezone,
ContextDatum, ContextManifest, DecisionProblem, cross-provider canonical
identity, runtime eligibility, execution, Outcome, inverse mapping, or source
identity completeness.

The same exact source byte range is referenced under two independently
reviewed evidence roles:

- `SOURCE_NATIVE_IDENTIFIER_CONTEXT`
- `TARGET_GRANULARITY_MEANING`

Publication still requires explicit reviewer confirmation of source-identity
namespace applicability. No lexical or machine heuristic is treated as the
identity authority.
