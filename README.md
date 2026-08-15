# Agronomy Deployment Runtime

Independent product repository for **Agronomy Deployment Runtime (ADR)**.

ADR owns the semantics and governance of agronomic knowledge deployment. It may consume context, state, models, forecasts, runtime results, and outcomes from external systems, but it must not require any specific farm platform, digital-twin implementation, sensor provider, weather provider, satellite provider, or execution stack.

GEOX is a first-party integration, reference consumer, and field-validation substrate; it is not the host or domain authority of this repository.

## Architecture status

The current target architecture is **v1.0 FROZEN**. This freeze defines product/domain/authority boundaries only; it does not imply that implementation scope or MVP sequencing has been selected.

The v1.0 freeze includes a final cross-document adjudication. Where an earlier v1.0 clause conflicts with that adjudication, the adjudication controls that seam while non-conflicting clauses remain authoritative.

Authoritative documents:

- [`docs/architecture/ADR-STANDALONE-PRODUCT-ARCHITECTURE-v1.0.md`](docs/architecture/ADR-STANDALONE-PRODUCT-ARCHITECTURE-v1.0.md)
- [`docs/architecture/ADR-REPO-CONSTITUTION-v1.0.md`](docs/architecture/ADR-REPO-CONSTITUTION-v1.0.md)
- [`docs/architecture/ADR-COMPLETE-COMPONENT-ARCHITECTURE-v1.0.md`](docs/architecture/ADR-COMPLETE-COMPONENT-ARCHITECTURE-v1.0.md)
- [`docs/architecture/ADR-AGRONOMIC-CONTEXT-AND-PUBLIC-RUNTIME-CONTRACT-v1.0.md`](docs/architecture/ADR-AGRONOMIC-CONTEXT-AND-PUBLIC-RUNTIME-CONTRACT-v1.0.md)
- [`docs/architecture/ADR-ARCHITECTURE-v1.0-FINAL-ADJUDICATION.md`](docs/architecture/ADR-ARCHITECTURE-v1.0-FINAL-ADJUDICATION.md)
- [`docs/domain/ADR-DOMAIN-MODEL-v1.0.md`](docs/domain/ADR-DOMAIN-MODEL-v1.0.md)
- [`docs/decisions/DEC-0001-INDEPENDENT-PRODUCT-BOUNDARY.md`](docs/decisions/DEC-0001-INDEPENDENT-PRODUCT-BOUNDARY.md)

## Core separations

```text
Source ≠ SourceArtifact ≠ Claim ≠ QualifiedKnowledge ≠ DerivedKnowledge
SourceContext ≠ DerivedKnowledgeContext ≠ TargetContext ≠ ContextManifest
KnowledgeRelease ≠ RuntimeProfile ≠ Deployment
Specification ≠ Implementation ≠ ImplementationConformance
DerivedKnowledge ≠ CalibrationArtifact
RuntimePlan ≠ RuntimeAlternativeSet ≠ RuntimeBinding
RuntimeEligibility ≠ DecisionDisposition ≠ DecisionResult
ContextDatum ≠ RuntimeDatum
Outcome ≠ CausalEffect
RuntimeEnvironment ≠ RolloutStage
Knowledge ≠ Transformation ≠ Model ≠ Policy ≠ Implementation
```

The six long-term product backbone objects remain:

```text
KnowledgeRelease
RuntimeProfile
Deployment
ContextManifest
RuntimeBinding
DecisionRobustness
```

They are not the complete domain-object inventory. The final adjudication adds the authority objects required to keep source materialization, implementation conformance, calibration, retrieval provenance, robustness coverage, decision semantics, runtime output semantics and causal attribution explicit.

Implementation work should be derived from these frozen semantics rather than redefining them for local engineering convenience.
