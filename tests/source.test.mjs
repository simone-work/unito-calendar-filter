import test from 'node:test';
import assert from 'node:assert/strict';
import * as calendar from '../calendar.js';
const id = '612617b82db4bb0017172840';
const link = `https://unito.prod.up.cineca.it/calendarioPubblico/linkCalendarioId=${id}`;
test('accepts a public UniTo link and rejects other origins and unsupported forms', () => {
  assert.equal(typeof calendar.parseCalendarLink, 'function');
  assert.deepEqual(calendar.parseCalendarLink(` ${link} `), {calendarId:id,url:link});
  for (const bad of [link.replace('https:','http:'),link.replace('unito.prod','evil.prod'),link+'?x=1',link+'#x',link.replace('https://','https://user:pass@'),link.replace(id,'bad')]) assert.throws(()=>calendar.parseCalendarLink(bad));
});
test('requests the chosen calendar on the fixed UniTo endpoint',async()=>{
  assert.equal(calendar.payload('2026-10-19',id).linkCalendarioId,id);
  await calendar.fetchEvents('2026-10-19',{calendarId:id,fetcher:async(url,init)=>{
    assert.equal(url,'https://unito.prod.up.cineca.it/api/Impegni/getImpegniCalendarioPubblico');
    assert.equal(JSON.parse(init.body).linkCalendarioId,id);
    return {ok:true,json:async()=>[]};
  }});
});
test('midnight uses the offset before the DST transition',()=>{
  assert.equal(calendar.romeMidnight('2026-03-29'),'2026-03-28T23:00:00.000Z');
  assert.equal(calendar.romeMidnight('2026-10-25'),'2026-10-24T22:00:00.000Z');
});
test('editing Rome times is independent of device timezone and rejects DST ambiguity',()=>{
  assert.equal(typeof calendar.romeInstant,'function');
  assert.equal(calendar.romeInstant('2026-10-19T09:30'),'2026-10-19T07:30:00.000Z');
  assert.equal(calendar.romeLocalInput('2026-10-19T07:30:00Z'),'2026-10-19T09:30');
  assert.throws(()=>calendar.romeInstant('2026-03-29T02:30'),/inesistente/);
  assert.throws(()=>calendar.romeInstant('2026-10-25T02:30'),/ambiguo/);
  assert.throws(()=>calendar.romeInstant('2026-02-30T12:00'));
});
