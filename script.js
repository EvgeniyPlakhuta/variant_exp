// ===== Логические схемы — тренажёр (Физика 10 класс) =====

// ==== Состояние ====
const state = {
    components: [],
    nextId: 1,
    nextNode: 1,
    selectedId: null,
    wires: [],
    lastGraph: null,
    liveNodes: []
};

let wireModeActive = false;
let wireStart = null;
let wirePreviewEl = null;
let currentLevel = 1;
let currentTaskIndex = 0;

// ==== DOM элементы ====
const gridArea = document.getElementById('gridArea');
const checkBtn = document.getElementById('checkBtn');
const clearBtn = document.getElementById('clearBtn');
const analysisContent = document.getElementById('analysisContent');
const propertiesPanel = document.getElementById('propertiesPanel');
const truthTableEl = document.getElementById('truthTable');

// ==== Компоненты (фабрики) ====
const COMPONENT_DEFS = {
    battery: {
        label: 'Батарея (9В)',
        create: () => ({
            type: 'battery',
            id: state.nextId++,
            label: '9В',
            connections: [
                { id: state.nextNode++, x: -22, y: 0, role: 'positive' },
                { id: state.nextNode++, x: 22, y: 0, role: 'negative' }
            ]
        })
    },
    bulb: {
        label: 'Лампочка',
        create: () => ({
            type: 'bulb',
            id: state.nextId++,
            label: 'Лампа',
            lit: false,
            connections: [
                { id: state.nextNode++, x: -20, y: 0 },
                { id: state.nextNode++, x: 20, y: 0 }
            ]
        })
    },
    switch: {
        label: 'Выключатель',
        varCounter: { count: 0 },
        create: () => {
            const n = (COMPONENT_DEFS.switch.varCounter.count += 1);
            return {
                type: 'switch',
                id: state.nextId++,
                label: String.fromCharCode(64 + n),
                variable: String.fromCharCode(64 + n),
                closed: false,
                connections: [
                    { id: state.nextNode++, x: -20, y: 0 },
                    { id: state.nextNode++, x: 20, y: 0 }
                ]
            };
        }
    },
    resistor: {
        label: 'Резистор',
        create: () => ({
            type: 'resistor',
            id: state.nextId++,
            label: 'R',
            connections: [
                { id: state.nextNode++, x: -20, y: 0 },
                { id: state.nextNode++, x: 20, y: 0 }
            ]
        })
    },
    junction: {
        label: 'Узел',
        create: () => ({
            type: 'junction',
            id: state.nextId++,
            label: '•',
            connections: [
                { id: state.nextNode++, x: 0, y: 0 },
                { id: state.nextNode++, x: 0, y: -20 },
                { id: state.nextNode++, x: -20, y: 0 },
                { id: state.nextNode++, x: 20, y: 0 }
            ]
        })
    }
};

// ==== Рендер компонентов ====
function renderComponent(comp) {
    const el = document.createElement('div');
    el.className = 'circuit-component';
    el.dataset.id = comp.id;
    el.style.left = comp.x + 'px';
    el.style.top = comp.y + 'px';

    switch (comp.type) {
        case 'battery':
            el.innerHTML = `<div class="comp comp-battery">
                <div class="btk-term term-plus">+</div>
                <div class="btk-body"></div>
                <div class="btk-term term-minus">−</div>
            </div><span class="comp-label">Батарея 9В</span>`;
            break;
        case 'bulb':
            el.innerHTML = `<div class="comp comp-bulb">
                <div class="bulb-glass"></div>
                <div class="bulb-base"></div>
            </div><span class="comp-label">Лампочка</span>`;
            break;
        case 'switch':
            el.innerHTML = `<div class="comp comp-switch">
                <div class="sw-label">${comp.variable}</div>
                <div class="sw-lever${comp.closed ? ' closed' : ''}"></div>
                <div class="sw-base">
                    <div class="sw-contact"></div>
                    <div class="sw-contact"></div>
                </div>
                <span class="sw-status">${comp.closed ? '1' : '0'}</span>
            </div><span class="comp-label">Выключатель ${comp.variable}</span>`;
            break;
        case 'resistor':
            el.innerHTML = `<div class="comp comp-resistor">
                <div class="rs-lead"></div>
                <div class="rs-body"></div>
                <div class="rs-lead"></div>
            </div><span class="comp-label">Резистор</span>`;
            break;
        case 'junction':
            el.innerHTML = `<div class="comp comp-junction"><div class="j-dot"></div></div><span class="comp-label">Узел</span>`;
            break;
    }

    el.addEventListener('click', () => selectComponent(comp.id));
    return el;
}

function updateComponentDOM(comp) {
    const wrapper = document.querySelector(`.circuit-component[data-id="${comp.id}"]`);
    if (!wrapper) return;

    if (comp.type === 'bulb') {
        wrapper.querySelector('.comp-bulb').classList.toggle('lit', !!comp.lit);
    }
    if (comp.type === 'switch') {
        const lever = wrapper.querySelector('.sw-lever');
        lever.classList.toggle('closed', comp.closed);
        const status = wrapper.querySelector('.sw-status');
        status.textContent = comp.closed ? '1' : '0';
    }
}

// ==== Drag & Drop ====
let draggedType = null;

