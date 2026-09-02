import {
  canonicalizeSemanticJson,
  cloneCanonicalValue,
  deepFreeze
} from '../../canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  PERMISSIONS,
  authorizeKnowledgeInspection,
  samePrincipalIdentity
} from '../../authorization/src/index.mjs';
import { sourceReviewResourceId } from '../../knowledge-registry/src/source-faithful.mjs';
import {
  AgronomicContextCalendarDateLocalCivilFrameBindingCompilationError,
  agronomicContextCalendarDateLocalCivilFrameBindingCompilationAuthorityRefs,
  agronomicContextCalendarDateLocalCivilFrameBindingHash,
  normalizeAgronomicContextCalendarDateLocalCivilFrameBinding,
  normalizeAgronomicContextCalendarDateLocalCivilFrameBindingCompilation
} from './context-calendar-date-local-civil-frame-binding-contract.mjs';
import {
  validateAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationAuthority
} from './recorded-operation-context-source-native-timezone-identity-binding-authority.mjs';

export const AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REVIEW_DISPOSITIONS =
  deepFreeze([
    'ACCEPT_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING',
    'REJECT_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING'
  ]);

export const AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REQUIRED_REVIEW_CHECKS =
  deepFreeze([
    'PARENT_SOURCE_NATIVE_TIMEZONE_AUTHORITY_VERIFIED',
    'EXACT_TARGET_CONTEXT_SEMANTIC_VERIFIED',
    'EXACT_SOURCE_CALENDAR_DATE_VERIFIED',
    'EXACT_SOURCE_DAY_PRECISION_VERIFIED',
    'EXACT_SOURCE_NATIVE_SUBJECT_SERF_VERIFIED',
    'EXACT_TIMEZONE_SCHEME_IANA_VERIFIED',
    'EXACT_TIMEZONE_ZONE_ID_AMERICA_CHICAGO_VERIFIED',
    'LOCAL_CIVIL_DAY_FRAME_EXPLICITLY_AUTHORIZED',
    'CIVIL_DATE_EQUALS_SOURCE_CALENDAR_DATE',
    'FRAME_ZONE_EQUALS_ACCEPTED_SOURCE_NATIVE_TIMEZONE',
    'ADR_INTERPRETATION_NOT_UPSTREAM_SOURCE_CLAIM',
    'NO_GENERIC_DATE_TO_SOURCE_TIMEZONE_RULE',
    'NO_PROVIDER_GLOBAL_TIMEZONE_RULE',
    'NO_GEOGRAPHIC_TIMEZONE_INFERENCE',
    'NO_UTC_OFFSET_RESOLUTION',
    'NO_DST_RESOLUTION',
    'NO_TZDB_VERSION_BINDING',
    'NO_EFFECTIVE_INTERVAL_BOUNDARIES',
    'NO_AVAILABLE_AT_MUTATION',
    'NO_SOURCE_PROJECTION_MUTATION',
    'NO_CONTEXT_DATUM_PUBLICATION',
    'NO_CONTEXT_MANIFEST_OR_DECISION_PROBLEM_PUBLICATION',
    'NO_POLICY_RUNTIME_EXECUTION_OR_OUTCOME_INFERENCE'
  ]);

const REVIEW_DISPOSITIONS =
  new Set(AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REVIEW_DISPOSITIONS);
const REQUIRED_CHECKS =
  new Set(AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REQUIRED_REVIEW_CHECKS);

