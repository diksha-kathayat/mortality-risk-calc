const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateRisk } = require('../lib/model');

test('calculateRisk returns formatted horizons', () => {
  const payload = calculateRisk({
    age: 60,
    sex: 'Male',
    cancer: 'No',
    asa: '4-5',
    urgency: 'Elective',
    specialty: 'GI Tract',
    grade: 'Major',
    hospital: 'Cabrini Hospital',
    surgeryDate: '2026-03-25',
  });

  assert.equal(typeof payload.results.m30.pct, 'number');
  assert.match(payload.results.m30.pctFormatted, /%/);
  assert.ok(payload.results.m30.decile >= 1 && payload.results.m30.decile <= 10);
  assert.equal(typeof payload.results.lifeExpectancy, 'number');
});

test('calculateRisk rejects invalid age', () => {
  assert.throws(() => calculateRisk({ age: 10 }), /Invalid age/);
});
