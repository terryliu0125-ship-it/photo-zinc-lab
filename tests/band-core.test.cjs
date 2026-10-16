const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const C = require('../band-core.js');
const close = (actual, expected, epsilon = 1e-10) => assert(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);
const sample = changes => C.normalize({ name: 'test', cb: -0.9, vb: 1.2, scale: 'SHE', ph: 4, electrolyte: '2 M ZnSO4', soc: 'discharged', uncertainty_eV: 0, ...changes });

test('browser global and CommonJS expose the same public API', () => {
  const context = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../band-core.js'), 'utf8'), context);
  assert.deepEqual(Object.keys(context.BandCore).sort(), Object.keys(C).sort());
});

test('vacuum electronic energies reverse the potential axis and round-trip', () => {
  close(C.toSHE(-4.44, 'vacuum'), 0);
  close(C.toSHE(-4.00, 'vacuum'), -0.44);
  close(C.toVacuum(0), -4.44);
  for (const potential of [-1.5, -0.76, 0, 0.6, 2.2]) close(C.toSHE(C.toVacuum(potential), 'vacuum'), potential);
  const converted = C.normalize({ cb: -3.6, vb: -6.1, scale: 'vacuum' });
  assert.equal(converted.ok, true); close(converted.cb, -0.84); close(converted.vb, 1.66);
  assert(converted.warnings.some(message => message.includes('4.44')));
});

test('RHE conversion requires pH and subtracts rather than adds its offset', () => {
  close(C.toSHE(1, 'RHE', { ph: 7 }), 0.5858845522065321);
  close(C.toSHE(0, 'RHE', { ph: 0 }), 0);
  assert.throws(() => C.toSHE(1, 'RHE'), /pH/);
  assert.equal(C.normalize({ cb: 0, vb: 2, scale: 'RHE' }).ok, false);
  assert.equal(C.validateCustom({ cb: '0', vb: '2', scale: 'RHE', ph: '4' }).ph, 4);
});

test('Ag/AgCl and SCE require an explicit condition-specific reference offset', () => {
  assert.throws(() => C.toSHE(0.1, 'AgAgCl'), /偏移/);
  assert.throws(() => C.toSHE(0.1, 'SCE'), /偏移/);
  close(C.toSHE(0.1, 'AgAgCl', { reference_offset_V: 0.197 }), 0.297);
  close(C.toSHE(0.1, 'AgAgCl', { reference_offset_V: 0.210 }), 0.310);
  close(C.toSHE(0.1, 'SCE', { reference_offset_V: 0.241 }), 0.341);
  close(C.toSHE(0, 'AgAgCl', { reference_offset_V: 0 }), 0);
});

test('Zn conversion blocks an unknown reference instead of silently assuming standard zinc', () => {
  for (const reference_offset_V of [undefined, null, '', ' ']) {
    assert.throws(() => C.toSHE(1, 'Zn', { reference_offset_V }), /Zn参比/);
    assert.throws(() => C.fromSHE(0.24, 'Zn', { reference_offset_V }), /Zn参比/);
    assert.equal(sample({ cb: 0.1, vb: 2, scale: 'Zn', reference_offset_V }).ok, false);
  }
  assert.throws(() => C.toSHE(1, 'Zn', { zinc_reference_mode: 'standard' }), /显式选择/);
  assert.throws(() => C.validateCustom({ cb: 0, vb: 2, scale: 'Zn' }), /Zn参比/);
});

test('explicit standard Zn approximation has the correct sign and a strong provenance warning', () => {
  const options = { zinc_reference_mode: 'standard_approximation' };
  close(C.toSHE(1, 'Zn', options), 0.24);
  close(C.fromSHE(0.24, 'Zn', options), 1);
  close(C.toSHE(0, 'Zn', options), -0.76);
  close(C.fromSHE(-0.76, 'Zn', options), 0);
  const n = sample({ cb: 0, vb: 2, scale: 'Zn', ...options });
  assert.equal(n.ok, true); close(n.cb, -0.76); close(n.vb, 1.24);
  assert(n.warnings.some(message => message.includes('标准态近似') && message.includes('非实际Zn电极')));
  const custom = C.validateCustom({ cb: '0', vb: '2', scale: 'Zn', zinc_reference_mode: ' standard_approximation ' });
  assert.equal(custom.zinc_reference_mode, 'standard_approximation'); assert.equal(C.normalize(custom).ok, true);
});

test('measured Zn offsets take priority while conflicting standard modes remain visible', () => {
  const options = { reference_offset_V: -0.81, zinc_reference_mode: 'standard_approximation' };
  close(C.toSHE(1, 'Zn', options), 0.19);
  close(C.fromSHE(0.19, 'Zn', options), 1);
  const n = sample({ cb: 0, vb: 2, scale: 'Zn', ...options });
  assert.equal(n.ok, true); close(n.cb, -0.81); close(n.vb, 1.19);
  assert(n.warnings.some(message => message.includes('模式冲突') && message.includes('优先')));
  close(C.toSHE(1, 'Zn', { reference_offset_V: 0 }), 1);
  for (const reference_offset_V of [false, NaN, Infinity, 'not measured']) {
    assert.throws(() => C.toSHE(1, 'Zn', { ...options, reference_offset_V }));
    assert.throws(() => C.fromSHE(1, 'Zn', { ...options, reference_offset_V }));
    assert.equal(sample({ scale: 'Zn', ...options, reference_offset_V }).ok, false);
  }
});