function requireLedger(ledger){if(!ledger||typeof ledger.publish!=='function'||typeof ledger.resolve!=='function'||typeof ledger.auditFor!=='function')throw new AgronomicContextCalendarDateLocalCivilFrameBindingCompilationError('AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_LEDGER_REQUIRED','local-civil frame binding authority requires AuthorityLedger');}
function text(v,n){if(typeof v!=='string'||v.trim().length===0)throw new AgronomicContextCalendarDateLocalCivilFrameBindingCompilationError('INVALID_AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_INPUT',`${n} must be a non-empty string`);return v.trim();}
function sameSemanticValue(a,b){return canonicalizeSemanticJson(a)===canonicalizeSemanticJson(b);}
function exactRefIn(refs,expected){return Array.isArray(refs)&&refs.some(ref=>sameAuthorityRef(ref,expected));}
function refKey(ref){return JSON.stringify([ref.kind,ref.logicalId,ref.version,ref.semanticHash]);}
function uniqueRefs(refs){const m=new Map();for(const ref of refs)m.set(refKey(ref),ref);return [...m.values()].sort((a,b)=>refKey(a).localeCompare(refKey(b)));}
function normalizeReviewerPrincipal(v){if(!v||typeof v!=='object'||Array.isArray(v))throw new AgronomicContextCalendarDateLocalCivilFrameBindingCompilationError('AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REVIEWER_REQUIRED','reviewerPrincipal must be an object');return deepFreeze({principalId:text(v.principalId,'reviewerPrincipal.principalId'),type:text(v.type,'reviewerPrincipal.type'),organizationId:text(v.organizationId,'reviewerPrincipal.organizationId'),...(v.tenantId?{tenantId:text(v.tenantId,'reviewerPrincipal.tenantId')}:{})});}
function normalizeReviewChecks(values,disposition){if(!Array.isArray(values))throw new AgronomicContextCalendarDateLocalCivilFrameBindingCompilationError('AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REVIEW_CHECKS_REQUIRED','confirmedChecks must be an array');const xs=values.map((v,i)=>text(v,`confirmedChecks[${i}]`));if(new Set(xs).size!==xs.length)throw new AgronomicContextCalendarDateLocalCivilFrameBindingCompilationError('AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REVIEW_CHECKS_INVALID','confirmedChecks cannot contain duplicates');for(const x of xs)if(!REQUIRED_CHECKS.has(x))throw new AgronomicContextCalendarDateLocalCivilFrameBindingCompilationError('AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REVIEW_CHECKS_INVALID',`unsupported local-civil frame review check ${x}`);if(disposition==='ACCEPT_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING')for(const req of REQUIRED_CHECKS)if(!xs.includes(req))throw new AgronomicContextCalendarDateLocalCivilFrameBindingCompilationError('AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REVIEW_INCOMPLETE',`accepted local-civil frame review must confirm ${req}`);return deepFreeze([...xs].sort());}
function assertAuditActor(audit,principal){if(!audit?.actor||audit.actor.id!==principal.principalId||audit.actor.type!==principal.type)throw new AgronomicContextCalendarDateLocalCivilFrameBindingCompilationError('AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REVIEW_ACTOR_MISMATCH','audit actor must match exact reviewer');}
function occurrenceSubject(parent){const ids=parent?.semanticPayload?.occurrence?.occurrenceSemantics?.sourceNativeSubject?.identifiers??[];const site=ids.filter(x=>x?.name==='siteid');if(site.length!==1)return null;return {name:site[0].name,value:site[0].value};}

function resolveAuthorizationCoverage({ledger,authorizationDecisionAuditRefs,reviewerPrincipal,requiredSources}){
  if(!Array.isArray(authorizationDecisionAuditRefs)||authorizationDecisionAuditRefs.length!==requiredSources.length)throw new AgronomicContextCalendarDateLocalCivilFrameBindingCompilationError('AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REVIEW_AUTHORIZATION_REQUIRED','review requires one exact source-inspection authorization per required source');
  const records=authorizationDecisionAuditRefs.map(ref=>ledger.resolve(ref));
  for(const source of requiredSources){
    const resourceId=sourceReviewResourceId(source.ref);
    const matches=records.filter(record=>{
      const decision=record.semanticPayload??{};
      if(record.ref.kind!=='AuthorizationDecisionAudit'||decision.allowed!==true||decision.operation!=='KNOWLEDGE_INSPECT'||!samePrincipalIdentity(decision.principal,reviewerPrincipal))return false;
      const policy=ledger.resolve(decision.policyRef);
      return policy.ref.kind==='KnowledgeGovernancePolicy'&&policy.semanticPayload?.resourceId===resourceId;
    });
    if(matches.length!==1)throw new AgronomicContextCalendarDateLocalCivilFrameBindingCompilationError('AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REVIEW_AUTHORIZATION_INVALID','review authorization must cover each exact predecessor source exactly once');
    const decision=matches[0].semanticPayload,policy=ledger.resolve(decision.policyRef),assignments=(decision.assignmentRefs??[]).map(ref=>ledger.resolve(ref));
    const recomputed=authorizeKnowledgeInspection({principal:reviewerPrincipal,policy,roleAssignments:assignments,authorizationScope:decision.request?.authorizationScope});
    const hasGrant=assignments.some(a=>a.ref.kind==='RoleAssignment'&&samePrincipalIdentity(a.semanticPayload?.principal,reviewerPrincipal)&&(a.semanticPayload?.permissions??[]).includes(PERMISSIONS.SOURCE_READ)&&(a.semanticPayload?.permissions??[]).includes(PERMISSIONS.KNOWLEDGE_INSPECT));
    if(!recomputed.allowed||recomputed.decisionHash!==decision.decisionHash||!hasGrant)throw new AgronomicContextCalendarDateLocalCivilFrameBindingCompilationError('AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REVIEW_AUTHORIZATION_INVALID','review authorization cannot be reproduced');
  }
  return deepFreeze(records);
}

