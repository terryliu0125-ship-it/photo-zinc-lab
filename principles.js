'use strict';
(() => {
 const controls=document.getElementById('mode-controls');
 if(!controls)return;
 const buttons=[...controls.querySelectorAll('[data-mode]')];
 const panels=[...document.querySelectorAll('[data-mode-panel]')];
 const status=document.getElementById('mode-status');
 function select(mode,announce=false){
  for(const panel of panels)panel.hidden=panel.dataset.modePanel!==mode;
  for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.mode===mode));
  if(announce)status.textContent=`已切换为${buttons.find(b=>b.dataset.mode===mode).textContent.slice(2)}，下方展示对应能量路径与判断方法。`;
 }
 controls.hidden=false;
 for(const button of buttons)button.addEventListener('click',()=>select(button.dataset.mode,true));
 select('assisted');
})();
