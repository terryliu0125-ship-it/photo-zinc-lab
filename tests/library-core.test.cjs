const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const C=require('../library-core.js');
const root=path.join(__dirname,'..');
const library=JSON.parse(fs.readFileSync(path.join(root,'literature.json'),'utf8'));
const papers=library.papers;
const state=changes=>({...C.initialState(),...changes});
const ids=rows=>rows.map(p=>p.id).sort();
const find=changes=>C.filter(papers,state(changes));

test('chemical formula variants and Chinese aliases return the same papers',()=>{
 const expected=ids(find({query:'V2O5'}));assert(expected.length>5);
 assert.deepEqual(ids(find({query:'V₂O₅'})),expected);
 assert.deepEqual(ids(find({query:'五氧化二钒'})),expected);
 const vo2={...papers[0],id:'L900',title:'VO2 cathode',title_zh:'',heading:'',material:'VO₂',summary:'',doi:'10.1234/vo2-test',authors:[],tags:['vanadium'],material_groups:['vanadium'],research_topics:[]};
 assert.equal(C.filter([vo2],state({query:'V₂O₅'})).length,0,'VO2 alone must not be treated as V2O5');
});
test('Chinese and English research concepts match consistently',()=>{
 assert.deepEqual(ids(find({query:'质子'})),ids(find({query:'proton'})));
 assert.deepEqual(ids(find({query:'预嵌入'})),ids(find({query:'pre-intercalation'})));
 assert.deepEqual(ids(find({query:'普鲁士蓝'})),ids(find({query:'PBA'})));
});
test('problem-oriented query finds relevant zinc vanadium dissolution work',()=>{
 const result=find({query:'钒基 锌电 抑制溶解'});assert(result.some(p=>p.id==='L101'));
 assert(result.every(p=>C.materialKeys(p).includes('vanadium')));
 assert(result.every(p=>(p.battery_category||'zinc')==='zinc'));
});
test('same facet is OR, different facets are AND',()=>{
 const changes={system:'zinc',materials:['vanadium','manganese'],directions:['proton'],scopes:['cathode-basics'],type:'research'};
 const expected=papers.filter(p=>p.battery_category==='zinc'&&C.typeKey(p)==='research'&&C.scopeKeys(p).includes('cathode-basics')&&C.directionKeys(p).includes('proton')&&C.materialKeys(p).some(k=>['vanadium','manganese'].includes(k)));
 assert.deepEqual(ids(find(changes)),ids(expected));assert(expected.some(p=>p.id==='L113'));
});
test('teacher collection preserves four distinct publications and perspective type',()=>{
 assert.deepEqual(ids(find({scopes:['teacher']})),['L113','L114','L115','L116']);
 assert.deepEqual(ids(find({scopes:['teacher'],type:'review'})),['L115']);
 assert.deepEqual(ids(find({scopes:['teacher'],materials:['vanadium']})),['L113','L116']);
});
test('group collection includes every supplied DOI and the author-verified extra paper',()=>{
 const supplied=['10.1016/j.nanoms.2026.06.007','10.1039/d6ta03521c','10.3390/nano15151167','10.1016/j.est.2025.117461','10.1039/d5ta03701h','10.1016/j.est.2024.114136','10.1002/smll.202405627','10.1016/j.jpowsour.2024.234204'];
 const group=find({scopes:['group']});assert.equal(group.length,9);
 for(const doi of supplied){assert.equal(group.filter(p=>p.doi.toLowerCase()===doi).length,1);}
 assert(group.some(p=>p.doi==='10.1002/adsu.202501531'&&p.group_basis.orcid==='0000-0001-6902-0024'));
 assert.equal(new Set(papers.map(p=>p.doi.toLowerCase())).size,papers.length);
 assert.deepEqual(ids(find({scopes:['group'],materials:['vanadium']})),['L07','L117','L20']);
});
test('linked supercapacitor remains a related device and reviews retain their type',()=>{
 const capacitor=papers.find(p=>p.id==='L119');assert.equal(capacitor.doi,'10.1016/j.est.2024.114136');
 assert.equal(capacitor.publisher_pii,'S2352152X24037228');assert.deepEqual(ids(find({query:'https://www.sciencedirect.com/science/article/pii/S2352152X24037228'})),['L119']);
 assert.equal(capacitor.battery_category,'related-devices');assert(!C.scopeKeys(capacitor).includes('photo'));
 assert(!C.makeIndex(capacitor).full.includes('zincbattery'));
 assert.deepEqual(ids(find({system:'related-devices',scopes:['group']})),['L119']);
 assert(!ids(find({system:'other-metals'})).includes('L119'));
 assert.deepEqual(ids(find({scopes:['group'],type:'review'})),['L117','L43']);
 assert.equal(C.readState('?system=related-devices&scope=group').system,'related-devices');
});
test('group page, correction and metric conditions stay connected to their sources',()=>{
 const page=fs.readFileSync(path.join(root,'group.html'),'utf8'),html=fs.readFileSync(path.join(root,'literature.html'),'utf8');
 for(const p of find({scopes:['group']})){assert(page.includes('#paper-'+p.id));assert(p.title_zh&&p.summary&&p.source);assert(!/[<>]/.test(p.title));}
 assert.match(page,/data-group-count>9</);assert(html.includes('https://doi.org/10.1016/j.est.2025.117613'));
 assert.match(library.comparison_evidence.L118.capacity.value,/0\.1 A/);
 assert.match(library.comparison_evidence.L120.capacity.value,/0\.2 A/);
 assert.match(library.comparison_evidence.L120.cycling.value,/1 A/);
 const groupBlock=html.match(/<fieldset class="facet-group"><legend>阅读范围<\/legend>([\s\S]*?)<\/fieldset>/)[1];assert.match(groupBlock,/data-value="group"[^>]*>课题组成果<span>9<\/span>/);
});
test('DOI URL search resolves the exact publication',()=>{
 assert.deepEqual(ids(find({query:'https://doi.org/10.1002/adma.75300'})),['L113']);
 assert.deepEqual(ids(find({query:'10.1021/acs.nanolett.6c02373'})),['L114']);
});
test('unmatched terms remain empty and do not generate references',()=>{
 assert.equal(find({query:'nonexistent-paper-8492-test'}).length,0);
});
test('relevance outranks newer unrelated material mentions',()=>{
 const items=[{...papers[0],id:'L900',year:2020,publication_date:'2020-01-01',title:'Dissolution of vanadium cathodes',title_zh:'',material:'vanadium',summary:''},{...papers[0],id:'L901',year:2026,publication_date:'2026-01-01',title:'Electrode design',title_zh:'',material:'carbon',summary:'A discussion of vanadium dissolution.'}];
 assert.equal(C.filter(items,state({query:'vanadium dissolution'}))[0].id,'L900');
});
test('URL round-trip restores all combination filters and page',()=>{
 const wanted=state({query:'钒基 结构水',system:'zinc',materials:['vanadium','organic'],directions:['hydration','preintercalation'],scopes:['cathode-basics','teacher'],type:'research',year:'2026',sort:'oldest',shelf:true,favoritesOnly:true,status:'todo',page:2});
 assert.deepEqual(C.readState(C.stateQuery(wanted)),wanted);
 assert.deepEqual(C.readState('?materials=evil&directions=none&scope=unknown&page=-1').materials,[]);
 assert.equal(C.readState('?page=-1').page,1);
});
test('bookmarks and reading statuses survive serialization by DOI',()=>{
 const p=papers.find(p=>p.id==='L113');let books=C.updateBook({},p.doi,{favorite:true,status:'todo',note:'核对质子输运的对照'});
 const recovered=C.parseBooks(JSON.stringify({version:1,records:books}),papers);
 assert.deepEqual(recovered,books);
 assert.deepEqual(ids(C.filter(papers,state({shelf:true,status:'todo'}),recovered)),['L113']);
 assert.deepEqual(ids(C.filter(papers,state({favoritesOnly:true}),recovered)),['L113']);
 books=C.updateBook(books,p.doi,{favorite:false,status:'',note:''});assert.deepEqual(books,{});
});
test('invalid backups cannot introduce foreign papers or executable state',()=>{
 assert.deepEqual(C.parseBooks('{broken',papers),{});
 const doi=papers[0].doi;const books=C.parseBooks({version:1,records:{'10.1/foreign':{favorite:true},[doi]:{favorite:true,status:'<script>',note:'a'.repeat(3000)}}},papers);
 assert.equal(Object.keys(books).length,1);assert.equal(books[doi].status,'');assert.equal(books[doi].note.length,2000);
 assert.equal(C.safeUrl('javascript:alert(1)'),'#');assert.equal(C.escape('<img src=x>'),'&lt;img src=x&gt;');
});
test('comparison is bounded to four known papers and removal works',()=>{
 const known=papers.map(p=>p.id);let chosen=[];for(const id of ['L113','L114','L115','L116'])chosen=C.toggleCompare(chosen,id,known).selected;
 assert(C.toggleCompare(chosen,'L101',known).error);assert(C.toggleCompare(chosen,'foreign',known).error);
 assert.deepEqual(C.toggleCompare(chosen,'L114',known).selected,['L113','L115','L116']);
});
test('comparison measurements carry source, locator, and test conditions',()=>{
 for(const [id,fields]of Object.entries(library.comparison_evidence)){assert(papers.some(p=>p.id===id));for(const [key,item]of Object.entries(fields)){if(key==='source_notice')continue;assert(item.value&&item.locator&&item.checked_on);assert(/^https:\/\//.test(item.source));}}
 assert.match(library.comparison_evidence.L113.capacity.value,/0\.2 A/);
 assert.match(library.comparison_evidence.L113.cycling.value,/20 A/);
 assert.match(library.comparison_evidence.L113.loading.context,/软包/);
 assert.match(library.comparison_evidence.L97.capacity.context,/未加入/);
});
test('CSV safely preserves quotes, newlines, Unicode, and formula-like text',()=>{
 const output=C.csv([['材料','备注'],['V₂O₅','a,"b"\nline'],['=1+1','@SUM(A1)']]);
 assert(output.startsWith('\uFEFF'));assert(output.includes('"a,""b""\nline"'));assert(output.includes('"\'=1+1"'));assert(output.includes('"\'@SUM(A1)"'));
});
test('renderer and browser agree on the material facets of future auto papers',()=>{
 const auto={...papers[0],id:'L999',tags:['auto','vanadium','heterojunction'],kind:'期刊文献',article_type:undefined,material:'TiO2 / V2O5',title:'New zinc photocathode',material_groups:undefined,research_topics:undefined};
 assert.deepEqual(C.materialKeys(auto),['vanadium']);assert.deepEqual(C.directionKeys(auto),['heterojunction']);
 assert(C.filter([auto],state({materials:['vanadium']})).some(p=>p.id==='L999'));
 assert.equal(C.typeKey(auto),'unclassified');
});
test('rendered library retains all records and their reading controls',()=>{
 const html=fs.readFileSync(path.join(root,'literature.html'),'utf8');
 assert.equal((html.match(/class="paper" id="paper-L\d+"/g)||[]).length,papers.length);
 assert.equal((html.match(/data-favorite="L\d+"/g)||[]).length,papers.length);
 assert.equal((html.match(/data-reading-status="L\d+"/g)||[]).length,papers.length);
 assert.deepEqual(JSON.parse(html.match(/<script id="literature-data" type="application\/json">([\s\S]*?)<\/script>/)[1]),papers);
 assert.deepEqual(JSON.parse(html.match(/<script id="comparison-data" type="application\/json">([\s\S]*?)<\/script>/)[1]),library.comparison_evidence);
 assert(!/xwechat_files|wxid_4prf|NORTHEAST FORESTRY UNIV|Downloaded from pubs/.test(html));
});
