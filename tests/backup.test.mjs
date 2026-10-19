import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBackup,serializeBackup} from '../backup.js';
import {makeOverride} from '../personal-events.js';
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
