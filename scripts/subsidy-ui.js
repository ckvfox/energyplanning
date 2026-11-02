(function () {
    'use strict';

    function element(tag, text, className) {
        const node = document.createElement(tag);
        if (text) node.textContent = text;
        if (className) node.className = className;
        return node;
    }

    function renderSubsidies(container, result, bundesland) {
        const fragment = document.createDocumentFragment();
        const national = element('div', '', 'subsidy-static');
        national.appendChild(element('h4', 'Bundesweite Hinweise'));
        const list = element('ul');
        result.baseMessages.forEach((message) => list.appendChild(element('li', message)));
        national.appendChild(list);
        fragment.appendChild(national);

        const state = element('div', '', 'subsidy-dynamic');
        state.appendChild(element('h4', `Förderhinweise für ${bundesland}`));
        if (result.statePrograms.length === 0) {
            state.appendChild(element('p', `Für ${bundesland} sind derzeit keine spezifischen Landesprogramme gespeichert.`));
        } else {
            const seen = new Set();
            result.statePrograms.forEach((program) => {
                // Legacy entries have no ID; their hidden descriptions must not create duplicate cards.
                const key = program.program_id || JSON.stringify([
                    String(program.title || '').trim().toLocaleLowerCase('de'),
                    program.type || '', program.link_portal || ''
                ]);
                if (seen.has(key)) return;
                seen.add(key);
                const entry = element('div', '', 'subsidy-entry');
                const title = element('strong', String(program.title || 'Förderprogramm'));
                entry.appendChild(title);
                if (program.type) entry.appendChild(document.createTextNode(` (${program.type})`));
                const reviewed = program.verification_status === 'reviewed' && program.last_checked;
                entry.appendChild(element('p', reviewed
                    ? `${program.funding_type} · Quellenprüfung: ${program.last_checked}; vor Antrag erneut prüfen.`
                    : 'Unbestätigt: Aktualität und Förderfähigkeit sind nicht ausreichend geprüft. Nicht als Förderzusage verwenden.'));
                if (reviewed && (Date.now() - Date.parse(program.last_checked)) > 180 * 86400000) {
                    entry.appendChild(element('p', 'Quellenprüfung älter als 180 Tage: Aktualität erneut bestätigen.'));
                }
                if (reviewed) {
                    entry.appendChild(element('p', String(program.description || '')));
                    entry.appendChild(element('p', `Voraussetzungen: ${program.eligibility || ''}`));
                }
                if (program.link_portal) {
                    const link = element('a', reviewed ? 'Zur offiziellen Programmseite' : 'Zur weiteren Recherche');
                    link.href = String(program.link_portal);
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    entry.appendChild(link);
                }
                state.appendChild(entry);
            });
        }
        fragment.appendChild(state);
        container.replaceChildren(fragment);
    }

    window.EnergySubsidyUI = { renderSubsidies };
}());
