// Deployment-only read projection. No native write, no raw Ledger response.
import {semanticHash} from '../../packages/canonicalization/src/index.mjs';
import {sameAuthorityRef} from '../../packages/contracts/src/authority.mjs';
import {samePrincipalIdentity} from '../../packages/authorization/src/index.mjs';
import {validateKnowledgeRetrievalResult} from '../../packages/knowledge-retrieval/src/index.mjs';
import {resolveDeploymentForRuntime} from '../../packages/deployment/src/index.mjs';
import {validateQualifiedKnowledgeAuthority} from '../../packages/knowledge-registry/src/qualified-authority.mjs';
import {validateWorkbenchInspectionAuthorization} from '../../packages/workbench/src/index.mjs';
import {evaluateRightsReadOnly,validateRightsGrant} from '../../packages/rights-authority/src/index.mjs';
const denied=()=>{const e=new Error('customer evidence display is not authorized');e.code='CUSTOMER_EVIDENCE_ACCESS_DENIED';throw e;};
const need=v=>{if(!v)denied();};
const text=(v,n=512)=>typeof v==='string'&&v.length>0&&v.length<=n&&!/[\x00-\x1f\x7f]/.test(v);
const exact=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===k.length&&k.every(x=>Object.hasOwn(v,x));
const core=r=>{need(exact(r,['kind','logical_id','version','semantic_hash'])&&text(r.kind)&&text(r.logical_id)&&text(r.version)&&/^sha256:[a-f0-9]{64}$/.test(r.semantic_hash));return {kind:r.kind,logicalId:r.logical_id,version:r.version,semanticHash:r.semantic_hash};};
const wire=r=>({kind:r.kind,logical_id:r.logicalId,version:r.version,semantic_hash:r.semanticHash});
const key=r=>JSON.stringify(wire(r));
const sameSet=(a,b)=>a.length===b.length&&new Set(a.map(key)).size===a.length&&a.every(x=>b.some(y=>sameAuthorityRef(x,y)));
const digest=v=>semanticHash('ADR-CustomerEvidenceDisplay-v1',v);
const listText=(objects)=>{need(Array.isArray(objects)&&objects.length<=64);return objects.map(o=>{
 // No arbitrary nested authority object serialization. Select reviewed human-readable fields only.
 const fields=['description','statement','rationale','message','reason','code','semanticId','type','kind'].filter(k=>text(o?.[k],600)).map(k=>o[k]);
 return fields.length?fields.join(' · ').slice(0,1000):'Governed condition recorded; detailed interpretation not available in this projection.';
 });};