function validateBindingWorld({ledger,sourceRegistry,binding}){
  const normalized=normalizeAgronomicContextCalendarDateLocalCivilFrameBinding(binding);
  const parent=validateAgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilationAuthority({ledger,sourceRegistry,compilationRef:normalized.parentSourceNativeTimezoneIdentityBindingCompilationRef});
  const temporal=parent.temporalSupportClassification.semanticPayload.classification;
  const occurrence=parent.parentOccurrence.semanticPayload.occurrence;
  const sourceTemporal=occurrence.occurrenceSemantics.temporalSupport;
  const parentSubject=occurrenceSubject(parent.parentOccurrence);
  if(!sameSemanticValue(normalized.targetContextSemantic,temporal.targetContextSemantic))throw new AgronomicContextCalendarDateLocalCivilFrameBindingCompilationError('AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_TARGET_MISMATCH','target semantic/value must equal exact DEC-0022 temporal predecessor world');
  if(!sameSemanticValue(normalized.sourceTemporalDescriptor,sourceTemporal))throw new AgronomicContextCalendarDateLocalCivilFrameBindingCompilationError('AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_SOURCE_TEMPORAL_MISMATCH','source temporal descriptor must equal exact parent occurrence CALENDAR_DATE/DAY');
  if(!sameSemanticValue(normalized.sourceNativeSubject,parent.semanticPayload.binding.sourceNativeSubject)||!sameSemanticValue(normalized.sourceNativeSubject,parentSubject))throw new AgronomicContextCalendarDateLocalCivilFrameBindingCompilationError('AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_SUBJECT_MISMATCH','source-native subject must equal exact DEC-0022/occurrence SERF subject');
  if(!sameSemanticValue(normalized.sourceTimezone,parent.semanticPayload.binding.sourceTimezone))throw new AgronomicContextCalendarDateLocalCivilFrameBindingCompilationError('AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_TIMEZONE_MISMATCH','sourceTimezone must equal exact DEC-0022 IANA America/Chicago identity');
  if(normalized.temporalFrame.civilDate!==sourceTemporal.date||normalized.temporalFrame.zoneScheme!==parent.semanticPayload.binding.sourceTimezone.scheme||normalized.temporalFrame.zoneId!==parent.semanticPayload.binding.sourceTimezone.zoneId)throw new AgronomicContextCalendarDateLocalCivilFrameBindingCompilationError('AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_FRAME_MISMATCH','temporalFrame must exactly join source calendar date and accepted source-native timezone');

  const sourceRefs=uniqueRefs([
    parent.parentOccurrence.source.ref,
    ...parent.replayedEvidence.map(e=>e.source.ref),
    ...parent.targetIdentityBinding.replayedEvidence.map(e=>e.source.ref)
  ]);
  const requiredSources=sourceRefs.map(ref=>ledger.resolve(ref));
  return deepFreeze({normalized,parent,temporal,occurrence,requiredSources});
}

export function publishAgronomicContextCalendarDateLocalCivilFrameBindingReviewDecision({ledger,sourceRegistry,logicalId,version,binding,disposition,reviewerPrincipal,authorizationDecisionAuditRefs,confirmedChecks,rationale,audit}){
  requireLedger(ledger);if(!REVIEW_DISPOSITIONS.has(disposition))throw new AgronomicContextCalendarDateLocalCivilFrameBindingCompilationError('INVALID_AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REVIEW_DISPOSITION','unsupported review disposition');
  const reviewer=normalizeReviewerPrincipal(reviewerPrincipal),checks=normalizeReviewChecks(confirmedChecks,disposition),world=validateBindingWorld({ledger,sourceRegistry,binding});
  const auths=resolveAuthorizationCoverage({ledger,authorizationDecisionAuditRefs,reviewerPrincipal:reviewer,requiredSources:world.requiredSources});assertAuditActor(audit,reviewer);
  const bindingHash=agronomicContextCalendarDateLocalCivilFrameBindingHash(world.normalized);
  const predecessorBindings=deepFreeze({parentSourceNativeTimezoneIdentityBindingCompilationRef:world.normalized.parentSourceNativeTimezoneIdentityBindingCompilationRef,targetContextSemantic:cloneCanonicalValue(world.normalized.targetContextSemantic),sourceTemporalDescriptor:cloneCanonicalValue(world.normalized.sourceTemporalDescriptor),sourceNativeSubject:cloneCanonicalValue(world.normalized.sourceNativeSubject),sourceTimezone:cloneCanonicalValue(world.normalized.sourceTimezone),temporalFrame:cloneCanonicalValue(world.normalized.temporalFrame),interpretationClass:world.normalized.interpretationClass,requiredSourceRefs:world.requiredSources.map(s=>s.ref)});
  return ledger.publish({kind:'AgronomicContextCalendarDateLocalCivilFrameBindingReviewDecision',logicalId:text(logicalId,'logicalId'),version:text(version,'version'),semanticPayload:{authorityClass:'AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REVIEW_AUTHORITY',binding:cloneCanonicalValue(world.normalized),bindingHash,predecessorBindings,disposition,confirmedChecks:checks,reviewerPrincipal:reviewer,authorizationDecisionAuditRefs:auths.map(r=>r.ref),rationale:text(rationale,'rationale')},audit:{...audit,action:'REVIEW_AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING',inputRefs:[world.normalized.parentSourceNativeTimezoneIdentityBindingCompilationRef,...world.requiredSources.map(s=>s.ref),...auths.map(r=>r.ref),...(audit?.inputRefs??[])],details:{...(audit?.details??{}),bindingHash,disposition,predecessorBindings,temporalFrame:cloneCanonicalValue(world.normalized.temporalFrame),interpretationClass:world.normalized.interpretationClass}}});
}

