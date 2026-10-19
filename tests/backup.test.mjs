import test from 'node:test';
import assert from 'node:assert/strict';
import * as backup from '../backup.js';
const {parseBackup,serializeBackup}=backup;
import {makeOverride} from '../personal-events.js';
import {fromSelection} from '../preferences.js';
const source={id:'a',subject:'Analisi',start:'2026-10-19T07:00:00Z',end:'2026-10-19T09:00:00Z',allDay:false,state:'P',cancelled:false,rooms:[],teachers:[],notes:''};
const profile={calendarId:'612617b82db4bb0017172839',url:'https://unito.prod.up.cineca.it/calendarioPubblico/linkCalendarioId=612617b82db4bb0017172839',selection:['Analisi'],revision:2,overrides:[makeOverride(source,{note:'<script>testo</script>'})]};
test('backup round trip preserves personal edits as plain text',()=>{
  assert.deepEqual(parseBackup(serializeBackup([profile])),[profile]);
});
test('untrusted backups reject foreign URLs, unknown fields, invalid snapshots and unsupported versions',()=>{
  const valid=JSON.parse(serializeBackup([profile]));
  for (const mutate of [x=>x.version=2,x=>x.other=true,x=>x.profiles[0].url='https://evil.example/',x=>x.profiles[0].calendarId='0'.repeat(24),x=>x.profiles[0].overrides[0].patch.color='url(evil)',x=>x.profiles[0].overrides[0].latestSource.end='bad',x=>x.profiles.push(structuredClone(x.profiles[0]))]){
    const value=structuredClone(valid);mutate(value);assert.throws(()=>parseBackup(JSON.stringify(value)));
  }
  assert.throws(()=>parseBackup(' '.repeat(5*1024*1024+1)));
});
test('a selection must be an array or null, never an iterable string',()=>{
  assert.throws(()=>fromSelection('ABC'));
  const value=JSON.parse(serializeBackup([profile]));value.profiles[0].selection='ABC';
  assert.throws(()=>parseBackup(JSON.stringify(value)));
});
test('oversized profiles cannot become accepted unexportable drafts or saved archives',()=>{
  const large={...profile,overrides:Array.from({length:500},(_,i)=>makeOverride({...source,id:'large-'+i},{note:'x'.repeat(10000)}))};
  assert.throws(()=>backup.validateProfile(large),/5 MiB/);
});
test('emergency export explicitly reports a partial backup when reading other calendars fails',()=>{
  assert.equal(typeof backup.prepareBackup,'function');
  const result=backup.prepareBackup({profiles:[],currentProfile:profile,readError:new Error('read failed')});
  assert.equal(result.partial,true);assert.match(result.message,/parziale/);assert.deepEqual(parseBackup(result.content),[profile]);
});
test('a valid draft that exceeds the combined archive budget still has an explicit partial export',()=>{
  const a={...profile,overrides:Array.from({length:260},(_,i)=>makeOverride({...source,id:'a-'+i},{note:'x'.repeat(10000)}))};
  const b={...a,calendarId:'612617b82db4bb0017172840',url:'https://unito.prod.up.cineca.it/calendarioPubblico/linkCalendarioId=612617b82db4bb0017172840'};
  const result=backup.prepareBackup({profiles:[a],currentProfile:b});
  assert.equal(result.partial,true);assert.match(result.message,/altri calendari non sono inclusi/);
  assert.equal(parseBackup(result.content)[0].calendarId,b.calendarId);
});
