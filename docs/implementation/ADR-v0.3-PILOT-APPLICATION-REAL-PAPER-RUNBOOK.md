# ADR v0.3 Pilot Application — First Real-Paper Runbook

Status: IMPLEMENTATION RUNBOOK — NOT DOMAIN AUTHORITY

This runbook covers the first supervised real-paper execution of the ADR v0.3 pilot application. It does not promote LLM output to scientific authority and does not claim commercial or agronomic validation.

## 1. Scope of the first run

The first run exercises exactly this chain:

```text
real PDF
  -> exact retained bytes
  -> Source + SourceArtifact
  -> external model extraction
  -> CompilationProposal (PROPOSAL_ONLY)
  -> ScientificCompiler
  -> ClaimCandidate + SourceContextCandidate
  -> human source-faithful review
  -> ACCEPT or REJECT
  -> accepted Claim + SourceContext
```

The first run stops before scientific qualification. `QualifiedKnowledge`, KnowledgeRelease, applicability, runtime eligibility, deployment authority, and agronomic outcome claims are not required for this smoke/validation run.

## 2. Runtime prerequisites

The repository `package.json` requires Node.js 24.x.

On Windows PowerShell, confirm:

```powershell
node --version
npm --version
```

Use the implementation branch while PR #56 remains unmerged:

```powershell
git fetch origin
git switch feat/v0.3-pilot-application-source-ingestion
git pull --ff-only
```

Do not place an OpenAI API key in Git, source files, screenshots, issue comments, or chat transcripts.

## 3. Environment

Use a fixed model for a benchmark run. The first baseline is:

```text
provider = OpenAI Responses API
model = gpt-5.6
```

Set environment variables locally:

```powershell
$env:ADR_OPERATOR_TOKEN="choose-a-local-random-token"
$env:ADR_OPERATOR_ID="local-scientific-reviewer"
$env:OPENAI_API_KEY="<set locally; do not commit>"
$env:ADR_EXTRACTION_MODEL="gpt-5.6"
$env:ADR_DATA_DIR="$PWD\.adr-pilot"
```

Optional operational guardrail:

```powershell
$env:ADR_MAX_SOURCE_UPLOAD_BYTES="1073741824"
```

The default is 1 GiB. This is an operational upload ceiling, not an agronomic or scientific boundary.

## 4. Preflight

Run the exact branch acceptance before introducing a real paper:

```powershell
npm test
```

Then start the pilot host:

```powershell
npm start
```

Expected local endpoint:

```text
http://127.0.0.1:8787
```

Check readiness:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/readyz
```

Expected material properties include:

```text
ready = true
authorityPersistence = LOCAL_CHECKPOINT_RESTART_DURABLE_V1
artifactPersistence = FILESYSTEM_SCOPED_CONTENT_ADDRESSABLE
extraction.configured = true
extraction.proposalAuthority = PROPOSAL_ONLY
sourceFaithfulReview.humanDispositionRequired = true
```

Do not proceed with a real paper if extraction is not configured or if the host fails to restore an existing checkpoint cleanly.

## 5. Select the first paper

Use one legitimate PDF whose external-model processing is permitted for this test. Prefer an open-access agronomy paper with:

- explicit crop and treatment context;
- a clear Methods section;
- quantitative Results;
- at least one non-trivial context boundary such as cultivar, growth stage, soil, irrigation regime, dose, timing, site, or year;
- enough complexity to expose over-generalization, but not a review/meta-analysis for the first smoke run.

Do not use a confidential or contract-restricted paper unless its rights permit sending the document to the configured external model provider.

## 6. Upload and materialize exact source evidence

Open the pilot workbench in a browser.

Enter:

- operator bearer token;
- organization/tenant scope;
- paper title;
- DOI if known;
- source type;
- rights basis.

Select the PDF and upload it.

The upload path is streaming. The browser does not base64-encode the paper into JSON, and the server does not require a whole-file application Buffer.

Before finalization, ADR must retain the exact PDF and reproduce:

```text
contentHash = sha256:<exact bytes>
byteLength = <measured server-side length>
retentionId = tenant-scoped retained-object identity
```

Then click:

```text
Finalize Source + SourceArtifact
```

Record for the test report:

- Source ref;
- SourceArtifact ref;
- SHA-256;
- byteLength.

## 7. Explicitly authorize external extraction

PDF retention rights and permission to send the paper to an external model are separate decisions.

The extraction button remains unavailable until the operator explicitly confirms that this SourceArtifact may be sent to the configured provider for this run.

Only after that confirmation click:

```text
Extract Claim Candidates
```

Expected chain:

```text
retained PDF stream
 -> bounded provider upload
 -> OpenAI Responses API
 -> strict JSON Schema
 -> CompilationProposal
 -> ScientificCompiler
 -> ClaimCandidate + SourceContextCandidate
