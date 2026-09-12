// ===== Электронный рабочий лист ученика + дашборд прохождения тренажёра =====

// ==== Хранилище сессии и рабочего листа (localStorage) ====
const WS_KEY = 'logicTrainer.worksheet.v1';
const SESSION_KEY = 'logicTrainer.session.v1';

const Worksheet = {
    defaultData: {
        name: '', class: '', date: '', team: '', role: '',
        goal: '', hypothesis: '',
        match: { closed: '', open: '', lamp: '', seq: '', par: '' },
        demoFormula: '', seqFormula: '', parFormula: '', mixFormula: '',
        seqConclusion: '', parConclusion: '', mixPlan: '', mixAnswer: '',
        scores: { schema: 0, formula: 0, table: 0, explain: 0 },
        reflect1: '', reflect2: '', reflect3: '',
        self: { and: '', circuit: '' }
    },

    data: null,

    load() {
        try {
            this.data = JSON.parse(localStorage.getItem(WS_KEY));
        } catch (e) { this.data = null; }
        if (!this.data) {
            this.data = JSON.parse(JSON.stringify(this.defaultData));
            this.data.date = new Date().toISOString().slice(0, 10);
            this.save();
        }
        return this.data;
    },
    save() {
        localStorage.setItem(WS_KEY, JSON.stringify(this.data));
    },
    reset() {
        this.data = JSON.parse(JSON.stringify(this.defaultData));
        this.data.date = new Date().toISOString().slice(0, 10);
        this.save();
    }
};

const Session = {
    data: {
        startedAt: null,
        studentName: '',
        events: [],           // { t, type, level?, task?, ok?, expr? }
        checks: { total: 0, correct: 0 },
        byTask: {},           // key "L1T0" -> { attempts, correct, solved, timeMs }
        lastCheck: null,
        timeByTask: {},
        taskStart: null
    },

    load() {
        try {
            const raw = JSON.parse(localStorage.getItem(SESSION_KEY));
            if (raw) this.data = { ...this.data, ...raw };
        } catch (e) { /* ignore */ }
        if (!this.data.startedAt) this.data.startedAt = Date.now();
        this.save();
        return this.data;
    },
    save() {
        localStorage.setItem(SESSION_KEY, JSON.stringify(this.data));
    },
    reset() {
        this.data = {
            startedAt: Date.now(),
            studentName: '',
            events: [],
            checks: { total: 0, correct: 0 },
            byTask: {},
            lastCheck: null,
            timeByTask: {},
            taskStart: null
        };
        this.save();
    },

    taskKey(level, index) { return 'L' + level + 'T' + index; },

    onTaskLoad(level, index) {
        const key = this.taskKey(level, index);
        const task = this.data.byTask[key] || { attempts: 0, correct: 0, solved: false, solvedTime: null };
        task.mostRecent = true;
        this.data.byTask[key] = task;
        this.data.taskStart = Date.now();
        this.pushEvent('task_load', level, index, null, null);
    },

    onCheck(level, index, ok, expr) {
        const key = this.taskKey(level, index);
        const now = Date.now();
        const elapsed = this.data.taskStart ? now - this.data.taskStart : null;

        const task = this.data.byTask[key] || { attempts: 0, correct: 0, solved: false, solvedTime: null };
        task.attempts++;
        if (ok) task.correct++;
        if (ok) {
            task.solved = true;
            task.solvedTime = now;
        }
        this.data.byTask[key] = task;

        if (elapsed != null) {
            this.data.timeByTask[key] = Math.round((this.data.timeByTask[key] || 0) + elapsed);
        }

        this.data.checks.total++;
        if (ok) this.data.checks.correct++;
        this.data.lastCheck = { level, index, ok, expr, t: now };
        this.pushEvent(ok ? 'solve' : 'fail', level, index, ok, expr);
        this.save();
    },

    pushEvent(type, level, index, ok, expr) {
        this.data.events.push({
            t: Date.now(),
            type,
            level,
            task: level != null ? this.taskKey(level, index) : null,
            ok,
            expr
        });
        if (this.data.events.length > 100) this.data.events.shift();
        this.save();
    }
};
Session.load();