function setupDragAndDrop() {
    document.querySelectorAll('.component[draggable]').forEach(comp => {
        comp.addEventListener('dragstart', (e) => {
            draggedType = comp.dataset.type;
            e.dataTransfer.setData('text/plain', comp.dataset.type);
            e.dataTransfer.effectAllowed = 'copy';
            comp.classList.add('dragging');
        });
        comp.addEventListener('dragend', () => {
            comp.classList.remove('dragging');
            clearMarker();
        });
    });

    gridArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        gridArea.classList.add('drag-over');
        showMarkerAtPoint(e.clientX, e.clientY);
    });

    gridArea.addEventListener('dragleave', (e) => {
        if (!gridArea.contains(e.relatedTarget)) {
            gridArea.classList.remove('drag-over');
            clearMarker();
        }
    });

    gridArea.addEventListener('drop', (e) => {
        e.preventDefault();
        gridArea.classList.remove('drag-over');
        clearMarker();
        if (!draggedType) return;
        const rect = gridArea.getBoundingClientRect();
        addComponent(draggedType, e.clientX - rect.left, e.clientY - rect.top);
        draggedType = null;
    });

    gridArea.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (wireModeActive) { handleWireClick(e); return; }

        const compEl = e.target.closest('.circuit-component');
        if (!compEl) return;
        const id = parseInt(compEl.dataset.id);
        selectComponent(id);

        const startX = e.clientX, startY = e.clientY;
        const comp = state.components.find(c => c.id === id);
        const origX = comp.x, origY = comp.y;

        const moveHandler = (ev) => {
            moveComponent(id, origX + (ev.clientX - startX), origY + (ev.clientY - startY));
        };
        const upHandler = () => {
            document.removeEventListener('mousemove', moveHandler);
            document.removeEventListener('mouseup', upHandler);
        };
        document.addEventListener('mousemove', moveHandler);
        document.addEventListener('mouseup', upHandler);
    });

    gridArea.addEventListener('dblclick', (e) => {
        const compEl = e.target.closest('.circuit-component');
        if (!compEl) return;
        const id = parseInt(compEl.dataset.id);
        const comp = state.components.find(c => c.id === id);
        if (comp && comp.type === 'switch') {
            toggleSwitch(id);
            analyzeCircuit(true);
        }
    });
}

// ==== Режим проводов ====
const wireStatus = document.getElementById('wireStatus');

function setWireStatus(text, cls = '') {
    if (!wireStatus) return;
    wireStatus.textContent = text;
    wireStatus.className = 'wire-status' + (cls ? ' ' + cls : '');
}

function toggleWireMode() {
    wireModeActive = !wireModeActive;
    wireStart = null;
    clearWirePreview();
    gridArea.classList.toggle('wire-mode-active', wireModeActive);
    const btn = document.getElementById('wireModeBtn');
    if (btn) {
        btn.classList.toggle('active', wireModeActive);
        btn.textContent = wireModeActive ? '✓ Готово' : '🖊 Провода';
    }
    gridArea.style.cursor = wireModeActive ? 'crosshair' : '';
    if (wireModeActive) {
        setWireStatus('🎯 Кликните по ПЕРВОЙ синей точке-контакту, затем по ВТОРОЙ. Клик по проводу — удалить. Esc — отмена.', 'active');
    } else {
        setWireStatus('🖊 Режим проводов выключен. Нажмите «Провода», чтобы соединить компоненты.', '');
    }
    renderConnections(state.lastGraph);
}

function contactAt(x, y, radius = 16) {
    let best = null, bestDist = radius;
    state.components.forEach(comp => {
        comp.connections.forEach(conn => {
            const cx = comp.x + conn.x, cy = comp.y + conn.y;
            const dist = Math.hypot(cx - x, cy - y);
            if (dist < bestDist) { bestDist = dist; best = { connId: conn.id, x: cx, y: cy, compId: comp.id }; }
        });
    });
    return best;
}

function wireExists(connA, connB) {
    return state.wires.some(w => (w.a === connA && w.b === connB) || (w.a === connB && w.b === connA));
}

function handleWireClick(e) {
    const rect = gridArea.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;

    const hitWire = state.wires.find(w => {
        const p1 = resolveWirePoint(w.a), p2 = resolveWirePoint(w.b);
        if (!p1 || !p2) return false;
        return pointToSegmentDistance(x, y, p1.x, p1.y, p2.x, p2.y) < 8;
    });
    if (hitWire) {
        state.wires = state.wires.filter(w => w !== hitWire);
        clearWirePreview();
        wireStart = null;
        analyzeCircuit(true);
        setWireStatus(`Провод удалён. Осталось: ${state.wires.length}.`, 'done');
        return;
    }

    const contact = contactAt(x, y);
    if (!contact) {
        wireStart = null;
        clearWirePreview();
        setWireStatus('Мимо точки! Кликните точно по жёлтому кружку-контакту.', 'active');
        renderConnections(state.lastGraph);
        return;
    }

    if (!wireStart) {
        wireStart = contact;
        startWirePreview(contact.x, contact.y);
        renderConnections(state.lastGraph);
        setWireStatus('Первая точка выбрана! Теперь кликните по ВТОРОЙ точке. Esc — отменить.', 'active');
        return;
    }

    if (wireStart.connId === contact.connId) {
        wireStart = null;
        clearWirePreview();
        setWireStatus('Та же точка. Кликните по ДРУГОЙ точке.', 'active');
        renderConnections(state.lastGraph);
        return;
    }

    if (!wireExists(wireStart.connId, contact.connId)) {
        state.wires.push({ a: wireStart.connId, b: contact.connId });
    } else {
        showToast('Провод между этими точками уже есть.');
    }
    wireStart = null;
    clearWirePreview();
    analyzeCircuit(true);
    setWireStatus(`Провод добавлен! Всего: ${state.wires.length}.`, 'done');
}

function resolveWirePoint(connId) {
    for (const comp of state.components) {
        const conn = comp.connections.find(c => c.id === connId);
        if (conn) return { x: comp.x + conn.x, y: comp.y + conn.y };
    }
    return null;
}

function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function startWirePreview(x, y) {
    clearWirePreview();
    wirePreviewEl = document.createElement('div');
    wirePreviewEl.className = 'preview-line';
    wirePreviewEl.style.left = x + 'px';
    wirePreviewEl.style.top = y + 'px';
    gridArea.appendChild(wirePreviewEl);
    document.addEventListener('mousemove', updateWirePreview);
}

