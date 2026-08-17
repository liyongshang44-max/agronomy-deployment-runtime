# ADR v0.3 — Pilot Application Source Ingestion / Scientific Review Workbench

Status: **IMPLEMENTATION CONTRACT / NON-ARCHITECTURE-AUTHORITY**

Frontier: `ADR v0.3 Pilot Application — Source Ingestion + Scientific Review Workbench`

Baseline: `main @ bf1e7f1676da7e196b2988bc4f3876be652902df`

Upstream authority remains Architecture v1.0, final adjudication, Capability Map / Master Task Line / Version Slicing, and the already-closed K01–K06, A08/A10/A11 and P01/P06/P07/P08 implementation boundaries.

## 1. Purpose

The v0.3 capability release proves governed ADR semantics, but a real paper cannot yet be uploaded, retained, processed and reviewed through a running pilot application. This frontier supplies that executable product seam without changing scientific authority.

The first real end-to-end product path is:

```text
PDF upload
  -> exact retained bytes
  -> Source + SourceArtifact
  -> asynchronous extraction proposal
  -> ScientificCompiler
  -> ClaimCandidate + SourceContextCandidate
  -> source-faithful human review
  -> Claim + SourceContext
  -> scientific qualification
  -> QualifiedKnowledge
```

The permanent authority boundary is unchanged:

```text
browser != uploader != PDF parser != LLM != scientific authority
```

Parser/LLM output remains proposal-only. Existing K03/K04 authority actions remain the only path from candidates to source/scientific authority.

## 2. Large-PDF constraint

PDF ingestion MUST NOT require the complete file to be held in:

- browser JavaScript memory;
- JSON/base64 request bodies;
- Node.js API process memory;
- LLM context;
- AuthorityLedger semantic payloads.

The pilot upload protocol is streaming and content-addressed.

Local/single-node pilot:

```text
browser raw-body upload
  -> API streaming request
  -> tenant-scoped staging file
  -> incremental SHA-256 + byte count
  -> atomic commit into tenant-scoped content-addressable storage
```

Cloud deployment may replace the streaming API hop with presigned multipart object-store upload, but finalization MUST verify the provider/object-store checksum or independently stream-verify the completed object before authority publication.

No client-supplied SHA-256, Content-Length or MIME header is trusted as evidence identity.

## 3. Two-phase upload protocol

### Phase A — operational staging

`POST /operator/source-uploads`

Creates a non-authority upload session containing only operational metadata:

- organization / tenant scope;
- original filename;
- declared media type;
- intended Source metadata;
- upload state;
- expiry / operational timestamps.

The session creates no SourceArtifact authority.

`PUT /operator/source-uploads/{upload_id}/content`

Accepts raw request bytes (`application/pdf`) and streams them into scoped staging storage.

While streaming, the server/store:

1. counts exact bytes;
2. computes SHA-256 incrementally;
3. validates configured maximum size without buffering the body;
4. captures enough prefix bytes to validate PDF signature;
5. fsyncs/closes the staged object before commit;
6. atomically commits it to content-addressed retention.

A successful store operation returns a server-generated **retention receipt**:

```text
storeKind
retentionId
contentHash = sha256:<hex>
byteLength
scope
```

This receipt is operational evidence of retained exact material. It is not itself SourceArtifact authority.

### Phase B — authority finalization

`POST /operator/source-uploads/{upload_id}/finalize`

Finalization:

1. re-resolves the retained object by the exact Source ownership scope;
2. verifies the retention receipt against storage metadata;
3. publishes `Source`;
4. publishes `SourceArtifact` bound to the exact retained content hash / byte length / retention identity;
5. creates an asynchronous extraction job.

A client cannot submit an arbitrary retention receipt and mint SourceArtifact authority. The SourceRegistry/storage adapter must reproduce the receipt from retained material.

## 4. Streaming SourceRegistry extension

K01's existing `materializeArtifact({ bytes })` remains valid for small/in-memory callers and acceptance fixtures.

Large-file ingestion adds a versioned compatibility seam rather than changing that method in place:

```text
materializeRetainedArtifact({ retentionReceipt, ... })
```

It is accepted only when the configured artifact store supports scoped retained-object inspection and proves:

```text
receipt.scope == exact Source ownership
receipt.contentHash == retained object content hash
receipt.byteLength == retained object byte length
receipt.retentionId == retained object retention identity
```

The core never trusts browser/upload-session metadata for these fields.

Large downstream consumers use a streaming artifact-read seam. Existing `readArtifactBytes()` remains for bounded callers but must not be the parser path for large PDFs.

## 5. Storage identities and tenant isolation

P07 remains authoritative for the storage isolation rule:

```text
contentHash = global evidence identity
retained storage identity = organization/tenant scope + contentHash
```

Two tenants can retain identical PDF bytes and therefore share the same evidence hash while having independent storage objects/retention controls.

The local filesystem pilot adapter must derive safe storage paths from a cryptographic scope key rather than raw tenant strings.

No unscoped `get(contentHash)` API is exposed by the durable pilot store.

## 6. Upload limits and backpressure

