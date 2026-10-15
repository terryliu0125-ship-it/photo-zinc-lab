'use strict';
(() => {
 const panels=[...document.querySelectorAll('[data-topic-panel]')];
 const links=[...document.querySelectorAll('[data-chapter-link]')];
 if(!panels.length||!links.length)return;
 const status=document.getElementById('chapter-status');
 const valid=id=>panels.some(panel=>panel.id===id);
 function select(id,scroll=false){
  const current=valid(id)?id:panels[0].id;
  for(const panel of panels)panel.hidden=panel.id!==current;
  for(const link of links){if(link.dataset.chapterLink===current)link.setAttribute('aria-current','step');else link.removeAttribute('aria-current');}
  const index=panels.findIndex(panel=>panel.id===current);
  status.textContent=`第 ${index+1} / ${panels.length} 章`;
  if(scroll)panels[index].scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 }
 for(const link of document.querySelectorAll('a[href^="#"]')){
  const id=link.getAttribute('href').slice(1);
  if(!valid(id))continue;
  link.addEventListener('click',event=>{
   if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   event.preventDefault();
   if(location.hash!=='#'+id)history.pushState(null,'','#'+id);
   select(id,true);
  });
 }
 window.addEventListener('hashchange',()=>select(location.hash.slice(1),true));
 select(location.hash.slice(1));
 if(valid(location.hash.slice(1)))requestAnimationFrame(()=>select(location.hash.slice(1),true));
})();
