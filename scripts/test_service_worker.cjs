/* Offline worker regressions: no browser, network or third-party dependencies. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const source = readFileSync(require('node:path').join(__dirname, '../service-worker.js'), 'utf8');

function setup(options = {}) {
    const listeners = {};
    const puts = [];
    const deleted = [];
    const cache = {
        addAll: async () => {},
        put: async (request) => {
            if (options.cacheFailure) throw new Error('Quota exceeded');
            puts.push(request.url);
        },
        match: async (request) => options.entries?.get(request.url || request),
    };
    const response = { ok: true, type: 'basic', redirected: false, clone() { return this; } };
    let fetches = 0;
    let claimed = false;
    vm.runInNewContext(source, {
        URL,
        self: {
            location: { origin: 'https://energyplanning.great-site.net' },
            addEventListener: (name, callback) => { listeners[name] = callback; },
            skipWaiting: async () => {},
            clients: { claim: async () => { claimed = true; } },
        },
        caches: {
            open: async () => cache,
            keys: async () => ['energyplanning-v2', 'energyplanning-v3', 'another-app'],
            delete: async (key) => { deleted.push(key); },
        },
        fetch: async () => {
            fetches++;
            if (options.offline) throw new Error('Offline');
            return options.response || response;
        },
    });
    function dispatch(request) {
        let result;
        const pending = [];
        listeners.fetch({
            request: { method: 'GET', mode: 'cors', ...request },
            respondWith: (promise) => { result = promise; },
            waitUntil: (promise) => pending.push(promise),
        });
        return { get result() { return result; }, pending };
    }
    return { listeners, dispatch, puts, deleted, response,
        fetches: () => fetches, claimed: () => claimed };
}

test('CDN, extension and non-GET requests bypass the worker entirely', () => {
    const worker = setup();
    for (const request of [
        { url: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js' },
        { url: 'chrome-extension://example/script.js' },
        { url: 'https://energyplanning.great-site.net/', method: 'POST' },
    ]) assert.equal(worker.dispatch(request).result, undefined);
    assert.equal(worker.fetches(), 0);
});

test('successful own responses are cached with a tracked lifetime', async () => {
    const worker = setup();
    const event = worker.dispatch({ url: 'https://energyplanning.great-site.net/data/data.json' });
    assert.equal(await event.result, worker.response);
    await Promise.all(event.pending);
    assert.equal(worker.puts.length, 1);
});

test('cache quota errors never reject network success or background work', async () => {
    const worker = setup({ cacheFailure: true });
    const event = worker.dispatch({ url: 'https://energyplanning.great-site.net/style.css' });
    assert.equal(await event.result, worker.response);
    await Promise.all(event.pending);
});

test('error, opaque and redirected responses are not cached', async () => {
    for (const attributes of [{ ok: false }, { type: 'opaque' }, { redirected: true }]) {
        const response = { ok: true, type: 'basic', redirected: false, ...attributes };
        const worker = setup({ response });
        const event = worker.dispatch({ url: 'https://energyplanning.great-site.net/' });
        assert.equal(await event.result, response);
        assert.equal(event.pending.length, 0);
    }
});

test('offline navigation can use the shell but missing scripts and JSON cannot', async () => {
    const shell = { page: 'shell' };
    const worker = setup({ offline: true, entries: new Map([['./', shell]]) });
    assert.equal(await worker.dispatch({ url: 'https://energyplanning.great-site.net/', mode: 'navigate' }).result, shell);
    for (const path of ['scripts/script.js', 'data/data.json']) {
        await assert.rejects(worker.dispatch({ url: `https://energyplanning.great-site.net/${path}` }).result, /Offline/);
    }
});

test('offline assets use their own cached response', async () => {
    const url = 'https://energyplanning.great-site.net/style.css';
    const css = { asset: 'stylesheet' };
    const worker = setup({ offline: true, entries: new Map([[url, css]]) });
    assert.equal(await worker.dispatch({ url }).result, css);
});

test('activation retires only old EnergyPlanning caches and claims after cleanup', async () => {
    const worker = setup();
    const pending = [];
    worker.listeners.activate({ waitUntil: (promise) => pending.push(promise) });
    assert.equal(worker.claimed(), false);
    await Promise.all(pending);
    assert.deepEqual(worker.deleted, ['energyplanning-v2']);
    assert.equal(worker.claimed(), true);
});
