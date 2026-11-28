# ADR_WP2_SOURCE_AND_AUTHORITY_PACKAGE

Status: UNSIGNED / CANDIDATE ONLY / NOT A BOOTSTRAP PACKAGE / NO DOMAIN AUTHORITY.

CTO 2026-11-27 WP2 construction. GEOX product DRI. ADR baseline d63c3058d6b95873e811445920f7302ded980ef3. See unsigned-package.json for two source candidates, claim-level locators, scientific context, exact business envelope, and ten approval request slots. No approved native references are fabricated. No source text or secret is committed.

## Source acquisition and rights

The prior maize H40 edition (DOI 471088) remains HOLD for bytes and rights; it is superseded as an unsigned candidate, not promoted. The retained historical observation is bound to the previous package hash and head. The bounded new candidate is Holzhauser et al. (2026), DOI 10.1017/S0021859626100719, publisher PDF inspected, CC BY 4.0 identified, original-byte receipt still pending. It concerns northern-European silage maize model transfer and validation; no prior handbook claim or parameter is carried over. The article license does not establish native owner policy or grant rights to underlying data or code. See reviewer-input-20261127.md for the exact review request and remaining authority inputs. WUR's 2015 soybean page only yielded metadata, not full text. The WUR-indexed 2024 peer-reviewed article (WUR coauthor Chris de Visser) is the bounded alternate, previously included in WP2 candidate plan. CC BY 4.0 covers the article subject to attribution/change notice/third-party exceptions; no claim that underlying data licenses or formal source owner policy are granted. Candidate claims are descriptive evidence for a retrieval purpose, not a 2027 decision, forecast or prescription.

The public source receipt workflow obtains official PDFs in ephemeral CI, computes the original byte digest using native K01 sourceContentHash, checks identity on the text extracted from PDF, then deletes bytes. It uploads no PDF, full text or credentials. A missing/blocked/mismatched source is HOLD, not a digest of the web text. The source manifest raw_sha256 is null until a receipt is actually accepted; logs are independent evidence and do not create SourceArtifact. Formal materialization and retention require rights approval.

## Approval assembly (no execution)

Reuse existing objects if the owner can provide a validated non-synthetic checkpoint. The native K03 review and K04 qualification must bind exact source artifact, compiler candidates, source context, owner policy, actual reviewer/approver and decisions. Use K06 native KnowledgeReleaseService; exact member entitlements and conflict lifecycle. A05 publishRuntimeProfile and A06 publishDeployment must bind approved release, actual organization/tenant/program, crop and decision scope and effective interval. Native A01 creation uses exact DECISION_PROBLEM resource; A07 uses exact DEPLOYMENT_RUNTIME_READ authorization. Request digest remains separately bound by GEOX Consumer, not inferred from the deterministic id. A01 logical timestamp/evaluation time and decision deadline are unsigned until actual run planning. No default organization, no fabricated Principal, no auto-generated RoleAssignment, no signature.

The read-only replay utility checks a supplied checkpoint against exact refs via the existing native restore, release, profile and deployment validators, then current A07 runtime authorization. It checks the exact A01 authorization using native authorizeDecisionProblemCreation against the retained RoleAssignment refs. Structural replay is explicitly not proof of human approval, source rights, live credential validity or target correspondence. Output is an engineering check only. No method publishes any object. Caller supplies real owner-accepted materials separately, never secrets in GitHub.

## Isolated pilot preparation

Do not repurpose the current SYNTHETIC_SMOKE /data volume. Native initializePilotRuntime prefers an existing state file to bootstrap env, therefore new isolated volume + empty state path, separate snapshot directory and separate secret namespace are required. Restore exact approved checkpoint before any service starts. No env changes or Railway deployment in this branch. Formal launch must independently verify owner-approved package digest, exact native references, request bindings and current revocation/validity, then native /ready non-synthetic, negative isolation, stable idempotency, and restart. Neither a changed metadata.mode nor structural replay is sufficient. No A02/A04/A08 in zero-document E2E01; no scientific conclusion or execution authority.

## Reproduce
- `node --test docs/design_partner/geox-e2e01-wp2/prepare.test.mjs`
- `node docs/design_partner/geox-e2e01-wp2/acquire-source-receipts.mjs` (public network and pdftotext required; emits metadata only)
- `node docs/design_partner/geox-e2e01-wp2/replay-checkpoint.mjs <owner-checkpoint.json> <exact-replay-input.json>` (real approved artifacts are not supplied in this branch; schema in replay-input.example.json; never copy secrets into it).
