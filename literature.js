'use strict';
(() => {
 document.getElementById('copy-status').textContent='';
 const papers=JSON.parse(document.getElementById('literature-data').textContent);
 const list=document.getElementById('paper-list');
 const nodes=new Map([...list.children].map(node=>[node.dataset.id,node]));
 const search=document.getElementById('paper-search');
 const year=document.getElementById('paper-year');
 const sort=document.getElementById('paper-sort');
 const chips=[...document.querySelectorAll('[data-filter]')];
 const exportButton=document.getElementById('export-filtered');
 const normalize=s=>s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const searchable=new Map(papers.map(p=>[p.id,normalize([p.title,p.heading,p.summary,p.material,p.journal,p.doi,...p.authors].join(' '))]));
 let topic='all',visible=[...papers],noticeTimer;
 const notice=text=>{const node=document.getElementById('copy-status');node.textContent=text;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>node.textContent='',4000);};
 function render(){
  const terms=normalize(search.value).split(/\s+/).filter(Boolean);
  visible=papers.filter(p=>(topic==='all'||p.tags.includes(topic))&&(year.value==='all'||String(p.year)===year.value)&&terms.every(t=>searchable.get(p.id).includes(t)));
  visible.sort((a,b)=>(sort.value==='oldest'?a.year-b.year:sort.value==='newest'?b.year-a.year:0)||a.id.localeCompare(b.id));
  const shown=new Set(visible.map(p=>p.id));
  for(const p of papers)nodes.get(p.id).hidden=!shown.has(p.id);
  const order=[...list.children].filter(node=>shown.has(node.dataset.id)).map(node=>node.dataset.id);
  if(visible.some((p,i)=>order[i]!==p.id))for(const p of visible)list.append(nodes.get(p.id));
  for(const chip of chips)chip.setAttribute('aria-pressed',String(chip.dataset.filter===topic));
  document.getElementById('paper-result-count').textContent=`显示 ${visible.length} / ${papers.length} 篇文献`;
  document.getElementById('library-empty').hidden=visible.length!==0;
  exportButton.disabled=visible.length===0;
 }
 function clear(){search.value='';year.value='all';topic='all';render();}
 search.addEventListener('input',render);year.addEventListener('change',render);sort.addEventListener('change',render);
 document.getElementById('library-search-form').addEventListener('submit',event=>event.preventDefault());
 for(const chip of chips)chip.addEventListener('click',()=>{topic=chip.dataset.filter;render();});
 document.getElementById('clear-search').addEventListener('click',clear);
 document.getElementById('reset-empty').addEventListener('click',()=>{clear();search.focus();});
 const citation=p=>`${p.authors.join('; ')}. ${p.title}. ${p.journal}, ${p.year}, ${p.volume}: ${p.pages}. ${p.url}`;
 list.addEventListener('click',async event=>{
  const button=event.target.closest('[data-copy]');if(!button)return;
  const p=papers.find(p=>p.id===button.dataset.copy),text=citation(p);
  try{await navigator.clipboard.writeText(text);notice(`${p.id} 引文已复制`);}
  catch{
   const existing=nodes.get(p.id).querySelector('.citation-manual');if(existing){existing.focus();existing.select();return;}
   const area=document.createElement('textarea');area.className='citation-manual';area.value=text;area.readOnly=true;area.setAttribute('aria-label',`${p.id} 引文，可手动复制`);nodes.get(p.id).querySelector('.paper-body').append(area);area.focus();area.select();notice('请复制已选中的引文');
  }
 });
 const bib=p=>`@article{PhotoZinc${p.id},\n  title = {{${p.title}}},\n  author = {${p.citationAuthors.join(' and ')}},\n  journal = {${p.journal}},\n  year = {${p.year}},\n  volume = {${p.volume}},\n  ${/^\d+-\d+$/.test(p.pages)?'pages':'eid'} = {${p.pages.replace('-','--')}},\n  doi = {${p.doi}},\n  url = {${p.url}}\n}`;
 exportButton.addEventListener('click',()=>{
  if(!visible.length)return;
  const blob=new Blob([visible.map(bib).join('\n\n')+'\n'],{type:'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='photo-zinc-literature.bib';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);notice(`已导出 ${visible.length} 篇文献`);
 });
 function revealLinkedPaper(){
  if(!/^#paper-L\d{2}$/.test(location.hash))return;
  const target=document.getElementById(location.hash.slice(1));
  if(target?.hidden){clear();target.scrollIntoView({block:'start'});}
 }
 window.addEventListener('hashchange',revealLinkedPaper);render();revealLinkedPaper();
})();
