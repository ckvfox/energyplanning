/**
 * performance.js - Performance Optimierungen für Energy Calculator
 * 
 * Enthält:
 * - Result Caching (localStorage)
 * - Input Debouncing
 * - Lazy Loading für Subsidy-Daten
 */

// ========== CACHING SYSTEM ==========

class ResultCache {
    constructor(storageKey = 'energyCalcCache', maxSize = 50) {
        this.storageKey = storageKey;
        this.maxSize = maxSize;
        this.memoryCache = new Map();
    }

    /**
     * Generiert einen eindeutigen Cache-Key aus den Eingabeparametern
     */
    generateKey(params) {
        const sorted = Object.keys(params)
            .sort()
            .reduce((acc, key) => {
                acc[key] = params[key];
                return acc;
            }, {});
        return JSON.stringify(sorted);
    }

    /**
     * Holt einen Wert aus dem Cache
     */
    get(params) {
        const key = this.generateKey(params);
        
        // Erst Memory-Cache prüfen (schneller)
        if (this.memoryCache.has(key)) {
            return this.memoryCache.get(key);
        }

        // Dann localStorage prüfen
        try {
            const data = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
            if (data[key]) {
                // Zurück in Memory-Cache laden
                this.memoryCache.set(key, data[key]);
                return data[key];
            }
        } catch (err) {
            console.warn('Cache read error:', err);
        }

        return null;
    }

    /**
     * Speichert einen Wert im Cache
     */
    set(params, result) {
        const key = this.generateKey(params);

        // Memory-Cache updaten
        this.memoryCache.set(key, result);

        // localStorage updaten (mit Size-Limit)
        try {
            let data = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
            data[key] = result;

            // Alte Einträge entfernen wenn Max-Size überschritten
            if (Object.keys(data).length > this.maxSize) {
                const keys = Object.keys(data);
                data = keys.slice(-this.maxSize).reduce((acc, k) => {
                    acc[k] = data[k];
                    return acc;
                }, {});
            }

            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (err) {
            console.warn('Cache write error:', err);
            // Fehler nicht werfen - Cache ist optional
        }
    }

    /**
     * Löscht den Cache
     */
    clear() {
        this.memoryCache.clear();
        try {
            localStorage.removeItem(this.storageKey);
        } catch (err) {
            console.warn('Cache clear error:', err);
        }
    }

    /**
     * Gibt Cache-Größe zurück (für Debugging)
     */
    getSize() {
        return this.memoryCache.size;
    }
}

// Globale Cache-Instanz
const resultCache = new ResultCache();

// ========== DEBOUNCING ==========

/**
 * Debounce-Funktion: verzögert Ausführung bis nach Verzögerung keine neuen Calls kommen
 * Optimiert UI-Updates bei schnellen Input-Änderungen
 */
function debounce(func, wait = 300) {
    let timeout;
    let lastCall = 0;

    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            lastCall = Date.now();
            func.apply(this, args);
        };

        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle-Funktion: Führt maximal einmal pro Intervall aus
 * Optimiert für Fenster-Resize oder Scroll-Events
 */
function throttle(func, limit = 300) {
    let inThrottle;

    return function executedFunction(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ========== REQUEST IDEMPOTENZ ==========

/**
 * Dedupliziert gleichzeitige Anfragen (z.B. mehrfache Berechnung)
 */
class RequestDeduplicator {
    constructor() {
        this.pending = new Map();
    }

    /**
     * Führt eine Funktion aus, dedupliziert gleichzeitige Calls
     */
    async execute(key, fn) {
        if (this.pending.has(key)) {
            return this.pending.get(key);
        }

        const promise = Promise.resolve(fn()).finally(() => {
            this.pending.delete(key);
        });

        this.pending.set(key, promise);
        return promise;
    }

    clear() {
        this.pending.clear();
    }
}

const requestDeduplicator = new RequestDeduplicator();

// ========== LAZY LOADING ==========

/**
 * Lädt Subsidy-Daten nur wenn nötig (z.B. beim Scrollen zu Results)
 */
class LazySubsidyLoader {
    constructor() {
        this.loaded = false;
        this.data = null;
    }

    /**
     * Lädt Subsidy-Daten bei Bedarf
     */
    async load() {
        if (this.loaded) {
            return this.data;
        }

        try {
            const response = await fetch('data/subsidies.json');
            this.data = await response.json();
            this.loaded = true;
            return this.data;
        } catch (err) {
            console.error('Subsidy loading error:', err);
            this.data = { kfw: [], bafa: [] };
            this.loaded = true;
            return this.data;
        }
    }

    clear() {
        this.loaded = false;
        this.data = null;
    }
}

const lazySubsidyLoader = new LazySubsidyLoader();

// ========== INTERSECTION OBSERVER FÜR LAZY LOADING ==========

/**
 * Triggert Subsidy-Laden wenn Results-Container sichtbar wird
 */
function initializeSubsidyLazyLoading() {
    const resultContainer = document.getElementById('result');
    if (!resultContainer) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !lazySubsidyLoader.loaded) {
                lazySubsidyLoader.load().catch(err => {
                    console.error('Failed to load subsidies:', err);
                });
            }
        });
    }, { threshold: 0.1 });

    observer.observe(resultContainer);
}

// ========== WINDOW RESIZE OPTIMIZATION ==========

/**
 * Optimiert Chart-Resize auf Fenster-Resize
 */
function createThrottledResizeListener(callback) {
    return throttle(callback, 500);
}

// Exportieren für script.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ResultCache,
        resultCache,
        debounce,
        throttle,
        RequestDeduplicator,
        requestDeduplicator,
        LazySubsidyLoader,
        lazySubsidyLoader,
        initializeSubsidyLazyLoading,
        createThrottledResizeListener
    };
}
