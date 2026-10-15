'use strict';
(() => {
 const C=window.PhotoZincLibrary;
 if(!C)return;
 for(const element of document.querySelectorAll('[data-interactive]'))element.hidden=false;
 const $=id=>document.getElementById(id),papers=JSON.parse($('literature-data').textContent);
 const evidence=JSON.parse($('comparison-data').textContent),byId=new Map(papers.map(p=>[p.id,p]));
 const list=$('paper-list'),nodes=new Map([...list.children].map(n=>[n.dataset.id,n]));
 const index=new Map(papers.map(p=>[p.id,C.makeIndex(p)]));
 const bookKey='photo-zinc-reading-v1',compareKey='photo-zinc-compare-v1';
 let books={},selected=[],storageAvailable=true,state=C.readState(location.search),visible=[],noticeTimer;
 try{books=C.parseBooks(localStorage.getItem(bookKey),papers);const saved=JSON.parse(localStorage.getItem(compareKey)||'[]');selected=Array.isArray(saved)?[...new Set(saved.filter(id=>byId.has(id)))].slice(0,4):[];}catch{storageAvailable=false;}
 const initialCompare=new URLSearchParams(location.search).get('compare');
 if(initialCompare)selected=[...new Set(initialCompare.split(',').filter(id=>byId.has(id)))].slice(0,4);
 const notice=text=>{$('copy-status').textContent=text;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('copy-status').textContent='',4500);};
 function saveBooks(){try{localStorage.setItem(bookKey,JSON.stringify({version:1,records:books}));storageAvailable=true;}catch{storageAvailable=false;}$('storage-note').textContent=storageAvailable?'收藏、阅读状态与笔记保存在当前浏览器，可导出备份。':'浏览器未允许保存，当前会话仍可使用；请导出阅读记录备份。';}
 function saveCompare(){try{localStorage.setItem(compareKey,JSON.stringify(selected));}catch{/* Comparison remains usable for this session. */}}
 function controls(){
  $('paper-search').value=state.query;$('paper-type').value=state.type;$('paper-year').value=state.year;$('paper-sort').value=state.sort;
  $('reading-status-filter').value=state.status;$('favorites-only').checked=state.favoritesOnly;
  for(const b of document.querySelectorAll('[data-system]'))b.setAttribute('aria-pressed',String(b.dataset.system===state.system));
  for(const b of document.querySelectorAll('[data-facet]'))b.setAttribute('aria-pressed',String(state[b.dataset.facet].includes(b.dataset.value)));
  $('view-all').setAttribute('aria-pressed',String(!state.shelf));$('view-shelf').setAttribute('aria-pressed',String(state.shelf));
  if(state.directions.length)$('more-directions').open=true;
 }
 function url(){const query=C.stateQuery(state);history.replaceState(null,'',location.pathname+(query?'?'+query:''));}
 function activeFilters(){
  const tokens=[];
  if(state.query)tokens.push(['query','',`搜索：${state.query}`]);
  if(state.system!=='all')tokens.push(['system','',state.system==='zinc'?'锌基相关文献':'其他金属离子电池']);
  for(const key of ['materials','directions','scopes'])for(const value of state[key])tokens.push([key,value,C.labels[value]]);
  if(state.type!=='all')tokens.push(['type','',state.type==='research'?'研究论文':state.type==='review'?'综述 / 观点':'待分类']);
  if(state.year!=='all')tokens.push(['year','',state.year+' 年']);
  if(state.status!=='all')tokens.push(['status','',C.statuses.find(([key])=>key===state.status)?.[1]||'阅读状态']);
  if(state.favoritesOnly)tokens.push(['favoritesOnly','','仅收藏']);
  $('active-filters').innerHTML=tokens.map(([key,value,label])=>`<button type="button" data-clear-filter="${C.escape(key)}" data-clear-value="${C.escape(value)}" aria-label="移除筛选 ${C.escape(label)}">${C.escape(label)} <span aria-hidden="true">×</span></button>`).join('');
  $('active-filters').hidden=!tokens.length;
 }
 function updateReaderControls(){
  $('shelf-count').textContent=String(Object.keys(books).length);
  for(const p of papers){const record=books[p.doi.toLowerCase()]||{},node=nodes.get(p.id),button=node.querySelector('[data-favorite]');
   button.textContent=record.favorite?'★ 已收藏':'☆ 收藏';button.setAttribute('aria-pressed',String(!!record.favorite));button.setAttribute('aria-label',`${record.favorite?'取消收藏':'收藏'} ${p.id}`);
   node.querySelector('[data-reading-status]').value=record.status||'';
   const note=node.querySelector('[data-note]');if(document.activeElement!==note)note.value=record.note||'';
   const compare=node.querySelector('[data-compare]');compare.setAttribute('aria-pressed',String(selected.includes(p.id)));compare.textContent=selected.includes(p.id)?'✓ 已加入对比':'＋ 加入对比';compare.disabled=selected.length>=4&&!selected.includes(p.id);
  }
 }
 function render(pushUrl=false){
  visible=C.filter(papers,state,books,index);const pages=Math.max(1,Math.ceil(visible.length/6));state.page=Math.max(1,Math.min(state.page,pages));
  const current=visible.slice((state.page-1)*6,state.page*6),shown=new Set(current.map(p=>p.id));
  for(const p of papers)nodes.get(p.id).hidden=!shown.has(p.id);
  const order=[...list.children].filter(n=>shown.has(n.dataset.id)).map(n=>n.dataset.id);if(current.some((p,i)=>order[i]!==p.id))for(const p of current)list.append(nodes.get(p.id));
  controls();activeFilters();updateReaderControls();
  $('paper-result-count').textContent=`找到 ${visible.length} 篇文献 · 全库 ${papers.length} 篇${state.shelf?' · 我的书架':''}`;
  for(const label of document.querySelectorAll('[data-page-status]'))label.textContent=`第 ${state.page} / ${pages} 页 · 每页 6 篇`;
  for(const b of document.querySelectorAll('[data-page-action="previous"]'))b.disabled=state.page===1;
  for(const b of document.querySelectorAll('[data-page-action="next"]'))b.disabled=state.page===pages;
  for(const nav of document.querySelectorAll('.library-pagination'))nav.hidden=!visible.length;
  $('library-empty').hidden=!!visible.length;$('export-filtered').disabled=!visible.length;
  const emptyShelf=state.shelf&&!Object.keys(books).length;
  $('empty-title').textContent=emptyShelf?'从第一篇想读的论文开始':'没有符合当前条件的文献';
  $('empty-description').textContent=emptyShelf?'在全部文献中收藏、标为待读或写下笔记，就会出现在你的书架。':'试试减少条件，或前往站外学术数据库继续检索。';
  $('reset-empty').textContent=emptyShelf?'返回全部文献':'清除筛选';
  $('external-search').hidden=emptyShelf;
  const query=state.query.trim()||[...state.materials,...state.directions].map(k=>C.labels[k]).join(' ')||'aqueous zinc ion battery cathode';
  $('scholar-search').href='https://scholar.google.com/scholar?q='+encodeURIComponent(query);
  $('crossref-search').href='https://search.crossref.org/?q='+encodeURIComponent(query);
  $('search-understanding').textContent=state.query?`匹配词：${C.terms(state.query).join(' · ')}${state.sort==='relevance'?' · 按标题、材料与导读相关度排序':''}`:'支持中英文同义词与化学式，如“五氧化二钒 / V₂O₅ / V2O5”。';
  if(pushUrl)url();renderTray();
 }
 function refilter(){state.page=1;render(true);}
 function clear(keepShelf=true){const shelf=keepShelf&&state.shelf;state=C.initialState();state.shelf=shelf;render(true);}
 $('paper-search').addEventListener('input',()=>{state.query=$('paper-search').value;refilter();});
 for(const [id,key]of [['paper-year','year'],['paper-type','type'],['paper-sort','sort'],['reading-status-filter','status']])$(id).addEventListener('change',()=>{state[key]=$(id).value;refilter();});
 $('favorites-only').addEventListener('change',()=>{state.favoritesOnly=$('favorites-only').checked;refilter();});
 $('library-search-form').addEventListener('submit',e=>e.preventDefault());
 for(const b of document.querySelectorAll('[data-system]'))b.addEventListener('click',()=>{state.system=b.dataset.system;refilter();});
 for(const b of document.querySelectorAll('[data-facet]'))b.addEventListener('click',()=>{const key=b.dataset.facet,value=b.dataset.value;state[key]=state[key].includes(value)?state[key].filter(v=>v!==value):[...state[key],value];refilter();});
 for(const b of document.querySelectorAll('[data-search-example]'))b.addEventListener('click',()=>{state=C.initialState();state.query=b.dataset.searchExample;render(true);});
 $('active-filters').addEventListener('click',e=>{const b=e.target.closest('[data-clear-filter]');if(!b)return;const key=b.dataset.clearFilter;if(Array.isArray(state[key]))state[key]=state[key].filter(v=>v!==b.dataset.clearValue);else state[key]=C.initialState()[key];refilter();});
 $('clear-search').addEventListener('click',()=>clear());$('reset-empty').addEventListener('click',()=>{clear(!state.shelf||Object.keys(books).length>0);$('paper-search').focus();});
 $('view-all').addEventListener('click',()=>{state.shelf=false;refilter();});$('view-shelf').addEventListener('click',()=>{state.shelf=true;refilter();});
 for(const b of document.querySelectorAll('[data-page-action]'))b.addEventListener('click',()=>{state.page+=b.dataset.pageAction==='previous'?-1:1;render(true);$('library-results').scrollIntoView({block:'start'});});
 const citation=p=>[p.authors.join('; '),p.title,[p.journal,p.year,[p.volume,p.pages].filter(Boolean).join(': ')].filter(Boolean).join(', '),p.url].filter(Boolean).join('. ');
 list.addEventListener('click',async e=>{
  const favorite=e.target.closest('[data-favorite]'),compare=e.target.closest('[data-compare]'),copy=e.target.closest('[data-copy]');
  if(favorite){const p=byId.get(favorite.dataset.favorite),record=books[p.doi.toLowerCase()]||{};books=C.updateBook(books,p.doi,{favorite:!record.favorite});saveBooks();render();notice(record.favorite?'已取消收藏':'已加入收藏');}
  if(compare){const result=C.toggleCompare(selected,compare.dataset.compare,[...byId.keys()]);if(result.error)return notice(result.error);selected=result.selected;saveCompare();renderTray();updateReaderControls();}
  if(copy){const p=byId.get(copy.dataset.copy);try{await navigator.clipboard.writeText(citation(p));notice(`${p.id} 引文已复制`);}catch{let area=nodes.get(p.id).querySelector('.citation-manual');if(!area){area=document.createElement('textarea');area.className='citation-manual';area.readOnly=true;area.setAttribute('aria-label',p.id+' 引文，可手动复制');nodes.get(p.id).querySelector('.paper-body').append(area);}area.value=citation(p);area.focus();area.select();notice('请复制已选中的引文');}}
 });
 list.addEventListener('change',e=>{
  const select=e.target.closest('[data-reading-status]'),note=e.target.closest('[data-note]');if(!select&&!note)return;
  const p=byId.get((select||note).dataset.readingStatus||(select||note).dataset.note);
  books=C.updateBook(books,p.doi,select?{status:select.value}:{note:note.value.slice(0,2000)});saveBooks();render();notice(select?'阅读状态已保存':'阅读笔记已保存');
 });
 function download(text,type,name){const blob=new Blob([text],{type}),link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
 const bibEscape=s=>String(s).replace(/[\\{}&%_$#]/g,c=>({'\\':'\\textbackslash{}','{':'\\{','}':'\\}','&':'\\&','%':'\\%','_':'\\_','$':'\\$','#':'\\#'}[c]));
 function bib(p){const f=[`title = {{${bibEscape(p.title)}}}`,`author = {${p.citationAuthors.map(bibEscape).join(' and ')}}`,`journal = {${bibEscape(p.journal)}}`,`year = {${p.year}}`];if(p.volume)f.push(`volume = {${bibEscape(p.volume)}}`);if(p.issue)f.push(`number = {${bibEscape(p.issue)}}`);if(p.pages)f.push(`${/^\d+[-–]\d+$/.test(p.pages)?'pages':'eid'} = {${bibEscape(p.pages.replace(/(?<=\d)[-–](?=\d)/g,'--'))}}`);f.push(`doi = {${bibEscape(p.doi)}}`,`url = {${bibEscape(p.url)}}`);return `@article{PhotoZinc${p.id},\n  ${f.join(',\n  ')}\n}`;}
 $('export-filtered').addEventListener('click',()=>{if(!visible.length)return;download(visible.map(bib).join('\n\n')+'\n','text/plain;charset=utf-8','photo-zinc-literature.bib');notice(`已导出 ${visible.length} 篇文献`);});
 $('export-books').addEventListener('click',()=>{download(JSON.stringify({version:1,exported_at:new Date().toISOString(),records:books},null,2)+'\n','application/json','photo-zinc-reading.json');notice('阅读记录已导出，请妥善保存备份');});
 $('import-books-button').addEventListener('click',()=>$('import-books').click());
 $('import-books').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>1000000)throw new Error('备份文件过大');const data=JSON.parse(await file.text());if(data.version!==1||!data.records||Array.isArray(data.records))throw new Error('备份格式不正确');const incoming=C.parseBooks(data,papers),count=Object.keys(incoming).length;if(!count)throw new Error('没有可导入的本库阅读记录');books={...books,...incoming};saveBooks();render();notice(`已合并 ${count} 篇文献的阅读记录`);}catch(error){notice('导入失败：'+error.message);}finally{e.target.value='';}});
 function renderTray(){
  $('compare-count').textContent=String(selected.length);$('compare-tray').hidden=!selected.length;document.body.classList.toggle('has-compare',selected.length>0);
  $('compare-selected').innerHTML=selected.map(id=>`<button type="button" data-remove-compare="${id}" aria-label="移除对比 ${id}">${id} <span>${C.escape(byId.get(id).title_zh||byId.get(id).title)}</span> ×</button>`).join('');
  $('open-compare').disabled=selected.length<2;$('compare-open-top').disabled=selected.length<2;
  $('compare-tray-help').textContent=selected.length<2?'再选一篇，即可并排对比':'已选 '+selected.length+' / 4 篇，可跨页选择';
 }
 const comparisonRows=[['material','正极 / 光电极材料'],['type','论文类型与年份'],['scope','收录范围'],['topics','研究方向'],['summary','主要思路'],['electrolyte','电解液 / 对应工况'],['capacity','比容量与测试条件'],['cycling','循环表现与测试条件'],['loading','载量 / 器件级别'],['light','光照条件 / 光电压'],['source','导读与数据依据']];
 function plainComparison(p,key){if(key==='material')return p.material;if(key==='type')return `${C.typeKey(p)==='review'?'综述 / 观点':'研究论文'} · ${p.year}`;if(key==='scope')return C.scopeKeys(p).map(k=>C.labels[k]).join(' / ');if(key==='topics')return C.directionKeys(p).map(k=>C.labels[k]).join(' / ')||'未细分';if(key==='summary')return p.summary;if(key==='source')return (p.reading_basis||'书目与中文精选导读')+(evidence[p.id]?.source_notice?'；'+evidence[p.id].source_notice:'');const item=evidence[p.id]?.[key];return item?[item.value,item.context,'出处：'+item.source,item.locator].filter(Boolean).join('；'):'—（本库尚未录入已核实数据）';}
 function comparisonCell(p,key){const item=evidence[p.id]?.[key];if(item&&typeof item==='object')return `<strong>${C.escape(item.value)}</strong>${item.context?`<small>${C.escape(item.context)}</small>`:''}<a href="${C.escape(C.safeUrl(item.source))}" target="_blank" rel="noopener noreferrer">出处：${C.escape(item.locator)} ↗</a>`;return C.escape(plainComparison(p,key));}
 function openCompare(){if(selected.length<2)return notice('请至少选择 2 篇文献');const chosen=selected.map(id=>byId.get(id));$('comparison-table').innerHTML=`<caption>已选 ${chosen.length} 篇文献的材料、策略与有出处的测试条件</caption><thead><tr><th scope="col">比较项目</th>${chosen.map(p=>`<th scope="col"><span>${p.id} · ${p.year}</span><a href="${C.escape(C.safeUrl(p.url))}" target="_blank" rel="noopener noreferrer">${C.escape(p.title_zh||p.title)} ↗</a></th>`).join('')}</tr></thead><tbody>${comparisonRows.map(([key,label])=>`<tr><th scope="row">${label}</th>${chosen.map(p=>`<td>${comparisonCell(p,key)}</td>`).join('')}</tr>`).join('')}</tbody>`;$('compare-dialog').showModal();}
 $('open-compare').addEventListener('click',openCompare);$('compare-open-top').addEventListener('click',openCompare);
 $('compare-selected').addEventListener('click',e=>{const b=e.target.closest('[data-remove-compare]');if(!b)return;selected=selected.filter(id=>id!==b.dataset.removeCompare);saveCompare();renderTray();updateReaderControls();});
 $('clear-compare').addEventListener('click',()=>{selected=[];saveCompare();renderTray();updateReaderControls();});
 $('close-compare').addEventListener('click',()=>$('compare-dialog').close());$('compare-dialog').addEventListener('click',e=>{if(e.target===$('compare-dialog'))$('compare-dialog').close();});
 $('export-comparison').addEventListener('click',()=>{const chosen=selected.map(id=>byId.get(id));download(C.csv([['比较项目',...chosen.map(p=>p.id+' '+(p.title_zh||p.title))],...comparisonRows.map(([key,label])=>[label,...chosen.map(p=>plainComparison(p,key))])]),'text/csv;charset=utf-8','photo-zinc-comparison.csv');notice('对比表及出处已导出');});
 $('share-comparison').addEventListener('click',async()=>{const link=location.origin+location.pathname+'?compare='+selected.join(',');try{await navigator.clipboard.writeText(link);notice('对比链接已复制');}catch{notice('复制失败，请使用对比表导出');}});
 function revealLinkedPaper(){if(!/^#paper-L\d+$/.test(location.hash))return;const id=location.hash.slice(7);if(!byId.has(id))return;if(!visible.some(p=>p.id===id)){state=C.initialState();render();}state.page=Math.floor(visible.findIndex(p=>p.id===id)/6)+1;render();requestAnimationFrame(()=>nodes.get(id).scrollIntoView({block:'start'}));}
 window.addEventListener('hashchange',revealLinkedPaper);window.addEventListener('popstate',()=>{state=C.readState(location.search);render();revealLinkedPaper();});
 window.addEventListener('storage',e=>{if(e.key===bookKey){books=C.parseBooks(e.newValue,papers);render();}});
 $('storage-note').textContent=storageAvailable?'收藏、阅读状态与笔记保存在当前浏览器，可导出备份。':'浏览器未允许保存，当前会话仍可使用；请导出阅读记录备份。';
 $('copy-status').textContent='';render();revealLinkedPaper();if(initialCompare&&selected.length>=2)openCompare();
})();
