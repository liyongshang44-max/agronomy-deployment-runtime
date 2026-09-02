# DEC-0031 Sustainable Corn ContextDatum Assembly / Publication Gold Provenance

This Gold is the first same-ledger convergence of the exact Sustainable Corn
planting-date field-authority branches into the frozen A02 ContextDatum publisher.

## Direct field authorities

The assembly consumes the exact live authority records for:

- DEC-0016 context semantic/value;
- DEC-0017 epistemic class;
- DEC-0018 provenance class;
- DEC-0020 public provider/sourceRef/contentHash;
- DEC-0021 temporal support;
- DEC-0023 spatial support;
- DEC-0024 non-quantitative unit;
- DEC-0025 vertical-support non-applicability;
- DEC-0026 uncertainty UNKNOWN;
- DEC-0028 source-acquisition availability;
- DEC-0030 historical timezone boundary resolution.

DEC-0015/0019/0022/0029 remain mandatory through exact transitive replay.

DEC-0027 farmId is deliberately not inserted into A02 ContextDatum.

## Exact public semantic payload

The first governed datum template is:

- semanticId: crop.planting_date
- value: DATE 2011-05-03
- unit: NOT_APPLICABLE
- epistemicClass: ASSERTION
- provenanceClass: EXTERNAL_PROVIDER
- effectiveInterval:
  - 2011-05-03T05:00:00.000Z
  - 2011-05-04T05:00:00.000Z
- availableAt: 2026-08-30T13:00:00.000Z
- spatialSupport: FARM, no geometryRef
- verticalSupport: null
- temporalSupport: INTERVAL
- uncertainty: UNKNOWN /
  ACCEPTED_EVIDENCE_UNCERTAINTY_NOT_ESTABLISHED
- source.providerId: github.com/isudatateam/datateam
- source.sourceRef: exact DEC-0020 Git-blob/Jupyter-row locator
- source.contentHash:
  sha256:d27e8539ed45115419093d563cf44f0f364568efb4633781ea8120aaa2bb819f

## Publication authority split

Scientific assembly review does not grant write permission.

Actual ContextDatum publication independently replays the existing scoped A02/F03
CONTEXT_WRITE AuthorizationDecisionAudit for the exact caller-selected logicalId.

The publication bridge supplies no caller-controlled datum fields.

## Retained evidence reuse

No external evidence is duplicated by DEC-0031.

The Gold reuses:

- Sustainable Corn notebook/source/identity/timezone artifacts already retained by
  predecessor Golds;
- exact IANA tzdb 2026c evidence retained under the DEC-0030 Gold.

## Nonclaims

This Gold creates no ContextManifest, DecisionProblem, AuthorizedContextReference,
ResolvedContextDatumReceipt, Policy, RuntimePlan, execution or Outcome authority.

It does not create a generic ContextDatum assembly engine.
