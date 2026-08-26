# Agronomic Policy Compilation

This package is an experimental candidate for governed operationalization of agronomic knowledge into deployable `Model` + `Policy` semantics. It does not collapse Source, Knowledge, Model, Policy, execution, or Outcome authority boundaries.

Core invariants:

- Protocol documents remain logical `Source` authority.
- The exact protocol material interpreted by the compilation is bound separately through exact `SourceArtifact` refs.
- Scientific assertions remain `Claim` / `QualifiedKnowledge` / `DerivedKnowledge` authority.
- A knowledge predecessor is not trusted by kind label alone: every `QualifiedKnowledge` / `DerivedKnowledge` ref must replay through ADR's existing scientific authority validator and be currently qualified for the fixed v1 use `AGRONOMIC_POLICY_INPUT`.
- Forged kind-tagged records, unrelated-use qualifications, superseded authority, and revoked authority fail closed before publication/replay of the agronomic compilation.
- Computational state derivation remains `Model` authority.
- Decision logic remains `Policy` authority.
- `AgronomicPolicyCompilation` records how exact protocol artifacts, active scientific knowledge, model, and policy authorities were operationalized and who approved that operationalization.
- The declarative rule is content-addressed by `ruleHash`, and the bound Policy `decisionLogic.methodId/definitionHash` must close exactly over that rule.
- Every referenced Model has one inspectable content-addressed `modelDefinition`, and its method/hash must close exactly over the bound Model computation authority.
- `losslessCoverage` explicitly declares whether decision-material protocol semantics were represented completely; incomplete coverage cannot masquerade as complete.
- Notification and approval are distinct: `NOTIFY` does not imply a human approval gate; `APPROVAL_REQUIRED` requires one.
- Field execution and later outcomes remain outside this package.

The v1 experimental declarative vocabulary covers semantic inputs, evaluation cadence, trigger predicates, thresholds, temporal persistence/windows, exceptions/overrides, action timing, parameter expressions, coordination, fallback, human gate, limitations, and exact knowledge authority bindings.

The package public entry point routes publication and validation through the scientific-authority hardening layer. The lower-level implementation module is not a supported public authority boundary.

Architecture status: `DEC-0002` is **PROPOSED**. ADR v1.0 remains frozen. This package is therefore a schema-gap candidate and must not be treated as merged normative product authority until the decision is explicitly accepted or the design is folded into an already-frozen authority object.
