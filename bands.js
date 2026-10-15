/* Band comparison interface. Scientific conversions and models live in BandCore. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const num = (value, digits = 2) => finite(value) ? value.toFixed(digits).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1') : '待核实';
  const signed = value => finite(value) ? (value > 0 ? '+' : '') + num(value) : '待核实';
  const colors = ['#2d6a50','#ae8b3c','#5a7d98','#9b6e85'];
  const safeUrl = value => { try { const u = new URL(value, location.href); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch (_) { return ''; } };
  let payload, records, core;
  try {
    payload = JSON.parse($('bands-data').textContent);
    records = Array.isArray(payload) ? payload : (payload.records || []);
    core = window.BandCore;
    if (!core || !Array.isArray(records) || !records.length) throw new Error('暂无可加载的能带数据');
  } catch (error) {
    $('bands-load-message').textContent = '交互数据暂未加载。请阅读下方样品目录，或稍后刷新页面。';
    return;
  }
  const publishedIds = new Set(records.map(record => record.id));
  const map = new Map(records.map(record => [record.id, record]));
  const defaults = ['V-VO2B-2021-rGO','P-ZNO-ACS2021'];
  const urlIds = new URL(location.href).searchParams.get('ids');
  const requested = urlIds ? Array.from(new Set(urlIds.split(',').filter(id => map.has(id)))).slice(0,4) : [];
  let aId = requested[0] || (map.has(defaults[0]) ? defaults[0] : records[0].id);
  let bId = requested[1] || (map.has(defaults[1]) ? defaults[1] : (records.find(record => record.id !== aId) || records[0]).id);
  let overlays = requested.slice(2).filter(id => id !== aId && id !== bId);
  let customIndex = 0;
  const normalized = record => core.normalize(record);
  const getA = () => map.get(aId);
  const getB = () => map.get(bId);
  const selected = () => Array.from(new Set([aId,bId,...overlays])).map(id => map.get(id)).filter(Boolean);
  const missing = record => !normalized(record).ok;
  const label = record => record.material || record.formula || record.id;
  const phase = record => record.phase || '晶相待核实';
  const scaleLabel = record => ({vacuum:'eV vs vacuum',SHE:'V vs SHE',NHE:'V vs NHE',RHE:'V vs RHE',AgAgCl:'V vs Ag/AgCl',SCE:'V vs SCE'}[record.scale] || record.scale || '标尺待核实');
  const isEstimate = record => /图|示意|估|近似|待核|未核/.test(String(record.edge_label || '') + String(record.method || ''));
  const allNotes = record => Array.isArray(record.notes) ? record.notes : record.notes ? [record.notes] : [];
  const diagramCaption = $('band-chart-caption').textContent;

  function options() {
    const html = records.map(record => '<option value="' + esc(record.id) + '">' + esc(label(record)) + ' · ' + esc(record.id) + (missing(record) ? ' · 缺带边' : '') + '</option>').join('');
    $('band-select-a').innerHTML = html; $('band-select-b').innerHTML = html;
    $('band-select-a').value = aId; $('band-select-b').value = bId;
  }
  function routeText(which, alignment) {
    const key = which === 'electron' ? alignment.electron_record : alignment.hole_record;
    return key === 'a' ? 'A · ' + label(getA()) : key === 'b' ? 'B · ' + label(getB()) : '模型不判定';
  }
  function renderSelected() {
    $('selection-status').textContent = '主比较 2 个样品 · 共 ' + selected().length + ' 条叠图';
    $('selected-records').innerHTML = selected().map((record,i) => '<div class="selected-record" style="--record-color:' + colors[i] + '"><span class="record-key"><i class="record-color"></i>' + (record.id === aId ? 'A / 主比较' : record.id === bId ? 'B / 主比较' : '叠图 / 不参与判断') + '</span><h4>' + esc(label(record)) + '</h4><p>' + esc(phase(record)) + '</p><p>' + esc(record.edge_label || (missing(record) ? '带边待核实' : '详见方法与来源')) + '</p>' + (overlays.includes(record.id) ? '<button class="remove-overlay" type="button" data-remove="' + esc(record.id) + '" aria-label="移除叠图 ' + esc(label(record)) + '">×</button>' : '') + '</div>').join('');
  }
  function renderDiagram() {
    const rows = selected().map(record => ({record,n:normalized(record)}));
    const values = rows.flatMap(row => row.n.ok ? [row.n.cb,row.n.vb] : []).filter(finite);
    const top = Math.floor(Math.min(-1.2,...values) - 0.2);
    const bottom = Math.ceil(Math.max(2,...values) + 0.2);
    const y = value => 65 + (value - top) / (bottom - top) * 325;
    const left = 86, right = 626, plotWidth = right-left;
    let html = '<title id="band-svg-title">选中样品的导带与价带对比</title><desc id="band-svg-desc">统一为 V vs SHE，正电位向下；右轴为采用4.44 eV约定换算的真空电子能量。虚线为论文示意或估计。缺失带边不绘制。</desc><text x="23" y="29" font-size="13" fill="#708567">V vs SHE</text><text x="621" y="29" font-size="12" fill="#879478">真空 / eV</text>';
    const tickStep=Math.max(1,Math.ceil((bottom-top)/8));
    if(!Number.isFinite(bottom-top)||bottom<=top){$('band-diagram').innerHTML='<text x="45" y="90" fill="#806b43" font-size="18">能级范围无法显示，请核对输入。</text>';return;}
    for (let index=0; index<=8; index+=1) {
      const tick=top+index*tickStep;
      if(tick>bottom)break;
      html += '<path d="M' + left + ' ' + y(tick) + 'H' + right + '" stroke="#d6dfca" stroke-width="1"/><text x="70" y="' + (y(tick)+5) + '" text-anchor="end" font-size="15" fill="#7b8e70">' + signed(tick) + '</text><text x="638" y="' + (y(tick)+5) + '" font-size="13" fill="#9aa58a">' + num(core.toVacuum(tick)) + '</text>';
    }
    html += '<path d="M' + left + ' ' + y(-0.76) + 'H' + right + '" stroke="#b9a067" stroke-width="1.2" stroke-dasharray="5 6"/><text x="' + left + '" y="' + (y(-0.76)-8) + '" font-size="11" fill="#9a8552">Zn²⁺/Zn −0.76 V · 标准态示意</text>';
    rows.forEach(({record,n},i) => {
      const width = Math.min(97,plotWidth/rows.length-34), x = left + plotWidth/rows.length*(i+.5);
      const color = colors[i], dash = isEstimate(record) ? ' stroke-dasharray="7 5"' : '';
      const key = record.id === aId ? 'A' : record.id === bId ? 'B' : '叠图';
      if (n.ok) {
        const cy=y(n.cb),vy=y(n.vb);
        html += '<rect x="' + (x-width/2) + '" y="' + cy + '" width="' + width + '" height="' + Math.max(0,vy-cy) + '" fill="' + color + '" opacity=".09"/><path d="M' + (x-width/2) + ' ' + cy + 'H' + (x+width/2) + 'M' + (x-width/2) + ' ' + vy + 'H' + (x+width/2) + '" stroke="' + color + '" stroke-width="4"' + dash + '/><text x="' + x + '" y="' + (cy-10) + '" text-anchor="middle" fill="' + color + '" font-size="14">CB ' + signed(n.cb) + '</text><text x="' + x + '" y="' + (vy+24) + '" text-anchor="middle" fill="' + color + '" font-size="14">VB ' + signed(n.vb) + '</text>';
        const gap = finite(record.gap_eV) ? num(record.gap_eV) + ' eV' : '待核实';
        html += '<text x="' + x + '" y="' + ((cy+vy)/2+5) + '" text-anchor="middle" fill="' + color + '" font-size="15">Eg ' + gap + '</text>';
      } else {
        html += '<path d="M' + x + ' 145V295" stroke="#b7c2aa" stroke-width="1.5" stroke-dasharray="3 6"/><circle cx="' + x + '" cy="220" r="16" fill="#edf0e4" stroke="#a6b79a"/><text x="' + x + '" y="225" text-anchor="middle" font-size="18" fill="#98a58b">?</text><text x="' + x + '" y="322" text-anchor="middle" font-size="13" fill="#8c9a7d">缺失带边</text><text x="' + x + '" y="344" text-anchor="middle" font-size="12" fill="#9aa68b">不参与对齐</text>';
      }
      html += '<circle cx="' + x + '" cy="426" r="12" fill="' + color + '"/><text x="' + x + '" y="430" text-anchor="middle" font-size="11" fill="#fff">' + key + '</text><text x="' + x + '" y="457" text-anchor="middle" fill="#5e7753" font-size="' + (rows.length>2 ? 12 : 14) + '">' + esc(record.formula || label(record).slice(0,15)) + '</text><text x="' + x + '" y="480" text-anchor="middle" fill="#8c9b7d" font-size="10">' + esc(record.id.length>24 ? record.id.slice(0,23)+'…' : record.id) + '</text>';
    });
    $('band-diagram').innerHTML = html;
    $('band-chart-caption').textContent = diagramCaption;
  }
  function renderResult() {
    const a = normalized(getA()),b = normalized(getB());
    let alignment = null, title = '带边待核实', description = '至少一个样品缺少可转换的完整 CB/VB，暂不计算对齐类型。可查看原文详情，或填入本组测量。';
    if (aId === bId) { title='同一样品';description='A、B 目前选择相同。请换一个样品，再比较两个独立组分。'; }
    else if (a.ok && b.ok) {
      alignment = core.classify(a,b);title=alignment.type;
      description = ({'Type I':'理想独立组分模型下，两种载流子倾向于进入较窄带隙的一侧；这不是已经测出的接触后电荷路径。','Type II':'理想独立组分模型下，电子与空穴分别趋向不同组分；分离可能同时损失部分氧化还原驱动力。','Type III':'两组带边呈断隙关系；这个简单模型不指定可用的电子 / 空穴终点。','边界不确定':'输入的关键带边相等或不确定度区间重叠，现有数据不足以稳健区分对齐类型；先补精确标定与界面证据。'}[alignment.type] || '请结合原始方法与样品条件解释对齐。');
    }
    $('comparison-result').innerHTML = '<div class="alignment-type"><span class="kicker">A ↔ B / 理想独立组分</span><h3>' + esc(title) + '</h3><p>前接触能带比较</p></div><div class="alignment-copy"><p>' + esc(description) + '</p>' + (alignment ? '<div class="charge-route"><span>电子候选终点 <b>' + esc(routeText('electron',alignment)) + '</b></span><span>空穴候选终点 <b>' + esc(routeText('hole',alignment)) + '</b></span></div>' : '') + '<p>跨论文配对只用于提出假设，不代表该组合已制备，也不据此判定 S-scheme、Z-scheme 或直接光充电。</p></div>';
    const warnings = [];
    [getA(),getB()].forEach((record,i) => {
      const n=normalized(record),key=i?'B':'A';
      if (!n.ok) warnings.push(key+'：'+(n.reason || '带边数据不足'));
      if (!finite(record.ph)) warnings.push(key+'：测量 pH 未核实，不能认为两侧处于相同界面条件。');
      if (!record.method || isEstimate(record)) warnings.push(key+'：'+(record.edge_label || '方法含示意、估计或近似，见原文详情。'));
      (n.warnings || []).forEach(w => warnings.push(key+'：'+w));
    });
    if (finite(getA().ph) && finite(getB().ph) && getA().ph !== getB().ph) warnings.push('两样品测量 pH 不同；本图保留原测量条件，不自动做 pH 平移。');
    if (getA().source && getB().source && getA().source.doi !== getB().source.doi) warnings.push('A 与 B 来自不同论文、不同样品：这里只是跨论文比较，不是已报道的实际配对。');
    if (alignment) (alignment.warnings || []).forEach(w=>warnings.push(w));
    const list=Array.from(new Set(warnings));
    const keyWarnings=[];
    if (!a.ok || !b.ok) keyWarnings.push('至少一条缺少完整绝对带边，本次不作对齐判定。');
    if (!finite(getA().ph) || !finite(getB().ph)) keyWarnings.push('测量 pH 不齐，不能确认与本组电池界面条件相同。');
    if (isEstimate(getA()) || isEstimate(getB())) keyWarnings.push('本次含论文图示或估计能级；虚线标识，方法细节需回到出处。');
    if (getA().source && getB().source && getA().source.doi !== getB().source.doi) keyWarnings.push('来自不同论文，只是跨样品比较，不是已验证的实际配对。');
    if (finite(getA().ph) && finite(getB().ph) && getA().ph !== getB().ph) keyWarnings.push('测量 pH 不同，本图不做自动 pH 平移。');
    if (!keyWarnings.length && list.length) keyWarnings.push('测量与界面条件仍有待核实，详见下方条件清单。');
    $('comparison-warnings').hidden=!list.length;
    $('comparison-warnings').innerHTML='<strong>条件不齐时，先作为实验假设</strong><ul>'+keyWarnings.slice(0,4).map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul>'+(list.length?'<details class="conditions-more"><summary>展开全部条件与换算说明 · '+list.length+' 项</summary><ul>'+list.map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul></details>':'');
    renderHeadroom();
  }
  function renderPhoton() {
    const value=$('photon-wavelength').value;
    try {
      if (!value.trim()) throw new Error();
      const energy=core.photonEnergy(Number(value));
      $('photon-output').textContent=num(energy)+' eV';
      const results=selected().filter(r=>finite(r.gap_eV)).map(r=>label(r)+'：'+(energy>=r.gap_eV?'光子能量达到所列 Eg':'光子能量低于所列 Eg'));
      $('photon-note').textContent=results.length?results.join('；')+'。仅按单一带隙筛选，不代表吸收强度或量子效率。':'光子能量筛选需先核实样品带隙。';
    } catch (_) { $('photon-output').textContent='请输入正波长';$('photon-note').textContent='单色光的能量筛选，不代表吸收强度。'; }
  }
  function renderHeadroom() {
    const target=$('headroom-results'),rawCathode=$('redox-cathode').value.trim(),rawZinc=$('redox-zinc').value.trim();
    if (!rawCathode || !rawZinc) { target.innerHTML='<p class="headroom-note">填写相同 SHE 标尺下的正极氧化电位后，显示电子还原锌与空穴氧化正极的两侧余量。</p>';return; }
    const model=$('redox-model').value,a=normalized(getA()),b=normalized(getB());
    let e,h;
    if (model==='typeII') {
      const c=a.ok&&b.ok&&aId!==bId?core.classify(a,b):null;
      if (!c || c.type!=='Type II' || !finite(c.electron) || !finite(c.hole)) { target.innerHTML='<p class="headroom-note">当前 A/B 不满足可计算的理想 Type II 对齐；请改用单组分，或补充带边数据。</p>';return; }
      e=c.electron;h=c.hole;
    } else { const n=model==='b'?b:a;if(!n.ok){target.innerHTML='<p class="headroom-note">此样品缺完整带边，暂不计算反应余量。</p>';return;}e=n.cb;h=n.vb; }
    try {
      const result=core.headroom(e,h,Number(rawCathode),Number(rawZinc));
      target.innerHTML='<div class="headroom-grid"><div class="headroom-value"><b>'+signed(result.zinc)+' V</b><span>电子还原锌余量<br/>U(Zn²⁺/Zn) − U(电子)</span></div><div class="headroom-value"><b>'+signed(result.cathode)+' V</b><span>空穴氧化正极余量<br/>U(空穴) − U(正极氧化)</span></div></div><p class="headroom-note"><strong>这是以 CB/VB 代替光照准费米能级的乐观上限，仅用于无外加偏压的理想初筛。</strong>正值表示此模型下的方向性余量，负值表示此模型中的缺口；未计入过电位、欧姆损失和复合，不代表器件结论，也不否定外加偏压下的光辅助。</p>';
    } catch (_) { target.innerHTML='<p class="headroom-note">请填写有效、有限的反应电位数值。</p>'; }
  }
  function details(record) {
    const source=record.source || {},url=safeUrl(source.url || (source.doi?'https://doi.org/'+source.doi:''));
    const pH=finite(record.ph)?String(record.ph):'待核实';
    return '<details class="record-details"><summary>样品、方法与原始出处</summary><div class="record-detail-grid"><div><span>具体样品</span><p>'+esc(record.sample || '待核实')+'</p></div><div><span>测量 / 估计方法</span><p>'+esc(record.method || '待核实')+'</p></div><div><span>原始带边与参比</span><p>CB '+esc(signed(record.cb))+' / VB '+esc(signed(record.vb))+' · '+esc(scaleLabel(record))+'；pH '+esc(pH)+'</p></div><div><span>证据与充电模式</span><p>'+esc(record.edge_label || '见原文方法')+'；'+esc(record.charge_label || '是否直接光充电须回到原文器件验证')+'</p></div>'+((finite(record.work_function_eV)||finite(record.d_band_center_eV))?'<div class="detail-full"><span>其他电子结构量（不绘入 CB/VB 图）</span><p>功函数：'+esc(finite(record.work_function_eV)?num(record.work_function_eV,3)+' eV':'待核实')+'；d 带中心：'+esc(finite(record.d_band_center_eV)?num(record.d_band_center_eV,3)+' eV':'待核实')+'。两者不是带边，参比和意义须单独核对。</p></div>':'')+'<div class="detail-full"><span>原始出处</span><p>'+(url?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(source.title || source.doi || '打开原始出处')+' ↗</a>':esc(source.title || '本组会话测量，尚无公开出处'))+(source.doi?'<br/>DOI '+esc(source.doi):'')+'<br/>'+esc(source.locator || '具体页图待核实')+'</p></div>'+(allNotes(record).length?'<div class="detail-full"><span>阅读边界与缺失项</span><ul>'+allNotes(record).map(note=>'<li>'+esc(note)+'</li>').join('')+'</ul></div>':'')+'</div></details>';
  }
  function renderCatalog() {
    const q=$('band-search').value.trim().toLowerCase(),role=$('band-role-filter').value,complete=$('band-complete-filter').value,picked=new Set(selected().map(r=>r.id));
    const found=records.filter(record=>{
      const text=[record.id,record.material,record.formula,record.phase,record.method,record.sample,record.source&&record.source.doi,record.source&&record.source.title,...allNotes(record)].join(' ').toLowerCase();
      return (!q||text.includes(q))&&(role==='all'||record.role===role)&&(complete==='all'||(complete==='complete'?!missing(record):missing(record)));
    });
    $('catalog-count').textContent=found.length+' / '+records.length+' 条样品';
    $('band-catalog-live').innerHTML=found.length?found.map(record=>{
      const isPicked=picked.has(record.id),source=record.source||{},url=safeUrl(source.url || (source.doi?'https://doi.org/'+source.doi:'')),n=normalized(record);
      return '<article class="band-record-card" id="band-'+esc(record.id)+'"><div><div class="record-eyebrow"><span>'+esc(record.id)+'</span><span>'+esc(record.role==='cathode'?'钒基正极':record.role==='partner'?'异质结候选':'研究上下文')+'</span><span>'+esc(publishedIds.has(record.id)?'文献样品':'本组会话数据')+'</span></div><h3>'+esc(label(record))+'</h3><p class="record-phase">'+esc(phase(record))+'</p><div class="record-values"><span>Eg<b>'+esc(finite(record.gap_eV)?num(record.gap_eV)+' eV':'待核实')+'</b></span><span>CB<b>'+esc(signed(record.cb))+'</b></span><span>VB<b>'+esc(signed(record.vb))+'</b></span></div><p class="record-state">'+esc(scaleLabel(record))+' · '+esc(record.edge_label || (n.ok?'带边可转换，方法见详情':'带边不齐或标尺待核实'))+'</p></div><div class="record-actions"><button type="button" data-add="'+esc(record.id)+'"'+(isPicked?' disabled':'')+'>'+(isPicked?'已在比较':'＋ 加入叠图')+'</button>'+(url?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">原始出处 ↗</a>':'')+'</div>'+details(record)+'</article>';
    }).join(''):'<p class="catalog-empty">没有匹配样品。试试化学式、晶相或 DOI，也可以清除筛选。</p>';
  }
  function syncUrl() {
    const ids=[aId,bId,...overlays].filter(id=>publishedIds.has(id));
    const url=new URL(location.href);url.searchParams.delete('ids');
    if(ids.length)url.searchParams.set('ids',ids.join(','));
    history.replaceState(null,'',url.pathname+url.search+url.hash);
  }
  function render() {renderSelected();renderDiagram();renderResult();renderPhoton();renderCatalog();syncUrl();}
  function changeMain(which) {
    if(which==='a')aId=$('band-select-a').value;else bId=$('band-select-b').value;
    overlays=overlays.filter(id=>id!==aId&&id!==bId).slice(0,2);render();
  }
  function addOverlay(id) {
    if(!map.has(id)||selected().some(record=>record.id===id))return;
    if(overlays.length>=2){$('export-status').textContent='已叠图 4 个样品，请先移除一条叠图。';return;}
    overlays.push(id);render();$('export-status').textContent='已添加叠图：'+label(map.get(id));
  }
  function exportSnapshot() {
    return {exported_at:new Date().toISOString(),assumptions:{common_scale:'V vs SHE',vacuum_zero_eV:4.44,pH_shift:'不做自动pH平移',model:'理想独立组分前接触对齐；不能判定直接光充电',scope:'A/B用于主比较，overlay只叠图'},a_id:aId,b_id:bId,overlay_ids:overlays.slice(),records:selected().map(record=>({...record,normalized_SHE:normalized(record)}))};
  }
  function download(text,mime,name) {
    const url=URL.createObjectURL(new Blob([text],{type:mime})),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);$('export-status').textContent='已导出当前 '+selected().length+' 条样品及出处。';
  }
  $('band-select-a').addEventListener('change',()=>changeMain('a'));
  $('band-select-b').addEventListener('change',()=>changeMain('b'));
  $('selected-records').addEventListener('click',event=>{const button=event.target.closest('[data-remove]');if(button){overlays=overlays.filter(id=>id!==button.dataset.remove);render();}});
  $('band-catalog-live').addEventListener('click',event=>{const button=event.target.closest('[data-add]');if(button)addOverlay(button.dataset.add);});
  ['band-search','band-role-filter','band-complete-filter'].forEach(id=>$(id).addEventListener(id==='band-search'?'input':'change',renderCatalog));
  $('photon-wavelength').addEventListener('input',renderPhoton);
  ['redox-model','redox-cathode','redox-zinc'].forEach(id=>$(id).addEventListener('input',renderHeadroom));
  $('share-comparison').addEventListener('click',async()=>{
    const url=new URL('bands.html',location.href);const ids=[aId,bId,...overlays].filter(id=>publishedIds.has(id));url.searchParams.set('ids',ids.join(','));
    try {await navigator.clipboard.writeText(url.href);$('export-status').textContent='已复制公开样品比较链接'+(selected().some(r=>!publishedIds.has(r.id))?'；自定义数据未分享，打开时公共样品会重新默认补位。':'。');}
    catch(_){$('export-status').textContent='浏览器未允许复制。可复制地址栏中的公开样品链接。';}
  });
  $('export-bands-json').addEventListener('click',()=>download(JSON.stringify(exportSnapshot(),null,2),'application/json;charset=utf-8','photo-zinc-band-comparison.json'));
  $('export-bands-csv').addEventListener('click',()=>{
    const headers=['selection','id','material','formula','phase','sample','gap_eV','gap_basis','cb_original','vb_original','scale','pH','cb_SHE_V','vb_SHE_V','edge_label','charge_label','work_function_eV','d_band_center_eV','method','doi','source_url','locator','notes'];
    const quote=value=>{let text=String(value==null?'':value);if(typeof value!=='number'&&/^[\s]*[=+\-@]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};
    const rows=selected().map(r=>{const n=normalized(r),s=r.source||{};return [r.id===aId?'A':r.id===bId?'B':'overlay',r.id,label(r),r.formula,r.phase,r.sample,r.gap_eV,r.gap_basis,r.cb,r.vb,r.scale,r.ph,n.ok?n.cb:null,n.ok?n.vb:null,r.edge_label,r.charge_label,r.work_function_eV,r.d_band_center_eV,r.method,s.doi,s.url,s.locator,allNotes(r).join('；')];});
    download('\uFEFF'+[headers,...rows].map(row=>row.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8','photo-zinc-band-comparison.csv');
  });
  $('custom-scale').addEventListener('change',()=>{
    const needs=['AgAgCl','SCE'].includes($('custom-scale').value);$('custom-offset-label').hidden=!needs;$('custom-band-form').elements.reference_offset_V.required=needs;
  });
  $('custom-band-form').addEventListener('submit',event=>{
    event.preventDefault();const form=event.currentTarget,raw=Object.fromEntries(new FormData(form).entries());
    try {
      if(!raw.material.trim()||!raw.phase.trim()||!raw.sample.trim()||!raw.method.trim()||raw.ph.trim()==='')throw new Error('请补齐具体样品、晶相、pH 与测量方法。');
      if(!Number.isFinite(Number(raw.cb))||!Number.isFinite(Number(raw.vb))||Math.abs(Number(raw.cb))>30||Math.abs(Number(raw.vb))>30)throw new Error('本模块用于电池材料初筛，CB / VB 接受 −30 至 +30 V（真空为 eV）；请核对输入单位。');
      const input={...raw,role:'cathode',id:'CUSTOM-'+(++customIndex),source:{doi:null,url:null,title:'本组当前会话测量',locator:'用户填写，未上传'},edge_label:'本组测量输入，未由本站核验',charge_label:'直接光充电尚需实验验证',notes:['仅当前会话保留，不进入公开分享链接。']};
      if(!raw.gap_eV.trim())delete input.gap_eV;
      if(!raw.reference_offset_V.trim())delete input.reference_offset_V;
      const {source:customSource,...coreInput}=input;
      const validated=core.validateCustom(coreInput),record={...input,...validated,source:customSource};
      if(!finite(record.gap_eV)&&raw.gap_eV.trim())record.gap_eV=Number(raw.gap_eV);
      record.ph=Number(raw.ph);records.push(record);map.set(record.id,record);bId=record.id;overlays=overlays.filter(id=>id!==bId).slice(0,2);options();render();$('custom-band-status').textContent='已加入 B；仅保留在当前会话。请导出后再关闭或刷新。';
    } catch(error){$('custom-band-status').textContent=error.message || '请核对数值和参比。';}
  });
  options();$('bands-app').hidden=false;$('catalog-controls').hidden=false;$('bands-load-message').hidden=true;$('bands-static-catalog').hidden=true;render();
}());
