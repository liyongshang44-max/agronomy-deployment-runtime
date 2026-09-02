import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_CONTRACT_VERSION,
  AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_INTERPRETATION_CLASS,
  AgronomicContextCalendarDateLocalCivilFrameBindingCompilationError,
  agronomicContextCalendarDateLocalCivilFrameBindingHash,
  normalizeAgronomicContextCalendarDateLocalCivilFrameBinding,
  normalizeAgronomicContextCalendarDateLocalCivilFrameBindingCompilation
} from '../src/index.mjs';

const parentRef=Object.freeze({kind:'AgronomicRecordedOperationContextSourceNativeTimezoneIdentityBindingCompilation',logicalId:'compilation.test.timezone',version:'1',semanticHash:`sha256:${'1'.repeat(64)}`});
const reviewRef=Object.freeze({kind:'AgronomicContextCalendarDateLocalCivilFrameBindingReviewDecision',logicalId:'review.test.frame',version:'1',semanticHash:`sha256:${'2'.repeat(64)}`});

function binding(overrides={}){
  return {
    contractVersion:AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_CONTRACT_VERSION,
    bindingId:'binding.test.sustainable-corn.local-civil-day',
    parentSourceNativeTimezoneIdentityBindingCompilationRef:parentRef,
    targetContextSemantic:{semanticId:'crop.planting_date',value:{type:'DATE',date:'2011-05-03'}},
    sourceTemporalDescriptor:{kind:'CALENDAR_DATE',date:'2011-05-03',precision:'DAY'},
    sourceNativeSubject:{name:'siteid',value:'SERF'},
    sourceTimezone:{scheme:'IANA',zoneId:'America/Chicago'},
    temporalFrame:{kind:'LOCAL_CIVIL_DAY',civilDate:'2011-05-03',zoneScheme:'IANA',zoneId:'America/Chicago'},
    interpretationClass:AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_INTERPRETATION_CLASS,
    rationale:'Explicit ADR-governed interpretation; upstream source does not declare this date-field frame.',
    ...overrides
  };
}
function compilation(value=binding(),overrides={}){
  return {
    contractVersion:AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_COMPILATION_CONTRACT_VERSION,
    authorityClass:'AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_COMPILATION_AUTHORITY',
    binding:value,
    bindingHash:agronomicContextCalendarDateLocalCivilFrameBindingHash(value),
    frameReviewRef:reviewRef,
    losslessCoverage:{status:'COMPLETE',coveredElements:['SOURCE_CALENDAR_DATE','SOURCE_NATIVE_TIMEZONE_IDENTITY','LOCAL_CIVIL_DAY_FRAME','ADR_INTERPRETATION_CLASS'],unrepresentedElements:[]},
    limitations:['NO_UTC_OFFSET','NO_DST','NO_TZDB','NO_EFFECTIVE_INTERVAL','NO_CONTEXT_DATUM_PUBLICATION'],
    ...overrides
  };
}
function expectCode(fn,code){assert.throws(fn,e=>{assert.ok(e instanceof AgronomicContextCalendarDateLocalCivilFrameBindingCompilationError);assert.equal(e.code,code);return true;});}

test('normalizes exact first governed local-civil-day binding',()=>{
  const n=normalizeAgronomicContextCalendarDateLocalCivilFrameBinding(binding());
  assert.deepEqual(n.sourceTemporalDescriptor,{kind:'CALENDAR_DATE',date:'2011-05-03',precision:'DAY'});
  assert.deepEqual(n.sourceNativeSubject,{name:'siteid',value:'SERF'});
  assert.deepEqual(n.sourceTimezone,{scheme:'IANA',zoneId:'America/Chicago'});
  assert.deepEqual(n.temporalFrame,{kind:'LOCAL_CIVIL_DAY',civilDate:'2011-05-03',zoneScheme:'IANA',zoneId:'America/Chicago'});
  assert.equal(n.interpretationClass,'ADR_GOVERNED_SOURCE_DATE_FRAME_BINDING');
});

