export const ENDPOINT = 'https://unito.prod.up.cineca.it/api/Impegni/getImpegniCalendarioPubblico';
export const SOURCE = 'https://unito.prod.up.cineca.it/calendarioPubblico/linkCalendarioId=612617b82db4bb0017172839';
export const STORAGE_KEY = 'unito:612617b82db4bb0017172839:subjects:v1';
export const DEFAULT_CALENDAR_ID = '612617b82db4bb0017172839';
export function parseCalendarLink(input) {
  let url;
  try {url = new URL(String(input).trim());} catch {throw new Error('Inserisci il link pubblico UniTo completo.');}
  const match = /^\/calendarioPubblico\/linkCalendarioId=([a-f0-9]{24})$/i.exec(url.pathname);
  if (url.origin !== 'https://unito.prod.up.cineca.it' || url.username || url.password || url.search || url.hash || !match) throw new Error('Usa un link pubblico UniTo nel formato …/calendarioPubblico/linkCalendarioId=…');
  const calendarId = match[1].toLowerCase();
  return {calendarId, url:`https://unito.prod.up.cineca.it/calendarioPubblico/linkCalendarioId=${calendarId}`};
}
const zone = 'Europe/Rome';
export function romeDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {timeZone: zone, year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
export function shiftDay(day, n) {
  const date = new Date(day + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate()+n);
  return date.toISOString().slice(0,10);
}
export function monday(day) {
  return shiftDay(day, -((new Date(day+'T12:00:00Z').getUTCDay()+6)%7));
}
export function openingWeek(day) {
  const weekday = new Date(day+'T12:00:00Z').getUTCDay();
  return monday(dayIsWeekend(weekday) ? shiftDay(day, 7) : day);
}
function dayIsWeekend(weekday) { return weekday === 0 || weekday === 6; }
export function romeMidnight(day) {
  return romeInstant(day+'T00:00');
}
const localFormat = new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function romeLocalInput(iso) {
  const p = Object.fromEntries(localFormat.formatToParts(new Date(iso)).map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function romeInstant(input) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input)) throw new Error('Data o ora non valida.');
  const wall = Date.parse(input+':00Z');
  if (!Number.isFinite(wall) || new Date(wall).toISOString().slice(0,16) !== input) throw new Error('Data o ora non valida.');
  const offsets = new Set([-86400000,0,86400000].map(delta=>{
    const sample = wall+delta;
    return Date.parse(romeLocalInput(new Date(sample))+':00Z')-sample;
  }));
  const candidates = [...offsets].map(offset=>wall-offset).filter(value=>romeLocalInput(new Date(value))===input);
  if (!candidates.length) throw new Error('Orario inesistente nel fuso di Roma per il cambio d’ora.');
  if (candidates.length>1) throw new Error('Orario ambiguo nel fuso di Roma per il cambio d’ora: scegli un altro orario.');
  return new Date(candidates[0]).toISOString();
}
export function payload(day, calendarId = DEFAULT_CALENDAR_ID) {
  if (!/^[a-f0-9]{24}$/.test(calendarId)) throw new Error('Identificativo calendario non valido.');
  return {linkCalendarioId:calendarId,clienteId:'5852fd1ab7305612a8354d51',dataInizio:romeMidnight(day),dataFine:romeMidnight(shiftDay(day,7)),mostraImpegniAnnullati:true,mostraIndisponibilitaTotali:false,limitaRisultati:false};
}
export function normalize(raw) {
  if (!Array.isArray(raw)) throw new Error('Formato della risposta CINECA non riconosciuto.');
  return raw.map(e => {
    if (!e || !e.id || typeof e.nome !== 'string' || !e.nome.trim() || !Number.isFinite(Date.parse(e.dataInizio)) || !Number.isFinite(Date.parse(e.dataFine)) || Date.parse(e.dataFine)<=Date.parse(e.dataInizio)) throw new Error('Un evento contiene campi mancanti o non validi.');
    return {id:String(e.id),subject:e.nome.trim(),start:e.dataInizio,end:e.dataFine,allDay:!!e.interaGiornata,state:e.stato||'',cancelled:e.stato==='A',
      rooms:(e.aule||[]).map(a=>[a.descrizione,a.edificio?.descrizione].filter(Boolean).join(' · ')),
      teachers:(e.docenti||[]).map(d=>[d.nome,d.cognome].filter(Boolean).join(' ')),notes:e.notePubbliche||''};
  }).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)||a.subject.localeCompare(b.subject,'it'));
}
export function subjects(events) { return [...new Set(events.map(e=>e.subject))].sort((a,b)=>a.localeCompare(b,'it')); }
export function filterEvents(events, selected) {return selected===null ? events : events.filter(e=>selected.includes(e.subject));}
export function readSelection(storage) {
  try { const s=JSON.parse(storage.getItem(STORAGE_KEY)); return s===null || (Array.isArray(s)&&s.every(x=>typeof x==='string')) ? s : null; } catch { return null; }
}
export async function fetchEvents(day, {calendarId=DEFAULT_CALENDAR_ID, signal, fetcher=fetch}={}) {
  const response=await fetcher(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload(day,calendarId)),credentials:'omit',cache:'no-store',signal});
  if(!response.ok) throw new Error(`Il calendario UniTo ha risposto con errore ${response.status}.`);
  const events=normalize(await response.json());
  const start=Date.parse(romeMidnight(day)), end=Date.parse(romeMidnight(shiftDay(day,7)));
  return events.filter(e=>Date.parse(e.start)<end&&Date.parse(e.end)>start);
}
export function time(iso) {return new Intl.DateTimeFormat('it-IT',{timeZone:zone,hour:'2-digit',minute:'2-digit'}).format(new Date(iso));}
export function dayLabel(day, options={day:'numeric',month:'long'}) {return new Intl.DateTimeFormat('it-IT',{timeZone:zone,...options}).format(new Date(day+'T12:00:00Z'));}