export function boundedMemberDisplay(ledger,knowledgeRef,use,cropCode){
 need(knowledgeRef.kind==='QualifiedKnowledge'&&['CORN','SOYBEAN'].includes(cropCode));
 const q=validateQualifiedKnowledgeAuthority({ledger,qualifiedKnowledgeRef:knowledgeRef,requiredUseTarget:{use}});
 const artifact=ledger.resolve(q.claim.semanticPayload.sourceArtifactRef);
 need(artifact.ref.kind==='SourceArtifact'&&sameAuthorityRef(artifact.semanticPayload.sourceRef,q.source.ref)&&artifact.semanticPayload.contentHash===q.claim.semanticPayload.sourceArtifactContentHash);
 const s=q.source.semanticPayload,b=s.bibliographic??{},summary=q.claim.semanticPayload.assertion;
 need(text(s.title,500)&&text(summary,1200));
 const publication={};
 for(const k of ['doi','journal','citation','publisher','year','authors']){const v=b[k];if(text(v,700))publication[k]=v;else if(k==='year'&&Number.isInteger(v))publication[k]=String(v);else if(k==='authors'&&Array.isArray(v)&&v.length<=20&&v.every(x=>text(x,100)))publication[k]=v.join(', ');}
 const active=q.decisions.filter(d=>d.semanticPayload.qualificationTarget.use===use&&d.semanticPayload.disposition==='QUALIFY_USE');need(active.length===1);
 const p=active[0].semanticPayload;
 return {knowledge_ref:wire(q.knowledge.ref),source_ref:wire(q.source.ref),artifact_ref:wire(artifact.ref),claim_ref:wire(q.claim.ref),qualification_ref:wire(active[0].ref),artifact_sha256:artifact.semanticPayload.contentHash,crop_code:cropCode,source_title:s.title,publication,summary,allowed_use:use,limitations:listText(p.limitations??[]),conditions:listText([...(p.semanticPreconditions??[]),...(p.effectModifiers??[]),...(p.transportConstraints??[])])};
}
export function customerEvidenceRequestHash(request,principal){return digest({request,principal});}
export function customerEvidenceMemberHash(member){return digest(member);}
export async function readCustomerEvidence({ledger,principal,request,resolveGrant,clock=Date.now}){
 need(exact(request,['retrieval_ref','decision_problem_ref','deployment_ref','runtime_profile_ref','knowledge_release_ref','candidate_refs','manager_scope','question_crops','basis_sha256','journal_sha256','review_id']));
 need(exact(request.manager_scope,['tenant_id','project_id','group_id','field_id','actor_id','mapping_version'])&&Object.values(request.manager_scope).every(x=>text(x))&&text(request.review_id)&&/^[a-f0-9]{64}$/.test(request.basis_sha256)&&/^[a-f0-9]{64}$/.test(request.journal_sha256));
 need(Array.isArray(request.question_crops)&&request.question_crops.length>0&&request.question_crops.length<=2&&new Set(request.question_crops).size===request.question_crops.length&&request.question_crops.every(x=>['CORN','SOYBEAN'].includes(x)));
 need(Array.isArray(request.candidate_refs)&&request.candidate_refs.length>0&&request.candidate_refs.length<=32&&typeof resolveGrant==='function');
 const r=validateKnowledgeRetrievalResult({ledger,knowledgeRetrievalResultRef:core(request.retrieval_ref)});
 need(samePrincipalIdentity(r.retrievalPrincipal,principal));
 const v=r.semanticPayload;
 for(const [name,value] of [['decision_problem_ref',v.decisionProblemRef],['deployment_ref',v.deploymentRef],['runtime_profile_ref',v.runtimeProfileRef],['knowledge_release_ref',v.knowledgeReleaseRef]])need(sameAuthorityRef(core(request[name]),value));
 need(sameSet(v.candidateRefs,request.candidate_refs.map(core)));
 const target=r.decisionAuthority.semanticPayload.targetRef;
 need(target.organizationId===principal.organizationId&&(target.tenantId??null)===(principal.tenantId??null));
 const hash=customerEvidenceRequestHash(request,principal);
 // Trusted live owner port; never reads grant from HTTP input or restored checkpoint metadata.
 const grant=structuredClone(await resolveGrant({request:structuredClone(request),principal:structuredClone(principal),request_sha256:hash}));
 const current=()=>{const n=clock(),checked=Date.parse(grant?.checked_at),until=Date.parse(grant?.valid_until);need(grant?.status==='ACTIVE'&&grant.permission==='ADR_A07_CUSTOMER_EVIDENCE_DISPLAY'&&grant.request_sha256===hash&&text(grant.approval_ref)&&Number.isFinite(checked)&&Number.isFinite(until)&&checked<=n&&n-checked<=60000&&until>n&&until<=checked+60000);return new Date(n).toISOString();};
 const at=current();
 const world=resolveDeploymentForRuntime({ledger,deploymentRef:v.deploymentRef,principal,authorizationDecisionAuditRef:r.runtimeAuthorization.ref,atTime:at});
 need(sameAuthorityRef(world.knowledgeRelease.ref,v.knowledgeReleaseRef)&&sameAuthorityRef(world.runtimeProfile.ref,v.runtimeProfileRef));
 // Bounded first release: complete exact retrieved member set only. Derived or partially filtered release stays HOLD.
 need(sameSet(world.knowledgeRelease.semanticPayload.memberRefs,v.candidateRefs)&&Array.isArray(grant.members)&&grant.members.length===v.candidateRefs.length&&sameSet(grant.members.map(m=>core(m.knowledge_ref)),v.candidateRefs));
 const use=v.querySemantics.usePurpose,program=world.semanticPayload.deploymentScope.programId;
 let validUntil=Math.min(Date.parse(grant.valid_until),Date.parse(world.semanticPayload.effectiveInterval.end));
 const items=v.candidateRefs.map(knowledgeRef=>{
  const m=grant.members.find(x=>sameAuthorityRef(core(x.knowledge_ref),knowledgeRef));
  need(m&&request.question_crops.includes(m.crop_code)&&text(m.jurisdiction));
  const q=validateQualifiedKnowledgeAuthority({ledger,qualifiedKnowledgeRef:knowledgeRef,requiredUseTarget:{use}});
  const inspection=validateWorkbenchInspectionAuthorization({ledger,authorizationDecisionAuditRef:core(m.inspection_ref),principal,knowledgeRef,knowledgeOwnership:q.knowledge.semanticPayload.ownership,requiredProgramId:program});
  const artifact=q.claim.semanticPayload.sourceArtifactRef;
  const rights=evaluateRightsReadOnly({ledger,rightsPolicyRef:core(m.rights_policy_ref),subjectRef:artifact,actor:principal,evaluatorPrincipal:m.evaluator_principal,operation:'DISPLAY_EXCERPT',purpose:'GEOX_CUSTOMER_EVIDENCE',jurisdiction:m.jurisdiction,evaluatedAt:at,enforceableObligations:[]});
  for(const ref of rights.grantRefs){const bound=validateRightsGrant({ledger,rightsGrantRef:ref}).record.semanticPayload.validUntil;if(bound)validUntil=Math.min(validUntil,Date.parse(bound));}
  const item=boundedMemberDisplay(ledger,knowledgeRef,use,m.crop_code);
  need(customerEvidenceMemberHash(item)===m.projection_sha256);
  return {...item,inspection_ref:wire(inspection.authorizationDecisionAudit.ref),rights_policy_ref:wire(rights.rightsPolicyRef),rights_grant_refs:rights.grantRefs.map(wire),rights_checked_at:at};
 });
 current();need(validUntil>clock());
 return {contract_version:'geox.adr-a07-customer-evidence.v1',authority_class:'RETRIEVAL_EVIDENCE_NON_SCIENTIFIC',display_status:'AUTHORIZED_RECORDED_EVIDENCE',approval_ref:grant.approval_ref,valid_until:new Date(validUntil).toISOString(),request,items,coverage_crops:[...new Set(items.map(i=>i.crop_code))].sort(),action_authority:false,applicability_authority:false};
}