test('binding hash is deterministic and predecessor is material',()=>{
  const b=binding();
  assert.equal(agronomicContextCalendarDateLocalCivilFrameBindingHash(b),agronomicContextCalendarDateLocalCivilFrameBindingHash(structuredClone(b)));
  const drift=structuredClone(b);drift.parentSourceNativeTimezoneIdentityBindingCompilationRef.semanticHash=`sha256:${'3'.repeat(64)}`;
  assert.notEqual(agronomicContextCalendarDateLocalCivilFrameBindingHash(b),agronomicContextCalendarDateLocalCivilFrameBindingHash(drift));
});

test('rejects semantic/value and source temporal drift',()=>{
  expectCode(()=>normalizeAgronomicContextCalendarDateLocalCivilFrameBinding(binding({targetContextSemantic:{semanticId:'crop.emergence_date',value:{type:'DATE',date:'2011-05-03'}}})),'UNSUPPORTED_AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_TARGET');
  for(const sourceTemporalDescriptor of [
    {kind:'TIMESTAMP',date:'2011-05-03',precision:'DAY'},
    {kind:'CALENDAR_DATE',date:'2011-05-04',precision:'DAY'},
    {kind:'CALENDAR_DATE',date:'2011-05-03',precision:'SECOND'}
  ]) expectCode(()=>normalizeAgronomicContextCalendarDateLocalCivilFrameBinding(binding({sourceTemporalDescriptor})),'UNSUPPORTED_AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_SOURCE_TEMPORAL_DESCRIPTOR');
});

test('rejects subject and timezone drift',()=>{
  expectCode(()=>normalizeAgronomicContextCalendarDateLocalCivilFrameBinding(binding({sourceNativeSubject:{name:'siteid',value:'NWREC'}})),'UNSUPPORTED_AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_SUBJECT');
  for(const sourceTimezone of [
    {scheme:'IANA',zoneId:'America/New_York'},
    {scheme:'OFFSET',zoneId:'-05:00'}
  ]) expectCode(()=>normalizeAgronomicContextCalendarDateLocalCivilFrameBinding(binding({sourceTimezone})),'UNSUPPORTED_AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_TIMEZONE');
});

test('rejects alternate frame and non-governed interpretation class',()=>{
  for(const temporalFrame of [
    {kind:'UTC_DAY',civilDate:'2011-05-03',zoneScheme:'IANA',zoneId:'America/Chicago'},
    {kind:'LOCAL_CIVIL_DAY',civilDate:'2011-05-04',zoneScheme:'IANA',zoneId:'America/Chicago'},
    {kind:'LOCAL_CIVIL_DAY',civilDate:'2011-05-03',zoneScheme:'IANA',zoneId:'America/New_York'}
  ]) expectCode(()=>normalizeAgronomicContextCalendarDateLocalCivilFrameBinding(binding({temporalFrame})),'UNSUPPORTED_AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME');
  expectCode(()=>normalizeAgronomicContextCalendarDateLocalCivilFrameBinding(binding({interpretationClass:'UPSTREAM_SOURCE_DECLARED_FRAME'})),'UNSUPPORTED_AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_INTERPRETATION_CLASS');
});

test('rejects offset DST TZDB interval and downstream authority widening',()=>{
  for(const [key,value] of [
    ['utcOffset','-05:00'],['dstState','DAYLIGHT'],['tzdbVersion','2026a'],
    ['effectiveInterval',{start:'2011-05-03T05:00:00Z',end:'2011-05-04T05:00:00Z'}],
    ['availableAt','2026-08-30T13:00:00.000Z'],
    ['contextDatumRef','CD-1'],['contextManifestRef','CM-1'],['decisionProblemRef','DP-1'],
    ['upstreamDeclaredLocalCivilDay',true]
  ]) expectCode(()=>normalizeAgronomicContextCalendarDateLocalCivilFrameBinding({...binding(),[key]:value}),'INVALID_AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_FIELD');
});

test('normalizes COMPLETE compilation and detects hash mismatch',()=>{
  assert.equal(normalizeAgronomicContextCalendarDateLocalCivilFrameBindingCompilation(compilation()).losslessCoverage.status,'COMPLETE');
  expectCode(()=>normalizeAgronomicContextCalendarDateLocalCivilFrameBindingCompilation(compilation(binding(),{bindingHash:`sha256:${'f'.repeat(64)}`})),'AGRONOMIC_CONTEXT_CALENDAR_DATE_LOCAL_CIVIL_FRAME_BINDING_HASH_MISMATCH');
});
