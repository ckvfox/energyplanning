(function () {
    'use strict';

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function nonnegative(value) {
        if (!Number.isFinite(value) || value < 0) throw new RangeError('Energy inputs must be finite and nonnegative');
        return value;
    }

    function normalize(values) {
        const sum = values.reduce((a, b) => a + b, 0);
        return values.map((value) => value / sum);
    }

    // Synthetic profiles, not measured weather or household data. All profiles are normalized.
    const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const pvMonths = normalize([3, 5, 11, 13, 14, 13, 12, 11, 9, 6, 2.5, 1.5]);
    const heatMonths = normalize([18, 15, 13, 8, 4, 1, 1, 1, 4, 9, 12, 14]);
    const acMonths = normalize([0, 0, 0, 0, 1, 2, 3, 3, 1, 0, 0, 0]);
    const householdHours = normalize([1, 1, 1, 1, 1, 2, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 3, 4, 4, 4, 3, 3, 2, 1]);
    const evHours = normalize(Array.from({length: 24}, (_, h) => h >= 18 || h < 6 ? 1 : 0));
    const acHours = normalize(Array.from({length: 24}, (_, h) => h >= 12 && h <= 20 ? 1 : 0));

    function estimateEnergyBalance({pvKwp, batteryKwh, annualLoadKwh, pvYieldPerKwp,
        hasEv = false, evLoadKwh = 0, heatpumpLoadKwh = 0, airconLoadKwh = 0}) {
        [pvKwp, batteryKwh, annualLoadKwh, pvYieldPerKwp, evLoadKwh, heatpumpLoadKwh, airconLoadKwh].forEach(nonnegative);
        const evLoad = hasEv ? evLoadKwh : 0;
        const householdLoad = annualLoadKwh - evLoad - heatpumpLoadKwh - airconLoadKwh;
        if (householdLoad < -1e-8) throw new RangeError('Load components exceed annual demand');
        const generation = pvKwp * pvYieldPerKwp;
        const usableCapacity = batteryKwh * 0.7;
        const efficiency = 0.85; // All round-trip loss is assigned to discharge.
        let stored = 0; // No free initial battery energy; year-end inventory is accounted for.
        const totals = {pvGeneration: 0, directSelf: 0, batteryCharged: 0, batteryDelivered: 0,
            batteryLosses: 0, selfUse: 0, gridImport: 0, feedIn: 0, evFromBattery: 0,
            annualLoad: 0, heatpumpSelfUse: 0};
        const monthly = [];
        const daily = {summer: [], winter: []};
        for (let month = 0; month < 12; month++) {
            const row = {month, pv: 0, consumption: 0, selfConsumption: 0, gridImport: 0, feedIn: 0, batteryLosses: 0, storageChange: 0};
            const startStored = stored;
            const daylight = [8, 10, 12, 14, 16, 17, 16, 14, 12, 10, 8, 7][month];
            const pvHours = normalize(Array.from({length: 24}, (_, h) =>
                Math.max(0, Math.cos((h + 0.5 - 12) * Math.PI / daylight)) *
                (Math.abs(h + 0.5 - 12) < daylight / 2 ? 1 : 0)));
            for (let day = 0; day < daysPerMonth[month]; day++) {
                for (let hour = 0; hour < 24; hour++) {
                    const pv = generation * pvMonths[month] / daysPerMonth[month] * pvHours[hour];
                    const ev = evLoad / 365 * evHours[hour];
                    const hp = heatpumpLoadKwh * heatMonths[month] / daysPerMonth[month] / 24;
                    const load = Math.max(0, householdLoad) / 365 * householdHours[hour] + ev + hp +
                        airconLoadKwh * acMonths[month] / daysPerMonth[month] * acHours[hour];
                    const direct = Math.min(load, pv);
                    const charged = Math.min(pv - direct, Math.max(0, usableCapacity - stored));
                    stored += charged;
                    const delivered = Math.min(load - direct, stored * efficiency);
                    const losses = delivered / efficiency - delivered;
                    stored = Math.max(0, stored - delivered / efficiency);
                    const self = direct + delivered;
                    const grid = Math.max(0, load - self);
                    const feed = Math.max(0, pv - direct - charged);
                    totals.pvGeneration += pv;
                    totals.directSelf += direct;
                    totals.batteryCharged += charged;
                    totals.batteryDelivered += delivered;
                    totals.batteryLosses += losses;
                    totals.selfUse += self;
                    totals.gridImport += grid;
                    totals.feedIn += feed;
                    totals.annualLoad += load;
                    // Shared hourly supply is allocated proportionally to simultaneous loads.
                    totals.evFromBattery += load > 0 ? delivered * ev / load : 0;
                    totals.heatpumpSelfUse += load > 0 ? self * hp / load : 0;
                    row.pv += pv;
                    row.consumption += load;
                    row.selfConsumption += self;
                    row.gridImport += grid;
                    row.feedIn += feed;
                    row.batteryLosses += losses;
                    if (day === 14 && (month === 0 || month === 6)) {
                        daily[month === 0 ? 'winter' : 'summer'].push({hour, pv, load,
                            selfConsumption: self, gridImport: grid, feedIn: feed,
                            batteryLosses: losses, batteryStored: stored});
                    }
                }
            }
            row.storageChange = stored - startStored;
            monthly.push(row);
        }
        return {...totals, pvGeneration: generation, annualLoad: annualLoadKwh, storageChange: stored, monthly, daily,
            autarky: annualLoadKwh > 0 ? totals.selfUse / annualLoadKwh * 100 : 0,
            heatpumpAutarky: heatpumpLoadKwh > 0 ? totals.heatpumpSelfUse / heatpumpLoadKwh * 100 : 0};
    }

    function projectSavings({electricity, gas, fuel = 0, feedIn = 0,
        electricityRate = 0, gasRate = 0, fuelRate = 0, feedInRate = 0, years = 20}) {
        let sum = 0;
        for (let n = 0; n < years; n++) {
            sum += electricity * (1 + electricityRate) ** n + gas * (1 + gasRate) ** n +
                fuel * (1 + fuelRate) ** n + feedIn * (1 + feedInRate) ** n;
        }
        return sum;
    }

    window.EnergyCalculationCore = {clamp, estimateEnergyBalance, projectSavings};
}());
