'use strict';
(function(root, factory) {
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PhotoZincLibrary=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const materials=[['vanadium','钒基'],['manganese','锰基'],['prussian-blue','普鲁士蓝类'],['organic','有机材料'],['perovskite','钙钛矿'],['sulfide','硫化物'],['other','其他材料']];
 const directions=[['hydration','结构水'],['preintercalation','离子预嵌入'],['dissolution','溶解与稳定性'],['proton','质子 / 多载流子'],['heterojunction','异质结与界面'],['defect','掺杂与缺陷'],['photothermal','光热与光电'],['device','器件与集成'],['mechanism','机理与评价'],['voltage','电压与配位场']];
 const scopes=[['photo','光辅助 / 光充电'],['cathode-basics','锌电正极基础'],['aqueous-sodium','水系钠电基础'],['teacher','老师分享']];
 const statuses=[['all','全部阅读状态'],['unmarked','未标记'],['todo','待读'],['reading','在读'],['read','已读']];
 const labels=Object.fromEntries([...materials,...directions,...scopes]);
 const clean=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[‐‑‒–—−]/g,'-').replace(/https?:\/\/(?:dx\.)?doi\.org\//g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const aliasGroups=[
  ['zincbattery',/水系锌离子电池|锌离子电池|锌电池|锌电|锌基|zinc[ -]?ion batteries|zinc[ -]?ion battery|zn[ -]?ion batteries|zn[ -]?ion battery|zinc batteries|zinc battery/gi],
  ['lithiumbattery',/锂离子电池|锂电池|锂电|lithium[ -]?ion batteries|lithium[ -]?ion battery|li[ -]?ion batteries|li[ -]?ion battery/gi],
  ['sodiumbattery',/钠离子电池|钠电池|钠电|sodium[ -]?ion batteries|sodium[ -]?ion battery|na[ -]?ion batteries|na[ -]?ion battery/gi],
  ['v2o5',/五氧化二钒|\bv\s*2\s*o\s*5\b/gi],['vo2',/二氧化钒|\bvo\s*2\b/gi],['v2o3',/三氧化二钒|\bv\s*2\s*o\s*3\b/gi],
  ['mno2',/二氧化锰|\bmno\s*2\b/gi],['tio2',/二氧化钛|\btio\s*2\b/gi],['mos2',/二硫化钼|\bmos\s*2\b/gi],['vs2',/二硫化钒|\bvs\s*2\b/gi],
  ['prussianblue',/普鲁士蓝类似物|普鲁士蓝类|普鲁士蓝|prussian blue analogues|prussian blue analogs|prussian blue|\bpbas?\b/gi],
  ['vanadium',/钒基正极|钒基材料|钒基|钒氧化物|\bvanadium\b/gi],['manganese',/锰基正极|锰基材料|锰基|\bmanganese\b/gi],
  ['photocharge',/可光充电|光充电|光自充电|photo[ -]?rechargeable|photorechargeable|photo[ -]?charging/gi],
  ['photoassist',/光辅助|光助|光增强|photo[ -]?assisted|photoassisted|light[ -]?assisted|photo[ -]?enhanced/gi],
  ['hydration',/结构水|结晶水|层间水|晶格水|水合|structural water|lattice water|interlayer water|hydrated|hydration/gi],
  ['preintercalation',/离子预嵌入|阳离子预嵌入|预嵌入|预插层|预嵌|pre[ -]?intercalat\w*|preintercalat\w*/gi],
  ['dissolution',/抑制溶解|溶解抑制|溶出|溶解|抗溶解|\bdissolution\b|\bdissolving\b/gi],
  ['proton',/质子|氢离子|\bprotons?\b/gi],['heterojunction',/异质结|异质结构|\bheterojunctions?\b|\bheterostructures?\b/gi],
  ['photothermal',/光热|\bphotothermal\b/gi],['defect',/缺陷|掺杂|\bdefects?\b|\bdoping\b|\bdoped\b/gi],
  ['review',/综述论文|综述类|综述|观点文章|\breviews?\b|\bperspective\b/gi],
  ['research',/研究论文|\bresearch article\b/gi],['organic',/有机正极|有机材料|\borganic\b/gi],['perovskite',/钙钛矿|\bperovskites?\b/gi],
  ['voltage',/配位场|高电压|工作电压|ligand field|\bvoltage\b/gi]
 ];
 function canonical(text){let s=String(text||'').normalize('NFKC').toLowerCase().replace(/[‐‑‒–—−]/g,'-');for(const [term,pattern]of aliasGroups)s=s.replace(pattern,' '+term+' ');return clean(s);}
 function terms(query){return [...new Set(canonical(query).replace(/我想找|我想要|帮我找|有没有|相关的|相关|关于|文献|论文|的/g,' ').split(/\s+/).filter(Boolean))];}
 function materialKeys(p){
  if(Array.isArray(p.material_groups))return p.material_groups;
  const t=[p.material,p.title].join(' ').toLowerCase(),tags=p.tags||[],out=[];
  for(const key of ['vanadium','manganese','prussian-blue'])if(tags.includes(key))out.push(key);
  if(/perovsk|钙钛矿/.test(t))out.push('perovskite');
  if(tags.includes('organic')&&!out.includes('perovskite'))out.push('organic');
  if(/sulfide|mos[₂2]|vs[₂2]|sns[₂2]|硫化/.test(t))out.push('sulfide');
  return out.length?out:['other'];
 }
 function directionKeys(p){return Array.isArray(p.research_topics)?p.research_topics:(p.tags||[]).filter(t=>directions.some(([key])=>key===t));}
 function scopeKeys(p){const tags=p.tags||[],out=[];if(tags.includes('cathode-basics'))out.push('cathode-basics');else if(tags.includes('aqueous-sodium'))out.push('aqueous-sodium');else out.push('photo');if(tags.includes('teacher'))out.push('teacher');return out;}
 const typeKey=p=>['research','review'].includes(p.article_type)?p.article_type:p.kind==='综述'?'review':['研究论文','关联器件'].includes(p.kind)?'research':'unclassified';
 const published=p=>p.publication_date||`${p.year}-01-01`;
 function makeIndex(p){
  const facets=[...materialKeys(p),...directionKeys(p),...scopeKeys(p)].map(k=>`${k} ${labels[k]||k}`).join(' ');
  const battery=p.battery_category==='other-metals'?'': 'zincbattery';
  const full=[p.title,p.title_zh,p.heading,p.summary,p.material,p.journal,p.doi,...(p.authors||[]),facets,typeKey(p),battery,p.metal_system==='sodium'?'sodiumbattery':'',p.metal_system==='lithium'?'lithiumbattery':''].join(' ');
  return {full:canonical(full),title:canonical([p.title,p.title_zh].join(' ')),material:canonical(p.material),doi:clean(p.doi)};
 }
 function termMatch(text,term){return text.includes(term);}
 function score(index,queryTerms){
  let total=0;
  for(const term of queryTerms){
   if(!termMatch(index.full,term))return 0;
   total+=1+(termMatch(index.title,term)?8:0)+(termMatch(index.material,term)?5:0)+(index.doi===term?100:0);
  }return total;
 }
 const matches=(chosen,values)=>!chosen?.length||chosen.some(value=>values.includes(value));
 function filter(papers,state,books={},index=new Map(papers.map(p=>[p.id,makeIndex(p)]))){
  const queryTerms=terms(state.query),rank=new Map();
  const result=papers.filter(p=>{
   const record=books[p.doi.toLowerCase()]||{};
   if(state.system&&state.system!=='all'&&(p.battery_category||'zinc')!==state.system)return false;
   if(!matches(state.materials,materialKeys(p))||!matches(state.directions,directionKeys(p))||!matches(state.scopes,scopeKeys(p)))return false;
   if(state.type&&state.type!=='all'&&typeKey(p)!==state.type)return false;
   if(state.year&&state.year!=='all'&&String(p.year)!==state.year)return false;
   if(state.shelf&&!record.favorite&&!record.status&&!record.note)return false;
   if(state.favoritesOnly&&!record.favorite)return false;
   if(state.status&&state.status!=='all'&&(record.status||'unmarked')!==state.status)return false;
   const relevance=queryTerms.length?score(index.get(p.id),queryTerms):1;rank.set(p.id,relevance);return relevance>0;
  });
  return result.sort((a,b)=>(state.sort==='relevance'&&queryTerms.length?rank.get(b.id)-rank.get(a.id):0)||(state.sort==='oldest'?published(a).localeCompare(published(b)):state.sort==='number'?0:published(b).localeCompare(published(a)))||a.id.localeCompare(b.id,undefined,{numeric:true}));
 }
 function initialState(){return {query:'',system:'all',materials:[],directions:[],scopes:[],type:'all',year:'all',sort:'relevance',shelf:false,favoritesOnly:false,status:'all',page:1};}
 function readState(search){
  const u=new URLSearchParams(search),state=initialState();
  const valid=(value,options)=>options.some(([key])=>key===value);
  state.query=(u.get('q')||'').slice(0,300);
  if(['all','zinc','other-metals'].includes(u.get('system')))state.system=u.get('system');
  for(const [param,key,options]of [['materials','materials',materials],['directions','directions',directions],['scope','scopes',scopes]])state[key]=[...new Set((u.get(param)||'').split(',').filter(v=>valid(v,options)))];
  if(['research','review','unclassified'].includes(u.get('type')))state.type=u.get('type');
  if(/^\d{4}$/.test(u.get('year')||''))state.year=u.get('year');
  if(['relevance','newest','oldest','number'].includes(u.get('sort')))state.sort=u.get('sort');
  state.shelf=u.get('view')==='shelf';state.favoritesOnly=u.get('favorites')==='1';
  if(valid(u.get('status'),statuses))state.status=u.get('status');
  state.page=Math.max(1,Math.min(10000,Number.parseInt(u.get('page'),10)||1));return state;
 }
 function stateQuery(state){const u=new URLSearchParams();if(state.query)u.set('q',state.query);if(state.system!=='all')u.set('system',state.system);for(const [param,key]of [['materials','materials'],['directions','directions'],['scope','scopes']])if(state[key].length)u.set(param,state[key].join(','));for(const key of ['type','year','sort','status'])if(state[key]!==initialState()[key])u.set(key,state[key]);if(state.shelf)u.set('view','shelf');if(state.favoritesOnly)u.set('favorites','1');if(state.page>1)u.set('page',state.page);return u.toString();}
 function parseBooks(raw,papers){
  try{const data=typeof raw==='string'?JSON.parse(raw):raw;if(!data||data.version!==1||!data.records||Array.isArray(data.records))return {};
   const known=new Set(papers.map(p=>p.doi.toLowerCase())),out={};
   for(const [doi,r]of Object.entries(data.records)){const key=doi.toLowerCase();if(!known.has(key)||!r||typeof r!=='object')continue;const value={favorite:r.favorite===true,status:['todo','reading','read'].includes(r.status)?r.status:'',note:typeof r.note==='string'?r.note.slice(0,2000):''};if(value.favorite||value.status||value.note)out[key]=value;}return out;
  }catch{return {};}
 }
 function updateBook(books,doi,changes){const key=doi.toLowerCase(),next={...books,[key]:{favorite:false,status:'',note:'',...(books[key]||{}),...changes}};if(!next[key].favorite&&!next[key].status&&!next[key].note)delete next[key];return next;}
 function toggleCompare(selected,id,knownIds){if(!knownIds.includes(id))return {selected,error:'文献不存在'};if(selected.includes(id))return {selected:selected.filter(v=>v!==id)};if(selected.length>=4)return {selected,error:'最多对比 4 篇，请先移除一篇'};return {selected:[...selected,id]};}
 const safeUrl=value=>/^https?:\/\//i.test(String(value||''))?String(value):'#';
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const csvCell=value=>{let text=String(value??'');if(/^[\s]*[=+\-@]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};
 const csv=rows=>'\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
 return {materials,directions,scopes,statuses,labels,clean,canonical,terms,makeIndex,materialKeys,directionKeys,scopeKeys,typeKey,filter,initialState,readState,stateQuery,parseBooks,updateBook,toggleCompare,safeUrl,escape,csv};
});
