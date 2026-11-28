# First soybean source admission — owner confirmation required

CTO source stewardship scope accepted: SOY-WUR-ROTUNDO-2024-01 only. This is unsigned technical preparation, NOT an IAM grant or a signed approval. No native records or credentials have been issued.

## Once-only actual owner confirmation

The actual organization's authorized human uses the established controlled identity channel to establish/confirm the ADR governance root, organization and tenant correspondence, sole steward principal, existing IAM grantor and real compiler service principal. The GEOX business tenant is known, but its ADR ownership mapping is not established. No identifier in the test fixtures or GitHub account is an alternative to the verified identity. Supply an independently verifiable root/owner attestation, issuer and current permission status through the owner-approved secure channel, not secrets in GitHub. The local owner binding example has intentionally null values. No generic JSON field or checkpoint hash constitutes authority.

## Exact execution inputs

Run prepare-soy-k01-k02.mjs against the exact WUR PDF (optional first argument is a locally obtained PDF). It checks all bytes, page count and page-specific anchors, binds each locator to the extracted page digest, produces unsigned Source, SourceArtifact, ScientificCompilerDefinition and ScientificCompilationResult proposal input. No raw PDF or page text is uploaded. Page text digest is NOT PDF-byte hash or K03 acceptance. K02 source assertion excludes reviewer interpretation; limitations remain separate. Source retention, author attribution, license link and adaptation notice required; underlying third-party data/model rights excluded.

The proposed compiler role is the native COMPILER_SERVICE, with exact source/artifact/compilation resource scopes, no platform-wide assignment. These resource labels are task-specific scope proposals, not pre-existing native compiler authorization operations. Current SourceRegistry/ScientificCompiler are low-level writers, not an authenticated admission service: owner-controlled execution must enforce exact source and input, current role status and rights before invocation. No new IAM system. No K03/K04/K06 authority inferred. If the actual owner policy uses different existing resource naming, obtain an explicit decision rather than expanding the scope.

## Execution order after independent owner attestation

1. Custodian verifies actual governance root, current actor/role and exact draft hash. If no root exists, HOLD until actual organization owner establishes it; do not construct a bootstrap from this example.
2. Owner-authorized SourceRegistry.registerSource with actual ownership and source-steward audit. Establish exact RightsPolicy and source grants for ACQUIRE and RETAIN_FULLTEXT, actual retention policy. Native source registration is first; do not invent an artifact ref to grant rights before it exists. Re-export a verified checkpoint.
3. Run read-only pre-artifact check using the owner-supplied binding, checkpoint and exact PDF. After actual approval, materializeArtifact under owner-approved durable storage (do not use temporary CI memory store as formal persistence). Verify contentHash, length and retention by reading the artifact through the native store. Establish artifact grants for READ_FOR_EXTRACTION, EXTRACT_CLAIM, RETAIN_DERIVED. Re-export checkpoint.
4. Run pre-compile check. After actual current authority confirmation, use createDeterministicCompilerDefinition and ScientificCompiler.materializeCompilationProposal with the exact proposal and service audit, native lineage, and actual source-artifact ref. Retain exact compiler and candidate refs. Export owner-controlled checkpoint.
5. Run readback check of candidate/context pair, compilation, refs, audits and exported exact retained bytes. This CLI checks content and ledger structure, not authenticity of the owner attestation or live role status. The actual custodian must independently verify those and the native retention read. It refuses nonempty rights obligations rather than claiming unsupported execution; owner must implement and prove any applicable obligations before actual writes.

Commands (owner machine only, no production credentials in command arguments):
```
node docs/design_partner/geox-e2e01-wp2/verify-soy-k01-k02.mjs pre-artifact unsigned.json checkpoint.json owner-binding.json source.pdf
node docs/design_partner/geox-e2e01-wp2/verify-soy-k01-k02.mjs pre-compile unsigned.json checkpoint.json owner-binding.json source.pdf
node docs/design_partner/geox-e2e01-wp2/verify-soy-k01-k02.mjs readback unsigned.json checkpoint.json owner-binding.json source.pdf
```

Owner updates checkpoint hash and exact refs after each stage. All outputs are structural receipts only, with write_authorized=false; not a substitute for controlled identity and current authorization. No automatic write command is enabled in this PR. K03/K04 require independent real qualified actors. No customer publication, deployment, secret, or action.
