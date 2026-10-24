'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const root = process.env.ENERGY_TEST_ROOT || path.resolve(__dirname, '..');
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

async function app() {
    const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
        url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true
    });
    const w = dom.window;
    const errors = [];
    w.console.error = (...args) => errors.push(args.join(' '));
    w.alert = (message) => errors.push(message);
    w.HTMLElement.prototype.scrollIntoView = () => {};
    w.IntersectionObserver = class {observe() {} disconnect() {}};
    w.HTMLCanvasElement.prototype.getContext = function () {return {canvas: this};};
    w.fetch = async (url) => ({ok: true, text: async () =>
        fs.readFileSync(path.join(root, new URL(url, 'http://localhost/').pathname), 'utf8')});
    const charts = new Map();
    w.Chart = class {
        constructor(ctx, config) {charts.set(ctx.canvas.id, config);}
        destroy() {}
        resize() {}
    };
    for (const file of ['performance.js', 'calculation-core.js', 'chart-ui.js', 'subsidy-ui.js', 'pdf-export.js', 'script.js']) {
        w.eval(fs.readFileSync(path.join(root, 'scripts', file), 'utf8'));
    }
    // Let the actual registered DOM initialization complete.
    await new Promise(resolve => w.setTimeout(resolve, 0));
    return {dom, w, charts, errors};
}

test('production scenario/UI/chart path uses one balance and correct configured sizing', async () => {
    const {dom, w, charts, errors} = await app();
    try {
        const d = w.document;
        d.getElementById('houseType').value = 'einfamilienhaus';
        d.getElementById('area').value = '150';
        d.getElementById('people').value = '4';
        d.getElementById('aircon').value = 'Ja';
        d.getElementById('airconRooms').value = '2';
        d.getElementById('wallbox').value = 'Ja';
        await w.calculateAll();
        assert.deepEqual(errors, []);
        const data = JSON.parse(fs.readFileSync(path.join(root, 'data/data.json'), 'utf8'));
        assert.equal(w._scenarios.length, 3);
        for (const s of w._scenarios) {
            near(s.annualConsumption, s.householdBlock + s.climateBlock + s.evBlock + s.heatpumpBlock);
            near(s.energyBalance.annualLoad, s.annualConsumption);
            near(s.energyBalance.pvGeneration, s.pvKwp * data.pv.yield_per_kwp);
            near(s.gridImportKwh, s.energyBalance.gridImport);
            near(s.co2_after, s.gridImportKwh * data.co2.electricity_factor + s.gasUse * data.co2.gas_factor);
            near(s.co2_saving_20yr, s.co2_saving * 20);
            near(s.stromAutarky, s.energyBalance.selfUse / s.annualConsumption * 100);
            near(s.batteryCost, s.storageKwh * data.battery.cost_per_kwh);
            near(s.totalCost, s.pvCost + s.batteryCost + s.heatpumpCost + s.airconCost + s.wallboxCost);
            near(s.simplePaybackYears, s.totalCost / s.savings);
        }
        const first = w._scenarios[0];
        near(first.pvKwp, Math.round(first.annualConsumption / data.pv.yield_per_kwp * 10) / 10);
        const text = d.getElementById('results').textContent;
        assert.ok(text.includes('Einfache Amortisation (konstante Preise)'));
        assert.ok(text.includes('ungeprüfte Preise'));
        assert.ok(!text.includes('Heiz-Autarkie'));
        d.querySelector('[data-scenario="2"]').click();
        const wp = w._scenarios[2];
        const monthlyPV = charts.get('yearChart').data.datasets[0].data;
        near(monthlyPV.reduce((a,b) => a+b, 0), wp.energyBalance.pvGeneration);
        const monthlyLoad = charts.get('yearChart').data.datasets[1].data;
        near(monthlyLoad.reduce((a,b) => a+b, 0), wp.annualConsumption);
        d.querySelector('[data-season="winter"]').click();
        near(charts.get('dayChart').data.datasets[0].data.reduce((a,b) => a+b, 0),
            wp.energyBalance.daily.winter.reduce((a,b) => a+b.pv, 0));
        d.querySelector('[data-scenario="0"]').click();
        near(charts.get('yearChart').data.datasets[1].data.reduce((a,b) => a+b, 0), first.annualConsumption);
    } finally {dom.window.close();}
});

test('configured WP factor preserves effective 1.1 multiplier and cap', async () => {
    const {dom, w, errors} = await app();
    try {
        w.document.getElementById('area').value = '150';
        w.document.getElementById('people').value = '4';
        w.document.getElementById('houseType').value = 'reihenhaus';
        w.document.getElementById('insulation').value = 'normal';
        w.document.getElementById('floorHeating').value = 'Ja';
        await w.calculateAll();
        assert.deepEqual(errors, []);
        near(w._scenarios[2].heatpumpElectric, 16500 / 3.3);
    } finally {dom.window.close();}
});


test('no saving is disclosed instead of a fictitious payback; overrides remain consistent', async () => {
    const {dom, w, errors} = await app();
    try {
        const d = w.document;
        d.getElementById('houseType').value = 'reihenhaus';
        d.getElementById('area').value = '150';
        d.getElementById('people').value = '4';
        await w.calculateAll();
        for (const [id, value] of Object.entries({input_preis_strom:'1', input_preis_gas:'.05', input_pv_kwp:'2'})) {
            d.getElementById(id).value = value;
            d.getElementById(id).dataset.userEdited = 'true';
        }
        await w.calculateAll();
        assert.deepEqual(errors, []);
        const wp = w._scenarios[2];
        assert.ok(wp.savings < 0);
        assert.equal(wp.simplePaybackYears, null);
        assert.ok(d.getElementById('results').textContent.includes('Keine einfache Amortisation'));
        near(wp.pvKwp, 2);
        near(wp.batteryCost, wp.storageKwh * 750);
        assert.ok(wp.storageKwh < 15);
    } finally {dom.window.close();}
});
