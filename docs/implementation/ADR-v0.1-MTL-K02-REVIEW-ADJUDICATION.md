# ADR v0.1 — MTL-K02 Scientific Compiler Review Adjudication

Status: **IMPLEMENTATION REVIEW / NON-ARCHITECTURE-AUTHORITY**

Task: `MTL-K02 — Scientific Compiler Candidate Pipeline`

Purpose: record the independent review performed after the first K02 CI run and close implementation seams without changing Architecture v1.0, C03 capability semantics or the Master Task Line.

---

## 1. First CI failure was acceptance-boundary drift, not a scientific/compiler authority failure

The first K02 CI run failed on two test assumptions:

1. passing a `Source` ref into the compiler is rejected by the upstream `SourceRegistry` boundary as `SOURCE_ARTIFACT_REQUIRED`, rather than being rewrapped as `ScientificCompilerError`;
2. `AuthorityLedger.auditFor(ref)` returns all audit events in which a ref is the object **or an input**, so a ClaimCandidate can correctly appear in its own publication event plus downstream SourceContext/CompilationResult events.

The acceptance suite was corrected to test the actual authority boundary:

```text
Source input → rejected before compilation
ClaimCandidate direct publication audit → exact SourceArtifact + compiler-definition refs
```

No Architecture or Capability change was required.

---

## 2. Async extractor rejection must occur before async function invocation

The initial helper invoked an extractor and only then rejected a Promise result. For a native `async` extractor, code before the first `await` could therefore execute before the core rejected the result.

The helper now rejects native `AsyncFunction` / `AsyncGeneratorFunction` extractors **before invocation**, and still rejects any Promise-like result returned by an otherwise synchronous function.

The boundary is:

```text
trusted local synchronous deterministic extractor
→ may be invoked in-process

external / LLM / provider work
→ must happen in worker/adapter/integration code
→ proposal submitted to materializeCompilationProposal
```

`compileWithExtractor` is a local/reference helper, not an untrusted plugin/execution-provider interface.

---

## 3. Proposal materialization is not yet a durable transactional compiler job

K02 uses the F02 in-memory append-only reference ledger. All proposal shape/source-locator/context-family validation occurs before candidate publication, which prevents ordinary malformed proposals from partially publishing candidates.

However K02 does **not** claim a durable database transaction spanning:

```text
ClaimCandidate(s)
+ SourceContextCandidate(s)
+ ScientificCompilationResult
```

A later publication collision/storage failure could leave immutable proposal records that are not referenced by a completed ScientificCompilationResult.

This is acceptable for K02 only under two permanent constraints:

1. these records are `CANDIDATE_PROPOSAL` only and cannot become qualified authority by existence alone;
2. K03 review/materialization must consume candidates through an exact completed `ScientificCompilationResult` (or an equivalently governed review envelope), not by scanning arbitrary orphan candidate rows.

Durable atomic job persistence/recovery belongs to later persistence/async productization work; K02 must not claim it.

---

## 4. Compiler authorization is not duplicated inside scientific core

F03 already established scoped authorization/entitlement semantics, including a least-privilege Compiler service role. K02 scientific core deliberately does not import the authorization package to create a second hidden authorization policy.

Future worker/API orchestration that invokes compiler materialization must enforce F03 authorization and record the authorization decision. K02 itself guarantees the stronger scientific-authority invariant:

```text
whatever principal invokes the candidate pipeline,
its outputs cannot be QualifiedKnowledge / Deployment / Decision authority.
```

This keeps:

```text
IAM authorization
≠ scientific candidate semantics
```

without weakening either boundary.

---

## 5. Review disposition

After correcting acceptance-boundary assumptions and the async pre-invocation seam:

- exact SourceArtifact remains mandatory;
- candidate source provenance remains content-addressed and replayable;
- all six SourceContext families remain explicit;
- unsupported/inferred context cannot be laundered into source assertions;
- compiler configuration/version remains exact provenance;
- candidate output remains proposal-only;
- core package still contains no provider/network dependency;
- no Compiler→Qualification self-authorizing path exists.

No Architecture v1.0 amendment or Capability Map change is required.

The next task after K02 acceptance remains:

```text
MTL-K03 — Claim / SourceContext Source-Faithful Authority
```
