import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';

const [scenario,root,recover]=process.argv.slice(2),statePath=join(root,'state.json');
let armed=false,fired=false;
const copy=fs.copyFileSync,write=fs.writeFileSync,rename=fs.renameSync;
function error(){const e=new Error('INJECTED_'+scenario);e.code='EIO';return e;}
fs.copyFileSync=(source,target,...rest)=>{if(armed&&!fired&&scenario==='R2'&&target===statePath+'.prev'){fired=true;throw error();}return copy(source,target,...rest);};
fs.writeFileSync=(target,data,...rest)=>{
  if(armed&&!fired&&target===statePath+'.tmp'&&['R3','R4','R8'].includes(scenario)) {fired=true;if(scenario==='R4')write(target,String(data).slice(0,73));throw error();}
  return write(target,data,...rest);
};
fs.renameSync=(source,target,...rest)=>{
  if(armed&&!fired&&target===statePath&&['R5','R6'].includes(scenario)) {fired=true;if(scenario==='R5')throw error();rename(source,target,...rest);process.exit(86);}
  return rename(source,target,...rest);
};
syncBuiltinESMExports();
const token='probe-synthetic-only';
delete process.env.ADR_PILOT_BOOTSTRAP_PACKAGE_B64;
process.env.ADR_PILOT_TOKEN_BINDINGS_JSON=JSON.stringify({[token]:{principal_id:'design-partner-context-provider-host',type:'SERVICE_ACCOUNT',organization_id:'org-a',tenant_id:'tenant-a',program_ids:['pilot-a']},'probe-read-only':{principal_id:'agronomist-v03-host',type:'USER',organization_id:'org-a',tenant_id:'tenant-a',program_ids:['pilot-a']}});
const host=await import('./server.mjs');
let runtime;
try{runtime=await host.initializePilotRuntime({statePath,snapshotDir:join(root,'snapshots'),allowSyntheticBootstrap:!recover});}
catch(e){process.send({type:'START_FAILED',code:e.code??e.name,message:e.message});process.exit(0);}
const prototype=Object.getPrototypeOf(runtime.ledger),originalSnapshot=prototype.exportSnapshot;
const snapshot=originalSnapshot.bind(runtime.ledger);
prototype.exportSnapshot=function(){
  if(armed&&!fired&&scenario==='R1'&&new Error().stack.includes('createAuthorityRecoveryCheckpoint')){fired=true;throw error();}
  return originalSnapshot.call(this);
};
const server=host.createPilotHttpServer(runtime);await new Promise(r=>server.listen(0,'127.0.0.1',r));
server.prependListener('request',req=>{if(req.headers['x-probe-request'])process.send({type:'RECEIVED',id:req.headers['x-probe-request']});});
const describe=()=>({records:snapshot().records.map(x=>x.ref),audit_count:snapshot().audit.length,idempotency_entries:runtime.metadata.idempotency??{},injection_fired:fired,ready:runtime.ready,persistenceFault:runtime.persistenceFault??false});
process.send({type:'READY',port:server.address().port,smoke:runtime.metadata.smokeRequest,before:describe()});
process.on('message',async message=>{
  if(message.type==='ARM'){armed=true;process.send({type:'ARMED'});}
  if(message.type==='SNAPSHOT')process.send({type:'SNAPSHOT',state:describe()});
  if(message.type==='PERSIST') {try{runtime.persist();process.send({type:'PERSIST',status:'SUCCEEDED'});}catch(e){process.send({type:'PERSIST',status:'REJECTED',code:e.code});}}
  if(message.type==='STOP'){await new Promise(r=>server.close(r));process.exit(0);}
});
