(function () {
    'use strict';

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function estimateEnergyBalance({ pvKwp, batteryKwh, annualLoadKwh, pvYieldPerKwp, hasEv = false, evLoadKwh = 0 }) {
        const roundtripEff = 0.85;
        const pvGeneration = Math.max(0, pvKwp) * pvYieldPerKwp;
        const directShare = batteryKwh > 0 ? 0.45 : 0.35;
        const directSelf = Math.min(annualLoadKwh * directShare, pvGeneration * 0.9);
        const pvSurplus = Math.max(pvGeneration - directSelf, 0);
        let batteryDelivered = 0;
        if (batteryKwh > 0) {
            const annualUsablePv = batteryKwh * 0.7 * 365;
            batteryDelivered = Math.min(pvSurplus, annualUsablePv) * roundtripEff;
        }
        const selfUse = Math.min(annualLoadKwh, directSelf + batteryDelivered);
        return {
            pvGeneration,
            directSelf,
            batteryDelivered,
            selfUse,
            gridImport: Math.max(0, annualLoadKwh - selfUse),
            feedIn: Math.max(0, pvGeneration - selfUse),
            autarky: annualLoadKwh > 0 ? (selfUse / annualLoadKwh) * 100 : 0,
            evFromBattery: hasEv && batteryKwh > 0 ? Math.round(Math.min(evLoadKwh * 0.5, batteryDelivered * 0.4)) : 0
        };
    }

    window.EnergyCalculationCore = { clamp, estimateEnergyBalance };
}());
