/**
 * tests.js - Unit Tests für Energy Calculator Berechnungen
 * 
 * Test-Suite für:
 * - Energiebilanzen
 * - Kostenberechnungen
 * - PV/Batterie-Dimensionierung
 */

// Einfaches Test-Framework (ohne externe Dependencies)
class TestRunner {
    constructor(name) {
        this.name = name;
        this.tests = [];
        this.results = { passed: 0, failed: 0 };
    }

    test(name, fn) {
        this.tests.push({ name, fn });
    }

    async run() {
        console.log(`\n📋 Running test suite: ${this.name}\n`);
        
        for (const test of this.tests) {
            try {
                await test.fn();
                this.results.passed++;
                console.log(`✅ ${test.name}`);
            } catch (err) {
                this.results.failed++;
                console.error(`❌ ${test.name}`);
                console.error(`   Error: ${err.message}`);
            }
        }

        console.log(`\n📊 Results: ${this.results.passed} passed, ${this.results.failed} failed\n`);
        return this.results.failed === 0;
    }
}

// Assertion Helpers
function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
}

function assertAlmostEqual(actual, expected, tolerance = 0.01, message) {
    const diff = Math.abs(actual - expected);
    if (diff > tolerance) {
        throw new Error(message || `Expected ${expected} ±${tolerance}, got ${actual}`);
    }
}

function assertThrows(fn, message) {
    try {
        fn();
        throw new Error(message || 'Expected function to throw');
    } catch (err) {
        // Expected
    }
}

// ========== TEST SUITES ==========

const energyBalanceTests = new TestRunner('Energy Balance Calculations');

energyBalanceTests.test('Basic energy balance without battery', () => {
    const result = estimateEnergyBalance({
        pvKwp: 5,
        batteryKwh: 0,
        annualLoadKwh: 5000,
        pvYieldPerKwp: 850
    });

    assert(result.pvGeneration === 4250, `PV generation should be 5 * 850 = 4250, got ${result.pvGeneration}`);
    assert(result.selfUse > 0, 'Self-use should be positive');
    assert(result.selfUse < result.pvGeneration, 'Self-use should be less than PV generation');
});

energyBalanceTests.test('Energy balance with battery', () => {
    const result = estimateEnergyBalance({
        pvKwp: 10,
        batteryKwh: 5,
        annualLoadKwh: 6000,
        pvYieldPerKwp: 850
    });

    assert(result.batteryDelivered > 0, 'Battery should deliver energy');
    assert(result.selfUse > 0, 'Self-use should be positive');
    assertAlmostEqual(result.autarky, result.selfUse / 6000 * 100, 1, 'Autarky calculation should be correct');
});

energyBalanceTests.test('Energy balance with heatpump', () => {
    const resultWithHP = estimateEnergyBalance({
        pvKwp: 8,
        batteryKwh: 6,
        annualLoadKwh: 12000, // Mit Wärmepumpe
        pvYieldPerKwp: 850,
        hasHeatpump: true
    });

    const resultWithoutHP = estimateEnergyBalance({
        pvKwp: 8,
        batteryKwh: 6,
        annualLoadKwh: 6000,
        pvYieldPerKwp: 850,
        hasHeatpump: false
    });

    assert(resultWithHP.selfUse > 0, 'Heatpump case should have self-use');
    assert(resultWithoutHP.selfUse > 0, 'Non-heatpump case should have self-use');
});

energyBalanceTests.test('Autarky cannot exceed 100%', () => {
    const result = estimateEnergyBalance({
        pvKwp: 20,
        batteryKwh: 10,
        annualLoadKwh: 2000, // Very low load
        pvYieldPerKwp: 850
    });

    assert(result.autarky <= 100, `Autarky should not exceed 100%, got ${result.autarky}`);
});

energyBalanceTests.test('Grid import decreases with more PV/battery', () => {
    const resultSmallPV = estimateEnergyBalance({
        pvKwp: 3,
        batteryKwh: 0,
        annualLoadKwh: 5000,
        pvYieldPerKwp: 850
    });

    const resultLargePV = estimateEnergyBalance({
        pvKwp: 10,
        batteryKwh: 8,
        annualLoadKwh: 5000,
        pvYieldPerKwp: 850
    });

    assert(resultLargePV.gridImport < resultSmallPV.gridImport, 'Larger PV/battery should reduce grid import');
});

// ========== COST CALCULATION TESTS ==========

const costCalculationTests = new TestRunner('Cost Calculations');

costCalculationTests.test('Basic cost calculation', () => {
    const pvCost = 5 * 1600; // 5 kWp @ €1600
    assert(pvCost === 8000, `PV cost should be €8000, got €${pvCost}`);

    const batteryCost = 6 * 550; // 6 kWh @ €550
    assert(batteryCost === 3300, `Battery cost should be €3300, got €€${batteryCost}`);

    const totalCost = pvCost + batteryCost;
    assert(totalCost === 11300, `Total cost should be €11300, got €${totalCost}`);
});

