(function () {
    'use strict';
    let yearChartInstance = null;
    let dayChartInstance = null;

    function render(canvasId, data, title, colors, dayMode) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || !Array.isArray(data) || data.length === 0) return;
        const current = dayMode ? dayChartInstance : yearChartInstance;
        if (current) current.destroy();
        const keys = dayMode ? ['pv', 'load', 'selfConsumption', 'gridImport'] : ['pv', 'consumption', 'selfConsumption', 'gridImport'];
        const maxValue = Math.max(...data.flatMap((row) => keys.map((key) => Number(row[key]))));
        const step = dayMode ? 0.5 : 250;
        const factor = dayMode ? 1.2 : 1.15;
        const minimum = dayMode ? 1.5 : 750;
        const yMax = Math.max(minimum, Number.isFinite(maxValue) ? Math.ceil((maxValue * factor) / step) * step : 0);
        const chart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top' }, title: { display: true, text: `Szenario: ${title || '-'}`, font: { size: 16 } } },
                scales: { y: { beginAtZero: true, max: yMax, ticks: { stepSize: step, precision: dayMode ? 1 : 0 } } }
            },
            data: {
                labels: dayMode ? data.map((row) => row.hour) : ['Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
                datasets: dayMode
                    ? [
                        { label: 'PV', data: data.map((row) => row.pv), borderColor: colors.pv, borderWidth: 2 },
                        { label: 'Last', data: data.map((row) => row.load), borderColor: colors.load, borderWidth: 2 },
                        { label: 'Eigenverbrauch', data: data.map((row) => row.selfConsumption), borderColor: colors.eigenverbrauch, borderWidth: 2 },
                        { label: 'Netzbezug', data: data.map((row) => row.gridImport), borderColor: colors.netzbezug, borderWidth: 2 }
                    ]
                    : [
                        { label: 'PV', data: data.map((row) => row.pv), borderColor: colors.pv, borderWidth: 2 },
                        { label: 'Verbrauch', data: data.map((row) => row.consumption), borderColor: colors.consumption, borderWidth: 2 },
                        { label: 'Eigenverbrauch', data: data.map((row) => row.selfConsumption), borderColor: colors.selfConsumption, borderWidth: 2 },
                        { label: 'Netzbezug', data: data.map((row) => row.gridImport), borderColor: colors.gridImport, borderWidth: 2 }
                    ]
            }
        });
        if (dayMode) dayChartInstance = chart;
        else yearChartInstance = chart;
    }

    window.EnergyChartUI = {
        renderYearChart: (data, title, colors) => render('yearChart', data, title, colors, false),
        renderDayChart: (data, title, colors) => render('dayChart', data, title, colors, true),
        resizeAll: () => {
            if (yearChartInstance) yearChartInstance.resize();
            if (dayChartInstance) dayChartInstance.resize();
        }
    };
}());
