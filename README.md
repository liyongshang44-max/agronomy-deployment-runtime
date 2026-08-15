# Agronomy Deployment Runtime

Independent product repository for **Agronomy Deployment Runtime (ADR)**.

ADR owns the semantics and governance of agronomic knowledge deployment. It may consume context, state, models, forecasts, runtime results, and outcomes from external systems, but it must not require any specific farm platform, digital-twin implementation, sensor provider, weather provider, satellite provider, or execution stack.

GEOX is a first-party integration, reference consumer, and field-validation substrate; it is not the host or domain authority of this repository.

## Architecture status

The current target architecture is **v1.0 FROZEN**. This freeze defines product/domain/authority boundaries only; it does not imply that implementation scope or MVP sequencing has been selected.

Authoritative documents:

- [`docs/architecture/ADR-STANDALONE-PRODUCT-ARCHITECTURE-v1.0.md`](docs/architecture/ADR-STANDALONE-PRODUCT-ARCHITECTURE-v1.0.md)
- [`docs/architecture/ADR-REPO-CONSTITUTION-v1.0.md`](docs/architecture/ADR-REPO-CONSTITUTION-v1.0.md)
- [`docs/architecture/ADR-COMPLETE-COMPONENT-ARCHITECTURE-v1.0.md`](docs/architecture/ADR-COMPLETE-COMPONENT-ARCHITECTURE-v1.0.md)
- [`docs/architecture/ADR-AGRONOMIC-CONTEXT-AND-PUBLIC-RUNTIME-CONTRACT-v1.0.md`](docs/architecture/ADR-AGRONOMIC-CONTEXT-AND-PUBLIC-RUNTIME-CONTRACT-v1.0.md)
- [`docs/domain/ADR-DOMAIN-MODEL-v1.0.md`](docs/domain/ADR-DOMAIN-MODEL-v1.0.md)
- [`docs/decisions/ADR-0001-INDEPENDENT-PRODUCT-BOUNDARY.md`](docs/decisions/ADR-0001-INDEPENDENT-PRODUCT-BOUNDARY.md)

## Core separations

```text
Source ≠ Claim ≠ QualifiedKnowledge ≠ DerivedKnowledge
SourceContext ≠ TargetContext ≠ ContextManifest
KnowledgeRelease ≠ RuntimeProfile ≠ Deployment
RuntimePlan ≠ RuntimeBinding
RuntimeEligibility ≠ Decision
Knowledge ≠ Transformation ≠ Model ≠ Policy ≠ Implementation
```

The six long-term product backbone objects are:

```text
KnowledgeRelease
RuntimeProfile
Deployment
ContextManifest
RuntimeBinding
DecisionRobustness
```

Implementation work should be derived from these frozen semantics rather than redefining them for local engineering convenience.