function updateWirePreview(e) {
    if (!wireStart || !wirePreviewEl) return;
    const rect = gridArea.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const sx = wireStart.x, sy = wireStart.y;
    const angle = Math.atan2(y - sy, x - sx) * 180 / Math.PI;
    wirePreviewEl.style.left = Math.min(sx, x) + 'px';
    wirePreviewEl.style.top = Math.min(sy, y) + 'px';
    wirePreviewEl.style.width = Math.max(1, Math.hypot(x - sx, y - sy)) + 'px';
    wirePreviewEl.style.transform = `rotate(${angle}deg)`;
    wirePreviewEl.style.transformOrigin = '0 50%';
}

function stopWirePreviewTracking() { document.removeEventListener('mousemove', updateWirePreview); }
function clearWirePreview() {
    stopWirePreviewTracking();
    if (wirePreviewEl && wirePreviewEl.parentNode) wirePreviewEl.parentNode.removeChild(wirePreviewEl);
    wirePreviewEl = null;
}

// ==== Компоненты: действия ====
function addComponent(type, x, y) {
    const def = COMPONENT_DEFS[type];
    if (!def) return;
    const comp = def.create();
    comp.x = x;
    comp.y = y;
    snapComponent(comp);
    state.components.push(comp);

    const el = renderComponent(comp);
    el.style.left = comp.x + 'px';
    el.style.top = comp.y + 'px';
    gridArea.appendChild(el);

    updateDropHint();
    showToast(`${def.label} добавлен.`);
    analyzeCircuit(true);
}

function moveComponent(id, x, y) {
    const comp = state.components.find(c => c.id === id);
    if (!comp) return;
    comp.x = x;
    comp.y = y;
    const el = document.querySelector(`.circuit-component[data-id="${id}"]`);
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    clearPreviewLine();
    analyzeCircuit(true);
}

function snapComponent(comp) {
    const others = state.components.filter(c => c.id !== comp.id);
    if (others.length === 0) return;
    let best = null, bestDist = 90;
    comp.connections.forEach(conn => {
        const cx = comp.x + conn.x, cy = comp.y + conn.y;
        others.forEach(other => {
            other.connections.forEach(otherConn => {
                const ox = other.x + otherConn.x, oy = other.y + otherConn.y;
                const dist = Math.hypot(cx - ox, cy - oy);
                if (dist < bestDist) { bestDist = dist; best = { dx: ox - cx, dy: oy - cy }; }
            });
        });
    });
    if (best) { comp.x += best.dx; comp.y += best.dy; }
}

function removeComponent(id) {
    const idx = state.components.findIndex(c => c.id === id);
    if (idx === -1) return;
    const comp = state.components[idx];
    const el = document.querySelector(`.circuit-component[data-id="${id}"]`);
    if (el) el.remove();
    state.components.splice(idx, 1);
    if (state.selectedId === id) state.selectedId = null;
    const compNodeIds = new Set(comp.connections.map(c => c.id));
    state.wires = state.wires.filter(w => !compNodeIds.has(w.a) && !compNodeIds.has(w.b));
    updateDropHint();
    clearPropertiesPanel();
    analyzeCircuit(true);
}

function toggleSwitch(id) {
    const comp = state.components.find(c => c.id === id);
    if (!comp || comp.type !== 'switch') return;
    comp.closed = !comp.closed;
    updateComponentDOM(comp);
    updatePropertiesPanel();
}

// ==== Маркеры ====
let markerEl = null;
let previewLineEl = null;

function showMarkerAtPoint(clientX, clientY) {
    const rect = gridArea.getBoundingClientRect();
    const x = clientX - rect.left, y = clientY - rect.top;
    if (!markerEl) {
        markerEl = document.createElement('div');
        markerEl.className = 'placement-marker';
        gridArea.appendChild(markerEl);
    }
    markerEl.style.left = x + 'px';
    markerEl.style.top = y + 'px';
}
function clearMarker() {
    if (markerEl && markerEl.parentNode) { markerEl.parentNode.removeChild(markerEl); markerEl = null; }
}
function clearPreviewLine() {
    document.querySelectorAll('.preview-line').forEach(el => el.remove());
    previewLineEl = null;
}
function updateDropHint() {
    const has = state.components.length > 0;
    gridArea.classList.toggle('empty', !has);
    document.getElementById('dropHint').style.display = has ? 'none' : 'flex';
}

// ==== Выбор компонента ====
function selectComponent(id) {
    state.selectedId = id;
    document.querySelectorAll('.circuit-component').forEach(el => {
        el.classList.toggle('selected', parseInt(el.dataset.id) === id);
    });
    updatePropertiesPanel();
}

function updatePropertiesPanel() {
    const comp = state.components.find(c => c.id === state.selectedId);
    if (!comp) {
        propertiesPanel.innerHTML = `<h4>Свойства компонента</h4>
            <div class="properties-content"><p class="hint">Кликните по компоненту на схеме</p></div>`;
        return;
    }
    let rows = `<div class="property-row"><span class="prop-name">Тип</span><span class="prop-value">${COMPONENT_DEFS[comp.type].label}</span></div>`;
    if (comp.type === 'switch') {
        rows += `<div class="property-row"><span class="prop-name">Переменная</span><span class="prop-value">${comp.variable}</span></div>`;
        rows += `<div class="property-row"><span class="prop-name">Состояние</span><span class="prop-value">${comp.closed ? '1 (замкнут)' : '0 (разомкнут)'}</span></div>
        <div class="property-row"><span class="prop-name">Управление</span><button id="switchToggle">${comp.closed ? 'Разомкнуть' : 'Замкнуть'}</button></div>`;
    }
    if (comp.type === 'bulb') {
        rows += `<div class="property-row"><span class="prop-name">Состояние</span><span class="prop-value">${comp.lit ? '💡 Горит' : '🌑 Не горит'}</span></div>`;
    }
    propertiesPanel.innerHTML = `<h4>Свойства — ${COMPONENT_DEFS[comp.type].label}</h4><div class="properties-content">${rows}</div>`;
    const btn = document.getElementById('switchToggle');
    if (btn) btn.addEventListener('click', () => { toggleSwitch(comp.id); analyzeCircuit(false); });
}

