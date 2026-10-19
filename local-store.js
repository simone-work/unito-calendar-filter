import {SOURCE,STORAGE_KEY,parseCalendarLink} from './calendar.js';
import {fromSelection} from './preferences.js';
import {validateProfile,validateProfiles} from './backup.js';

const DB_NAME='unito-calendar-personal';
export class ConflictError extends Error {
  constructor(){super('Il calendario è cambiato in un’altra scheda. Ricarica i dati salvati prima di riprovare.');this.code='CONFLICT';}
}
export async function openLocalStore({indexedDB=globalThis.indexedDB,legacyStorage,onExternalChange=()=>{}}={}) {
  if(!indexedDB)throw new Error('Questo browser non rende disponibile l’archivio locale.');
  const db=await new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,1);let abandoned=false;
    const timer=setTimeout(()=>{abandoned=true;reject(new Error('Archivio occupato. Chiudi le altre schede del sito e riprova.'));},5000);
    request.onupgradeneeded=()=>{request.result.createObjectStore('profiles',{keyPath:'calendarId'});request.result.createObjectStore('meta',{keyPath:'key'});};
    request.onblocked=()=>{abandoned=true;clearTimeout(timer);reject(new Error('Chiudi le altre schede del sito per aggiornare l’archivio.'));};
    request.onerror=()=>{clearTimeout(timer);reject(request.error);};
    request.onsuccess=()=>{clearTimeout(timer);if(abandoned)request.result.close();else resolve(request.result);};
  });
  let closed=false;
  const channel=typeof window!=='undefined' && typeof BroadcastChannel!=='undefined'?new BroadcastChannel(DB_NAME):null;
  if(channel)channel.onmessage=()=>onExternalChange();
  function close(){closed=true;channel?.close();db.close();}
  db.onversionchange=()=>{close();onExternalChange();};
  function transaction(names,mode,work) {
    return new Promise((resolve,reject)=>{
      if(closed){reject(new Error('Archivio chiuso. Ricarica la pagina.'));return;}
      const tx=db.transaction(names,mode), stores=Object.fromEntries(names.map(n=>[n,tx.objectStore(n)]));
      let result,failure;
      const fail=error=>{failure=error;tx.abort();};
      tx.oncomplete=()=>{if(mode==='readwrite')channel?.postMessage('changed');resolve(result);};
      tx.onabort=()=>reject(failure||tx.error||new Error('Salvataggio interrotto. Le modifiche non sono state salvate.'));
      tx.onerror=()=>{failure ||= tx.error;};
      try{work(stores,value=>{result=value;},fail);}catch(error){fail(error);}
    });
  }
  const store={
    getProfile:calendarId=>transaction(['profiles'],'readonly',(s,done)=>{s.profiles.get(calendarId).onsuccess=e=>done(e.target.result||null);}),
    listProfiles:()=>transaction(['profiles'],'readonly',(s,done)=>{s.profiles.getAll().onsuccess=e=>done(e.target.result);}),
    getActiveCalendar:()=>transaction(['meta'],'readonly',(s,done)=>{s.meta.get('active').onsuccess=e=>done(e.target.result?.value||null);}),
    activateCalendar(source){
      const parsed=parseCalendarLink(source.url);
      if(parsed.calendarId!==source.calendarId)return Promise.reject(new Error('Calendario non valido.'));
      return transaction(['profiles','meta'],'readwrite',(s,done,fail)=>{
        s.profiles.getAll().onsuccess=e=>{
          const profiles=e.target.result;
          let profile=profiles.find(p=>p.calendarId===parsed.calendarId);
          if(!profile){if(profiles.length>=100){fail(new Error('Massimo 100 calendari salvati.'));return;}profile={...parsed,selection:null,revision:0,overrides:[]};s.profiles.put(profile);}
          s.meta.put({key:'active',value:parsed.calendarId});done(profile);
        };
      });
    },
    saveProfile(profile,expectedRevision){
      let valid;try{valid=validateProfile(profile);}catch(error){return Promise.reject(error);}
      return transaction(['profiles'],'readwrite',(s,done,fail)=>{
        s.profiles.getAll().onsuccess=e=>{
          const profiles=e.target.result, current=profiles.find(p=>p.calendarId===valid.calendarId);
          if(!current || current.revision!==expectedRevision){fail(new ConflictError());return;}
          const next={...valid,revision:current.revision+1};
          try{validateProfiles(profiles.map(p=>p.calendarId===next.calendarId?next:p));}catch(error){fail(error);return;}
          s.profiles.put(next);done(next);
        };
      });
    },
    importProfiles(profiles){
      let valid;try{valid=validateProfiles(profiles);}catch(error){return Promise.reject(error);}
      return transaction(['profiles','meta'],'readwrite',(s,done,fail)=>{
        s.profiles.getAll().onsuccess=e=>{
          const existing=e.target.result, combined=new Map(existing.map(p=>[p.calendarId,p]));
          for(const profile of valid)combined.set(profile.calendarId,{...profile,revision:(combined.get(profile.calendarId)?.revision??-1)+1});
          try{validateProfiles([...combined.values()]);}catch(error){fail(error);return;}
          for(const profile of valid)s.profiles.put(combined.get(profile.calendarId));
          s.meta.get('active').onsuccess=event=>{if(!event.target.result && valid.length)s.meta.put({key:'active',value:valid[0].calendarId});};
          done([...combined.values()]);
        };
      });
    },
    close
  };
  // Keep the old storage intact. Marker and migrated profile commit together.
  let legacy=null;
  try{const raw=legacyStorage?.getItem(STORAGE_KEY);if(raw!==null&&raw!==undefined){legacy=JSON.parse(raw);fromSelection(legacy);}else legacy=undefined;}catch{legacy=undefined;}
  try{
    await transaction(['profiles','meta'],'readwrite',(s,done)=>{
      s.meta.get('migrated-v1').onsuccess=e=>{
        if(e.target.result)return;
        if(legacy!==undefined){
          const source=parseCalendarLink(SOURCE);
          s.profiles.get(source.calendarId).onsuccess=event=>{
            if(!event.target.result)s.profiles.put({...source,selection:legacy,revision:0,overrides:[]});
          };
          s.meta.get('active').onsuccess=event=>{if(!event.target.result)s.meta.put({key:'active',value:source.calendarId});};
        }
        s.meta.put({key:'migrated-v1',value:true});done();
      };
    });
  }catch(error){close();throw error;}
  return store;
}
