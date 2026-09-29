(function () {
    'use strict';
    document.addEventListener('DOMContentLoaded', () => {
        const button = document.getElementById('exportPdfBtn');
        if (!button) return;
        button.addEventListener('click', () => window.print());
    });
}());