function clearPropertiesPanel() {
    propertiesPanel.innerHTML = `<h4>Свойства компонента</h4>
        <div class="properties-content"><p class="hint">Кликните по компоненту на схеме</p></div>`;
}

// ==== Рендер соединений ====
function renderConnections(graph) {
    document.querySelectorAll('.wire-svg').forEach(el => el.remove());
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'wire-svg');
    if (!graph) { gridArea.appendChild(svg); return; }

    const groups = new Map();
    graph.points.forEach(p => {
        if (!groups.has(p.node)) groups.set(p.node, []);
        groups.get(p.node).push(p);
    });
    const liveNodeIds = new Set(state.liveNodes || []);

    groups.forEach((pts) => {
        if (pts.length < 2) return;
        const isLive = liveNodeIds.has(pts[0].node);
        for (let i = 0; i < pts.length; i++) {
            for (let j = i + 1; j < pts.length; j++) {
                const sameComp = pts[i].comp.id === pts[j].comp.id;
                if (sameComp && Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) < 6) continue;
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', pts[i].x);
                line.setAttribute('y1', pts[i].y);
                line.setAttribute('x2', pts[j].x);
                line.setAttribute('y2', pts[j].y);
                line.setAttribute('class', 'wire-line');
                if (isLive) line.classList.add('live');
                svg.appendChild(line);
            }
        }
    });

    state.wires.forEach(w => {
        const p1 = resolveWirePoint(w.a), p2 = resolveWirePoint(w.b);
        if (!p1 || !p2) return;
        const n1 = graph.pointToNode.get(w.a), n2 = graph.pointToNode.get(w.b);
        const isLive = liveNodeIds.has(n1) && liveNodeIds.has(n2);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', p1.x);
        line.setAttribute('y1', p1.y);
        line.setAttribute('x2', p2.x);
        line.setAttribute('y2', p2.y);
        line.setAttribute('class', 'wire-line wire-drawn');
        if (isLive) line.classList.add('live');
        svg.appendChild(line);
    });

    // Точки-контакты
    const drawn = new Set();
    state.components.forEach(comp => {
        comp.connections.forEach(conn => {
            const cx = comp.x + conn.x, cy = comp.y + conn.y;
            const key = Math.round(cx * 10) + '_' + Math.round(cy * 10);
            if (drawn.has(key)) return;
            drawn.add(key);
            const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            dot.setAttribute('cx', cx);
            dot.setAttribute('cy', cy);
            dot.setAttribute('r', wireModeActive ? 7 : 5);
            dot.setAttribute('class', 'contact-dot');
            if (wireModeActive) dot.classList.add('wiring');
            if (wireStart && wireStart.connId === conn.id) dot.classList.add('start');
            svg.appendChild(dot);
        });
    });

    gridArea.appendChild(svg);
}

// ==== Граф ====
function buildGraph() {
    const graph = { points: [], adj: {}, pointToNode: new Map(), nodeComps: {} };

    state.components.forEach(comp => {
        comp.connections.forEach(conn => {
            const px = comp.x + conn.x, py = comp.y + conn.y;
            const p = { connId: conn.id, x: px, y: py, comp, conn, node: null };
            const mergedPoint = graph.points.find(existing => Math.hypot(existing.x - px, existing.y - py) < 18);
            if (mergedPoint) {
                p.node = mergedPoint.node;
                if (!graph.nodeComps[p.node].includes(comp.id)) graph.nodeComps[p.node].push(comp.id);
            } else {
                const nodeId = state.nextNode++;
                p.node = nodeId;
                graph.adj[nodeId] = [];
                graph.nodeComps[nodeId] = [comp.id];
            }
            graph.points.push(p);
            graph.pointToNode.set(conn.id, p.node);
        });
    });

    state.components.forEach(comp => {
        const nodes = comp.connections.map(c => graph.pointToNode.get(c.id));
        if (comp.type === 'switch' && !comp.closed) return;
        if (comp.type === 'battery') return; // батарея НЕ проводит между "+" и "−" как элемент
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                addEdge(graph, nodes[i], nodes[j], comp);
            }
        }
    });

    state.wires.forEach(w => {
        const na = graph.pointToNode.get(w.a), nb = graph.pointToNode.get(w.b);
        if (na != null && nb != null) addEdge(graph, na, nb, { id: 'wire', type: 'wire' });
    });

    return graph;
}

function addEdge(graph, a, b, comp) {
    if (!graph.adj[a]) graph.adj[a] = [];
    if (!graph.adj[b]) graph.adj[b] = [];
    graph.adj[a].push({ to: b, comp });
    graph.adj[b].push({ to: a, comp });
}

function findPath(graph, start, end) {
    if (start == null || end == null) return { found: false, path: [] };
    if (start === end) return { found: true, path: [start] };
    const visited = new Set([start]);
    const parent = new Map();
    const queue = [start];
    while (queue.length > 0) {
        const node = queue.shift();
        (graph.adj[node] || []).forEach(edge => {
            if (!visited.has(edge.to)) {
                visited.add(edge.to);
                parent.set(edge.to, node);
                queue.push(edge.to);
            }
        });
    }
    if (!visited.has(end)) return { found: false, path: [] };
    const path = [];
    let cur = end;
    while (cur != null && cur !== start) { path.unshift(cur); cur = parent.get(cur); }
    path.unshift(start);
    return { found: true, path };
}

