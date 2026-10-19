import {romeMidnight, shiftDay} from './calendar.js';

const plain = value => !!value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const text = (value, max, empty=true) => typeof value === 'string' && value.length <= max && (empty || value.trim().length>0) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);
const instant = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
export function validatePatch(value) {
  if (!plain(value) || Object.keys(value).some(k=>!['title','start','end','room','note','color','hidden'].includes(k))) throw new Error('Modifica personale non valida.');
  for (const key of ['title','room','note']) if (key in value && !text(value[key],key==='note'?10000:500,key!=='title')) throw new Error('Testo della modifica non valido.');
  if ('color' in value && !/^#[0-9a-f]{6}$/i.test(value.color)) throw new Error('Colore non valido.');
  if ('hidden' in value && typeof value.hidden!=='boolean') throw new Error('Visibilità non valida.');
  if (('start' in value)!==('end' in value) || ('start' in value && (!instant(value.start)||!instant(value.end)||Date.parse(value.end)<=Date.parse(value.start)))) throw new Error('La fine deve essere successiva all’inizio.');
  return structuredClone(value);
}
export function validateSource(value) {
  const keys=['id','subject','start','end','allDay','state','cancelled','rooms','teachers','notes'];
  if (!plain(value) || Object.keys(value).sort().join(',')!==keys.sort().join(',') || !text(value.id,500,false) || !text(value.subject,500,false) || !instant(value.start) || !instant(value.end) || Date.parse(value.end)<=Date.parse(value.start) || typeof value.allDay!=='boolean' || typeof value.cancelled!=='boolean' || !text(value.state,20) || !text(value.notes,10000)) throw new Error('Dati originali della lezione non validi.');
  for(const key of ['rooms','teachers']) if(!Array.isArray(value[key]) || value[key].length>100 || value[key].some(v=>!text(v,1000))) throw new Error('Dati originali della lezione non validi.');
  return structuredClone(value);
}
export function makeOverride(source, patch) {
  const baseline=validateSource(source);
  return {eventId:baseline.id,patch:validatePatch(patch),baseline,latestSource:structuredClone(baseline)};
}
export function validateOverride(value) {
  if(!plain(value) || Object.keys(value).sort().join(',')!=='baseline,eventId,latestSource,patch') throw new Error('Personalizzazione non valida.');
  const baseline=validateSource(value.baseline), latestSource=validateSource(value.latestSource);
  if(value.eventId!==baseline.id || value.eventId!==latestSource.id) throw new Error('Identità della lezione incoerente.');
  return {eventId:value.eventId,patch:validatePatch(value.patch),baseline,latestSource};
}
export function mergeSource(overrides, events) {
  const sources=new Map(events.map(e=>[e.id,e]));
  return overrides.map(item=>({...item,latestSource:sources.has(item.eventId)?validateSource(sources.get(item.eventId)):item.latestSource}));
}
export function composeEvents(events, overrides, week, selection, {includeHidden=false}={}) {
  const originals=new Map(overrides.map(o=>[o.eventId,o.latestSource]));
  for(const event of events) originals.set(event.id,event);
  const edits=new Map(overrides.map(o=>[o.eventId,o]));
  const begin=Date.parse(romeMidnight(week)), end=Date.parse(romeMidnight(shiftDay(week,7)));
  return [...originals.values()].map(source=>{
    const override=edits.get(source.id), patch=override?.patch||{};
    const before=override?.baseline;
    const sourceChanged=!!before && (source.state!==before.state || Object.keys(patch).some(key=>{
      if(key==='title')return source.subject!==before.subject;
      if(key==='room')return JSON.stringify(source.rooms)!==JSON.stringify(before.rooms);
      if(key==='start'||key==='end')return Date.parse(source[key])!==Date.parse(before[key]);
      return false;
    }));
    return {...source,title:patch.title??source.subject,start:patch.start??source.start,end:patch.end??source.end,rooms:patch.room!==undefined?(patch.room?[patch.room]:[]):source.rooms,personalNote:patch.note||'',personalColor:patch.color,hidden:patch.hidden===true,personal:!!override,sourceChanged,source};
  }).filter(e=>(includeHidden||!e.hidden) && (selection===null||selection.includes(e.subject)) && Date.parse(e.start)<end && Date.parse(e.end)>begin)
    .sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)||a.subject.localeCompare(b.subject,'it'));
}
