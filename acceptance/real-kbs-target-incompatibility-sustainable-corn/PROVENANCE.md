# Real KBS 2015 Knowledge × Sustainable Corn target incompatibility proof

Status: **MACHINE ACCEPTANCE / REAL-SOURCE NEGATIVE COMPATIBILITY / TEST ONLY**

This proof combines two already source-grounded worlds inside one replayable ADR ledger:

1. Sustainable Corn / SERF target context
   - exact DEC-0031 real-source `ContextDatum`;
   - exact DEC-0032 source-backed FARM target binding;
   - a new TEST_ONLY A01 `DecisionProblem` with `usePurpose = AGRONOMIC_POLICY_INPUT`;
   - a new A04 `ContextManifest` containing exactly the retained
     `crop.planting_date = DATE 2011-05-03` datum.
2. KBS 2015 Resource Gradient Experiment irrigation protocol
   - exact retained whitespace-normalized transcription of PDF page 23;
   - exact transcription content hash
     `sha256:8d18c0fcc5a2b536d675e9b1cdafc16fbeedb19204b67c11ae81f887844f71d9`;
   - one source-faithful claim and SourceContext;
   - one real `QualifiedKnowledge` authority qualified for
     `AGRONOMIC_POLICY_INPUT`.

The KBS qualification retains the exact material semantic preconditions:

```text
crop.code == soybean
experiment.name == Resource Gradient Experiment (N-rate Study)
```

The Sustainable Corn manifest deliberately contains neither semantic. It contains
only the source-backed planting-date fact. The proof therefore tests whether ADR
fails closed instead of manufacturing current crop state or experiment identity
from planting occurrence semantics, FARM identity, SERF, provider metadata, or
other neighboring authority.

## Temporal control

This proof removes look-ahead as a competing explanation:

```text
ContextDatum.availableAt = 2026-08-30T13:00:00.000Z
A04 evidenceCutoff       = 2026-08-30T14:00:00.000Z
A01 logicalTime          = 2026-08-31T00:00:00.000Z
```

Therefore the real source datum is available before the selected evidence cutoff,
and the cutoff precedes the test decision logical time.

## Expected legal result

A07 may retrieve the exact released KBS QualifiedKnowledge because the runtime use
purpose exactly matches its qualification target.

A08 must then produce:

```text
scientificUseStatus = QUALIFIED
transportStatus     = UNRESOLVED
runtimeUse          = BLOCKED
missingContext      = [crop.code, experiment.name]
```

Both material semantic preconditions must be `UNKNOWN / UNRESOLVED`; no target value
may be synthesized.

R01 must carry the missing semantic requirements forward. R03 must classify the
world as `INFORMATION_REQUIRED`, not as a legal runtime and not as a scientific-use
failure. D01 must reject publication with `RUNTIME_BINDING_RUNTIME_NOT_ELIGIBLE`.

## Nonclaims

This proof does **not** claim:

- KBS knowledge is scientifically invalid;
- KBS knowledge is applicable to SERF;
- corn is current at SERF because `plant_corn` occurred historically;
- soybean is absent at SERF as a real-world fact;
- Resource Gradient Experiment identity can be inferred from FARM/provider identity;
- a real operator decision exists;
- any runtime executed;
- any RuntimeBinding, RuntimeResult, DecisionResult or Outcome was lawfully produced.

The only positive claim is that ADR preserves the real KBS qualification boundary and
fails closed when its exact decision-material target context is not present.
