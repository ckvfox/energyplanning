'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const context = {window: {}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'calculation-core.js'), 'utf8'), context);
const core = context.window.EnergyCalculationCore;
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/data.json'), 'utf8'));
const doc = fs.readFileSync(path.join(root, 'docs/CALCULATIONS.md'), 'utf8');

test('documented example matches actual core and configured yield', () => {
    const result = core.estimateEnergyBalance({pvKwp: 5, batteryKwh: 5,
        annualLoadKwh: 5000, pvYieldPerKwp: data.pv.yield_per_kwp});
    const expected = {pvGeneration: 4750, directSelf: 2250, batteryDelivered: 1085.875,
        selfUse: 3335.875, gridImport: 1664.125, feedIn: 1414.125, autarky: 66.7175};
    for (const [key, value] of Object.entries(expected)) {
        assert.ok(Math.abs(result[key] - value) < 1e-8, key);
        assert.ok(doc.includes(value.toLocaleString('de-DE', {maximumFractionDigits: 4})), key);
    }
    assert.equal(result.gridImport + result.selfUse, 5000);
});

test('documented no-storage example and zero-load boundary', () => {
    const input = {pvKwp: 5, batteryKwh: 0, annualLoadKwh: 5000,
        pvYieldPerKwp: data.pv.yield_per_kwp};
    assert.equal(core.estimateEnergyBalance(input).selfUse, 1750);
    assert.equal(core.estimateEnergyBalance({...input, annualLoadKwh: 0}).autarky, 0);
});