// ==== Анализ схемы ====
function analyzeCircuit(silent = false) {
    state.components.forEach(c => { if (c.type === 'bulb') c.lit = false; });
    state.liveNodes = [];

    const graph = buildGraph();
    state.lastGraph = graph;

    const battery = state.components.find(c => c.type === 'battery');
    if (!battery) {
        renderConnections(graph);
        if (!silent) showAnalysisPlaceholder();
        return;
    }

    const batteryPts = graph.points.filter(p => p.comp.id === battery.id);
    if (batteryPts.length !== 2) {
        renderConnections(graph);
        if (!silent) showAnalysisPlaceholder();
        return;
    }

    const startNode = batteryPts[0].node;
    const endNode = batteryPts[1].node;
    const { found, path } = findPath(graph, startNode, endNode);

    const currentOnNodes = new Set();
    if (found) path.forEach(n => currentOnNodes.add(n));
    state.liveNodes = [...currentOnNodes];

    const componentsOnPath = new Set();
    if (found) {
        path.forEach(nodeId => (graph.nodeComps[nodeId] || []).forEach(compId => componentsOnPath.add(compId)));
    }

    const switches = state.components.filter(c => c.type === 'switch');
    const bulbs = state.components.filter(c => c.type === 'bulb');

    // Логическое выражение всей цепи (для таблицы истинности и панели)
    const expr = buildLogicExpression(graph, startNode, endNode);

    // Текущие значения переменных (замкнутость выключателей)
    const values = {};
    switches.forEach(s => values[s.variable] = s.closed ? 1 : 0);

    // Лампочка горит ⟺ её собственное выражение = 1 при текущих значениях.
    // Это гарантирует совпадение с таблицей истинности.
    let lit = false;
    bulbs.forEach(b => {
        const bulbExpr = buildLogicExpression(graph, startNode, endNode, b.id);
        let on = false;
        try { on = evalExpr(bulbExpr, values) === 1; } catch (e) { on = false; }
        b.lit = on;
        if (on) lit = true;
    });

    // Отобразить
    document.querySelectorAll('.circuit-component').forEach(el => {
        const comp = state.components.find(c => c.id === parseInt(el.dataset.id));
        if (comp) updateComponentDOM(comp);
    });
    renderConnections(graph);

    if (!silent) {
        displayAnalysis(expr, lit, switches);
    }
}

// ==== Построение логического выражения из графа ====
// Обходим от (+) батареи к (-) через компоненты.
// Последовательные выключатели на одном пути → И (∧)
// Параллельные пути → ИЛИ (∨)
// throughBulbId: если задан — строим выражение только для путей, проходящих через лампочку с этим id
// (тогда лампочка горит ⟺ её собственное выражение = 1 при текущих значениях, что совпадает с таблицей истинности).
function buildLogicExpression(graph, startNode, endNode, throughBulbId = null) {
    const switches = state.components.filter(c => c.type === 'switch');
    if (switches.length === 0) return '1';

    // Для топологии строим граф, где ВСЕ выключатели (независимо от состояния) проводят.
    const topo = buildTopologyGraph();
    const topoStart = topo.startNode, topoEnd = topo.endNode;
    if (!topoStart || !topoEnd) return '0';

    // Собрать все простые пути от topoStart к topoEnd (ограничение по глубине)
    const paths = [];
    const visited = new Set();
    const MAX_DEPTH = 16;
    function dfs(node, pathVars, passedBulb, depth) {
        if (depth > MAX_DEPTH || node == null) return;
        if (node === topoEnd) {
            if (throughBulbId == null || passedBulb) paths.push(pathVars);
            return;
        }
        (topo.adj[node] || []).forEach(edge => {
            if (visited.has(edge.to)) return;
            const nextVars = edge.comp && edge.comp.type === 'switch' ? [...pathVars, edge.comp.variable] : pathVars;
            const nextPassed = passedBulb || (edge.comp && edge.comp.id === throughBulbId);
            visited.add(edge.to);
            dfs(edge.to, nextVars, nextPassed, depth + 1);
            visited.delete(edge.to);
        });
    }
    visited.add(topoStart);
    dfs(topoStart, [], false, 0);
    visited.delete(topoStart);

    if (paths.length === 0) return '0';

    // Каждый путь = конъюнкция
    const terms = paths.map(p => {
        if (p.length === 0) return '1';
        const unique = [...new Set(p)];
        return unique.length === 1 ? unique[0] : unique.join(' ∧ ');
    });

    // Разные пути = дизъюнкция
    const uniqueTerms = [...new Set(terms)];
    if (uniqueTerms.length === 1) return uniqueTerms[0];
    // Несколько параллельных веток: каждую оборачиваем в скобки, склеиваем ∨
    return uniqueTerms.map(t => (t.includes(' ∨ ') || t.includes(' ∧ ') ? '(' + t + ')' : t)).join(' ∨ ');
}

// Топологический граф: все выключатели проводят, находит + и - батареи
function buildTopologyGraph() {
    const battery = state.components.find(c => c.type === 'battery');
    if (!battery) return { adj: {}, startNode: null, endNode: null };

    const graph = { points: [], adj: {}, pointToNode: new Map() };

    // Точки
    state.components.forEach(comp => {
        comp.connections.forEach(conn => {
            const px = comp.x + conn.x, py = comp.y + conn.y;
            let node = null;
            const merged = graph.points.find(existing => Math.hypot(existing.x - px, existing.y - py) < 18);
            if (merged) {
                node = merged.node;
            } else {
                node = 't' + state.nextNode++;
                graph.adj[node] = [];
                graph.points.push({ x: px, y: py, node });
            }
            graph.pointToNode.set(conn.id, node);
        });
    });

    // Рёбра: ВСЕ выключатели проводят (топология), остальные компоненты тоже.
    // Батарея НЕ проводит между "+" и "−" как элемент.
    state.components.forEach(comp => {
        if (comp.type === 'battery') return;
        const nodes = comp.connections.map(c => graph.pointToNode.get(c.id));
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                addTopoEdge(graph, nodes[i], nodes[j], comp);
            }
        }
    });
    // Провода
    state.wires.forEach(w => {
        const na = graph.pointToNode.get(w.a), nb = graph.pointToNode.get(w.b);
        if (na != null && nb != null) addTopoEdge(graph, na, nb, { id: 'wire', type: 'wire' });
    });

    // + и - батареи
    const bpos = battery.connections.find(c => c.role === 'positive');
    const bneg = battery.connections.find(c => c.role === 'negative');
    return { adj: graph.adj, startNode: graph.pointToNode.get(bpos.id), endNode: graph.pointToNode.get(bneg.id) };
}

