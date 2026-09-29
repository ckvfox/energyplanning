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
        state.appendChild(element('h4', `Programme im Bundesland ${bundesland}`));
        if (result.statePrograms.length === 0) {
            state.appendChild(element('p', `Für ${bundesland} sind derzeit keine spezifischen Landesprogramme gespeichert.`));
        } else {
            result.statePrograms.forEach((program) => {
                const entry = element('div', '', 'subsidy-entry');
                const title = element('strong', String(program.title || 'Förderprogramm'));
                entry.appendChild(title);
                if (program.type) entry.appendChild(document.createTextNode(` (${program.type})`));
                entry.appendChild(element('p', String(program.description || '')));
                if (program.link_portal) {
                    const link = element('a', 'Zum Förderportal');
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
