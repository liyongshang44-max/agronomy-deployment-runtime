# Agronomic Policy Compilation

This package represents governed operationalization of agronomic knowledge into deployable Policy semantics without collapsing Source, Knowledge, Model, Policy, execution, or Outcome authority boundaries.

Core invariants:

- Protocol documents remain `Source` authority.
- Scientific assertions remain `Claim` / `QualifiedKnowledge` / `DerivedKnowledge` authority.
- Computational state derivation remains `Model` authority.
- Decision logic remains `Policy` authority.
- `AgronomicPolicyCompilation` records how exact knowledge/model/policy authorities were operationalized into a declarative agronomic rule and who approved that operationalization.
- The declarative rule is content-addressed by `ruleHash`.
- `losslessCoverage` must explicitly declare whether protocol semantics were completely represented.
- Field execution and later outcomes are outside this package.

The v1 declarative rule vocabulary covers trigger predicates, temporal persistence/windows, exceptions, action timing, parameter expressions, fallback, human gate, and exact knowledge authority bindings.