test('inverse conversion round-trips every supported scale using the same conditions', () => {
  const cases = [
    ['vacuum', {}], ['SHE', {}], ['NHE', {}], ['RHE', { ph: 7 }],
    ['AgAgCl', { reference_offset_V: 0.197 }], ['SCE', { reference_offset_V: 0.241 }],
    ['Zn', { reference_offset_V: -0.82 }], ['Zn', { zinc_reference_mode: 'standard_approximation' }]
  ];
  for (const [scale, options] of cases) {
    for (const potential of [-1.5, -0.76, 0, 0.24, 2]) {
      close(C.toSHE(C.fromSHE(potential, scale, options), scale, options), potential);
      close(C.fromSHE(C.toSHE(potential, scale, options), scale, options), potential);
    }
  }
  close(C.fromSHE(0, 'vacuum'), -4.44);
  close(C.fromSHE(-0.44, 'vacuum'), -4);
  close(C.fromSHE(0.5858845522065321, 'RHE', { ph: 7 }), 1);
});

test('inverse conversion strictly blocks empty potentials, pH and reference offsets', () => {
  for (const bad of ['', ' ', null, undefined, true, false, [], {}, '0x10', 'Infinity', Infinity, NaN, '1 V']) {
    assert.throws(() => C.fromSHE(bad, 'SHE'));
    assert.throws(() => C.fromSHE(1, 'RHE', { ph: bad }));
    assert.throws(() => C.toSHE(1, 'RHE', { ph: bad }));
    for (const scale of ['AgAgCl', 'SCE', 'Zn']) {
      assert.throws(() => C.fromSHE(1, scale, { reference_offset_V: bad }));
      assert.throws(() => C.toSHE(1, scale, { reference_offset_V: bad }));
    }
  }
  assert.throws(() => C.fromSHE(1, 'unknown'));
  assert.throws(() => C.fromSHE(1, 'SHE', null));
  assert.throws(() => C.fromSHE(1, 'SHE', []));
});

test('cathode reaction potentials and band edges use the same Zn reference without double subtraction', () => {
  const options = { reference_offset_V: -0.8 };
  const e = C.toSHE(-0.2, 'Zn', options), h = C.toSHE(2, 'Zn', options);
  const cathode = C.toSHE(1, 'Zn', options), zinc = C.toSHE(0, 'Zn', options);
  close(e, -1); close(h, 1.2); close(cathode, 0.2); close(zinc, -0.8);
  const margins = C.headroom(e, h, cathode, zinc);
  close(margins.zinc, 0.2); close(margins.cathode, 1);
  close(C.fromSHE(cathode, 'Zn', options), 1);
  const incomplete = C.normalize({ scale: 'Zn', plateau_V: 1, reference_offset_V: -0.8 });
  assert.equal(incomplete.ok, false); assert.equal(incomplete.cb, null); assert.equal(incomplete.vb, null);
});

test('zero is numeric while blanks, booleans, arrays, hex, infinity and NaN are rejected', () => {
  close(C.toSHE('0', 'SHE'), 0);
  close(C.toSHE('−0.8', 'SHE'), -0.8);
  close(C.toSHE('1e-2', 'SHE'), 0.01);
  for (const bad of ['', ' ', null, undefined, true, false, [], {}, '0x10', 'Infinity', Infinity, NaN, '1 V']) {
    assert.throws(() => C.toSHE(bad, 'SHE'));
    assert.throws(() => C.toVacuum(bad));
    assert.throws(() => C.photonEnergy(bad));
  }
  assert.throws(() => C.toSHE(1, 'unspecified'));
});

test('Eg alone or flatband alone cannot become an absolute conduction band', () => {
  for (const record of [{ eg: 2.3, scale: 'SHE' }, { gap: 2.3, flatband: -0.8, scale: 'SHE' }, { cb: -0.8, eg: 2.3, scale: 'SHE' }]) {
    const normalized = C.normalize(record);
    assert.equal(normalized.ok, false); assert.equal(normalized.cb, null); assert.equal(normalized.vb, null);
    assert.throws(() => C.validateCustom(record));
  }
});

test('invalid band order and uncertainties cannot produce diagrams or types', () => {
  assert.equal(sample({ cb: 1, vb: 0 }).ok, false);
  assert.equal(sample({ cb: 0, vb: 0 }).ok, false);
  assert.equal(C.normalize({ cb: -6, vb: -4, scale: 'vacuum' }).ok, false);
  assert.equal(sample({ uncertainty_eV: -0.1 }).ok, false);
  assert.equal(sample({ uncertainty_eV: 'bad' }).ok, false);
  assert.equal(C.classify(sample(), { ok: false }).type, '边界不确定');
});