The API has a configurable `ADR_MAX_SOURCE_UPLOAD_BYTES` rather than a hard-coded domain limit. Pilot default: **1 GiB**.

The limit is an operational protection only; it is not agronomic or scientific authority.

The stream must stop once the measured byte count exceeds the configured limit, delete the partial staging object and return `413 Payload Too Large`.

Backpressure is preserved end-to-end using Node streams / object-store multipart flow. Reverse proxies must be configured not to buffer the entire request body.

## 7. PDF validation and parsing boundary

Upload acceptance checks only file/container safety sufficient for ingestion:

- non-empty body;
- PDF signature begins with `%PDF-` after allowed leading transport bytes are excluded by policy;
- configured byte limit;
- successful durable store commit.

It does **not** claim the PDF is scientifically valid, parseable, non-malicious, or complete.

Parsing occurs asynchronously in an isolated worker.

Parser output must preserve document coordinates (page and text/block coordinates where available) so later ClaimCandidate locators can point back to the exact SourceArtifact. OCR, if later needed, is a separate transformation/provenance step and cannot silently replace original PDF evidence.

## 8. Extraction worker boundary

A worker receives an exact SourceArtifact reference and streams the retained PDF. It may create derived parser artifacts/text for processing, but the original PDF remains the evidence root.

The worker produces a `CompilationProposal` only. Existing ScientificCompiler rules remain unchanged:

```text
LLM/provider output -> CANDIDATE_PROPOSAL / PROPOSAL_ONLY
```

No worker is allowed to publish Claim, SourceContext, QualifiedKnowledge, ApplicabilityAssessment or deployment/runtime authority directly.

Long papers are processed page/block/chunk-wise. The LLM is never required to receive the whole PDF in one prompt. A final deterministic reconciliation pass merges candidate keys/locators without widening assertions.

## 9. Minimal pilot web application

The first frontend has four product surfaces only.

### Source library / upload

- drag/drop PDF;
- title / DOI / source type / edition metadata;
- explicit rights/governance metadata;
- upload progress based on streamed bytes;
- resumable/multipart support when the storage adapter supports it.

### Processing status

Shows operational states only:

```text
CREATED
UPLOADING
STORED
SOURCE_MATERIALIZED
EXTRACTION_QUEUED
EXTRACTING
CANDIDATES_READY
FAILED
```

These states are not scientific authority.

### Source-faithful review

Primary review screen is split-view:

```text
exact PDF/page evidence | ClaimCandidate + SourceContextCandidate
```

The reviewer can accept or reject under existing K03 semantics. The UI does not provide a generic edit-and-save path that mutates a candidate into authority.

A materially corrected assertion requires a new candidate/extraction version; semantic context adjudication uses the existing governed K03 path.

### Qualification / knowledge library

Accepted Claim/SourceContext pairs can be qualified using existing K04 authority actions and then shown in a searchable knowledge library with provenance back to the exact source artifact.

## 10. Operator API vs frozen P01 public API

Paper ingestion is **not** added to the frozen P01 `/v1` public pilot operation registry in this frontier.

Initial endpoints live under an operator/application boundary, e.g.:

```text
/operator/source-uploads
/operator/source-uploads/{id}/content
/operator/source-uploads/{id}/finalize
/operator/source-uploads/{id}
/operator/review-queue
/operator/qualification-queue
```

This prevents a temporary upload UX from becoming permanent public domain semantics. A later public source-ingestion API can be separately versioned if design-partner evidence shows it belongs in the external contract.

## 11. Persistence model

The pilot application needs two durable classes of state:

```text
Postgres (or equivalent)
  authority records
  lineage/audit
  upload/job/workflow state
  review instrumentation

scoped object storage
  exact original PDF bytes
  parser/extraction working artifacts where policy permits
```

The existing in-memory AuthorityLedger / P07 artifact store remain acceptance/reference implementations; a running pilot must supply durable adapters before it can claim restart persistence.

## 12. First acceptance gate

This frontier is not closed merely because a web page renders.

The first real acceptance must prove with a generated large PDF fixture (large enough to detect accidental full buffering):

```text
streamed upload completes without request-body base64/JSON
authoritative contentHash equals independently computed hash
byteLength equals exact uploaded bytes
wrong tenant cannot inspect/read retained object
restart preserves retained object and workflow state
SourceArtifact finalization rejects forged/mismatched retention receipt
parser reads artifact as a stream
LLM/extractor output remains proposal-only
source-faithful review still gates Claim/SourceContext authority
```

A later real-paper benchmark then measures scientific extraction quality; it is not a substitute for this application/runtime acceptance.

## 13. Explicit nonclaims

This frontier does not establish:

- production CDN / global upload acceleration;
- arbitrary-size unlimited uploads;
- antivirus/sandbox certification;
- OCR correctness;
- publisher crawling / DOI download rights;
- copyright/license interpretation;
- LLM scientific correctness;
- agronomic correctness;
- design-partner willingness to pay;
- public source-ingestion API stability;
- v1.0 enterprise HA.

The purpose is narrower: make the already-governed ADR knowledge pipeline operable on real, potentially large scientific source files without weakening exact-material provenance or human authority boundaries.
