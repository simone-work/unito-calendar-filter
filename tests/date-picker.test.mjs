import test from 'node:test';
import assert from 'node:assert/strict';
import {monthGrid,shiftMonth,keyboardDate} from '../date-picker.js';
import * as picker from '../date-picker.js';

test('month grid starts on Monday and includes leap days and adjacent months',()=>{
  const december=monthGrid('2026-12-19');
  assert.equal(december.length,42);assert.equal(december[0],'2026-11-30');assert.equal(december[41],'2027-01-10');
  const leap=monthGrid('2028-02-02');assert.ok(leap.includes('2028-02-29'));
  assert.equal(monthGrid('2026-02-02').filter(day=>day.startsWith('2026-02')).length,28);
});
test('month navigation clamps month-end dates and crosses year boundaries',()=>{
  assert.equal(shiftMonth('2026-01-31',1),'2026-02-28');
  assert.equal(shiftMonth('2028-01-31',1),'2028-02-29');
  assert.equal(shiftMonth('2026-12-31',1),'2027-01-31');
  assert.equal(shiftMonth('2026-03-31',-1),'2026-02-28');
});
test('calendar keyboard navigation uses days, weeks, months and years',()=>{
  assert.equal(keyboardDate('2026-01-01','ArrowLeft'),'2025-12-31');
  assert.equal(keyboardDate('2026-10-19','ArrowDown'),'2026-10-26');
  assert.equal(keyboardDate('2026-11-01','Home'),'2026-10-26');
  assert.equal(keyboardDate('2026-10-19','End'),'2026-10-25');
  assert.equal(keyboardDate('2026-03-31','PageUp'),'2026-02-28');
  assert.equal(keyboardDate('2028-02-29','PageUp',true),'2027-02-28');
  assert.equal(keyboardDate('2026-10-19','Tab'),null);
});
test('focused days scroll inside a short picker without moving the document',()=>{
  assert.equal(typeof picker.revealFocusedDate,'function');
  const panel={scrollTop:0,getBoundingClientRect:()=>({top:100,bottom:300})};
  picker.revealFocusedDate(panel,{getBoundingClientRect:()=>({top:340,bottom:378})});
  assert.equal(panel.scrollTop,86);
  panel.scrollTop=150;
  picker.revealFocusedDate(panel,{getBoundingClientRect:()=>({top:70,bottom:108})});
  assert.equal(panel.scrollTop,112);
  picker.revealFocusedDate(panel,{getBoundingClientRect:()=>({top:150,bottom:188})});
  assert.equal(panel.scrollTop,112);
});