test('Type-I confines both ideal carrier endpoints to the narrower-gap component', () => {
  const wide = sample({ cb: -1, vb: 2 }), narrow = sample({ cb: -0.5, vb: 1 });
  const result = C.classify(wide, narrow);
  assert.equal(result.type, 'Type I'); assert.equal(result.electron, -0.5); assert.equal(result.hole, 1);
  assert.equal(result.electron_record, 'b'); assert.equal(result.hole_record, 'b');
  const swapped = C.classify(narrow, wide);
  assert.equal(swapped.type, 'Type I'); assert.equal(swapped.electron_record, 'a'); assert.equal(swapped.hole_record, 'a');
});

test('Type-II relaxation chooses a more positive CB and a more negative VB potential', () => {
  const a = sample({ cb: -1, vb: 1.2 }), b = sample({ cb: -0.4, vb: 2 });
  const result = C.classify(a, b);
  assert.equal(result.type, 'Type II'); assert.equal(result.electron, -0.4); assert.equal(result.hole, 1.2);
  assert.equal(result.electron_record, 'b'); assert.equal(result.hole_record, 'a');
  const swapped = C.classify(b, a);
  assert.equal(swapped.type, 'Type II'); assert.equal(swapped.electron, result.electron); assert.equal(swapped.hole, result.hole);
});

test('Type-III and touching or uncertainty-overlapping band edges have no inferred endpoints', () => {
  for (const [a, b, expected] of [
    [sample({ cb: -2, vb: -1 }), sample({ cb: 0, vb: 1 }), 'Type III'],
    [sample({ cb: 0, vb: 1 }), sample({ cb: -2, vb: -1 }), 'Type III'],
    [sample({ cb: -1, vb: 1 }), sample({ cb: 1, vb: 2 }), '边界不确定'],
    [sample({ cb: -1, vb: 1.2 }), sample({ cb: -1, vb: 2 }), '边界不确定'],
    [sample({ cb: -1, vb: 1.2, uncertainty_eV: 0.1 }), sample({ cb: -0.85, vb: 2, uncertainty_eV: 0.1 }), '边界不确定']
  ]) {
    const result = C.classify(a, b); assert.equal(result.type, expected);
    assert.equal(result.electron, null); assert.equal(result.hole, null);
  }
});

test('reference conversion does not remove pH, electrolyte or state-of-charge differences', () => {
  const result = C.classify(sample({ cb: -1, vb: 1, ph: 4 }), sample({ cb: -0.5, vb: 2, ph: 7, soc: 'charged', electrolyte: 'Zn(OTf)2' }));
  assert.equal(result.type, 'Type II');
  assert(result.warnings.some(message => message.includes('pH不同')));
  assert(result.warnings.some(message => message.includes('电解液不同')));
  assert(result.warnings.some(message => message.includes('插层状态不同')));
  assert(result.warnings.some(message => message.includes('不能据此确定实际界面')));
  assert(C.normalize({ cb: -0.7, vb: 1.6, scale: 'NHE' }).warnings.some(message => message.includes('近似')));
});

test('headroom signs follow Zn reduction and cathode oxidation, never return a photocharging verdict', () => {
  assert.deepEqual(C.headroom(-1, 1, 0.5), { zinc: 0.24, cathode: 0.5 });
  const negative = C.headroom(-0.4, 0.2, 0.5);
  close(negative.zinc, -0.36); close(negative.cathode, -0.3);
  assert.deepEqual(C.headroom(0, 0, 0, 0), { zinc: 0, cathode: 0 });
  assert.throws(() => C.headroom(null, 1, 0.5));
  assert.throws(() => C.headroom(-1, 1, ''));
  assert(!('canPhotocharge' in negative));
});

test('photon energy uses nm, rejects zero and negative wavelength', () => {
  close(C.photonEnergy(500), 2.479683968664005);
  assert(C.photonEnergy(400) > C.photonEnergy(800));
  assert.throws(() => C.photonEnergy(0)); assert.throws(() => C.photonEnergy(-400));
});

test('custom input validates complete native band edges and preserves rather than mutates source fields', () => {
  const input = { name: ' VO2(B) ', cb: '−3.6', vb: '-5.9', scale: 'vacuum', uncertainty_eV: '0.1', source: ' source text ', ph: '' };
  const record = C.validateCustom(input);
  assert.equal(input.cb, '−3.6'); assert.equal(record.cb, -3.6); assert.equal(record.vb, -5.9);
  assert.equal(record.name, 'VO2(B)'); assert.equal(record.source, 'source text'); assert.equal(record.uncertainty_eV, 0.1);
  assert(!('ph' in record)); assert.equal(C.normalize(record).ok, true);
  const agcl = C.validateCustom({ cb: '-1', vb: '1', scale: 'AgAgCl', reference_offset_V: '0.197' });
  close(C.normalize(agcl).cb, -0.803);
  assert.throws(() => C.validateCustom({ cb: -1, vb: 1, scale: 'SCE', reference_offset_V: '' }));
});