function addTopoEdge(graph, a, b, comp) {
    if (!graph.adj[a] || !graph.adj[b]) return;
    graph.adj[a].push({ to: b, comp });
    graph.adj[b].push({ to: a, comp });
}

// ==== Таблица истинности ====
function buildTruthTable(expr, switches) {
    const vars = switches.map(s => s.variable);
    if (vars.length === 0) {
        return { headers: ['Y'], rows: [[expr === '1' ? 1 : 0]] };
    }

    const rows = [];
    const combos = 1 << vars.length;
    for (let mask = 0; mask < combos; mask++) {
        const values = {};
        vars.forEach((v, i) => { values[v] = (mask >> (vars.length - 1 - i)) & 1; });
        // Вычислить значение выражения
        const y = evalExpr(expr, values);
        rows.push({ values: vars.map(v => values[v]), y });
    }
    return { headers: vars, rows };
}

// Простой вычислитель булева выражения (∧ ∨ ¬)
function evalExpr(expr, values) {
    // Заменяем переменные на 1/0, затем подставляем в логику через предикат
    let s = expr;
    for (const [k, v] of Object.entries(values)) {
        s = s.split(k).join(v);
    }
    // Упрощаем: заменяем 1 ∧ 1 → результат
    // Реализация: подстановка в JS
    try {
        return evalEval(s);
    } catch (e) {
        return 0;
    }
}

function evalEval(expr) {
    // Безопасная подстановка: преобразуем в JS-выражение
    let s = expr
        .replace(/∧/g, '&&')
        .replace(/∨/g, '||')
        .replace(/¬/g, '!');
    // Вычислить через Function но без глобальных переменных — уже подставлены 0/1
    return (new Function('return ' + s))() ? 1 : 0;
}

// ==== Отображение анализа ====
function showAnalysisPlaceholder() {
    analysisContent.innerHTML = `<div class="analysis-placeholder">
        <div class="analysis-icon">🔍</div>
        <p>Соберите схему — здесь появится её логическое выражение</p>
    </div>`;
    truthTableEl.innerHTML = '';
}

function displayAnalysis(expr, lit, switches) {
    const litIcon = lit ? '💡 Горит' : '🌑 Не горит';
    let html = `<div class="analysis-result">`;
    html += `<div class="analysis-formula">Y = ${expr}</div>`;
    html += `<div class="analysis-item"><span class="item-icon">${lit ? '✅' : '❌'}</span><span>Лампочка: ${litIcon}</span></div>`;

    const vars = switches.map(s => s.variable);
    if (switches.length > 0) {
        const openList = switches.filter(s => !s.closed).map(s => s.variable);
        const closedList = switches.filter(s => s.closed).map(s => s.variable);
        if (closedList.length) html += `<div class="analysis-item"><span class="item-icon">1</span><span>Замкнуты: ${closedList.join(', ')}</span></div>`;
        if (openList.length) html += `<div class="analysis-item"><span class="item-icon">0</span><span>Разомкнуты: ${openList.join(', ')}</span></div>`;
    }
    html += `</div>`;
    analysisContent.innerHTML = html;

    // Таблица истинности
    if (switches.length > 0 && switches.length <= 4) {
        const tt = buildTruthTable(expr, switches);
        let th = '<tr><th>' + tt.headers.join('</th><th>') + '</th><th>Y</th></tr>';
        let body = '';
        tt.rows.forEach(r => {
            body += '<tr><td>' + r.values.join('</td><td>') + '</td><td class="' + (r.y ? 'result-true' : 'result-false') + '">' + r.y + '</td></tr>';
        });
        truthTableEl.innerHTML = `<h4>Таблица истинности</h4><table><thead>${th}</thead><tbody>${body}</tbody></table>`;
    } else {
        truthTableEl.innerHTML = '';
    }
}

// ==== Задания ====
// Каждое задание: описание, авто-формула, типы проверки
const TASKS = {
    1: [
        {
            statement: 'Соберите на поле схему, где выключатели A и B соединены ПОСЛЕДОВАТЕЛЬНО (один за другим) с лампочкой и батареей.',
            hint: 'Последовательно — выключатели стоят в одну линию. Лампочка загорится только при обоих замкнутых: Y = A ∧ B.',
            expected: 'A ∧ B'
        },
        {
            statement: 'Соберите схему, где выключатели A и B соединены ПАРАЛЛЕЛЬНО (две отдельные ветки ведут к лампочке).',
            hint: 'Параллельно — две ветки с выключателями, каждая ведёт от источника к лампе. Y = A ∨ B.',
            expected: 'A ∨ B'
        },
        {
            statement: 'Резистор и выключатель A — последовательно с лампочкой. Соберите простейшую замкнутую цепь из батареи, выключателя, резистора и лампы.',
            hint: 'Все элементы в один контур. Резистор не влияет на логику — Y = A.',
            expected: 'A'
        }
    ],
    2: [
        {
            statement: 'Соберите схему, соответствующую выражению Y = (A ∧ B) ∨ C. Три выключателя, одна лампочка, батарея.',
            hint: 'Ветка 1: A и B последовательно. Ветка 2: C параллельно первой ветке. Обе ведут к лампе.',
            expected: '(A ∧ B) ∨ C'
        },
        {
            statement: 'Соберите схему Y = A ∨ (B ∧ C).',
            hint: 'Ветка 1: только A. Ветка 2: B и C последовательно. Параллельно между собой.',
            expected: 'A ∨ (B ∧ C)'
        }
    ],
    3: [
        {
            statement: 'На смешанной схеме. Напишите, из скольких параллельных веток состоит схема, которую вы собрали (посчитайте по количеству видимых ответвлений от источника к лампе).',
            hint: 'Выключатели можно двигать. Постройте схему с двумя параллельными ветками — ответ 2.',
            expected: '2',
            type: 'number'
        },
        {
            statement: 'Постройте схему из 3 выключателей, где итоговое выражение содержит ровно два знака «∧» (И) и ни одного «∨» — то есть всё строго последовательно.',
            hint: 'Три выключателя одним последовательным путём: Y = A ∧ B ∧ C.',
            expected: 'A ∧ B ∧ C'
        }
    ]
};

