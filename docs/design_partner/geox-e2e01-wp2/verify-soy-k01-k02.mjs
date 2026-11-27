// Read-only structural verification of an independently attested custodian checkpoint.
// This script cannot establish a governance root, authenticate an operator or authorize writes.
import {readFileSync} from 'node:fs';
import {restoreAuthorityRecoveryCheckpoint} from '../../../packages/recovery-operations/src/index.mjs';
import {sameAuthorityRef} from '../../../packages/contracts/src/authority.mjs';
import {semanticHash} from '../../../packages/canonicalization/src/index.mjs';
import {createPrincipal,samePrincipalIdentity,BUILTIN_ROLES} from '../../../packages/authorization/src/index.mjs';
import {sourceContentHash} from '../../../packages/source-registry/src/index.mjs';
import {validateRightsPolicy,evaluateRightsReadOnly} from '../../../packages/rights-authority/src/index.mjs';
const need=(ok,c)=>{if(!ok)throw Error(c);};
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const same=(a,b)=>semanticHash('GeoxSoyStructuralComparison',a)===semanticHash('GeoxSoyStructuralComparison',b);
const nonempty=x=>typeof x==='string'&&x.trim().length>0;
const [mode,draftPath,checkpointPath,bindingPath,pdfPath]=process.argv.slice(2);
need(['pre-artifact','pre-compile','readback'].includes(mode)&&draftPath&&checkpointPath&&bindingPath&&pdfPath,'OWNER_INPUTS_REQUIRED');
const draft=read(draftPath),binding=read(bindingPath),wrapper=read(checkpointPath);
const {preparation_sha256,...unsigned}=draft;
need(preparation_sha256===semanticHash('GeoxSoyK01K02UnsignedInputs',unsigned)&&draft.schema==='adr.geox-e2e01.soy-k01-k02-inputs.v1'&&draft.write_authorized===false&&draft.formal_authority_ready===false,'UNSIGNED_PREPARATION_HASH_MISMATCH');
const expected='sha256:bced62f287892f147e2f9c450c801a972c48855c0f5e255d17a7358ad3fe2495';
const bytes=readFileSync(pdfPath);
need(bytes.length===1804554&&sourceContentHash(bytes)===expected&&draft.source.raw_sha256===expected,'EXACT_SOURCE_BYTES_REQUIRED');
need(binding.preparation_sha256===preparation_sha256&&nonempty(binding.owner_attestation_ref)&&nonempty(binding.authority_root_ref)&&nonempty(binding.retention_policy_ref)&&nonempty(binding.jurisdiction)&&nonempty(binding.issuer),'OWNER_BINDING_INCOMPLETE');
need(!/SYNTHETIC|TEST_ONLY|FIXTURE/i.test(String(wrapper.metadata?.mode??'')),'SYNTHETIC_CHECKPOINT_DENIED');
const cp=wrapper.checkpoint??wrapper;
need(binding.checkpoint_sha256===cp.checkpointHash,'CHECKPOINT_BINDING_MISMATCH');
const {ledger}=restoreAuthorityRecoveryCheckpoint(cp);
const ownership=binding.ownership;
need(nonempty(ownership?.organizationId)&&nonempty(ownership?.tenantId),'ACTUAL_ADR_OWNER_SCOPE_REQUIRED');
const principal=(x,type)=>{
 const p=createPrincipal(x);
 need(p.type===type&&p.organizationId===ownership.organizationId&&p.tenantId===ownership.tenantId&&!/^(CTO|AI|fixture.*|test.only.*)$/i.test(p.principalId),'PRINCIPAL_SCOPE_OR_ID_INVALID');
 return p;
};
const steward=principal(binding.source_steward_principal,'USER'),compiler=principal(binding.compiler_principal,'SERVICE_ACCOUNT'),iam=principal(binding.iam_grantor_principal,'USER');
const rightsIdentity=p=>({principalId:p.principalId,type:p.type,organizationId:p.organizationId,tenantId:p.tenantId});
const exact=(ref,kind,logicalId)=>{
 need(ref?.kind===kind&&(!logicalId||ref.logicalId===logicalId),'EXACT_'+kind+'_REF_REQUIRED');
 const rec=ledger.resolve(ref);need(sameAuthorityRef(rec.ref,ref),'EXACT_REF_RESOLUTION_MISMATCH');return rec;
};
const audit=(rec,p,refs=[])=>{
 const events=ledger.auditFor(rec.ref).filter(e=>sameAuthorityRef(e.objectRef,rec.ref)&&e.actor?.id===p.principalId&&e.actor?.type===p.type&&refs.every(r=>e.inputRefs.some(x=>sameAuthorityRef(x,r))));
 need(events.length>0,'DIRECT_AUDIT_BINDING_MISSING_'+rec.ref.kind);
 return events.map(e=>e.eventId);
};
const i=draft.inputs;
const source=exact(binding.source_ref,'Source',i.source.logicalId);
need(source.ref.version===i.source.version&&same(source.semanticPayload.ownership,ownership)&&source.semanticPayload.title===i.source.title&&source.semanticPayload.sourceType==='PUBLICATION'&&same(source.semanticPayload.bibliographic,i.source.bibliographic)&&source.semanticPayload.originLocator===i.source.originLocator&&source.semanticPayload.rights?.license==='CC-BY-4.0'&&source.semanticPayload.rights?.licenseUrl===i.source.rights.licenseUrl&&source.semanticPayload.rights?.attribution===i.source.rights.attribution,'SOURCE_PAYLOAD_MISMATCH');
const audits={source:audit(source,steward)};
need(Array.isArray(binding.compiler_role_assignment_refs)&&binding.compiler_role_assignment_refs.length===draft.authorization.proposed_resource_scopes.length,'EXACT_COMPILER_ROLE_SET_REQUIRED');
const roles=binding.compiler_role_assignment_refs.map(r=>exact(r,'RoleAssignment'));
const scopes=draft.authorization.proposed_resource_scopes.map(s=>({...ownership,...s}));
for(const scope of scopes){
 const found=roles.filter(r=>same(r.semanticPayload.scope,scope));
 need(found.length===1,'EXACT_COMPILER_SCOPE_REQUIRED');
 const r=found[0],p=r.semanticPayload;
 need(samePrincipalIdentity(p.principal,compiler)&&p.role==='COMPILER_SERVICE'&&p.roleDefinitionVersion==='adr-builtin-roles-v1'&&same([...p.permissions].sort(),[...BUILTIN_ROLES.COMPILER_SERVICE].sort()),'COMPILER_ROLE_MISMATCH');
 audit(r,iam);
}
const policy=validateRightsPolicy({ledger,rightsPolicyRef:binding.rights_policy_ref});
need(same(policy.ownership,ownership)&&samePrincipalIdentity({...policy.ownerPrincipal,programIds:[]},steward),'RIGHTS_POLICY_OWNER_MISMATCH');
const at=new Date().toISOString();
function rights(subjectRef,actor,operations){
 return operations.map(operation=>{
  const decision=evaluateRightsReadOnly({ledger,rightsPolicyRef:binding.rights_policy_ref,subjectRef,actor:rightsIdentity(actor),evaluatorPrincipal:rightsIdentity(steward),operation,purpose:'GEOX_E2E01_SOY_K01_K02',jurisdiction:binding.jurisdiction,evaluatedAt:at,enforceableObligations:[]});
  // Nonempty obligations are deliberately HOLD until owner execution supports and proves them.
  return {operation,subject_ref:subjectRef,grant_refs:decision.grantRefs,obligations:decision.obligations,evaluated_at:at};
 });
}
const rightsChecks=rights(source.ref,steward,['ACQUIRE','RETAIN_FULLTEXT']);
const out={status:'STRUCTURAL_READBACK_ONLY_NOT_AUTHORIZATION',mode,preparation_sha256,checkpoint_sha256:cp.checkpointHash,source_ref:source.ref,compiler_role_assignment_refs:roles.map(r=>r.ref),rights_checks:rightsChecks,audit_event_ids:audits,actual_owner_attestation_independently_verified:false,live_assignment_status_independently_verified:false,write_authorized:false,formal_authority_ready:false};
if(mode!=='pre-artifact'){
 const artifact=exact(binding.artifact_ref,'SourceArtifact',i.artifact.logicalId),a=artifact.semanticPayload;
 need(artifact.ref.version===i.artifact.version&&sameAuthorityRef(a.sourceRef,source.ref)&&a.mediaType===i.artifact.mediaType&&a.materializationIdentity===i.artifact.materializationIdentity&&a.contentHash===expected&&a.byteLength===bytes.length&&a.acquisition.locator===i.artifact.acquisition.locator,'ARTIFACT_PAYLOAD_MISMATCH');
 audits.artifact=audit(artifact,steward,[source.ref]);
 out.artifact_ref=artifact.ref;
 out.rights_checks.push(...rights(artifact.ref,compiler,['READ_FOR_EXTRACTION','EXTRACT_CLAIM','RETAIN_DERIVED']));
 if(mode==='readback'){
  const definition=exact(binding.compiler_definition_ref,'ScientificCompilerDefinition',i.compiler.logicalId),d=definition.semanticPayload;
  need(definition.ref.version===i.compiler.version&&d.compilerId===i.compiler.compilerId&&d.implementationVersion===i.compiler.implementationVersion&&same(d.configuration,i.compiler.configuration)&&d.outputAuthority==='CANDIDATE_ONLY','COMPILER_DEFINITION_MISMATCH');
  audits.compiler_definition=audit(definition,compiler);
  const result=exact(binding.compilation_result_ref,'ScientificCompilationResult',i.compilation.compilationLogicalId),r=result.semanticPayload;
  need(result.ref.version===i.compilation.version&&sameAuthorityRef(r.sourceRef,source.ref)&&sameAuthorityRef(r.sourceArtifactRef,artifact.ref)&&sameAuthorityRef(r.compilerDefinitionRef,definition.ref)&&r.sourceArtifactContentHash===expected&&r.outputAuthority==='PROPOSAL_ONLY'&&r.candidateCount===2&&r.claimCandidateRefs.length===2&&r.sourceContextCandidateRefs.length===2&&same(r.runMetadata,i.compilation.proposal.runMetadata),'COMPILATION_RESULT_MISMATCH');
  audits.compilation=audit(result,compiler,[artifact.ref,definition.ref,...r.claimCandidateRefs,...r.sourceContextCandidateRefs]);
  for(const proposal of i.compilation.proposal.claims){
   const ref=r.claimCandidateRefs.find(x=>x.logicalId===i.compilation.compilationLogicalId+'/claim/'+proposal.key);
   const ctxRef=r.sourceContextCandidateRefs.find(x=>x.logicalId===i.compilation.compilationLogicalId+'/source-context/'+proposal.key);
   const claim=exact(ref,'ClaimCandidate'),ctx=exact(ctxRef,'SourceContextCandidate'),c=claim.semanticPayload,x=ctx.semanticPayload;
   for(const p of [c,x])need(sameAuthorityRef(p.sourceRef,source.ref)&&sameAuthorityRef(p.sourceArtifactRef,artifact.ref)&&sameAuthorityRef(p.compilerDefinitionRef,definition.ref)&&p.sourceArtifactContentHash===expected&&p.authorityClass==='CANDIDATE_PROPOSAL','CANDIDATE_PROVENANCE_MISMATCH');
   need(c.claimType===proposal.claimType&&c.assertion===proposal.assertion&&same(c.sourceLocator,proposal.sourceLocator)&&sameAuthorityRef(x.claimCandidateRef,claim.ref)&&same(x.contextFamilies,proposal.sourceContext),'CANDIDATE_CONTENT_MISMATCH');
   audits[proposal.key]={claim:audit(claim,compiler,[artifact.ref,definition.ref]),context:audit(ctx,compiler,[claim.ref,artifact.ref,definition.ref])};
  }
  Object.assign(out,{compiler_definition_ref:definition.ref,compilation_result_ref:result.ref,claim_candidate_refs:r.claimCandidateRefs,source_context_candidate_refs:r.sourceContextCandidateRefs,retained_export_bytes_verified:true});
 }
}
console.log(JSON.stringify(out,null,2));
