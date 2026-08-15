import { KnowledgeReleaseError } from './core.mjs';
import { publishKnowledgeRelease } from './publish.mjs';
import {
  knowledgeReleaseStatus,
  recordKnowledgeReleaseLifecycleDecision,
  revokeKnowledgeReleaseMemberEntitlement
} from './control.mjs';

export class KnowledgeReleaseService {
  #ledger;

  constructor({ ledger }) {
    if (!ledger || typeof ledger.publishBatchWithLineage !== 'function' || typeof ledger.resolve !== 'function'
      || typeof ledger.exportSnapshot !== 'function' || typeof ledger.auditFor !== 'function' || typeof ledger.lineageFor !== 'function') {
      throw new KnowledgeReleaseError('INVALID_LEDGER', 'KnowledgeReleaseService requires shared replayable AuthorityLedger');
    }
    this.#ledger = ledger;
  }

  publishRelease(args) {
    return publishKnowledgeRelease({ ledger: this.#ledger, ...args });
  }

  recordLifecycleDecision(args) {
    return recordKnowledgeReleaseLifecycleDecision({ ledger: this.#ledger, ...args });
  }

  revokeMemberEntitlement(args) {
    return revokeKnowledgeReleaseMemberEntitlement({ ledger: this.#ledger, ...args });
  }

  status(args) {
    return knowledgeReleaseStatus({ ledger: this.#ledger, ...args });
  }
}