// ==== Маппинг задач тренажёра на этапы рабочего листа ====
// Уровень 1, задание 0 (A∧B последовательно)   -> этап 4 «последовательное»
// Уровень 1, задание 1 (A∨B параллельно)       -> этап 5 «параллельное»
// Уровень 1, задание 2 (простая цепь Y=A)      -> этап 3 «демо»
// Уровень 2, задание 0 ((A∧B)∨C)               -> этап 6 «смешанная»
const FILL_MAP = {
    'L1T0': { formulaId: 'wsSeqFormula', ttId: 'wsSeqTT', field: 'seqFormula' },
    'L1T1': { formulaId: 'wsParFormula', ttId: 'wsParTT', field: 'parFormula' },
    'L1T2': { formulaId: 'wsDemoFormula', ttId: 'wsDemoTT', field: 'demoFormula' },
    'L2T0': { formulaId: 'wsMixFormula', ttId: 'wsMixTT', field: 'mixFormula' }
};

// ==== Рендер таблицы истинности ====
function renderTruthTable(containerId, expr) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Получаем текущие выключатели из тренажёра и строим таблицу
    const swObjs = (typeof window.getStateSwitchVars === 'function')
        ? window.getStateSwitchVars()
        : [];
    container.innerHTML = '';
    if (!swObjs || swObjs.length === 0 || swObjs.length > 4) {
        container.innerHTML = '<p class="ws-empty">Соберите схему в тренажёре и нажмите «Проверить», чтобы заполнить таблицу истинности.</p>';
        return;
    }

    // Все переменные формулы должны присутствовать в текущей схеме
    const used = Array.from(new Set((expr || '').match(/[A-Za-zЁёА-Яа-я]/g) || []));
    if (!used.every(v => swObjs.includes(v))) {
        container.innerHTML = '<p class="ws-empty">Таблица обновится при проверке схемы с этими выключателями.</p>';
        return;
    }

    const tt = buildTruthTable(expr, swObjs.map(s => ({ variable: s })));
    let html = '<table><thead><tr>';
    tt.headers.forEach(h => { html += '<th>' + h + '</th>'; });
    html += '<th>Y</th></tr></thead><tbody>';
    tt.rows.forEach(r => {
        html += '<tr>';
        r.values.forEach(v => { html += '<td>' + v + '</td>'; });
        html += '<td class="' + (r.y ? 'result-true' : 'result-false') + '">' + r.y + '</td>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
}

function setFormulaText(id, expr) {
    const el = document.getElementById(id);
    if (!el) return;
    const target = el.tagName === 'B' ? el : el.querySelector('b');
    if (!target) return;
    target.textContent = expr;
    el.classList.add('filled');
}

// ==== Перенос формулы и таблицы из тренажёра в рабочий лист ====
function applyResultToWorksheet(level, index, expr) {
    const key = Session.taskKey(level, index);
    const map = FILL_MAP[key];
    if (!map) return;

    if (expr) {
        setFormulaText(map.formulaId, expr);
        Worksheet.data[map.field] = expr;
    }
    Worksheet.save();
    renderTruthTable(map.ttId, expr);
}

// ==== Инициализация рабочего листа ====
function initWorksheet() {
    const w = Worksheet.load();

    // Привязка ввода текста
    document.querySelectorAll('[data-ws]').forEach(el => {
        const field = el.dataset.ws;
        if (field === 'name') {
            el.value = w[field] || '';
            el.addEventListener('change', () => {
                w[field] = el.value;
                Session.data.studentName = el.value;
                Worksheet.save();
                Session.save();
            });
            return;
        }
        if (field in w) el.value = w[field] || '';

        el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
            const name = el.dataset.ws;
            if (name !== 'name') {
                w[name] = el.value;
                Worksheet.save();
            } else {
                w[name] = el.value;
                Session.data.studentName = el.value;
                Worksheet.save();
                Session.save();
            }
        });
    });

    // Привязка соответствий (этап 2)
    document.querySelectorAll('[data-ws-m]').forEach(sel => {
        const key = sel.dataset.wsM;
        if (w.match[key]) sel.value = w.match[key];
        sel.addEventListener('change', () => {
            w.match[key] = sel.value;
            Worksheet.save();
        });
    });

    // Привязка оценок защиты (этап 7)
    const scoreEls = {};
    document.querySelectorAll('[data-ws^="score-"]').forEach(input => {
        const key = input.dataset.ws.replace('score-', '');
        input.value = w.scores[key] != null ? w.scores[key] : 0;
        scoreEls[key] = input;
        input.addEventListener('input', () => {
            let v = parseInt(input.value, 10) || 0;
            const max = parseInt(input.max, 10) || 0;
            if (v > max) { v = max; input.value = v; }
            if (v < 0) { v = 0; input.value = v; }
            w.scores[key] = v;
            Worksheet.save();
            updateWsTotal();
        });
    });

    // Привязка самооценки (этап 8)
    document.querySelectorAll('[data-ws="self-and"], [data-ws="self-circuit"]').forEach(sel => {
        const key = sel.dataset.ws.replace('self-', '');
        if (w.self[key]) sel.value = w.self[key];
        sel.addEventListener('change', () => {
            w.self[key] = sel.value;
            Worksheet.save();
        });
    });

    // Восстановление формул и таблиц, если они уже заполнены
    if (w.demoFormula) fillFormulaUI('wsDemoFormula', 'wsDemoTT', w.demoFormula);
    if (w.seqFormula) fillFormulaUI('wsSeqFormula', 'wsSeqTT', w.seqFormula);
    if (w.parFormula) fillFormulaUI('wsParFormula', 'wsParTT', w.parFormula);
    if (w.mixFormula) fillFormulaUI('wsMixFormula', 'wsMixTT', w.mixFormula);

    updateWsTotal();

    // Кнопки «Записать из тренажёра» — берут текущее выражение из панели анализа
    document.querySelectorAll('.ws-fill').forEach(btn => {
        btn.addEventListener('click', () => {
            const src = btn.dataset.fill;
            const expr = window.getLastExpr ? window.getLastExpr() : null;
            if (!expr) {
                showToast('Сначала соберите схему в тренажёре и нажмите «Проверить».');
                return;
            }
            const mapping = {
                demo: { key: 'demo', formulaId: 'wsDemoFormula', ttId: 'wsDemoTT', field: 'demoFormula' },
                seq: { key: 'seq', formulaId: 'wsSeqFormula', ttId: 'wsSeqTT', field: 'seqFormula' },
                par: { key: 'par', formulaId: 'wsParFormula', ttId: 'wsParTT', field: 'parFormula' },
                mix: { key: 'mix', formulaId: 'wsMixFormula', ttId: 'wsMixTT', field: 'mixFormula' }
            }[src];
            if (!mapping) return;
            Worksheet.data[mapping.field] = expr;
            Worksheet.save();
            fillFormulaUI(mapping.formulaId, mapping.ttId, expr);
            showToast('Формула записана в рабочий лист.');
        });
    });

    // Экспорт и сброс
    document.getElementById('wsExportBtn').addEventListener('click', exportWorksheet);
    document.getElementById('wsResetBtn').addEventListener('click', () => {
        if (confirm('Очистить рабочий лист ученика?')) {
            Worksheet.reset();
            location.reload();
        }
    });
}

