'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = {window: {}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'calculation-core.js'), 'utf8'), context);
const core = context.window.EnergyCalculationCore;
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/data.json'), 'utf8'));
const doc = fs.readFileSync(path.join(__dirname, '../docs/CALCULATIONS.md'), 'utf8');
const base = {pvKwp: 5, batteryKwh: 5, annualLoadKwh: 5000, pvYieldPerKwp: data.pv.yield_per_kwp};
const near = (actual, expected, label = '') => assert.ok(Math.abs(actual - expected) < 1e-6, `${label}: ${actual} != ${expected}`);

test('documented example executes the production core', () => {
    const result = core.estimateEnergyBalance(base);
    const expected = {pvGeneration: 4750, selfUse: 3060.750230502496,
        batteryLosses: 151.8407755849614, gridImport: 1939.2497694974065,
        feedIn: 1537.4089939125145, autarky: 61.21500461004992};
    for (const [key, value] of Object.entries(expected)) {
        near(result[key], value, key);
        assert.ok(doc.includes(value.toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2})), key);
    }
});

test('annual and monthly PV/load conservation, including losses and inventory', () => {
    for (const pvKwp of [0, 1, 5, 30]) for (const batteryKwh of [0, 1, 15, 100]) {
        for (const annualLoadKwh of [0, 100, 5000, 15000]) {
            const b = core.estimateEnergyBalance({...base, pvKwp, batteryKwh, annualLoadKwh});
            near(b.pvGeneration, pvKwp * base.pvYieldPerKwp, 'yield');
            near(b.annualLoad, annualLoadKwh, 'load');
            near(b.pvGeneration, b.selfUse + b.feedIn + b.batteryLosses + b.storageChange, 'PV');
            near(annualLoadKwh, b.selfUse + b.gridImport, 'demand');
            near(b.batteryCharged, b.batteryDelivered + b.batteryLosses + b.storageChange, 'battery');
            assert.ok(b.autarky >= 0 && b.autarky <= 100 + 1e-8);
            assert.ok(b.storageChange >= 0 && b.storageChange <= batteryKwh * .7 + 1e-8);
            for (const m of b.monthly) {
                near(m.pv, m.selfConsumption + m.feedIn + m.batteryLosses + m.storageChange, 'month PV');
                near(m.consumption, m.selfConsumption + m.gridImport, 'month demand');
            }
            for (const [monthlyKey, annualKey] of Object.entries({pv:'pvGeneration', consumption:'annualLoad',
                selfConsumption:'selfUse', gridImport:'gridImport', feedIn:'feedIn', batteryLosses:'batteryLosses'})) {
                near(b.monthly.reduce((sum, m) => sum + m[monthlyKey], 0), b[annualKey], monthlyKey);
            }
        }
    }
});

test('no storage has no storage flows; added storage reduces imports without creating energy', () => {
    const without = core.estimateEnergyBalance({...base, batteryKwh: 0});
    const withStorage = core.estimateEnergyBalance(base);
    near(without.batteryDelivered, 0);
    near(without.batteryLosses, 0);
    near(without.storageChange, 0);
    assert.ok(withStorage.gridImport < without.gridImport);
    assert.ok(withStorage.batteryLosses > 0);
    near(without.feedIn - withStorage.feedIn,
        withStorage.selfUse - without.selfUse + withStorage.batteryLosses + withStorage.storageChange);
});

test('WP, EV and AC loads are added exactly once and normalized', () => {
    const result = core.estimateEnergyBalance({...base, annualLoadKwh: 14000,
        heatpumpLoadKwh: 5000, airconLoadKwh: 1000, hasEv: true, evLoadKwh: 3000});
    near(result.annualLoad, 14000);
    assert.ok(result.heatpumpSelfUse <= 5000);
    assert.ok(result.evFromBattery <= Math.min(3000, result.batteryDelivered));
    for (const season of ['summer','winter']) {
        assert.equal(result.daily[season].length, 24);
        for (const hour of result.daily[season]) near(hour.load, hour.selfConsumption + hour.gridImport);
    }
    const nightOnly = core.estimateEnergyBalance({...base, annualLoadKwh: 3000, hasEv: true, evLoadKwh: 3000, batteryKwh: 0});
    near(nightOnly.evFromBattery, 0);
});

test('invalid or inconsistent energy inputs are rejected', () => {
    for (const invalid of [-1, NaN, Infinity]) {
        assert.throws(() => core.estimateEnergyBalance({...base, pvKwp: invalid}), /finite and nonnegative/);
    }
    assert.throws(() => core.estimateEnergyBalance({...base, heatpumpLoadKwh: 6000}), /components/);
});

test('cash flows escalate by carrier, leave fuel and tariff constant by default', () => {
    near(core.projectSavings({electricity: 100, gas: 200, fuel: 300, feedIn: 50,
        electricityRate: .02, gasRate: .03, years: 2}), 650 + 102 + 206 + 300 + 50);
    near(core.projectSavings({electricity: -100, gas: 200, years: 20}), 2000);
    near(core.projectSavings({electricity: 0, gas: 0, years: 20}), 0);
});