function validateReview({ledger,sourceRegistry,reviewRef,normalizedCompilation}){
  const review=ledger.resolve(reviewRef);if(review.ref.kind!=='AgronomicContextCalendarDateLocalCivilFrameBindingReviewDecision')throw new AgronomicContextCalendarDateLocalCivilFrameBindingCompilationError('AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REVIEW_REQUIRED','publication requires local-civil frame review');
  const p=review.semanticPayload??{};if(p.authorityClass!=='AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REVIEW_AUTHORITY')throw new AgronomicContextCalendarDateLocalCivilFrameBindingCompilationError('AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REVIEW_INVALID','invalid review authorityClass');if(p.disposition!=='ACCEPT_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING')throw new AgronomicContextCalendarDateLocalCivilFrameBindingCompilationError('AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REVIEW_REJECTED','only accepted review can authorize publication');normalizeReviewChecks(p.confirmedChecks,p.disposition);
  const binding=normalizedCompilation.binding,bindingHash=agronomicContextCalendarDateLocalCivilFrameBindingHash(binding);if(p.bindingHash!==bindingHash||!sameSemanticValue(p.binding,binding))throw new AgronomicContextCalendarDateLocalCivilFrameBindingCompilationError('AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REVIEW_MISMATCH','review must bind exact normalized binding');
  const world=validateBindingWorld({ledger,sourceRegistry,binding}),expected={parentSourceNativeTimezoneIdentityBindingCompilationRef:binding.parentSourceNativeTimezoneIdentityBindingCompilationRef,targetContextSemantic:cloneCanonicalValue(binding.targetContextSemantic),sourceTemporalDescriptor:cloneCanonicalValue(binding.sourceTemporalDescriptor),sourceNativeSubject:cloneCanonicalValue(binding.sourceNativeSubject),sourceTimezone:cloneCanonicalValue(binding.sourceTimezone),temporalFrame:cloneCanonicalValue(binding.temporalFrame),interpretationClass:binding.interpretationClass,requiredSourceRefs:world.requiredSources.map(s=>s.ref)};if(!sameSemanticValue(p.predecessorBindings,expected))throw new AgronomicContextCalendarDateLocalCivilFrameBindingCompilationError('AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REVIEW_PREDECESSOR_MISMATCH','review predecessor bindings must match exact DEC-0022 world');
  const reviewer=normalizeReviewerPrincipal(p.reviewerPrincipal),auths=resolveAuthorizationCoverage({ledger,authorizationDecisionAuditRefs:p.authorizationDecisionAuditRefs,reviewerPrincipal:reviewer,requiredSources:world.requiredSources});
  const direct=ledger.auditFor(review.ref).filter(e=>sameAuthorityRef(e.objectRef,review.ref)).some(e=>e.action==='REVIEW_AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING'&&e.actor?.id===reviewer.principalId&&e.actor?.type===reviewer.type&&exactRefIn(e.inputRefs,binding.parentSourceNativeTimezoneIdentityBindingCompilationRef)&&world.requiredSources.every(s=>exactRefIn(e.inputRefs,s.ref))&&auths.every(a=>exactRefIn(e.inputRefs,a.ref))&&e.details?.bindingHash===bindingHash&&sameSemanticValue(e.details?.predecessorBindings,expected)&&sameSemanticValue(e.details?.temporalFrame,binding.temporalFrame)&&e.details?.interpretationClass===binding.interpretationClass);
  if(!direct)throw new AgronomicContextCalendarDateLocalCivilFrameBindingCompilationError('AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_REVIEW_AUDIT_INVALID','review lacks direct audit');
  return deepFreeze({review,reviewer,auths,world});
}