// Нормализация выражения: приводит к канонической форме для сравнения
// Идея: выражение DNF-подобное. Разбиваем на дизъюнктивные термы (по ∨ на верх. уровне),
// каждый терм — отсортированное по алфавиту множество переменных, соединённых ∧.
// Сравнение: множества термов (с учётом кратности).
function canonicalExpr(expr) {
    // Вернуть набор термов
    return [...new Set(normTerms(expr))].sort().join('|');
}

function normTerms(expr) {
    const s = expr.replace(/\s+/g, '');
    if (!s) return [];
    // Разбить верхнеуровневые ∨
    const orParts = splitTop(s, '∨');
    if (orParts.length > 1) {
        let terms = [];
        orParts.forEach(p => terms = terms.concat(normTerms(p)));
        return terms;
    }
    // Одиночный терм: снять внешние скобки, затем разбить верхнеуровневые ∧
    const unb = s.replace(/^\((.*)\)$/, '$1');
    const andParts = splitTop(unb, '∧');
    if (andParts.length > 1) {
        const vars = [];
        andParts.forEach(p => {
            const inner = normVars(p);
            inner.forEach(v => { if (!vars.includes(v)) vars.push(v); });
        });
        vars.sort();
        return [vars.join('∧')];
    }
    const vars = normVars(unb);
    vars.sort();
    return [vars.length ? vars.join('∧') : '1'];
}

function normVars(str) {
    const s = str.replace(/\s+/g, '');
    if (!s) return [];
    const orParts = splitTop(s, '∨');
    if (orParts.length > 1) {
        // внутри терма не должно быть ∨, но на всякий случай
        return normVars(orParts[0]);
    }
    const unb = s.replace(/^\((.*)\)$/, '$1');
    if (unb === '') return [];
    if (unb === '1') return ['1'];
    // может содержать несколько переменных через ∧ — разбить
    const andParts = splitTop(unb, '∧');
    if (andParts.length > 1) {
        const res = [];
        andParts.forEach(p => res.push(...normVars(p)));
        return res;
    }
    // одиночная переменная
    return [unb];
}

// Разделить строку по разделителю на верхнем уровне (вне скобок)
function splitTop(str, sep) {
    const parts = [];
    let depth = 0;
    let current = '';
    for (const ch of str) {
        if (ch === '(') depth++;
        if (ch === ')') depth--;
        if (ch === sep && depth === 0) {
            parts.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    parts.push(current);
    return parts;
}

function normalizeExpr(expr) {
    return canonicalExpr(expr);
}

function loadTask(level, index) {
    const tasks = TASKS[level];
    const task = tasks[index % tasks.length];
    currentLevel = level;
    currentTaskIndex = index % tasks.length;

    // Событие для дашборда и электронного рабочего листа
    window.dispatchEvent(new CustomEvent('trainer:load', { detail: { level, index: currentTaskIndex } }));

    document.getElementById('taskBadge').textContent = `Задание ${currentTaskIndex + 1}`;
    document.getElementById('taskText').textContent = task.statement;

    const card = document.getElementById('taskCard');
    card.classList.remove('correct', 'incorrect');

    document.getElementById('taskStatement').innerHTML = `<strong>${task.statement}</strong><br><small style="color:var(--dark-600)">${task.hint}</small>`;

    // Подсказка по дальше
    const answerDiv = document.getElementById('taskAnswer');
    answerDiv.innerHTML = `<button class="task-submit" id="submitTask">Проверить схему</button>
        <button class="task-next" id="nextTask">Следующее задание →</button>`;

    document.getElementById('taskFeedback').classList.remove('show', 'correct', 'incorrect');
    document.getElementById('taskFeedback').innerHTML = '';
}

function setupTasks() {
    document.querySelectorAll('.level-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.level-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            loadTask(parseInt(tab.dataset.level), 0);
        });
    });

    document.getElementById('taskCard').addEventListener('click', (e) => {
        if (e.target.id === 'submitTask') checkTask();
        if (e.target.id === 'nextTask') {
            loadTask(currentLevel, currentTaskIndex + 1);
        }
    });

    loadTask(1, 0);
}

function checkTask() {
    const task = TASKS[currentLevel][currentTaskIndex];
    const graph = state.lastGraph;
    if (!graph || !state.components.find(c => c.type === 'battery')) {
        showTaskFeedback('Сначала соберите схему на тренажёре!', false);
        return;
    }

    const battery = state.components.find(c => c.type === 'battery');
    const batteryPts = graph.points.filter(p => p.comp.id === battery.id);
    if (batteryPts.length !== 2) {
        showTaskFeedback('Схема собрана неверно — у батареи должно быть два полюса.', false);
        return;
    }

    const expr = buildLogicExpression(graph, batteryPts[0].node, batteryPts[1].node);

    if (task.type === 'number') {
        // Подсчёт параллельных веток (по топологии)
        const topo = buildTopologyGraph();
        const branches = countParallelBranches(topo.adj, topo.startNode, topo.endNode);
        if (String(branches) === task.expected) {
            showTaskFeedback('Верно! Вы собрали правильную схему.', true);
            analyzeCircuit(false);
            window.dispatchEvent(new CustomEvent('trainer:check', { detail: { level: currentLevel, index: currentTaskIndex, ok: true, expr: `${branches} ветки` } }));
        } else {
            showTaskFeedback(`Не совсем. В вашей схеме ${branches} параллельных веток, а нужно ${task.expected}.`, false);
            window.dispatchEvent(new CustomEvent('trainer:check', { detail: { level: currentLevel, index: currentTaskIndex, ok: false, expr: `${branches} ветки` } }));
        }
        return;
    }

    const normalExpr = normalizeExpr(expr);
    const normalExpected = normalizeExpr(task.expected);

    if (normalExpr === normalExpected) {
        showTaskFeedback('Правильно! Логическое выражение вашей схемы соответствует заданию.', true);
        analyzeCircuit(false);
    } else {
        showTaskFeedback(`Почти. Логическое выражение вашей схемы: Y = ${expr}. Ожидалось: Y = ${task.expected}.`, false);
    }
    window.dispatchEvent(new CustomEvent('trainer:check', { detail: { level: currentLevel, index: currentTaskIndex, ok: normalExpr === normalExpected, expr } }));
}