costCalculationTests.test('Cost calculation with zero values', () => {
    const pvCost = 0 * 1600;
    assert(pvCost === 0, 'Zero PV should have zero cost');

    const batteryCost = 0 * 550;
    assert(batteryCost === 0, 'Zero battery should have zero cost');
});

costCalculationTests.test('Cost scales linearly with size', () => {
    const smallCost = 5 * 1600;
    const largeCost = 10 * 1600;

    assert(largeCost === smallCost * 2, 'Double size should double cost');
});

// ========== UTILITY FUNCTION TESTS ==========

const utilityTests = new TestRunner('Utility Functions');

utilityTests.test('clamp function', () => {
    assert(clamp(5, 0, 10) === 5, 'clamp(5, 0, 10) should be 5');
    assert(clamp(-5, 0, 10) === 0, 'clamp(-5, 0, 10) should be 0');
    assert(clamp(15, 0, 10) === 10, 'clamp(15, 0, 10) should be 10');
    assert(clamp(0, 0, 10) === 0, 'clamp(0, 0, 10) should be 0');
    assert(clamp(10, 0, 10) === 10, 'clamp(10, 0, 10) should be 10');
});

utilityTests.test('roofPvLimit function', () => {
    assert(roofPvLimit(70) === 10, 'roofPvLimit(70) should be 10 kWp');
    assert(roofPvLimit(35) === 5, 'roofPvLimit(35) should be 5 kWp');
    assert(roofPvLimit(100) === 14, 'roofPvLimit(100) should be 14 kWp');
    assert(roofPvLimit(0) === 0, 'roofPvLimit(0) should be 0');
});

utilityTests.test('formatNumber function', () => {
    // Note: This test assumes formatNumber exists and uses German locale
    const formatted = formatNumber(1234.567, 2);
    assert(typeof formatted === 'string', 'formatNumber should return string');
});

// ========== CACHING TESTS ==========

const cachingTests = new TestRunner('Caching System');

cachingTests.test('Cache stores and retrieves values', () => {
    const cache = new ResultCache('test-cache');
    const params = { pvKwp: 5, batteryKwh: 3 };
    const result = { selfUse: 2500, gridImport: 2500 };

    cache.set(params, result);
    const retrieved = cache.get(params);

    assert(retrieved !== null, 'Cache should retrieve stored value');
    assertEqual(retrieved.selfUse, result.selfUse, 'Cached value should match');
    
    cache.clear();
});

cachingTests.test('Cache key generation is consistent', () => {
    const cache = new ResultCache('test-cache');
    const params1 = { a: 1, b: 2 };
    const params2 = { b: 2, a: 1 }; // Different order

    const key1 = cache.generateKey(params1);
    const key2 = cache.generateKey(params2);

    assertEqual(key1, key2, 'Cache keys should be identical regardless of parameter order');
    
    cache.clear();
});

cachingTests.test('Cache miss returns null', () => {
    const cache = new ResultCache('test-cache');
    const params = { pvKwp: 99, batteryKwh: 99 };

    const result = cache.get(params);
    assert(result === null, 'Cache should return null on miss');
    
    cache.clear();
});

// ========== DEBOUNCING TESTS ==========

const debounceTests = new TestRunner('Debouncing');

debounceTests.test('Debounce delays function execution', async () => {
    let callCount = 0;
    const increment = debounce(() => callCount++, 100);

    increment();
    increment();
    increment();

    assert(callCount === 0, 'Function should not be called immediately');

    await new Promise(resolve => setTimeout(resolve, 150));
    assert(callCount === 1, 'Function should be called exactly once after debounce');
});

debounceTests.test('Debounce resets timer on new call', async () => {
    let callCount = 0;
    const increment = debounce(() => callCount++, 100);

    increment();
    await new Promise(resolve => setTimeout(resolve, 50));
    increment();
    await new Promise(resolve => setTimeout(resolve, 50));
    increment();
    
    assert(callCount === 0, 'Function should not be called during debounce window');

    await new Promise(resolve => setTimeout(resolve, 150));
    assert(callCount === 1, 'Function should be called once after final debounce');
});

// ========== RUN ALL TESTS ==========

async function runAllTests() {
    const suites = [
        energyBalanceTests,
        costCalculationTests,
        utilityTests,
        cachingTests,
        debounceTests
    ];

    let totalPassed = 0;
    let totalFailed = 0;

    for (const suite of suites) {
        await suite.run();
        totalPassed += suite.results.passed;
        totalFailed += suite.results.failed;
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`🎯 TOTAL: ${totalPassed} passed, ${totalFailed} failed`);
    console.log(`${'='.repeat(50)}\n`);

    return totalFailed === 0;
}

// Export für Browser & Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        TestRunner,
        assert,
        assertEqual,
        assertAlmostEqual,
        assertThrows,
        runAllTests
    };
}