export function publishAgronomicContextCalendarDateLocalCivilFrameBindingCompilation({ledger,sourceRegistry,logicalId,version,compilation,audit}){
  requireLedger(ledger);const normalized=normalizeAgronomicContextCalendarDateLocalCivilFrameBindingCompilation(compilation);if(normalized.losslessCoverage.status!=='COMPLETE')throw new AgronomicContextCalendarDateLocalCivilFrameBindingCompilationError('AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_INCOMPLETE_NOT_PUBLISHABLE','v1 requires COMPLETE targeted coverage');
  const review=validateReview({ledger,sourceRegistry,reviewRef:normalized.frameReviewRef,normalizedCompilation:normalized});assertAuditActor(audit,review.reviewer);const refs=agronomicContextCalendarDateLocalCivilFrameBindingCompilationAuthorityRefs(normalized);
  return ledger.publish({kind:'AgronomicContextCalendarDateLocalCivilFrameBindingCompilation',logicalId:text(logicalId,'logicalId'),version:text(version,'version'),semanticPayload:cloneCanonicalValue(normalized),audit:{...audit,action:'PUBLISH_AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_COMPILATION',inputRefs:[...refs,...(audit?.inputRefs??[])],details:{...(audit?.details??{}),authorityClass:'AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_COMPILATION_AUTHORITY',bindingHash:normalized.bindingHash,frameReviewRef:review.review.ref,parentSourceNativeTimezoneIdentityBindingCompilationRef:normalized.binding.parentSourceNativeTimezoneIdentityBindingCompilationRef,temporalFrame:cloneCanonicalValue(normalized.binding.temporalFrame),interpretationClass:normalized.binding.interpretationClass}}});
}

export function validateAgronomicContextCalendarDateLocalCivilFrameBindingCompilationAuthority({ledger,sourceRegistry,compilationRef}){
  requireLedger(ledger);const record=ledger.resolve(compilationRef);if(record.ref.kind!=='AgronomicContextCalendarDateLocalCivilFrameBindingCompilation')throw new AgronomicContextCalendarDateLocalCivilFrameBindingCompilationError('AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_COMPILATION_REQUIRED',`expected local-civil frame binding compilation, received ${record.ref.kind}`);
  const normalized=normalizeAgronomicContextCalendarDateLocalCivilFrameBindingCompilation(record.semanticPayload);if(normalized.losslessCoverage.status!=='COMPLETE')throw new AgronomicContextCalendarDateLocalCivilFrameBindingCompilationError('AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_INCOMPLETE_AUTHORITY_INVALID','stored v1 binding must have COMPLETE coverage');
  const review=validateReview({ledger,sourceRegistry,reviewRef:normalized.frameReviewRef,normalizedCompilation:normalized});const refs=agronomicContextCalendarDateLocalCivilFrameBindingCompilationAuthorityRefs(normalized);
  const direct=ledger.auditFor(record.ref).filter(e=>sameAuthorityRef(e.objectRef,record.ref)).some(e=>e.action==='PUBLISH_AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_COMPILATION'&&e.actor?.id===review.reviewer.principalId&&e.actor?.type===review.reviewer.type&&refs.every(ref=>exactRefIn(e.inputRefs,ref))&&e.details?.bindingHash===normalized.bindingHash&&sameAuthorityRef(e.details?.frameReviewRef,review.review.ref)&&sameAuthorityRef(e.details?.parentSourceNativeTimezoneIdentityBindingCompilationRef,normalized.binding.parentSourceNativeTimezoneIdentityBindingCompilationRef)&&sameSemanticValue(e.details?.temporalFrame,normalized.binding.temporalFrame)&&e.details?.interpretationClass===normalized.binding.interpretationClass);
  if(!direct)throw new AgronomicContextCalendarDateLocalCivilFrameBindingCompilationError('AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_AUDIT_INVALID','binding compilation lacks direct reviewer audit');
  return deepFreeze({record,semanticPayload:normalized,frameReview:review.review,sourceNativeTimezoneIdentityBinding:review.world.parent,temporalSupportClassification:review.world.parent.temporalSupportClassification,parentOccurrence:review.world.parent.parentOccurrence});
}
