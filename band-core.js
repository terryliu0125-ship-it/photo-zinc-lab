'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BandCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // Potentials are V vs SHE; vacuum values are signed electron energies in eV.
  // Constants and the RHE conversion below use the 25 °C aqueous convention.
  const SHE_ABSOLUTE_V = 4.44;
  const RHE_SLOPE_V = 0.059159349684781114;
  const HC_EV_NM = 1239.8419843320026;
  const EPS = 1e-9;
  const SCALES = ['vacuum', 'SHE', 'NHE', 'RHE', 'AgAgCl', 'SCE', 'Zn'];
  const has = value => value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '');

  function number(value, label) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const text = value.trim().replace(/\u2212/g, '-');
      if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) {
        const parsed = Number(text);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    throw new Error(`${label}必须是有效数值，不能留空。`);
  }

  function scaleName(value) {
    if (typeof value !== 'string') throw new Error('必须明确原始能带刻度或参比电极。');
    const found = SCALES.find(item => item.toLowerCase() === value.trim().toLowerCase());
    if (!found) throw new Error('不支持该刻度或参比电极，不能自动猜测。');
    return found;
  }

  function conversionOptions(options) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('参比换算条件无效。');
    return options;
  }

  function referenceOffset(scale, options) {
    if (scale === 'Zn') {
      if (has(options.zinc_reference_mode) && typeof options.zinc_reference_mode !== 'string') throw new Error('Zn参比模式必须明确为文字标识。');
      // A provided offset always wins. An invalid provided offset never falls back.
      if (has(options.reference_offset_V)) return number(options.reference_offset_V, '测量条件下Zn参比相对SHE的电位');
      if (text(options.zinc_reference_mode) === 'standard_approximation') return -0.76;
      throw new Error('缺少测量条件下Zn参比相对SHE的电位；必须提供reference_offset_V，或显式选择standard_approximation标准态近似。');
    }
    return number(options.reference_offset_V, '该参比在测量条件下相对SHE的偏移');
  }

  function toSHE(value, scale, options = {}) {
    const input = number(value, '能带数值');
    const nativeScale = scaleName(scale);
    conversionOptions(options);
    let result;
    if (nativeScale === 'vacuum') result = -input - SHE_ABSOLUTE_V;
    else if (nativeScale === 'SHE' || nativeScale === 'NHE') result = input;
    else if (nativeScale === 'RHE') result = input - RHE_SLOPE_V * number(options.ph, 'RHE测量时的pH');
    else result = input + referenceOffset(nativeScale, options);
    if (!Number.isFinite(result)) throw new Error('换算结果超出有效数值范围。');
    return result;
  }

  function fromSHE(value, scale, options = {}) {
    const input = number(value, 'SHE电位');
    const targetScale = scaleName(scale);
    conversionOptions(options);
    let result;
    if (targetScale === 'vacuum') result = -input - SHE_ABSOLUTE_V;
    else if (targetScale === 'SHE' || targetScale === 'NHE') result = input;
    else if (targetScale === 'RHE') result = input + RHE_SLOPE_V * number(options.ph, 'RHE测量时的pH');
    else result = input - referenceOffset(targetScale, options);
    if (!Number.isFinite(result)) throw new Error('换算结果超出有效数值范围。');
    return result;
  }

  function toVacuum(value) {
    const result = -number(value, 'SHE电位') - SHE_ABSOLUTE_V;
    if (!Number.isFinite(result)) throw new Error('换算结果超出有效数值范围。');
    return result;
  }

  function optionalNumber(value, label) {
    return has(value) ? number(value, label) : null;
  }

  function text(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  function normalize(record) {
    const warnings = [];
    const failure = reason => ({ ok: false, cb: null, vb: null, warnings, reason });
    if (!record || typeof record !== 'object' || Array.isArray(record)) return failure('缺少材料记录。');
    try {
      if (!has(record.cb) || !has(record.vb)) {
        return failure('缺少可定位的完整CB和VB；仅有带隙或平带电位不能补成绝对带边。');
      }
      const scale = scaleName(record.scale);
      const cb = toSHE(record.cb, scale, record);
      const vb = toSHE(record.vb, scale, record);
      if (!(cb < vb)) return failure('带边顺序无效：SHE电位刻度必须满足CB < VB（真空电子能量则CB > VB）。');
      const uncertaintyKnown = has(record.uncertainty_eV);
      const uncertainty = uncertaintyKnown ? number(record.uncertainty_eV, '带边不确定度') : 0;
      if (uncertainty < 0) return failure('带边不确定度不能为负。');
      const ph = optionalNumber(record.ph, 'pH');
      const temperature = optionalNumber(record.temperature_C, '温度');
      const conditions = {
        ph,
        electrolyte: text(record.electrolyte),
        soc: text(record.soc),
        phase: text(record.phase),
        temperature_C: temperature
      };
      if (scale === 'vacuum') warnings.push('真空刻度按带符号电子能量、SHE绝对电位4.44 V换算；这是25°C水系约定。');
      if (scale === 'NHE') warnings.push('保留原文NHE标注；本图按与SHE相同的常用近似坐标展示。');
      if (scale === 'RHE') warnings.push('RHE换算采用25°C斜率；仅统一坐标，不推算材料在其他pH下的能带变化。');
      if (scale === 'Zn') {
        if (has(record.reference_offset_V)) {
          warnings.push('Zn参比使用显式reference_offset_V；该值须对应测量时的电解液、温度和Zn²⁺活度，不能把所有Zn电极视为相同参比。');
          if (text(record.zinc_reference_mode) === 'standard_approximation') warnings.push('Zn参比模式冲突：已给显式偏移时优先使用该偏移，不使用−0.76 V标准态近似；请核对模式与原始记录。');
        } else warnings.push('Zn参比采用显式选择的标准态近似−0.76 V vs SHE；非实际Zn电极的实测电位，不能代表本组电解液、活度或配位条件。');
      }
      if (temperature !== null && Math.abs(temperature - 25) > EPS) warnings.push('测量温度不是25°C；RHE及真空转换仍采用25°C约定，需要核对温度修正。');
      if (ph === null) warnings.push('测量pH未提供；不能确认与实际电池条件相同。');
      if (!conditions.electrolyte) warnings.push('测量电解液未提供。');
      if (!conditions.soc) warnings.push('荷电／插层状态未提供；不能代表整个充放电区间。');
      if (!uncertaintyKnown) warnings.push('带边不确定度未提供；图中数值不代表精确无误。');
      if (record.estimated === true || record.derived === true) warnings.push('带边包含推算值，不能当作直接测量。');
      return { ok: true, cb, vb, warnings, reason: '', uncertainty_eV: uncertainty, uncertainty_known: uncertaintyKnown, conditions, id: text(record.id), name: text(record.name) || text(record.material) };
    } catch (error) {
      return failure(error.message);
    }
  }

  function classify(a, b) {
    const warnings = [...(Array.isArray(a?.warnings) ? a.warnings : []), ...(Array.isArray(b?.warnings) ? b.warnings : [])];
    const uniqueWarnings = () => [...new Set(warnings)];
    const result = (type, electron = null, hole = null, electronRecord = null, holeRecord = null) => ({ type, electron, hole, electron_record: electronRecord, hole_record: holeRecord, warnings: uniqueWarnings() });
    const valid = item => item?.ok === true && typeof item.cb === 'number' && Number.isFinite(item.cb) && typeof item.vb === 'number' && Number.isFinite(item.vb) && item.cb < item.vb;
    if (!valid(a) || !valid(b)) {
      warnings.push('至少一个材料缺少可比较的绝对带边。');
      return result('边界不确定');
    }
    const aConditions = a.conditions || {}, bConditions = b.conditions || {};
    for (const [field, label] of [['ph', 'pH'], ['electrolyte', '电解液'], ['soc', '荷电／插层状态'], ['temperature_C', '温度']]) {
      if (aConditions[field] !== null && aConditions[field] !== undefined && bConditions[field] !== null && bConditions[field] !== undefined && aConditions[field] !== bConditions[field]) warnings.push(`两条记录的${label}不同，坐标换算不消除样品条件差异。`);
    }
    warnings.push('类型仅按独立组分带边初筛；不能据此确定实际界面弯曲、内建电场、S-scheme／Z-scheme或光电压。');
    let uncertainty;
    try {
      const ua = has(a.uncertainty_eV) ? number(a.uncertainty_eV, 'A不确定度') : 0;
      const ub = has(b.uncertainty_eV) ? number(b.uncertainty_eV, 'B不确定度') : 0;
      if (ua < 0 || ub < 0) throw new Error('不确定度不能为负。');
      uncertainty = ua + ub + EPS;
    } catch (error) {
      warnings.push(error.message);
      return result('边界不确定');
    }
    const differences = [a.cb - b.cb, a.vb - b.vb, a.cb - b.vb, a.vb - b.cb];
    if (differences.some(delta => Math.abs(delta) <= uncertainty)) {
      warnings.push('至少一组关键带边相等或不确定度区间重叠，不能稳定区分对齐类型。');
      return result('边界不确定');
    }
    if (a.vb < b.cb || b.vb < a.cb) {
      warnings.push('理想破缺带隙对齐；不套用普通Type-II载流子终点。');
      return result('Type III');
    }
    if (a.cb < b.cb && a.vb > b.vb) return result('Type I', b.cb, b.vb, 'b', 'b');
    if (b.cb < a.cb && b.vb > a.vb) return result('Type I', a.cb, a.vb, 'a', 'a');
    const electronRecord = a.cb > b.cb ? 'a' : 'b';
    const holeRecord = a.vb < b.vb ? 'a' : 'b';
    return result('Type II', Math.max(a.cb, b.cb), Math.min(a.vb, b.vb), electronRecord, holeRecord);
  }

  function headroom(electron, hole, cathode, zinc = -0.76) {
    const e = number(electron, '电子终点电位'), h = number(hole, '空穴终点电位');
    const c = number(cathode, '正极反应电位'), z = number(zinc, 'Zn沉积电位');
    const result = { zinc: z - e, cathode: h - c };
    if (!Number.isFinite(result.zinc) || !Number.isFinite(result.cathode)) throw new Error('能量余量超出有效数值范围。');
    return result;
  }

  function photonEnergy(wavelength) {
    const lambda = number(wavelength, '波长（nm）');
    if (lambda <= 0) throw new Error('波长必须大于0 nm。');
    const energy = HC_EV_NM / lambda;
    if (!Number.isFinite(energy)) throw new Error('光子能量超出有效数值范围。');
    return energy;
  }

  function validateCustom(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('自定义材料输入无效。');
    const record = { ...input, scale: scaleName(input.scale), cb: number(input.cb, 'CB'), vb: number(input.vb, 'VB') };
    for (const [field, label] of [['ph', 'pH'], ['reference_offset_V', '参比偏移'], ['uncertainty_eV', '带边不确定度'], ['temperature_C', '温度']]) {
      if (has(input[field])) record[field] = number(input[field], label);
      else delete record[field];
    }
    for (const field of ['name', 'material', 'phase', 'electrolyte', 'soc', 'method', 'source', 'doi', 'zinc_reference_mode']) {
      if (input[field] !== undefined) {
        if (typeof input[field] !== 'string') throw new Error(`${field}必须是文字。`);
        record[field] = input[field].trim();
      }
    }
    const checked = normalize(record);
    if (!checked.ok) throw new Error(checked.reason);
    return record;
  }

  return { normalize, toSHE, fromSHE, toVacuum, classify, headroom, photonEnergy, validateCustom };
});
