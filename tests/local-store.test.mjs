import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {openLocalStore} from '../local-store.js';
import {parseCalendarLink,STORAGE_KEY} from '../calendar.js';
const a=parseCalendarLink('https://unito.prod.up.cineca.it/calendarioPubblico/linkCalendarioId=612617b82db4bb0017172839');
const b=parseCalendarLink('https://unito.prod.up.cineca.it/calendarioPubblico/linkCalendarioId=612617b82db4bb0017172840');
test('profiles survive reopening and separate calendars and stale concurrent writes',async()=>{
  const indexedDB=new IDBFactory();
  let store=await openLocalStore({indexedDB});
  let profile=await store.activateCalendar(a);profile.selection=['A'];
  const saved=await store.saveProfile(profile,profile.revision);store.close();
  store=await openLocalStore({indexedDB});assert.deepEqual((await store.getProfile(a.calendarId)).selection,['A']);
  await store.activateCalendar(b);assert.equal((await store.getProfile(b.calendarId)).selection,null);
  const second=await openLocalStore({indexedDB});
  await second.saveProfile({...saved,selection:['B']},saved.revision);
  await assert.rejects(store.saveProfile({...saved,selection:['Obsoleto']},saved.revision),e=>e.code==='CONFLICT');
  assert.deepEqual((await store.getProfile(a.calendarId)).selection,['B']);
  store.close();second.close();
});
test('legacy migration is atomic, idempotent, and never copies cloud codes',async()=>{
  const indexedDB=new IDBFactory(), values=new Map([[STORAGE_KEY,'[]'],['unito:sync-code:v1:test','secret']]);
  let store=await openLocalStore({indexedDB,legacyStorage:{getItem:k=>values.get(k)??null}});
  assert.deepEqual((await store.getProfile(a.calendarId)).selection,[]);
  assert.equal(values.get(STORAGE_KEY),'[]');assert.equal((await store.listProfiles()).length,1);
  const profile=await store.getProfile(a.calendarId);await store.saveProfile({...profile,selection:['New']},profile.revision);store.close();
  store=await openLocalStore({indexedDB,legacyStorage:{getItem:k=>values.get(k)??null}});
  assert.deepEqual((await store.getProfile(a.calendarId)).selection,['New']);store.close();
});
test('import replaces included profiles atomically and preserves others',async()=>{
  const store=await openLocalStore({indexedDB:new IDBFactory()});
  const pa=await store.activateCalendar(a),pb=await store.activateCalendar(b);
  await store.importProfiles([{...pa,selection:['Imported']}]);
  assert.deepEqual((await store.getProfile(a.calendarId)).selection,['Imported']);
  assert.deepEqual(await store.getProfile(b.calendarId),pb);
  await assert.rejects(store.importProfiles([{...pa,selection:['Bad']},{...pb,url:'https://evil.example/'}]));
  assert.deepEqual((await store.getProfile(a.calendarId)).selection,['Imported']);store.close();
});
test('a transaction abort after a successful request rejects saving and rolls back data',async()=>{
  const indexedDB=new IDBFactory(),store=await openLocalStore({indexedDB});
  const p=await store.activateCalendar(a);
  // Abort the real transaction after put succeeds; a request-success-only implementation would falsely resolve.
  const original=indexedDB.open.bind(indexedDB);let raw;
  await new Promise((resolve,reject)=>{const r=original('unito-calendar-personal',1);r.onsuccess=()=>{raw=r.result;resolve();};r.onerror=()=>reject(r.error);});
  const proto=Object.getPrototypeOf(raw.transaction('profiles').objectStore('profiles'));
  const put=proto.put;
  proto.put=function(...args){const request=put.apply(this,args);request.addEventListener('success',()=>this.transaction.abort());return request;};
  try {await assert.rejects(store.saveProfile({...p,selection:['Uncommitted']},p.revision));}
  finally {proto.put=put;raw.close();}
  assert.equal((await store.getProfile(a.calendarId)).selection,null);store.close();
});
