# DEC-0030 Sustainable Corn Historical Timezone Boundary Resolution Gold Provenance

This Gold extends the exact cumulative Sustainable Corn planting-date authority chain through DEC-0029.

## Accepted predecessor

- DEC-0029 compilation kind: `AgronomicContextCalendarDateLocalCivilFrameBindingCompilation`
- exact semantic/value: `crop.planting_date = DATE 2011-05-03`
- exact temporal frame: `LOCAL_CIVIL_DAY / 2011-05-03 / IANA America/Chicago`
- interpretation class remains `ADR_GOVERNED_SOURCE_DATE_FRAME_BINDING`

## External timezone-rule authority

Pinned source:

- provider: IANA Time Zone Database
- release: `2026c`
- release date: `2026-07-08`
- development commit: `71f28b9ab3b67c0f9466803f6151812d4fc8e357`
- data artifact: `tzdata2026c.tar.gz`
- SHA-512: `e0b4b7044b66fbc27bc21d13d18063abcdf78ab58d5ba5fd64bd1a88d86e9d495f45add4d8e65bb6c40249f9c94ca29b72c8ebba8d0e4c468f2965ac77932ef0`
- rule file: `northamerica`

The mutable `tzdata-latest.tar.gz` alias is not authority.

## Retained evidence

The Gold retains three reviewed text artifacts:

1. `upstream/iana-tzdb-2026c-release.txt`
   - normalized release identity/checksum record
   - sha256: `055162be6f6d98fefeabb54b1a6c01ce1b67964f6d45ea0cc30ff05a04386032`
2. `upstream/northamerica-2026c-required-rules.txt`
   - exact public-domain rule lines needed for US 2007+ DST and America/Chicago
   - sha256: `91447e93780354cd95cf00c944c8034c08b9be4b9e23f165307baf7ae3b0cb5a`
3. `upstream/transition-derivation-2011.txt`
   - reviewed finite Gregorian derivation for 2011 transitions and boundaries
   - sha256: `75dbb5b05789e53ebd602113ac17baf48086363f6a3db9ede4a094968ae42655`

The implementation validator hashes the retained bytes and fails closed on any mismatch.

## Finite derivation

Accepted rule material yields:

- spring transition: `2011-03-13`
- fall transition: `2011-11-06`
- base offset: `-06:00`
- daylight save: `+01:00`
- effective offset on 2011-05-03: `-05:00`
- DST state: `DAYLIGHT`

Accepted local boundaries:

- `2011-05-03T00:00:00-05:00`
- `2011-05-04T00:00:00-05:00`

Canonical UTC boundaries:

- `2011-05-03T05:00:00.000Z`
- `2011-05-04T05:00:00.000Z`

## Prohibitions

This Gold does not:

- call Node, ICU, OS, database or browser timezone data as authority;
- use a mutable latest tzdb alias;
- create a generic timezone engine;
- mutate the DATE value into TIMESTAMP;
- alter DEC-0028 `availableAt`;
- invent interval-open/closed semantics;
- publish ContextDatum, ContextManifest or DecisionProblem.
