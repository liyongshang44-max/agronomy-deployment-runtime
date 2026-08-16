import { deepFreeze } from '../../canonicalization/src/index.mjs';
import { SourceFaithfulReviewService } from '../../knowledge-registry/src/source-faithful.mjs';
import { ScientificQualificationService } from '../../knowledge-registry/src/qualification.mjs';
import { KnowledgeConflictService } from '../../conflict-engine/src/index.mjs';
import { publishDeployment, publishDeploymentControlDecision } from '../../deployment/src/index.mjs';
import { AgronomistWorkbenchError } from './case.mjs';

export const WORKBENCH_AUTHORITY_ACTIONS = deepFreeze([
  'REVIEW_SOURCE_FAITHFUL_CANDIDATE',
  'RECORD_SCIENTIFIC_QUALIFICATION_DECISION',
  'PUBLISH_QUALIFIED_KNOWLEDGE',
  'CREATE_KNOWLEDGE_CONFLICT',
  'RESOLVE_KNOWLEDGE_CONFLICT',
  'PUBLISH_DEPLOYMENT',
  'CONTROL_DEPLOYMENT'
]);

export class AgronomistWorkbenchAuthorityActions {
  #ledger;
  #sourceReview;
  #qualification;
  #conflicts;

  constructor({ ledger }) {
    if (!ledger || typeof ledger.publish !== 'function' || typeof ledger.resolve !== 'function') {
      throw new AgronomistWorkbenchError('INVALID_LEDGER', 'Workbench authority actions require the shared backend AuthorityLedger');
    }
    this.#ledger = ledger;
    this.#sourceReview = new SourceFaithfulReviewService({ ledger });
    this.#qualification = new ScientificQualificationService({ ledger });
    this.#conflicts = new KnowledgeConflictService({ ledger });
  }

  reviewSourceFaithfulCandidate(args) {
    return this.#sourceReview.reviewCandidate(args);
  }

  recordScientificQualificationDecision(args) {
    return this.#qualification.recordQualificationDecision(args);
  }

  publishQualifiedKnowledge(args) {
    return this.#qualification.publishQualifiedKnowledge(args);
  }

  createKnowledgeConflict(args) {
    return this.#conflicts.createConflict(args);
  }

  resolveKnowledgeConflict(args) {
    return this.#conflicts.resolveConflict(args);
  }

  publishDeployment(args) {
    return publishDeployment({ ledger: this.#ledger, ...args });
  }

  controlDeployment(args) {
    return publishDeploymentControlDecision({ ledger: this.#ledger, ...args });
  }
}

export function createAgronomistWorkbenchAuthorityActions({ ledger }) {
  return new AgronomistWorkbenchAuthorityActions({ ledger });
}
