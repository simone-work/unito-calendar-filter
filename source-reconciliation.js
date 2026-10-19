import {mergeSource} from './personal-events.js';

// Keep source observations until a successful save can reconcile them with the current draft.
export function createSourceReconciler({getContext,persist}){
  const pending=new Map();let flushing=false;
  function observe(calendarId,events){
    const {profile}=getContext();if(!profile||profile.calendarId!==calendarId)return;
    const ids=new Set(profile.overrides.map(o=>o.eventId));
    if(!pending.has(calendarId))pending.set(calendarId,new Map());
    for(const event of events)if(ids.has(event.id))pending.get(calendarId).set(event.id,structuredClone(event));
  }
  async function flush(){
    if(flushing)return;flushing=true;
    try{
      while(true){
        const {profile,busy,dirty}=getContext();if(!profile||busy||dirty)return;
        const queued=pending.get(profile.calendarId);if(!queued?.size)return;
        const observed=new Map(queued),overrides=mergeSource(profile.overrides,[...observed.values()]);
        if(JSON.stringify(overrides)!==JSON.stringify(profile.overrides)&&!await persist({...profile,overrides}))return;
        // Do not remove newer observations that arrived during the write.
        for(const [id,event] of observed)if(queued.get(id)===event)queued.delete(id);
      }
    }finally{flushing=false;}
  }
  return {observe,flush};
}