function fillFormulaUI(formulaId, ttId, expr) {
    setFormulaText(formulaId, expr);
    if (ttId) {
        // Таблицу построим по последнему состоянию тренажёра, если возможно
        renderTruthTable(ttId, expr);
    }
}

function updateWsTotal() {
    const w = Worksheet.data;
    const total = w.scores.schema + w.scores.formula + w.scores.table + w.scores.explain;
    const el = document.getElementById('wsTotal');
    if (el) el.textContent = 'ИТОГО: ' + total + ' / 10';
}

function exportWorksheet() {
    const w = Worksheet.data;
    const payload = {
        meta: { exportedAt: new Date().toISOString(), source: 'Рабочий лист ученика — Логический ток' },
        worksheet: w,
        session: { startedAt: Session.data.startedAt, checks: Session.data.checks, byTask: Session.data.byTask }
    };
    downloadJson(payload, 'rabochiy_list_' + (w.name.trim() || 'uchenik') + '.json');
    showToast('Рабочий лист выгружен в JSON.');
}

// ==== Дашборд ====
const TASK_LABELS = {
    'L1T0': '1.1 Послед. (И) A∧B',
    'L1T1': '1.2 Паралл. (ИЛИ) A∨B',
    'L1T2': '1.3 Простая цепь Y=A',
    'L2T0': '2.1 (A∧B)∨C',
    'L2T1': '2.2 A∨(B∧C)',
    'L3T0': '3.1 Число веток',
    'L3T1': '3.2 Три подряд A∧B∧C'
};

const LEVEL_TASKS = { 1: ['L1T0', 'L1T1', 'L1T2'], 2: ['L2T0', 'L2T1'], 3: ['L3T0', 'L3T1'] };

