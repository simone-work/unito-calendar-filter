import {parseCalendarLink} from './calendar.js';
import {fromSelection} from './preferences.js';
import {validateOverride} from './personal-events.js';
export const MAX_BACKUP_BYTES=5*1024*1024;
const exact=(value,keys)=>value && typeof value==='object' && !Array.isArray(value) && Object.getPrototypeOf(value)===Object.prototype && Object.keys(value).sort().join(',')===keys.sort().join(',');
const documentFor=profiles=>JSON.stringify({format:'unito-calendar-personal',version:1,exportedAt:new Date().toISOString(),profiles},null,2);
function checkBudget(profiles){if(new TextEncoder().encode(documentFor(profiles)).length>MAX_BACKUP_BYTES)throw new Error('Archivio troppo grande per il backup di 5 MiB. Riduci le personalizzazioni o la lunghezza delle note.');}
export function validateProfile(value) {
  if(!exact(value,['calendarId','url','selection','revision','overrides'])) throw new Error('Profilo del calendario non valido.');
  const source=parseCalendarLink(value.url);
  if(source.calendarId!==value.calendarId || !Number.isSafeInteger(value.revision) || value.revision<0 || !Array.isArray(value.overrides) || value.overrides.length>5000) throw new Error('Profilo del calendario non valido.');
  fromSelection(value.selection);
  const overrides=value.overrides.map(validateOverride);
  if(new Set(overrides.map(o=>o.eventId)).size!==overrides.length) throw new Error('Lezioni duplicate nel profilo.');
  const profile={...source,selection:structuredClone(value.selection),revision:value.revision,overrides};
  checkBudget([profile]);return profile;
}
export function validateProfiles(values) {
  if(!Array.isArray(values) || values.length>100)throw new Error('Massimo 100 calendari nel backup.');
  const profiles=values.map(validateProfile);
  if(new Set(profiles.map(p=>p.calendarId)).size!==profiles.length || profiles.reduce((n,p)=>n+p.overrides.length,0)>5000)throw new Error('Calendari duplicati o troppe personalizzazioni.');
  checkBudget(profiles);return profiles;
}
export function serializeBackup(profiles) {
  const text=documentFor(validateProfiles(profiles));
  if(new TextEncoder().encode(text).length>MAX_BACKUP_BYTES)throw new Error('Il backup supera il limite di 5 MiB.');
  return text;
}
export function prepareBackup({profiles,currentProfile,readError}){
  if(readError&&!currentProfile)throw new Error('Impossibile leggere l’archivio: nessun backup completo è stato preparato.');
  const all=[...profiles];
  if(currentProfile){const i=all.findIndex(p=>p.calendarId===currentProfile.calendarId);if(i<0)all.push(currentProfile);else all[i]=currentProfile;}
  let partial=!!readError,content;
  try{content=serializeBackup(partial?[currentProfile]:all);}
  catch(error){if(!currentProfile||all.length<2)throw error;content=serializeBackup([currentProfile]);partial=true;}
  return {content,partial,message:partial?'Backup parziale: contiene soltanto il calendario corrente e le sue modifiche in memoria. Gli altri calendari non sono inclusi: non considerarli protetti da questo file.':'Backup completo preparato. Conserva il file scaricato in un luogo sicuro.'};
}
export function parseBackup(text) {
  if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BACKUP_BYTES)throw new Error('Il backup supera il limite di 5 MiB.');
  let value;try{value=JSON.parse(text);}catch{throw new Error('Il file non è un backup JSON valido.');}
  if(!exact(value,['format','version','exportedAt','profiles']) || value.format!=='unito-calendar-personal' || value.version!==1 || typeof value.exportedAt!=='string'||!Number.isFinite(Date.parse(value.exportedAt)))throw new Error('Formato o versione del backup non supportata.');
  return validateProfiles(value.profiles);
}
