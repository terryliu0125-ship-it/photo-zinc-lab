'use strict';
(() => {
 document.getElementById('copy-status').textContent='';
 const papers=JSON.parse(document.getElementById('literature-data').textContent);
 const list=document.getElementById('paper-list');
 const nodes=new Map([...list.children].map(node=>[node.dataset.id,node]));
 const search=document.getElementById('paper-search');
 const year=document.getElementById('paper-year');
 const type=document.getElementById('paper-type');
 const sort=document.getElementById('paper-sort');
 const chips=[...document.querySelectorAll('[data-filter]')];
 const systems=[...document.querySelectorAll('[data-system]')];
 const exportButton=document.getElementById('export-filtered');
 const normalize=s=>s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const searchable=new Map(papers.map(p=>[p.id,normalize([p.title,p.title_zh||'',p.heading,p.summary,p.material,p.journal,p.doi,...p.authors].join(' '))]));
 const paperType=p=>p.article_type|| (p.kind==='综述'?'review':['研究论文','关联器件'].includes(p.kind)?'research':'unclassified');
 let topic='all',system='all',visible=[...papers],noticeTimer;
 const notice=text=>{const node=document.getElementById('copy-status');node.textContent=text;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>node.textContent='',4000);};
 function render(){
  const terms=normalize(search.value).split(/\s+/).filter(Boolean);
  visible=papers.filter(p=>(system==='all'||(p.battery_category||'zinc')===system)&&(topic==='all'||p.tags.includes(topic))&&(type.value==='all'||paperType(p)===type.value)&&(year.value==='all'||String(p.year)===year.value)&&terms.every(t=>searchable.get(p.id).includes(t)));
  const published=p=>p.publication_date||`${p.year}-01-01`;
  visible.sort((a,b)=>(sort.value==='oldest'?published(a).localeCompare(published(b)):sort.value==='newest'?published(b).localeCompare(published(a)):0)||a.id.localeCompare(b.id,undefined,{numeric:true}));
  const shown=new Set(visible.map(p=>p.id));
  for(const p of papers)nodes.get(p.id).hidden=!shown.has(p.id);
  const order=[...list.children].filter(node=>shown.has(node.dataset.id)).map(node=>node.dataset.id);
  if(visible.some((p,i)=>order[i]!==p.id))for(const p of visible)list.append(nodes.get(p.id));
  for(const chip of chips)chip.setAttribute('aria-pressed',String(chip.dataset.filter===topic));
  for(const button of systems)button.setAttribute('aria-pressed',String(button.dataset.system===system));
  document.getElementById('paper-result-count').textContent=`显示 ${visible.length} / ${papers.length} 篇文献`;
  document.getElementById('library-empty').hidden=visible.length!==0;
  exportButton.disabled=visible.length===0;
 }
 function clear(){search.value='';year.value='all';type.value='all';topic='all';system='all';render();}
 search.addEventListener('input',render);year.addEventListener('change',render);type.addEventListener('change',render);sort.addEventListener('change',render);
 document.getElementById('library-search-form').addEventListener('submit',event=>event.preventDefault());
 for(const chip of chips)chip.addEventListener('click',()=>{topic=chip.dataset.filter;render();});
 for(const button of systems)button.addEventListener('click',()=>{system=button.dataset.system;render();});
 document.getElementById('clear-search').addEventListener('click',clear);
 document.getElementById('reset-empty').addEventListener('click',()=>{clear();search.focus();});
 const citation=p=>[p.authors.join('; '),p.title,[p.journal,p.year,[p.volume,p.pages].filter(Boolean).join(': ')].filter(Boolean).join(', '),p.url].filter(Boolean).join('. ');
 list.addEventListener('click',async event=>{
  const button=event.target.closest('[data-copy]');if(!button)return;
  const p=papers.find(p=>p.id===button.dataset.copy),text=citation(p);
  try{await navigator.clipboard.writeText(text);notice(`${p.id} 引文已复制`);}
  catch{
   const existing=nodes.get(p.id).querySelector('.citation-manual');if(existing){existing.focus();existing.select();return;}
   const area=document.createElement('textarea');area.className='citation-manual';area.value=text;area.readOnly=true;area.setAttribute('aria-label',`${p.id} 引文，可手动复制`);nodes.get(p.id).querySelector('.paper-body').append(area);area.focus();area.select();notice('请复制已选中的引文');
  }
 });
 const bibEscape=s=>String(s).replace(/[\\{}&%_$#]/g,c=>({'\\':'\\textbackslash{}','{':'\\{','}':'\\}','&':'\\&','%':'\\%','_':'\\_','$':'\\$','#':'\\#'}[c]));
 const bib=p=>{
  const fields=[`title = {{${bibEscape(p.title)}}}`,`author = {${p.citationAuthors.map(bibEscape).join(' and ')}}`,`journal = {${bibEscape(p.journal)}}`,`year = {${p.year}}`];
  if(p.volume)fields.push(`volume = {${bibEscape(p.volume)}}`);
  if(p.issue)fields.push(`number = {${bibEscape(p.issue)}}`);
  if(p.pages)fields.push(`${/^\d+[-–]\d+$/.test(p.pages)?'pages':'eid'} = {${bibEscape(p.pages.replace(/(?<=\d)[-–](?=\d)/g,'--'))}}`);
  fields.push(`doi = {${bibEscape(p.doi)}}`,`url = {${bibEscape(p.url)}}`);
  return `@article{PhotoZinc${p.id},\n  ${fields.join(',\n  ')}\n}`;
 };
 exportButton.addEventListener('click',()=>{
  if(!visible.length)return;
  const blob=new Blob([visible.map(bib).join('\n\n')+'\n'],{type:'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='photo-zinc-literature.bib';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);notice(`已导出 ${visible.length} 篇文献`);
 });
 function revealLinkedPaper(){
  if(!/^#paper-L\d+$/.test(location.hash))return;
  const target=document.getElementById(location.hash.slice(1));
  if(target?.hidden){clear();target.scrollIntoView({block:'start'});}
 }
 window.addEventListener('hashchange',revealLinkedPaper);render();revealLinkedPaper();
})();