function renderDashboard() {
    const s = Session.data;

    // Ключевые показатели
    const accuracy = s.checks.total > 0 ? Math.round(100 * s.checks.correct / s.checks.total) : 0;
    const solvedCount = Object.values(s.byTask).filter(t => t.solved).length;
    const totalTasks = Object.keys(TASK_LABELS).length;
    const minutes = Math.round((Date.now() - s.startedAt) / 60000);

    const kpis = document.getElementById('dashKpis');
    kpis.innerHTML = `
        <div class="dash-kpi green"><div class="kpi-value">${solvedCount}/${totalTasks}</div><div class="kpi-label">Задач решено</div></div>
        <div class="dash-kpi amber"><div class="kpi-value">${accuracy}%</div><div class="kpi-label">Точность</div></div>
        <div class="dash-kpi"><div class="kpi-value">${s.checks.total}</div><div class="kpi-label">Проверок</div></div>
        <div class="dash-kpi blue"><div class="kpi-value">${minutes} мин</div><div class="kpi-label">В сессии</div></div>
        <div class="dash-kpi pink"><div class="kpi-value">${s.events.length}</div><div class="kpi-label">Событий</div></div>`;

    // Прогресс по уровням
    const levels = document.getElementById('dashLevels');
    let lvlHtml = '';
    for (const lvl of [1, 2, 3]) {
        const list = LEVEL_TASKS[lvl];
        const solved = list.filter(k => s.byTask[k] && s.byTask[k].solved).length;
        const pct = Math.round(100 * solved / list.length);
        lvlHtml += `<div class="dash-level-row">
            <div class="dash-level-label">Ур. ${lvl}</div>
            <div class="dash-level-bar"><div class="dash-level-fill" style="width:${pct}%"></div></div>
            <div class="dash-level-pct">${pct}%</div>
        </div>`;
    }
    levels.innerHTML = lvlHtml || '<div class="dash-empty">Нет данных</div>';

    // Попытки по заданиям
    const tasks = document.getElementById('dashTasks');
    let taskHtml = '';
    for (const [key, label] of Object.entries(TASK_LABELS)) {
        const t = s.byTask[key];
        const attempts = t ? t.attempts : 0;
        const state = t && t.solved ? 'solved' : (attempts ? 'failed' : 'neutral');
        const chipText = t && t.solved ? 'решено' : (attempts ? attempts + ' поп.' : '—');
        taskHtml += `<div class="dash-task-row">
            <span class="task-id">${key}</span>
            <span>${label}</span>
            <span class="task-attempts">попытки: ${attempts}</span>
            <span class="chip ${state}">${chipText}</span>
        </div>`;
    }
    tasks.innerHTML = taskHtml || '<div class="dash-empty">Задач пока не было</div>';

    // Лента событий
    const events = document.getElementById('dashEvents');
    if (s.events.length === 0) {
        events.innerHTML = '<div class="dash-empty">Начните работу в тренажёре — здесь появятся события.</div>';
    } else {
        let evHtml = '';
        s.events.slice().reverse().forEach(ev => {
            const time = new Date(ev.t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            let text = '';
            let cls = '';
            if (ev.type === 'task_load') {
                text = 'Задание открыто — ' + (TASK_LABELS[ev.task] || ev.task);
            } else if (ev.type === 'solve') {
                text = `✅ Верно! ${ev.task} · Y = ${ev.expr}`;
                cls = 'ok';
            } else if (ev.type === 'fail') {
                text = `❌ Попытка ${ev.task} · Y = ${ev.expr}`;
                cls = 'fail';
            }
            evHtml += `<div class="dash-event"><span class="ev-time">${time}</span><span class="ev-text ${cls}">${text}</span></div>`;
        });
        events.innerHTML = evHtml;
    }
}

// ==== События тренажёра → сессия и рабочий лист ====
window.addEventListener('trainer:load', (e) => {
    Session.onTaskLoad(e.detail.level, e.detail.index);
    renderDashboard();
});

window.addEventListener('trainer:check', (e) => {
    const { level, index, ok, expr } = e.detail;
    Session.onCheck(level, index, ok, expr);
    if (ok) applyResultToWorksheet(level, index, expr);
    renderDashboard();
});

// ==== Инициализация дашборда ====
function initDashboard() {
    document.getElementById('dashExportBtn').addEventListener('click', exportDashboardReport);
    document.getElementById('dashResetBtn').addEventListener('click', () => {
        if (confirm('Сбросить всю статистику прохождения?')) {
            Session.reset();
            renderDashboard();
        }
    });
    renderDashboard();
}

function exportDashboardReport() {
    const payload = {
        meta: { exportedAt: new Date().toISOString() },
        session: Session.data,
        worksheet: Worksheet.data
    };
    downloadJson(payload, 'dashbord_otchet.json');
    showToast('Отчёт по тренажёру выгружен.');
}

// ==== Утилиты ====
function downloadJson(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ==== Старт ====
document.addEventListener('DOMContentLoaded', () => {
    initWorksheet();
    initDashboard();
});