```

No output at this stage is a `Claim`, `SourceContext`, or `QualifiedKnowledge` authority.

## 8. Source-faithful review

For every candidate, compare the machine assertion against the exact PDF evidence.

Review at least these dimensions:

1. Does the paper actually assert the candidate statement?
2. Is the claim type correct?
3. Does the page/evidence locator point to supporting source text?
4. Did extraction broaden population, crop, cultivar, stage, site, year, treatment, dose, timing, environment, measurement, or management conditions?
5. Did it convert association into causality?
6. Did it convert Discussion speculation into measured Results?
7. Did it invent a context value that the paper did not explicitly report?

### ACCEPT

Use `ACCEPT_SOURCE_FAITHFUL` only when the assertion is source-faithful.

For every reported context dimension, adjudicate the canonical semantic identity and value type. Example:

```text
candidate semanticHint: crop.identity
candidate value: maize

review adjudication:
semanticId: crop.code
valueType: CATEGORY
```

K03 review must not silently normalize or invent a different unit.

An accepted review may mint:

```text
Claim(authorityClass = SOURCE_ASSERTION)
SourceContext
```

This still does not qualify the claim for a scientific use or for a target field.

### REJECT

Use `REJECT_SOURCE_FAITHFUL` when the candidate is unsupported, over-broad, mislocated, misclassified, or otherwise not source-faithful.

A rejection requires a reason and must mint neither Claim nor SourceContext.

## 9. Restart proof

After at least one finalized SourceArtifact, stop the process normally and restart:

```powershell
# stop the running host, then
npm start
```

Check:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/readyz
```

An existing runtime should report checkpoint restoration rather than an empty runtime.

The local checkpoint is stored below `ADR_DATA_DIR` and includes the AuthorityLedger and upload-session journal. Startup revalidates authority semantic hashes, audit/lineage integrity, session bindings, retained PDF identity, SHA-256, and byte length. Corrupt or inconsistent state must fail closed.

This is single-node local restart durability, not a multi-process/database durability claim.

## 10. First-run evidence report

For the first real paper, capture:

```text
paper title / DOI
Source ref
SourceArtifact ref
SHA-256
byteLength
provider
model
promptVersion
schemaVersion
candidate count
accepted unchanged count
rejected count
context adjudication corrections
unsupported-inference count
bad-locator count
missed important claims (manual review)
review minutes
```

The primary hard failures are:

```text
accepted unsupported claim > 0
broken provenance > 0
inferred context laundered as source fact > 0
```

The first run is diagnostic. A low score means extraction/review implementation needs correction; it does not justify changing ADR authority boundaries to make the test easier.

## 11. Current nonclaims

This pilot application does not yet claim:

- scientific qualification of accepted Claims;
- domain-authoritative agronomic correctness without expert adjudication;
- automatic SourceContext-to-TargetContext transportability;
- autonomous runtime/deployment authority;
- commercial validation;
- distributed/multi-process persistence;
- adversarially authenticated checkpoint storage.

The next decision after the first real paper is evidence-driven: fix extraction/review defects first, then decide whether a qualification UI is necessary before expanding the benchmark corpus.
