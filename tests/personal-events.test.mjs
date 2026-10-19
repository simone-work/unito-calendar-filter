import test from 'node:test';
import assert from 'node:assert/strict';
import * as personal from '../personal-events.js';
export const source={id:'event-1',subject:'Analisi',start:'2026-10-19T07:00:00.000Z',end:'2026-10-19T09:00:00.000Z',allDay:false,state:'P',cancelled:false,rooms:['Aula A'],teachers:['Docente'],notes:''};
test('personal title does not change subject identity or another occurrence',()=>{
  const overrides=[personal.makeOverride(source,{title:'La mia lezione'})];
  const events=personal.composeEvents([source,{...source,id:'event-2'}],overrides,'2026-10-19',['Analisi']);
  assert.equal(events.length,2);assert.equal(events[0].title,'La mia lezione');assert.equal(events[0].subject,'Analisi');assert.equal(events[1].title,'Analisi');
  assert.equal(personal.composeEvents([source],[],'2026-10-19',null)[0].title,'Analisi');
});
test('moving an event works across weeks without fetching its original week',()=>{
  const overrides=[personal.makeOverride(source,{start:'2026-10-26T08:00:00.000Z',end:'2026-10-26T10:00:00.000Z'})];
  assert.equal(personal.composeEvents([source],overrides,'2026-10-19',null).length,0);
  assert.equal(personal.composeEvents([],overrides,'2026-10-26',null).length,1);
  assert.equal(personal.composeEvents([source],overrides,'2026-10-26',null).length,1);
});
test('new official data updates untouched fields while keeping edited ones and cancellation',()=>{
  const overrides=[personal.makeOverride(source,{title:'Personale',room:'Studio'})];
  const changed={...source,subject:'Analisi nuova',rooms:['Aula B'],state:'A',cancelled:true};
  const merged=personal.mergeSource(overrides,[changed]);
  const event=personal.composeEvents([changed],merged,'2026-10-19',null)[0];
  assert.equal(event.title,'Personale');assert.deepEqual(event.rooms,['Studio']);assert.equal(event.cancelled,true);assert.equal(event.sourceChanged,true);
  assert.deepEqual(event.source.rooms,['Aula B']);assert.deepEqual(merged[0].baseline.rooms,['Aula A']);
});
test('a missing source preserves overrides and hidden events remain recoverable',()=>{
  const overrides=[personal.makeOverride(source,{note:'Appunti',hidden:true})];
  assert.deepEqual(personal.mergeSource(overrides,[]),overrides);
  assert.equal(personal.composeEvents([],overrides,'2026-10-19',null).length,0);
  const visible=personal.composeEvents([],overrides,'2026-10-19',null,{includeHidden:true});
  assert.equal(visible[0].personalNote,'Appunti');assert.equal(visible[0].hidden,true);
});
test('source updates move a note-only override and patch validation rejects dangerous or invalid data',()=>{
  const overrides=[personal.makeOverride(source,{note:'Nota'})];
  const changed={...source,start:'2026-10-26T07:00:00.000Z',end:'2026-10-26T09:00:00.000Z'};
  const merged=personal.mergeSource(overrides,[changed]);
  assert.equal(personal.composeEvents([],merged,'2026-10-26',null).length,1);
  for(const patch of [{subject:'x'},{title:''},{color:'url(evil)'},{hidden:'true'},{start:source.end,end:source.start},{start:source.start},{note:'x'.repeat(10001)}]) assert.throws(()=>personal.validatePatch(patch));
});