function countParallelBranches(adj, start, end) {
    if (!start || !end) return 0;
    const paths = [];
    const visited = new Set([start]);
    function dfs(node) {
        if (node === end) { paths.push(1); return; }
        (adj[node] || []).forEach(edge => {
            if (visited.has(edge.to)) return;
            visited.add(edge.to);
            dfs(edge.to);
            visited.delete(edge.to);
        });
    }
    dfs(start);
    return paths.length;
}

function showTaskFeedback(msg, ok) {
    const fb = document.getElementById('taskFeedback');
    fb.innerHTML = (ok ? '✅ ' : '❌ ') + msg;
    fb.className = 'task-feedback show ' + (ok ? 'correct' : 'incorrect');
    const card = document.getElementById('taskCard');
    card.classList.toggle('correct', ok);
    card.classList.toggle('incorrect', !ok);
}

// ==== Toast ====
function showToast(message) {
    const old = document.getElementById('toast');
    if (old) old.remove();
    const toast = document.createElement('div');
    toast.id = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed; bottom: 24px; left: 50%;
        transform: translateX(-50%) translateY(100px);
        background: var(--dark); color: white;
        padding: 12px 24px; border-radius: 8px;
        font-size: 14px; z-index: 200;
        box-shadow: 0 10px 25px rgba(0,0,0,0.3);
        transition: transform 0.4s ease; animation: slideUpFadeIn 4s forwards;
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.style.transform = 'translateX(-50%) translateY(0)'; });
    setTimeout(() => { toast.style.transform = 'translateX(-50%) translateY(100px)'; setTimeout(() => toast.remove(), 500); }, 3500);
}

// ==== Очистка ====
function clearAll() {
    state.components.forEach(c => {
        const el = document.querySelector(`.circuit-component[data-id="${c.id}"]`);
        if (el) el.remove();
    });
    state.components = [];
    state.wires = [];
    state.selectedId = null;
    COMPONENT_DEFS.switch.varCounter.count = 0;
    wireStart = null;
    clearWirePreview();
    document.querySelectorAll('.wire-svg').forEach(el => el.remove());
    updateDropHint();
    clearPropertiesPanel();
    showAnalysisPlaceholder();
}

// ==== События тренажёра → дашборд и рабочий лист ====
// Хелперы для app.js
function getStateSwitchVars() {
    return state.components
        .filter(c => c.type === 'switch' && c.variable)
        .map(s => s.variable);
}

function getLastExpr() {
    if (!state.lastGraph) return null;
    const battery = state.components.find(c => c.type === 'battery');
    if (!battery) return null;
    const batteryPts = state.lastGraph.points.filter(p => p.comp.id === battery.id);
    if (batteryPts.length !== 2) return null;
    return buildLogicExpression(state.lastGraph, batteryPts[0].node, batteryPts[1].node);
}

// ==== Демо-схема при старте ====
function loadDemo() {
    clearAll();
    const gx = gridArea.getBoundingClientRect();
    const cx = gx.width / 2, cy = gx.height / 2 + 10;

    // Последовательная цепь: батарея(+) → выключатель A → лампочка → батарея(-)
    // Элементы расставлены с зазором и соединены проводами (чтобы контакты не "слипались")
    const b = COMPONENT_DEFS.battery.create();
    b.x = cx - 150; b.y = cy;
    state.components.push(b);
    gridArea.appendChild(renderComponent(b));

    const s = COMPONENT_DEFS.switch.create();
    s.x = cx - 60; s.y = cy;
    state.components.push(s);
    gridArea.appendChild(renderComponent(s));

    const l = COMPONENT_DEFS.bulb.create();
    l.x = cx + 60; l.y = cy;
    state.components.push(l);
    gridArea.appendChild(renderComponent(l));

    // Провода
    state.wires.push({ a: b.connections[0].id, b: s.connections[0].id }); // батарея(+) → выключатель левый
    state.wires.push({ a: s.connections[1].id, b: l.connections[0].id }); // выключатель правый → лампочка левая
    state.wires.push({ a: l.connections[1].id, b: b.connections[1].id }); // лампочка правая → батарея(-)

    updateDropHint();
    analyzeCircuit(true);
    showToast('Демо-схема: A последовательно с лампой. Двойной клик по выключателю — замкнуть.');
}

// ==== Инициализация ====
function init() {
    setupDragAndDrop();
    loadDemo();
    setupTasks();

    checkBtn.addEventListener('click', () => analyzeCircuit(false));
    clearBtn.addEventListener('click', clearAll);
    document.getElementById('wireModeBtn').addEventListener('click', toggleWireMode);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' && state.selectedId != null) removeComponent(state.selectedId);
        if (e.key === 'Escape') {
            wireStart = null;
            clearWirePreview();
            if (wireModeActive) {
                setWireStatus('Отменено. Кликните по ПЕРВОЙ точке, чтобы начать провод.', 'active');
                renderConnections(state.lastGraph);
            }
        }
    });

    updateDropHint();
    showAnalysisPlaceholder();
}

document.addEventListener('DOMContentLoaded', init);
document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideUpFadeIn {
            0% { opacity: 0; }
            10% { opacity: 1; }
            85% { opacity: 1; }
            100% { opacity: 0; }
        }
        .dragging { opacity: 0.5; border-style: dashed; }
    `;
    document.head.appendChild(style);
});
