import {parseCalendarLink,romeDay,openingWeek,monday,shiftDay,fetchEvents,subjects,time,dayLabel,romeLocalInput,romeInstant} from './calendar.js';
import {makeOverride,mergeSource,composeEvents,validatePatch} from './personal-events.js';
import {openLocalStore} from './local-store.js';
import {serializeBackup,parseBackup,MAX_BACKUP_BYTES} from './backup.js';

const $=id=>document.getElementById(id);
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function button(text,action){const b=el('button',text);b.type='button';b.onclick=action;return b;}
function dialog(title){
  const node=el('dialog',undefined,'lesson-details personal-dialog');
  const heading=el('h2',title);heading.id='personal-dialog-title';node.setAttribute('aria-labelledby',heading.id);node.append(heading);
  node.addEventListener('close',()=>node.remove(),{once:true});document.body.append(node);return node;
}
function field(form,label,type,value,maxLength){
  const wrapper=el('label',label,'editor-field'), input=document.createElement(type==='textarea'?'textarea':'input');
  if(type!=='textarea')input.type=type;
  input.value=value??'';if(maxLength)input.maxLength=maxLength;wrapper.append(input);form.append(wrapper);return input;
}
function originalDescription(event){
  return `${event.subject}\n${dayLabel(romeDay(new Date(event.start)))} ${time(event.start)} – ${dayLabel(romeDay(new Date(event.end)))} ${time(event.end)}${event.allDay?' · Tutto il giorno':''}\n${event.rooms.join(' / ')||'Aula non indicata'}\n${event.teachers.join(', ')}${event.notes?'\n'+event.notes:''}`;
}
export async function startPersonalApp({renderWeek}) {
  let store,profile=null,events=[],week=openingWeek(romeDay()),controller,requestId=0,lastSuccess=0;
  let saving=false,dirty=false,saveError='',conflict=false,editor=null,externalChange=false,displayedCalendarId='';
  let theme='light';try{theme=localStorage.getItem('unito-calendar-theme')||'light';}catch{}
  function setTheme(){const dark=theme==='dark';document.documentElement.dataset.theme=dark?'dark':'light';$('theme-toggle').setAttribute('aria-pressed',String(dark));$('theme-toggle').setAttribute('aria-label',dark?'Attiva modalità chiara':'Attiva modalità scura');$('theme-label').textContent=dark?'Modalità chiara':'Modalità scura';}
  setTheme();$('theme-toggle').onclick=()=>{theme=theme==='dark'?'light':'dark';setTheme();try{localStorage.setItem('unito-calendar-theme',theme);}catch{}};
  const setSubjectsOpen=open=>{$('subjects-toggle').setAttribute('aria-expanded',String(open));$('subjects-content').hidden=!open;};
  setSubjectsOpen(!matchMedia('(max-width:600px)').matches);
  $('subjects-toggle').onclick=()=>setSubjectsOpen($('subjects-toggle').getAttribute('aria-expanded')!=='true');
  function storageState(){
    $('save-status').textContent=saving?'Salvataggio…':saveError?'Salvataggio non riuscito':!store?'Apertura archivio…':!profile?'Inserisci il tuo calendario':dirty?'Modifiche non salvate':'Salvato in questo browser';
    $('save-status').dataset.error=String(!!saveError);
    $('save-message').textContent=saveError||(externalChange?'L’archivio è stato aggiornato in un’altra scheda. Ricarica i dati salvati prima di continuare.':'');
    $('retry-save').hidden=!dirty||!saveError||conflict;
    $('reload-saved').hidden=!profile||(!dirty&&!externalChange&&!saveError);
    $('retry-save').disabled=$('reload-saved').disabled=saving;
    const locked=saving||dirty;
    $('source-submit').disabled=$('calendar-link').disabled=$('saved-calendars').disabled=!store||locked;
    $('backup-export').disabled=(!store&&!profile)||saving;
    $('backup-import').disabled=!store||locked;
    for(const id of ['prev','next','today','date','refresh','all','none'])$(id).disabled=!profile||saving||dirty;
    for(const input of $('subjects').querySelectorAll('input'))input.disabled=saving||dirty;
  }
  async function refreshSavedCalendars(){
    if(!store)return;
    const profiles=await store.listProfiles();const select=$('saved-calendars');select.replaceChildren(el('option','Scegli un calendario già salvato'));
    select.firstElementChild.value='';
    for(const p of profiles){const option=el('option',`Calendario …${p.calendarId.slice(-8)}`);option.value=p.calendarId;select.append(option);}
    select.value=profile?.calendarId||'';select.parentElement.hidden=profiles.length<2;
  }
  function renderFilters(){
    const names=[...new Set([...subjects(events),...(profile?.overrides.map(o=>o.latestSource.subject)||[]),...(profile?.selection||[])])].sort((a,b)=>a.localeCompare(b,'it'));
    $('subject-count').textContent=names.length;$('subjects').replaceChildren();
    for(const name of names.filter(n=>n.toLocaleLowerCase('it').includes($('search').value.toLocaleLowerCase('it')))){
      const label=el('label',undefined,'subject'),input=document.createElement('input');input.type='checkbox';input.checked=profile?.selection===null||!!profile?.selection.includes(name);input.disabled=saving||dirty;
      input.onchange=()=>{
        if(!profile||saving||dirty)return;
        let selection=profile.selection===null?[...names]:[...profile.selection];
        selection=input.checked?[...new Set([...selection,name])]:selection.filter(n=>n!==name);
        void commit({...profile,selection});
      };
      label.append(input,el('span',name));$('subjects').append(label);
    }
    if(!names.length)$('subjects').append(el('p',profile?'Nessuna materia in questa settimana. Prova un’altra data.':'Inserisci il link per scegliere le materie.','hint'));
  }
  function render(){
    $('week-title').textContent=`${dayLabel(week)} – ${dayLabel(shiftDay(week,6))}`;
    $('week-year').textContent=`LA TUA SETTIMANA · ${week.slice(0,4)}`;$('date').value=week;
    $('source').hidden=!profile;if(profile){$('source').href=profile.url;if(displayedCalendarId!==profile.calendarId){$('calendar-link').value=profile.url;displayedCalendarId=profile.calendarId;}}
    $('schedule-content').hidden=!profile;$('welcome').hidden=!!profile;
    renderFilters();
    const all=profile?composeEvents(events,profile.overrides,week,null):[];
    const shown=profile?.selection===null?all:all.filter(e=>profile.selection.includes(e.subject));
    $('total').textContent=`${shown.length} / ${all.length} eventi`;
    renderWeek($('agenda'),all,shown,week,{onOpen:openEditor});
    const hidden=profile?.overrides.filter(o=>o.patch.hidden)||[];
    $('hidden-events').hidden=!hidden.length;$('hidden-list').replaceChildren();$('hidden-count').textContent=hidden.length;
    for(const override of hidden){
      const day=romeDay(new Date(override.patch.start||override.latestSource.start));
      const event=composeEvents([],[override],monday(day),null,{includeHidden:true})[0];
      if(event)$('hidden-list').append(button(`${event.title} · ${dayLabel(day)} — modifica o ripristina`,()=>openEditor(event)));
    }
    storageState();
  }
  async function commit(next,expectedRevision=next.revision){
    if(saving||!store)return false;
    profile=structuredClone(next);dirty=true;saving=true;saveError='';conflict=false;render();
    try{profile=await store.saveProfile(next,expectedRevision);dirty=false;externalChange=false;return true;}
    catch(error){saveError=error.message||'Impossibile salvare. Esporta un backup e riprova.';conflict=error.code==='CONFLICT';return false;}
    finally{saving=false;render();}
  }
  async function load(clear=false){
    if(!profile)return;
    controller?.abort();controller=new AbortController();const active=controller,id=++requestId,calendarId=profile.calendarId,requestedWeek=week;
    if(clear){events=[];lastSuccess=0;render();}
    $('agenda').setAttribute('aria-busy','true');$('status').textContent='Aggiornamento da UniTo…';$('error').hidden=true;
    const timer=setTimeout(()=>active.abort(),25000);
    try{
      const result=await fetchEvents(requestedWeek,{calendarId,signal:active.signal});
      if(id!==requestId||profile.calendarId!==calendarId)return;
      events=result;lastSuccess=Date.now();
      if(!saving&&!dirty){
        const overrides=mergeSource(profile.overrides,result);
        if(JSON.stringify(overrides)!==JSON.stringify(profile.overrides))await commit({...profile,overrides});
      }
      render();$('status').textContent=`Aggiornato alle ${time(new Date().toISOString())}`;
    }catch(error){
      if(id!==requestId)return;
      $('error').hidden=false;$('error').textContent='Recupero non riuscito. '+(error.name==='AbortError'?'Tempo di attesa scaduto.':error.message);
      $('status').textContent=lastSuccess?'Dati non aggiornati: ultimo recupero '+time(new Date(lastSuccess).toISOString()):'Fonte non disponibile. Le personalizzazioni salvate restano disponibili.';
    }finally{clearTimeout(timer);if(id===requestId)$('agenda').setAttribute('aria-busy','false');}
  }
  async function activate(source){
    if(saving||dirty)return;
    saving=true;saveError='';storageState();
    try{const next=await store.activateCalendar(source);controller?.abort();requestId++;profile=next;events=[];externalChange=false;$('search').value='';$('source-message').textContent='';$('calendar-link').value=next.url;await refreshSavedCalendars();}
    catch(error){saveError=error.message;}
    finally{saving=false;render();}
    if(profile&&profile.calendarId===source.calendarId)void load(true);
  }
  async function readExternal(){
    if(!store||!profile)return;
    try{
      const latest=await store.getProfile(profile.calendarId);
      if(!latest||latest.revision===profile.revision)return;
      if(editor||dirty||saving){externalChange=true;if(editor)editor.querySelector('[data-editor-message]').textContent='Dati cambiati in un’altra scheda. Chiudi e ricarica i dati salvati; le modifiche aperte non sovrascriveranno quella versione.';storageState();return;}
      profile=latest;render();await refreshSavedCalendars();
    }catch(error){saveError=error.message;storageState();}
  }
  function openEditor(event){
    if(!profile||saving||dirty||editor)return;
    const openedProfile=structuredClone(profile),source=event.source,existing=profile.overrides.find(o=>o.eventId===event.id);
    const modal=dialog('La tua lezione');editor=modal;
    modal.append(el('p','Le modifiche valgono solo per questa lezione nel tuo calendario.','hint'));
    const official=el('details'),summary=el('summary','Dati originali UniTo');official.append(summary,el('p',originalDescription(source),'notes'));modal.append(official);
    if(source.cancelled||source.state==='S')modal.append(el('p',source.cancelled?'UniTo segnala questa lezione come annullata.':'UniTo segnala questa lezione come sospesa.','badge'));
    if(event.sourceChanged)modal.append(el('p','UniTo ha aggiornato dati che hai personalizzato. Puoi confrontare gli originali o ripristinarli.','hint'));
    const form=el('form'),title=field(form,'Titolo','text',event.title,500);title.required=true;
    const start=field(form,'Inizio · ora di Roma','datetime-local',romeLocalInput(event.start)),end=field(form,'Fine · ora di Roma','datetime-local',romeLocalInput(event.end));start.required=end.required=true;
    if(source.allDay)form.append(el('p','Evento di giornata intera: conserva inizio e fine a mezzanotte. La fine indica il primo giorno escluso.','hint'));
    const room=field(form,'Aula personale','text',event.rooms.join(' / '),500),note=field(form,'Nota personale','textarea',event.personalNote,10000);
    const colorEnabled=field(form,'Usa un colore personale','checkbox','');colorEnabled.checked=!!event.personalColor;
    const color=field(form,'Colore','color',event.personalColor||'#7c253e');color.disabled=!colorEnabled.checked;colorEnabled.onchange=()=>{color.disabled=!colorEnabled.checked;};
    const hidden=field(form,'Nascondi questa lezione','checkbox','');hidden.checked=event.hidden;
    const message=el('p','','editor-message');message.setAttribute('role','alert');message.dataset.editorMessage='';form.append(message);
    const actions=el('div',undefined,'editor-actions'),save=el('button','Salva lezione');save.type='submit';
    const close=button('Chiudi',()=>modal.close()),restore=button('Ripristina originale',async()=>{
      if(saving)return;
      save.disabled=restore.disabled=close.disabled=true;modal.dataset.busy='true';
      const success=await commit({...openedProfile,overrides:openedProfile.overrides.filter(o=>o.eventId!==event.id)},openedProfile.revision);
      delete modal.dataset.busy;
      if(success)modal.close();else{message.textContent=saveError;save.disabled=restore.disabled=close.disabled=false;}
    });restore.hidden=!existing;
    actions.append(save,restore,close);form.append(actions);modal.append(form);
    form.onsubmit=async e=>{
      e.preventDefault();if(saving)return;
      try{
        const patch={};
        if(title.value.trim()!==source.subject)patch.title=title.value.trim();
        const editedTimes=start.value!==romeLocalInput(event.start)||end.value!==romeLocalInput(event.end);
        const newStart=editedTimes?romeInstant(start.value):event.start,newEnd=editedTimes?romeInstant(end.value):event.end;
        if(source.allDay&&(!start.value.endsWith('T00:00')||!end.value.endsWith('T00:00')))throw new Error('Per una giornata intera scegli inizio e fine a mezzanotte.');
        if(Date.parse(newStart)!==Date.parse(source.start)||Date.parse(newEnd)!==Date.parse(source.end)){patch.start=newStart;patch.end=newEnd;}
        if(room.value.trim()!==source.rooms.join(' / '))patch.room=room.value.trim();
        if(note.value)patch.note=note.value;
        if(colorEnabled.checked)patch.color=color.value;
        if(hidden.checked)patch.hidden=true;
        validatePatch(patch);
        const overrides=openedProfile.overrides.filter(o=>o.eventId!==event.id);
        if(Object.keys(patch).length)overrides.push(makeOverride(source,patch));
        save.disabled=restore.disabled=close.disabled=true;modal.dataset.busy='true';
        const success=await commit({...openedProfile,overrides},openedProfile.revision);
        delete modal.dataset.busy;
        if(success)modal.close();else message.textContent=saveError;
      }catch(error){message.textContent=error.message;}
      finally{save.disabled=restore.disabled=close.disabled=false;}
    };
    modal.addEventListener('cancel',e=>{if(saving)e.preventDefault();});
    modal.addEventListener('close',()=>{editor=null;void readExternal();},{once:true});modal.showModal();
  }
  $('source-form').onsubmit=e=>{e.preventDefault();if(!store)return;try{void activate(parseCalendarLink($('calendar-link').value));}catch(error){$('source-message').textContent=error.message;}};
  $('calendar-link').oninput=()=>{$('source-message').textContent='';};
  $('saved-calendars').onchange=async()=>{const p=await store.getProfile($('saved-calendars').value);if(p)void activate(p);};
  function go(day){if(!profile||saving||dirty)return;week=monday(day);void load(true);}
  $('prev').onclick=()=>go(shiftDay(week,-7));$('next').onclick=()=>go(shiftDay(week,7));$('today').onclick=()=>go(romeDay());
  $('date').onchange=()=>{try{romeInstant($('date').value+'T00:00');go($('date').value);}catch(error){$('error').hidden=false;$('error').textContent=error.message;}};
  $('refresh').onclick=()=>void load();$('search').oninput=renderFilters;
  $('all').onclick=()=>{if(profile&&!saving&&!dirty)void commit({...profile,selection:null});};
  $('none').onclick=()=>{if(profile&&!saving&&!dirty)void commit({...profile,selection:[]});};
  $('retry-save').onclick=()=>{if(profile)void commit(profile);};
  $('reload-saved').onclick=()=>{
    const modal=dialog('Ricaricare i dati salvati?');modal.append(el('p','Le modifiche non salvate di questa pagina verranno scartate. Puoi prima esportare un backup.'));
    const accept=button('Ricarica dati salvati',async()=>{try{profile=await store.getProfile(profile.calendarId);dirty=false;saveError='';conflict=false;externalChange=false;render();modal.close();}catch(error){saveError=error.message;storageState();}});
    modal.append(accept,button('Annulla',()=>modal.close()));modal.showModal();
  };
  $('backup-export').onclick=async()=>{
    try{
      const all=store?await store.listProfiles().catch(()=>[]):[];
      if(profile){const i=all.findIndex(p=>p.calendarId===profile.calendarId);if(i<0)all.push(profile);else all[i]=profile;}
      const content=serializeBackup(all),url=URL.createObjectURL(new Blob([content],{type:'application/json'}));
      const anchor=el('a');anchor.href=url;anchor.download=`unito-backup-${romeDay()}.json`;anchor.hidden=true;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      $('backup-message').textContent=dirty?'Backup delle modifiche in memoria preparato. Conservalo prima di ricaricare.':'Backup preparato. Conserva il file scaricato in un luogo sicuro.';
    }catch(error){$('backup-message').textContent=error.message;}
  };
  $('backup-import').onchange=async()=>{
    const file=$('backup-import').files[0];$('backup-import').value='';if(!file||!store||saving||dirty)return;
    try{
      if(file.size>MAX_BACKUP_BYTES)throw new Error('Il backup supera il limite di 5 MiB.');
      const profiles=parseBackup(await file.text());
      if(!profiles.length)throw new Error('Il backup non contiene calendari.');
      const modal=dialog('Ripristina backup');modal.append(el('p',`${profiles.length} calendari e ${profiles.reduce((n,p)=>n+p.overrides.length,0)} personalizzazioni. Saranno sostituiti solo i calendari inclusi nel file; gli altri resteranno salvati.`));
      const list=el('ul');for(const p of profiles)list.append(el('li',`Calendario …${p.calendarId.slice(-8)} · ${p.overrides.length} modifiche`));modal.append(list);
      const message=el('p','','editor-message'),cancel=button('Annulla',()=>modal.close());
      const accept=button('Conferma ripristino',async()=>{
        if(saving||dirty){message.textContent='Completa prima il salvataggio delle modifiche aperte.';return;}
        saving=true;accept.disabled=cancel.disabled=true;storageState();
        try{await store.importProfiles(profiles);const active=profile?.calendarId||await store.getActiveCalendar();profile=active?await store.getProfile(active):null;saveError='';events=[];await refreshSavedCalendars();modal.close();$('backup-message').textContent='Backup ripristinato in questo browser.';}
        catch(error){message.textContent=error.message;}
        finally{saving=false;accept.disabled=cancel.disabled=false;render();if(profile)void load(true);}
      });
      modal.addEventListener('cancel',e=>{if(saving)e.preventDefault();});modal.append(message,accept,cancel);modal.showModal();
    }catch(error){$('backup-message').textContent=error.message;}
  };
  async function persistence(){
    try{$('persistence-message').textContent=await navigator.storage?.persisted?.()?'Il browser protegge l’archivio dalle cancellazioni automatiche. Conserva comunque un backup.':'Le modifiche restano in questo browser. Puoi richiedere protezione dalle cancellazioni automatiche.';}
    catch{$('persistence-message').textContent='Conserva un backup delle modifiche importanti.';}
  }
  $('protect-storage').disabled=!navigator.storage?.persist;
  $('protect-storage').onclick=async()=>{try{const granted=await navigator.storage.persist();await persistence();if(!granted)$('persistence-message').textContent='Protezione non concessa dal browser. Puoi continuare e conservare un backup.';}catch(error){$('persistence-message').textContent='Protezione non disponibile. Conserva un backup.';}};
  window.addEventListener('focus',()=>void readExternal());
  window.addEventListener('beforeunload',e=>{if(dirty||saving){e.preventDefault();e.returnValue='';}});
  setInterval(()=>{if(!document.hidden&&profile&&!saving&&!dirty&&!editor)void load();},300000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){void readExternal();if(profile&&!editor&&!saving&&!dirty&&Date.now()-lastSuccess>60000)void load();}});
  render();
  try{
    let legacyStorage;try{legacyStorage=localStorage;}catch{}
    store=await openLocalStore({legacyStorage,onExternalChange:()=>void readExternal()});
    const active=await store.getActiveCalendar();profile=active?await store.getProfile(active):null;
    await refreshSavedCalendars();render();void persistence();if(profile)void load();
  }catch(error){saveError='Archivio non disponibile: '+error.message+' Ricarica la pagina per riprovare.';storageState();}
}
