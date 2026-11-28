// Read public original bytes solely to make source-receipt metadata.
// No ledger, no fulltext logs, no upload, no approval or release.
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sourceContentHash} from '../../../packages/source-registry/src/index.mjs';
import {loadUnsigned,verifyUnsigned} from './prepare.mjs';
const pack=loadUnsigned();console.log(JSON.stringify(verifyUnsigned(pack)));
const allowed=new Set(['edepot.wur.nl','www.wur.nl','wur.nl','www.nature.com','nature.com','link.springer.com','static-content.springer-cdn.net','rdcu.be','research.wur.nl','www.verantwoordeveehouderij.nl','www.cambridge.org']);
const limit=50*1024*1024;
async function fetchPdf(start){
 let url=new URL(start);
 for(let n=0;n<6;n++){
  if(url.protocol!=='https:'||!allowed.has(url.hostname)||url.username||url.password)throw Error('REDIRECT_HOST_NOT_ALLOWED');
  const res=await fetch(url,{redirect:'manual',headers:{Accept:'application/pdf','User-Agent':'GEOX-source-provenance-review/1.0'},signal:AbortSignal.timeout(25000)});
  if([301,302,303,307,308].includes(res.status)){const next=res.headers.get('location');await res.body?.cancel();if(!next)throw Error('REDIRECT_MISSING');url=new URL(next,url);continue;}
  if(res.status!==200){await res.body?.cancel();throw Error('SOURCE_HTTP_'+res.status);}
  if(!res.body)throw Error('SOURCE_BODY_MISSING');
  const reader=res.body.getReader(),chunks=[];let length=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>limit)throw Error('SOURCE_SIZE_LIMIT');chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
  const bytes=Buffer.concat(chunks);if(bytes.subarray(0,5).toString('ascii')!=='%PDF-')throw Error('SOURCE_NOT_PDF');
  return {bytes,url:url.href};
 }
 throw Error('REDIRECT_LIMIT');
}
function inspect(source,bytes){
 const root=mkdtempSync(join(tmpdir(),'adr-wp2-source-'));
 try{
  const file=join(root,'source.pdf');writeFileSync(file,bytes,{mode:0o600,flag:'wx'});
  const plain=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8',maxBuffer:16*1024*1024}).normalize('NFKC').replace(/\s+/g,' ').toLowerCase();
  const required=source.candidate_id==='CORN-KIEL-HUME-2026-01'?[/hume[-–\s]*maize/,/modelling silage maize yield formation/,/10\.1017\/\s*s0021859626100719/,/creativecommons\.org\/licenses\/by\/4\.0/,/287/,/hybrid-specific/,/0\.21/]:source.candidate_id==='SOY-WUR-ROTUNDO-2024-01'?[/european soybean to benefit people and the environment/,/10\.1038\/s41598-024-57522-z/,/creative commons attribution 4\.0/,/simulation data processing/,/36\s*%/]:null;
  if(!required)throw Error('SOURCE_CANDIDATE_NOT_RECOGNIZED');
  if(!required.every(r=>r.test(plain)))throw Error('SOURCE_IDENTITY_OR_LOCATOR_MISMATCH');
  return 'PDF_TEXT_ANCHORS_PASS_NOT_SCIENTIFIC_REVIEW';
 }finally{rmSync(root,{recursive:true,force:true});}
}
const results=await Promise.all(pack.sources.map(async source=>{
 const attempts=[];
 const additional=source.candidate_id==='CORN-WUR-H40-2018-01'?['https://www.verantwoordeveehouderij.nl/upload_mm/c/8/8/16671496-8b7a-4db3-8861-747c2fe65a4d_Handboek%20Snijmais%202019.pdf']:[];
 for(const url of [source.pdf_url,source.alternate_url,...additional].filter(Boolean)){
  try{const x=await fetchPdf(url);const locator_check=inspect(source,x.bytes);
   return {candidate_id:source.candidate_id,doi:source.doi,source_url:url,final_url:x.url,raw_sha256:sourceContentHash(x.bytes),byte_length:x.bytes.length,retrieved_at:new Date().toISOString(),locator_check,status:'SOURCE_BYTES_OBSERVED_NOT_ADMITTED',rights_status:source.rights.status,scientific_status:'CANDIDATE_ONLY',attempts};
  }catch(e){attempts.push({url,code:/^[A-Z0-9_]+$/.test(e.message)?e.message:'SOURCE_DOWNLOAD_OR_PARSE_FAILED'});}
 }
 return {candidate_id:source.candidate_id,status:'HOLD_ORIGINAL_SOURCE_BYTES',raw_sha256:null,attempts};
}));
console.log(JSON.stringify({task:'ADR_WP2_SOURCE_BYTE_RECEIPTS',results,formal_authority_ready:false},null,2));
if(results.some(x=>!x.raw_sha256))process.exitCode=1;
