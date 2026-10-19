import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceReconciler} from '../source-reconciliation.js';
import {makeOverride,composeEvents} from '../personal-events.js';
const source={id:'a',subject:'Analisi',start:'2026-10-19T07:00:00Z',end:'2026-10-19T09:00:00Z',allDay:false,state:'P',cancelled:false,rooms:[],teachers:[],notes:''};
test('source cancellation observed during saving is persisted afterwards for a moved event',async()=>{
  let profile={calendarId:'cal',overrides:[makeOverride(source,{start:'2026-10-26T08:00:00Z',end:'2026-10-26T10:00:00Z'})]},busy=true,dirty=false;
  const reconciler=createSourceReconciler({getContext:()=>({profile,busy,dirty}),persist:async next=>{profile=next;return true;}});
  reconciler.observe('cal',[{...source,state:'A',cancelled:true}]);await reconciler.flush();
  busy=false;await reconciler.flush();
  assert.equal(composeEvents([],profile.overrides,'2026-10-26',null)[0].cancelled,true);
});
test('failed saving retains queued source data until the draft is retried',async()=>{
  let profile={calendarId:'cal',overrides:[makeOverride(source,{note:'Nota'})]},dirty=false,fail=true;
  const reconciler=createSourceReconciler({getContext:()=>({profile,busy:false,dirty}),persist:async next=>{profile=next;if(fail){dirty=true;return false;}return true;}});
  reconciler.observe('cal',[{...source,rooms:['Nuova aula']}]);await reconciler.flush();
  fail=false;dirty=false;await reconciler.flush();
  assert.deepEqual(composeEvents([],profile.overrides,'2026-10-19',null)[0].rooms,['Nuova aula']);
});
