export const ADR_MANUAL_EXTRACTION_PROMPT_VERSION = 'adr-paper-extraction-prompt-v3';
export const ADR_MANUAL_EXTRACTION_CONTRACT = 'ADR_ATOMIC_SINGLE_LOCATOR_V3';

export const ADR_MANUAL_EXTRACTION_CLAIM_TYPES = Object.freeze([
  'SEMANTIC_DEFINITION',
  'PARAMETER',
  'RELATIONSHIP',
  'BIOLOGICAL_PATTERN',
  'CAUSAL_EFFECT',
  'STATISTICAL_ASSOCIATION',
  'MODEL_ASSUMPTION',
  'OPERATIONAL_RECOMMENDATION',
  'BOUNDARY_CONSTRAINT',
  'EVALUATION_CLAIM'
]);

export const ADR_MANUAL_EXTRACTION_CONTEXT_FAMILIES = Object.freeze([
  'BIOLOGICAL',
  'ENVIRONMENTAL',
  'MANAGEMENT',
  'OPERATIONAL',
  'MEASUREMENT',
  'JURISDICTION_ECONOMIC'
]);

export function manualExternalExtractionPromptV3() {
  return `You are performing evidence-faithful scientific claim extraction for an Agronomy Deployment Runtime (ADR).

IMPORTANT:
You are NOT summarizing the paper.
You are producing PROPOSAL_ONLY candidate scientific assertions for later compiler preflight and human source-faithful review.

Extraction contract version: ${ADR_MANUAL_EXTRACTION_PROMPT_VERSION}
Contract profile: ${ADR_MANUAL_EXTRACTION_CONTRACT}

HARD RULES

1. Extract only claims materially asserted by the attached PDF.
2. Do not add agronomic, statistical, geographic, biological, operational, or economic knowledge from background knowledge.
3. Do not generalize beyond the population, crop, cultivar, geography, year, management system, treatment, timing, measurement design, model assumptions, or experimental/observational conditions explicitly supported by the source.
4. Do not convert discussion/speculation into measured evidence or operational recommendation.
5. Do not convert an association into a causal effect unless the study design and source wording support the causal interpretation.
6. Each claim must be independently reviewable and independently evidencable.
7. ONE CLAIM = ONE ATOMIC ASSERTION. Do not combine separately supportable facts merely because they are related.
8. The claim-level sourceLocator.evidenceText must, by itself, explicitly support EVERY MATERIAL PROPOSITION in the assertion. A reviewer must not need another paragraph, table row, footnote, SourceContext locator, or background knowledge to complete the proof of that assertion.
9. SourceContext locators DO NOT substitute for incomplete claim-level evidence. SourceContext scopes/interprets a claim; it is not a second hidden evidence channel for the claim assertion.
10. If an assertion would require two or more non-contiguous evidence fragments, split it into separate claims when doing so preserves source meaning. If it cannot be split without losing a material qualifier, DO NOT EMIT THAT CLAIM under this single-locator contract. Abstain rather than decontextualize it.
11. Do not combine multiple metrics, sample counts, treatment/control branches, parameter values, effect measures, robustness-test outcomes, or boundary clauses in one claim unless ONE short contiguous source excerpt explicitly covers the complete combined assertion.
12. For PARAMETER claims, preserve every material qualifier needed to interpret the parameter: comparator, value, unit, statistic, depth, timing/window, treatment scope, measurement definition, and conditional status when explicitly part of the source parameter. If a material qualifier is supported only elsewhere and cannot be covered by the same exact evidence fragment, do not emit a decontextualized parameter.
13. Preserve temporal semantics exactly. A fixed interval/window must not be rewritten as a minimum duration, maximum duration, persistence rule, recurrence rule, or other temporal meaning unless the source explicitly says so.
14. For binary/paired definitions, either cite one contiguous excerpt that contains both branches or emit separately reviewable branches if each branch remains semantically valid on its own. Never assert both branches while citing only one.
15. For causal estimates, include design/identification limitations in the assertion when they are material to the source's causal wording and can be evidenced by the same claim-level excerpt. If the required causal qualifier is only supported in a separate non-contiguous fragment and omitting it would strengthen the claim, do not emit the stronger claim.
16. Context values must only be recorded when explicitly supported by the source AND materially relevant to the scope or interpretation of that claim. Do not attach unrelated facts merely because they are true elsewhere in the paper.
17. Every reported context dimension must use supportClass EXPLICIT_SOURCE and point to the exact PDF page containing its explicit evidence.
18. If a context family is not explicitly and materially reported for the claim, mark it NOT_REPORTED with dimensions []. Never infer missing context.
19. evidenceText must be a short phrase actually present in the PDF on the stated 1-based page. Do not paraphrase evidenceText.
20. Prefer omission over a candidate whose assertion, qualifier, context, or evidence binding is uncertain.
21. confidence is extraction confidence only. It is not scientific validity or authority. Do not use 0.99/1.0 mechanically.
22. Return JSON only. No markdown and no explanation outside the JSON.

Allowed claimType values:
${ADR_MANUAL_EXTRACTION_CLAIM_TYPES.join('\n')}

Required SourceContext families for every claim:
${ADR_MANUAL_EXTRACTION_CONTEXT_FAMILIES.join('\n')}

Return exactly this top-level structure:
{
  "promptVersion": "${ADR_MANUAL_EXTRACTION_PROMPT_VERSION}",
  "claims": [
    {
      "key": "short-stable-key",
      "claimType": "EVALUATION_CLAIM",
      "assertion": "One atomic source-faithful assertion fully supported by the single claim-level evidence fragment.",
      "confidence": 0.0,
      "sourceLocator": {
        "kind": "DOCUMENT_COORDINATE",
        "scheme": "PDF_PAGE_TEXT_V1",
        "coordinates": {
          "page": 1,
          "evidenceText": "short exact phrase from source that supports the whole assertion"
        }
      },
      "sourceContext": {
        "BIOLOGICAL": { "status": "NOT_REPORTED", "dimensions": [] },
        "ENVIRONMENTAL": { "status": "NOT_REPORTED", "dimensions": [] },
        "MANAGEMENT": { "status": "NOT_REPORTED", "dimensions": [] },
        "OPERATIONAL": { "status": "NOT_REPORTED", "dimensions": [] },
        "MEASUREMENT": { "status": "NOT_REPORTED", "dimensions": [] },
        "JURISDICTION_ECONOMIC": { "status": "NOT_REPORTED", "dimensions": [] }
      }
    }
  ]
}

When a context family is REPORTED, use dimensions like:
{
  "status": "REPORTED",
  "dimensions": [
    {
      "semanticHint": "crop.identity",
      "valueCandidate": "maize",
      "supportClass": "EXPLICIT_SOURCE",
      "confidence": 0.90,
      "sourceLocator": {
        "kind": "DOCUMENT_COORDINATE",
        "scheme": "PDF_PAGE_TEXT_V1",
        "coordinates": {
          "page": 4,
          "evidenceText": "maize plots"
        }
      }
    }
  ]
}

ATOMIZATION EXAMPLES

BAD: one claim says "The trial included 84 plots and mean root depth was 42 cm" while its evidenceText only says "The trial included 84 plots".
GOOD: emit the plot-count claim and root-depth claim separately, each with evidenceText that directly supports its complete assertion.

BAD: one claim reports accuracy, RMSE, and calibration slope while evidenceText contains only the accuracy result.
GOOD: split the metrics into independently evidenced claims unless one contiguous source excerpt explicitly states every metric used in the combined assertion.

BAD: assert treatment=A and control=B while evidenceText contains only the treatment branch.
GOOD: cite one excerpt containing both branches or emit separately valid branch definitions.

BAD: turn a source window "from day 0 through day 3" into "for at least 3 days".
GOOD: preserve the fixed window exactly, or omit the claim if its material temporal qualifier cannot be bound under the single-locator contract.

FINAL SILENT CHECK BEFORE OUTPUT
For every proposed claim ask:
- Is every material phrase in assertion explicitly supported by this claim's one evidenceText?
- Would removing SourceContext still leave the claim-level evidence sufficient to verify the assertion?
- Did I accidentally combine two facts that have different evidence fragments?
- Did I preserve timing/window/comparator/unit/design qualifiers exactly?
- Did I attach only context that materially scopes this claim?
- If the answer to any evidence-coverage question is no, split or omit the claim.

Now extract the scientifically material claims from the attached PDF.`;
}
