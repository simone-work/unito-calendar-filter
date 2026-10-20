import {romeDay,shiftDay,monday,dayLabel} from './calendar.js';

export function monthGrid(day){
  const first=monday(day.slice(0,7)+'-01');
  return Array.from({length:42},(_,i)=>shiftDay(first,i));
}
export function shiftMonth(day,amount){
  const date=new Date(day+'T12:00:00Z'),wanted=date.getUTCDate();
  date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+amount);
  const last=new Date(date);last.setUTCMonth(last.getUTCMonth()+1,0);
  date.setUTCDate(Math.min(wanted,last.getUTCDate()));
  return date.toISOString().slice(0,10);
}
export function keyboardDate(day,key,shift=false){
  const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
  if(key in delta)return shiftDay(day,delta[key]);
  if(key==='Home')return monday(day);
  if(key==='End')return shiftDay(monday(day),6);
  if(key==='PageUp'||key==='PageDown')return shiftMonth(day,(key==='PageUp'?-1:1)*(shift?12:1));
  return null;
}
export function revealFocusedDate(panel,target){
  const viewport=panel.getBoundingClientRect(),item=target.getBoundingClientRect();
  if(item.top<viewport.top+8)panel.scrollTop-=viewport.top+8-item.top;
  else if(item.bottom>viewport.bottom-8)panel.scrollTop+=item.bottom-(viewport.bottom-8);
}
export function setupDatePicker({trigger,panel,onSelect}){
  let selected=romeDay(),active=selected;
  const label=trigger.querySelector('[data-date-label]');
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  function action(text,name,handler){const b=el('button',text);b.type='button';b.setAttribute('aria-label',name);b.onclick=handler;return b;}
  function close(restoreFocus=false){panel.hidden=true;trigger.setAttribute('aria-expanded','false');if(restoreFocus&&!trigger.disabled)trigger.focus({preventScroll:true});}
  function position(){
    const rect=trigger.getBoundingClientRect(),width=Math.min(320,window.innerWidth-32);
    panel.style.width=width+'px';panel.style.left=Math.max(16,Math.min(rect.left,window.innerWidth-width-16))+'px';
    const height=panel.getBoundingClientRect().height;
    const below=rect.bottom+8;
    panel.style.top=Math.max(16,Math.min(below+height<=window.innerHeight-16?below:rect.top-height-8,window.innerHeight-height-16))+'px';
  }
  function choose(day){if(trigger.disabled)return;setDate(day);close(true);onSelect(day);}
  function draw(focus='day'){
    const header=el('div',undefined,'date-picker-header');
    const previous=action('‹','Mese precedente',()=>{active=shiftMonth(active,-1);draw('previous');});previous.dataset.focus='previous';
    const next=action('›','Mese successivo',()=>{active=shiftMonth(active,1);draw('next');});next.dataset.focus='next';
    const title=el('h3',dayLabel(active,{month:'long',year:'numeric'}));title.id='date-picker-heading';
    header.append(previous,title,next);
    const table=el('table',undefined,'date-picker-grid');table.setAttribute('role','grid');table.setAttribute('aria-labelledby',title.id);
    const head=el('thead'),headRow=el('tr');
    ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].forEach(text=>{const cell=el('th',text);cell.scope='col';headRow.append(cell);});head.append(headRow);
    const body=el('tbody'),days=monthGrid(active),today=romeDay();
    for(let row=0;row<6;row++){
      const tr=el('tr');
      for(const day of days.slice(row*7,row*7+7)){
        const td=el('td');td.setAttribute('aria-selected',String(day===selected));
        const b=action(String(Number(day.slice(8))),dayLabel(day,{weekday:'long',day:'numeric',month:'long',year:'numeric'}),()=>choose(day));
        b.className='date-day'+(day.slice(0,7)!==active.slice(0,7)?' is-outside':'')+(day===selected?' is-selected':'')+(day===today?' is-today':'');
        b.dataset.day=day;b.tabIndex=day===active?0:-1;if(day===today)b.setAttribute('aria-current','date');
        td.append(b);tr.append(td);
      }
      body.append(tr);
    }
    table.append(head,body);
    table.onkeydown=e=>{
      const day=e.target.closest('[data-day]')?.dataset.day;if(!day)return;
      const target=keyboardDate(day,e.key,e.shiftKey);if(!target)return;
      e.preventDefault();active=target;draw();
    };
    const footer=el('div',undefined,'date-picker-footer');footer.append(action('Vai a oggi','Vai a oggi',()=>choose(romeDay())),action('Chiudi','Chiudi calendario date',()=>close(true)));
    const help=el('p','Frecce: cambia giorno. Pagina su/giù: cambia mese. Maiusc + Pagina su/giù: cambia anno. Invio: scegli. Esc: chiudi.','visually-hidden');help.id='date-picker-help';
    panel.replaceChildren(header,table,footer,help);position();
    const target=focus==='day'?panel.querySelector(`[data-day="${active}"]`):panel.querySelector(`[data-focus="${focus}"]`);
    if(target){target.focus({preventScroll:true});revealFocusedDate(panel,target);}
  }
  function setDate(day){selected=day;label.textContent=dayLabel(day,{day:'2-digit',month:'short',year:'numeric'});trigger.setAttribute('aria-label','Vai alla data: '+dayLabel(day,{day:'numeric',month:'long',year:'numeric'}));}
  trigger.onclick=()=>{
    if(!panel.hidden){close();return;}
    active=selected;panel.hidden=false;trigger.setAttribute('aria-expanded','true');draw();
  };
  document.addEventListener('pointerdown',e=>{if(!panel.hidden&&!panel.contains(e.target)&&!trigger.contains(e.target))close();});
  document.addEventListener('keydown',e=>{if(!panel.hidden&&e.key==='Escape'){e.preventDefault();close(true);}});
  const control=trigger.parentElement;
  control.addEventListener('focusout',e=>{if(e.relatedTarget&&!control.contains(e.relatedTarget))close();});
  document.addEventListener('scroll',e=>{if(!panel.hidden&&!panel.contains(e.target))close();},true);
  window.addEventListener('resize',()=>{if(!panel.hidden)position();});
  setDate(selected);return {setDate,close};
}
