# ADR v0.1 — MTL-K02 Scientific Compiler Candidate Pipeline Implementation Contract

Status: **IMPLEMENTATION CONTRACT / NON-ARCHITECTURE-AUTHORITY**

Task: `MTL-K02 — Scientific Compiler Candidate Pipeline`

Baseline: `main @ 2990bc8435f063a02a7a72ba43e06dfa17bd4a08`

Upstream authority remains Architecture v1.0, Capability Map 01, Master Task Line 01 and Version Slicing 01.

---

## 1. Compiler authority boundary

The Scientific Compiler consumes one exact `SourceArtifact` and produces candidate-only objects:

```text
SourceArtifact
    ↓
ScientificCompilerDefinition
    ↓
ClaimCandidate
+
SourceContextCandidate
    ↓
ScientificCompilationResult
```

Permanent invariant:

```text
Compiler output authority = PROPOSAL ONLY
```

The compiler cannot produce:

```text
Claim
SourceContext
QualifiedKnowledge
KnowledgeRelease
ApplicabilityAssessment
RuntimeEligibility
DecisionResult
```

Those belong to later review/control/runtime tasks.

---

## 2. Exact input binding

Every candidate freezes:

```text
exact Source ref
exact SourceArtifact ref
exact SourceArtifact raw contentHash
exact ScientificCompilerDefinition ref
source locator
```

A `Source`, URL, citation or provider locator alone is not a legal compiler input.

The SourceArtifact is resolved and its retained bytes re-verified before candidate materialization.

---

## 3. ScientificCompilerDefinition

The compiler definition is immutable/versioned through the shared F02 authority substrate and freezes:

```text
compilerId
implementationVersion
extractionContractVersion
locatorContractVersion
configuration
outputAuthority = CANDIDATE_ONLY
```

A prompt/model/parser/extractor configuration change that is material to extraction must therefore create a different compiler-definition semantic identity/version.

Secrets and transient credentials must not be placed in compiler-definition semantic configuration. They belong to later integration/operations infrastructure.

---

## 4. ClaimCandidate

The initial candidate claim-type vocabulary follows the frozen Domain Model representative claim classes:

```text
SEMANTIC_DEFINITION
PARAMETER
RELATIONSHIP
BIOLOGICAL_PATTERN
CAUSAL_EFFECT
STATISTICAL_ASSOCIATION
MODEL_ASSUMPTION
OPERATIONAL_RECOMMENDATION
BOUNDARY_CONSTRAINT
EVALUATION_CLAIM
```

A ClaimCandidate stores:

```text
candidate claim type
source-faithful assertion proposal
optional structured extraction proposal
exact source provenance
exact source locator
compiler-definition provenance
optional extraction confidence
candidate-only authority marker
```

Extraction confidence is proposal metadata. It never grants scientific qualification.

---

## 5. Source locator contract

K02 supports exact artifact-bound locators:

### WHOLE_ARTIFACT
Binds the entire retained artifact content hash/length.

### BYTE_RANGE
Binds exact byte offsets and computes a raw evidence hash over the selected bytes.

### DOCUMENT_COORDINATE
Binds a declared coordinate scheme and canonical coordinates to the exact SourceArtifact. This supports page/section/parser-coordinate schemes where raw byte offsets are not the useful review representation.

A locator never substitutes for the SourceArtifact content identity.

---

## 6. SourceContextCandidate and non-inference rule

Every claim candidate receives one SourceContextCandidate proposal spanning all frozen context families:

```text
BIOLOGICAL
ENVIRONMENTAL
MANAGEMENT
OPERATIONAL
MEASUREMENT
JURISDICTION_ECONOMIC
```

Every family is explicitly marked:

```text
REPORTED
or
NOT_REPORTED
```

Rules:

```text
NOT_REPORTED → no candidate values allowed
REPORTED     → at least one source-supported dimension required
```

Every reported dimension must use:

```text
supportClass = EXPLICIT_SOURCE
```

and must carry an artifact-bound source locator.

The candidate pipeline rejects inferred/defaulted context values rather than silently converting them into source assertions.

This does not prove the source statement is scientifically true. It proves only that the candidate is presented as source-supported rather than platform-invented.

---

## 7. Core/external compiler execution boundary

`packages/scientific-compiler` does not call network providers directly.

Two legal paths exist:

### Local deterministic extractor
A synchronous in-process extractor may receive a defensive copy of retained artifact bytes and produce a candidate proposal. This exists primarily for deterministic/reference acceptance.

### External/LLM worker path
A future worker/adapter may call an LLM/parser/provider and then submit the resulting proposal to `materializeCompilationProposal` together with the exact SourceArtifact and compiler-definition references.

The core package validates and freezes the proposal; it does not obtain scientific authority merely because an external model produced it.

---

## 8. Compilation result

`ScientificCompilationResult` freezes:

```text
exact Source / SourceArtifact
exact compiler definition
ClaimCandidate refs
SourceContextCandidate refs
candidate count
run metadata
outputAuthority = PROPOSAL_ONLY
```

Candidate and context refs are exact/versioned. Re-running a published compilation identity with changed semantics is rejected rather than rewriting history.

---

## 9. Audit and genealogy

Each ClaimCandidate audit event binds:

```text
SourceArtifact ref
ScientificCompilerDefinition ref
```

Each SourceContextCandidate additionally binds its ClaimCandidate.

The compilation result binds all candidate/context refs.

This establishes extraction genealogy before K03 converts reviewed candidates into source-faithful Claim / SourceContext authority.

---

## 10. Explicit nonclaims

K02 does not establish:

```text
Claim authority
SourceContext authority
scientific qualification
conflict resolution
KnowledgeRelease
field applicability
runtime legality
decision authority
LLM factual correctness
scientific truth
```

A green compiler pipeline means the extraction proposal is exact-source-bound, reproducible under its frozen compiler contract, and authority-safe. It does not mean the extracted assertion is correct.

---

## 11. K02 closure statement

K02 is accepted only when tests prove at least:

```text
SourceArtifact is mandatory input
candidate output is proposal-only
candidate binds exact SourceArtifact/contentHash/compiler definition
source locators are artifact-bound
all six SourceContext families are explicit
NOT_REPORTED cannot carry hidden values
inferred/defaulted context is rejected
changed compiler configuration changes provenance identity
deterministic clean replay reproduces candidate semantic identities
same published candidate version cannot be rewritten
async/external provider access is not hidden inside core packages
candidate audit binds exact artifact/compiler inputs
```

Passing K02 unlocks:

```text
MTL-K03 — Claim / SourceContext Source-Faithful Authority
```
