/**
 * main.js — Orquestrador principal do simulador ACO
 */

// ─── Estado Global ────────────────────────────────────────────────────────────
const graph = new Graph();
let renderer = null;
let aco = null;
let evChart = null;
let logger = null;
let rng = null;
let simRunning = false;
let simPaused = false;
let needsReset = true;
let _runAllPromise = null;

// ─── Inicialização ────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  renderer = new Renderer3D(document.getElementById('three-canvas'));
  evChart = new EvolutionChart('chart-canvas');
  logger = new Logger('history-tbody', 'log-panel');
  rng = new SeededRNG(42);

  _initDefaultGraph();
  _buildDepotSelect();
  _renderVertexTable();
  _buildScene();
  _updateStatusBar(null);

  document.getElementById('btn-run').addEventListener('click', _onRun);
  document.getElementById('btn-pause').addEventListener('click', _onPause);
  document.getElementById('btn-step').addEventListener('click', _onStep);
  document.getElementById('btn-reset').addEventListener('click', _onReset);
  document.getElementById('btn-add-vertex').addEventListener('click', _onAddVertex);

  document.querySelectorAll('.param-field').forEach(el => {
    el.addEventListener('input', _onConfigChange);
    el.addEventListener('change', _onConfigChange);
  });

  document.getElementById('speed-range').addEventListener('input', e => {
    document.getElementById('speed-val').textContent = e.target.value + 'ms';
  });

  // Modal editar vértice
  document.getElementById('btn-edit-save').addEventListener('click', _onEditSave);

  document.getElementById('btn-edit-cancel').addEventListener('click', () => {
    document.getElementById('edit-modal').style.display = 'none';
  });
});

// ─── Grafo padrão inicial ─────────────────────────────────────────────────────
function _initDefaultGraph() {
  graph.addVertex('A', 0, 0);
  graph.addVertex('B', 300, 0);
  graph.addVertex('C', 300, 400);
  graph.addVertex('D', 0, 400);
  graph.addVertex('E', 150, 200);
  graph.addVertex('F', 600, 300);
  graph.addVertex('G', 500, 100);
}

// ─── Gerenciamento de vértices ───────────────────────────────────────────────
function _renderVertexTable() {
  const tbody = document.getElementById('vertex-tbody');
  tbody.innerHTML = '';

  graph.vertices.forEach(v => {
    const tr = document.createElement('tr');

    tr.innerHTML =
      `<td>${v.id}</td><td>${v.x}</td><td>${v.y}</td>` +
      `<td>` +
        `<button class="btn-sm btn-edit" onclick="openEditModal('${v.id}')">✏️</button>` +
        `<button class="btn-sm btn-del" onclick="removeVertex('${v.id}')">🗑️</button>` +
      `</td>`;

    tbody.appendChild(tr);
  });

  const el = document.getElementById('vtx-count');

  if (el) {
    el.textContent = `(${graph.n}/12)`;
  }
}

function _onAddVertex() {
  const id = document.getElementById('v-id').value.trim();
  const x = document.getElementById('v-x').value;
  const y = document.getElementById('v-y').value;

  if (!id) {
    _showError('Informe um identificador.');
    return;
  }

  if (x === '' || y === '') {
    _showError('Informe as coordenadas X e Y.');
    return;
  }

  if (graph.n >= 12) {
    _showError('Máximo de 12 vértices atingido.');
    return;
  }

  const err = graph.addVertex(id, x, y);

  if (err) {
    _showError(err);
    return;
  }

  document.getElementById('v-id').value = '';
  document.getElementById('v-x').value = '';
  document.getElementById('v-y').value = '';

  _afterGraphChange();
}

function removeVertex(id) {
  if (graph.n <= 4) {
    _showError('Mínimo de 4 vértices — não é possível remover.');
    return;
  }

  const err = graph.removeVertex(id);

  if (err) {
    _showError(err);
    return;
  }

  _afterGraphChange();
}

window.removeVertex = removeVertex;

function openEditModal(id) {
  const v = graph.vertices.find(v => v.id === id);

  if (!v) return;

  document.getElementById('edit-old-id').value = id;
  document.getElementById('edit-id').value = v.id;
  document.getElementById('edit-x').value = v.x;
  document.getElementById('edit-y').value = v.y;
  document.getElementById('edit-modal').style.display = 'flex';
}

window.openEditModal = openEditModal;

function _onEditSave() {
  const oldId = document.getElementById('edit-old-id').value;
  const newId = document.getElementById('edit-id').value.trim();
  const x = document.getElementById('edit-x').value;
  const y = document.getElementById('edit-y').value;

  if (!newId) {
    _showError('Identificador não pode ser vazio.');
    return;
  }

  if (x === '' || y === '') {
    _showError('Coordenadas não podem ser vazias.');
    return;
  }

  const err = graph.editVertex(oldId, newId, x, y);

  if (err) {
    _showError(err);
    return;
  }

  document.getElementById('edit-modal').style.display = 'none';

  _afterGraphChange();
}

function _afterGraphChange() {
  _renderVertexTable();
  _buildDepotSelect();
  _buildScene();
  _onConfigChange();
}

/**
 * Qualquer alteração em dados ou parâmetros exige Reiniciar: se houver uma
 * execução em andamento ela é pausada e não pode ser retomada nem avançada.
 */
function _onConfigChange(e) {
  if (e && e.target && e.target.id === 'depot-select' && !aco) _buildScene();
  if (!aco) return; // nada calculado ainda: a próxima execução já usa os novos valores
  needsReset = true;
  _markNeedsReset();
  if (simRunning && !simPaused) _onPause();
}

function _buildDepotSelect() {
  const sel = document.getElementById('depot-select');
  const prev = sel.value;

  sel.innerHTML = '';

  graph.vertices.forEach(v => {
    const opt = document.createElement('option');

    opt.value = v.id;
    opt.textContent = v.id;

    if (v.id === prev) {
      opt.selected = true;
    }

    sel.appendChild(opt);
  });
}

// ─── Cena 3D ──────────────────────────────────────────────────────────────────
function _buildScene() {
  const tau0 = parseFloat(document.getElementById('tau0').value) || 1;
  const n = graph.n;

  const tau = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      i === j ? 0 : tau0
    )
  );

  renderer.buildScene(graph, _getDepotId(), tau);
}

function _getDepotId() {
  return document.getElementById('depot-select').value ||
    graph.vertices[0]?.id;
}

// ─── Parâmetros e validação ───────────────────────────────────────────────────
function _getParams() {
  const get = id => parseFloat(document.getElementById(id).value);
  const getInt = id => parseInt(document.getElementById(id).value, 10);

  return {
    alpha: get('alpha'),
    beta: get('beta'),
    rho: get('rho') / 100,
    tau0: get('tau0'),
    Q: get('q-val'),
    numAnts: getInt('num-ants'),
    numIter: getInt('num-iter'),
    depotId: _getDepotId(),
    seed: getInt('seed'),
    raw: {
      numAnts: document.getElementById('num-ants').value.trim(),
      numIter: document.getElementById('num-iter').value.trim(),
      seed: document.getElementById('seed').value.trim()
    }
  };
}

function _validateParams(p) {
  // Campos inteiros: recusa decimais em vez de truncar (10.7 não vira 10)
  const inteiro = /^\d+$/;
  if (!inteiro.test(p.raw.numAnts)) return 'Formigas: informe um inteiro entre 1 e 100.';
  if (!inteiro.test(p.raw.numIter)) return 'Iterações: informe um inteiro entre 1 e 200.';
  if (!inteiro.test(p.raw.seed)) return 'A semente aleatória deve ser um inteiro não negativo.';

  if (!Number.isFinite(p.alpha) || p.alpha < 0 || p.alpha > 5) {
    return 'α deve estar entre 0 e 5.';
  }

  if (!Number.isFinite(p.beta) || p.beta < 0 || p.beta > 5) {
    return 'β deve estar entre 0 e 5.';
  }

  if (!Number.isFinite(p.rho) || p.rho < 0 || p.rho > 0.9) {
    return 'ρ deve estar entre 0% e 90%.';
  }

  if (!Number.isFinite(p.tau0) || p.tau0 < 0.01 || p.tau0 > 100) {
    return 'τ₀ deve estar entre 0,01 e 100.';
  }

  if (!Number.isFinite(p.Q) || p.Q < 0.01 || p.Q > 10000) {
    return 'Q deve estar entre 0,01 e 10000.';
  }

  if (!Number.isInteger(p.numAnts) || p.numAnts < 1 || p.numAnts > 100) {
    return 'Formigas: informe um inteiro entre 1 e 100.';
  }

  if (!Number.isInteger(p.numIter) || p.numIter < 1 || p.numIter > 200) {
    return 'Iterações: informe um inteiro entre 1 e 200.';
  }

  if (!Number.isInteger(p.seed) || p.seed < 0) {
    return 'A semente aleatória deve ser um inteiro não negativo.';
  }

  if (graph.n < 4 || graph.n > 12) {
    return 'O grafo precisa ter entre 4 e 12 vértices.';
  }

  if (!p.depotId || graph.indexOf(p.depotId) === -1) {
    return 'Selecione um vértice válido como depósito.';
  }

  return null;
}

// ─── Controles ────────────────────────────────────────────────────────────────
let runGraph = null; // cópia do grafo usada pela execução atual

/** Cria uma nova execução com os dados e parâmetros atuais (iteração 0). */
function _novaExecucao() {
  const params = _getParams();
  const err = _validateParams(params);

  if (err) {
    _showError(err);
    return false;
  }

  rng = new SeededRNG(params.seed);

  logger.reset();
  evChart.reset();

  needsReset = false;
  _clearNeedsReset();

  runGraph = graph.clone();
  aco = new AntSystem(runGraph, params, rng, result => _onIterComplete(result, runGraph), null);

  _buildScene();
  _updateStatusBar(null);
  return true;
}

function _bloqueioDeExecucao() {
  if (aco && needsReset) {
    return 'Dados ou parâmetros alterados: clique em Reiniciar para aplicá-los.';
  }
  if (aco && aco.isFinished()) {
    return 'Todas as iterações já foram concluídas. Clique em Reiniciar para recomeçar.';
  }
  return null;
}

async function _onRun() {
  if (simRunning && !simPaused) return;

  const bloqueio = _bloqueioDeExecucao();
  if (bloqueio) {
    _showError(bloqueio);
    return;
  }

  if (!aco && !_novaExecucao()) return;

  simRunning = true;
  simPaused = false;
  _setButtons('running');

  // Pausado dentro do laço: apenas retoma
  if (aco.isRunning()) {
    aco.resume();
    return;
  }

  // Sem laço ativo (início ou depois de "Avançar"): continua da iteração atual
  const atual = aco;
  await atual.runAll(() => parseInt(document.getElementById('speed-range').value, 10) || 0);

  if (aco === atual && !atual._stopped) {
    simRunning = false;
    simPaused = false;
    _setButtons(atual.isFinished() ? 'done' : 'paused');
  }
}

function _onPause() {
  if (!simRunning || simPaused) return;

  simPaused = true;
  aco.pause();

  _setButtons('paused');
}

function _onStep() {
  if (simRunning && !simPaused) return;

  const bloqueio = _bloqueioDeExecucao();
  if (bloqueio) {
    _showError(bloqueio);
    return;
  }

  if (!aco && !_novaExecucao()) return;

  aco.step();
  simPaused = true;
  _setButtons(aco.isFinished() ? 'done' : 'paused');
}

function _onReset() {
  if (aco) aco.stop();

  _runAllPromise = null;
  aco = null;
  runGraph = null;
  simRunning = false;
  simPaused = false;
  needsReset = false;

  logger.reset();
  evChart.reset();
  renderer.clearAnts();

  _buildScene();
  _updateStatusBar(null);
  _setButtons('idle');
  _clearNeedsReset();
}

// ─── Callback de iteração ─────────────────────────────────────────────────────
function _onIterComplete(result, g) {
  const escala = renderer.updatePheromones(result.tau, g);
  _updateLegend(escala, result.iter);
  renderer.highlightBestRoute(result.bestRoute, g);

  if (document.getElementById('chk-animate-ants')?.checked) {
    renderer.launchAnts(
      result.antResults.map(a => a.route),
      g
    );
  }

  evChart.addPoint(
    result.iter,
    result.bestLength,
    result.iterBestLength,
    result.avgLength
  );

  logger.addIterRow(
    result.iter,
    result.iterBestLength,
    result.avgLength,
    result.bestLength,
    result.bestRoute,
    g
  );

  logger.logIterHeader(result.iter);
  if (document.getElementById('chk-log-steps')?.checked) {
    logger.logRouteConstruction(result.antResults[0], 0, g);
  }
  logger.logRouteLengths(result.antResults);
  if (document.getElementById('chk-log-pheromone')?.checked) {
    logger.logPheromone(result.pheromoneLog);
  }

  _updateStatusBar(result, g);
}

/** Legenda numérica da escala de feromônio (logarítmica; muda só se τ_ref aumentar). */
function _fmtTau(v) {
  if (v !== 0 && Math.abs(v) < 0.001) return v.toExponential(2).replace('.', ',');
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
}

function _legendLimits(ref) {
  document.getElementById('legend-min').textContent = '≤ ' + _fmtTau(ref * Math.pow(10, -DECADAS_ESCALA));
  document.getElementById('legend-max').textContent = _fmtTau(ref);
}

function _updateLegend(escala, iter) {
  _legendLimits(escala.ref);
  const nota = document.getElementById('scale-note');
  const atual = `Feromônio atual: mín ${_fmtTau(escala.min)}, máx ${_fmtTau(escala.max)}.`;
  nota.textContent = escala.changed
    ? `Iteração ${iter}: a escala mudou (τ_ref ${_fmtTau(escala.prevRef)} → ${_fmtTau(escala.ref)}); a mesma cor agora representa mais feromônio. ${atual}`
    : `Iteração ${iter}: escala logarítmica inalterada (τ_ref = ${_fmtTau(escala.ref)}). ${atual}`;
  nota.classList.toggle('mudou', escala.changed);
}

function _resetLegend() {
  const tau0 = parseFloat(document.getElementById('tau0').value) || 1;
  _legendLimits(tau0);
  const nota = document.getElementById('scale-note');
  nota.textContent = `Iteração 0: τ = ${_fmtTau(tau0)} em todas as arestas (τ_ref = τ₀). Escala logarítmica: cada sexto da barra corresponde a um fator 10.`;
  nota.classList.remove('mudou');
}

// ─── Barra de status ──────────────────────────────────────────────────────────
function _updateStatusBar(result, g = graph) {
  const el = id => document.getElementById(id);

  if (!result) {
    _resetLegend();
    el('stat-iter').textContent = '0 / —';
    el('stat-best').textContent = 'ainda não calculada';
    el('stat-iter-best').textContent = '—';
    el('stat-avg').textContent = '—';
    el('stat-route').textContent = '—';

    return;
  }

  const total = aco?.params?.numIter ?? '?';

  el('stat-iter').textContent = `${result.iter} / ${total}`;
  el('stat-best').textContent = result.bestLength.toFixed(4);
  el('stat-iter-best').textContent = result.iterBestLength.toFixed(4);
  el('stat-avg').textContent = result.avgLength.toFixed(4);

  el('stat-route').textContent = result.bestRoute
    .map(i => g.vertices[i].id)
    .join(' → ');
}

// ─── Auxiliares da interface ──────────────────────────────────────────────────
function _setButtons(state) {
  const run = document.getElementById('btn-run');
  const pause = document.getElementById('btn-pause');
  const step = document.getElementById('btn-step');

  if (state === 'running') {
    run.disabled = true;
    run.textContent = '▶ Executar';
    pause.disabled = false;
    step.disabled = true;
  } else if (state === 'paused') {
    run.disabled = false;
    run.textContent = '▶ Retomar';
    pause.disabled = true;
    step.disabled = false;
  } else if (state === 'done') {
    run.disabled = true;
    run.textContent = '▶ Executar';
    pause.disabled = true;
    step.disabled = true;
  } else {
    run.disabled = false;
    run.textContent = '▶ Executar';
    pause.disabled = true;
    step.disabled = false;
  }
}

function _markNeedsReset() {
  const el = document.getElementById('reset-banner');

  if (el) {
    el.style.display = 'block';
  }
}

function _clearNeedsReset() {
  const el = document.getElementById('reset-banner');

  if (el) {
    el.style.display = 'none';
  }
}

function _showError(msg) {
  const el = document.getElementById('error-msg');

  if (!el) {
    alert(msg);
    return;
  }

  el.textContent = msg;
  el.style.display = 'block';

  clearTimeout(el._timeout);

  el._timeout = setTimeout(() => {
    el.style.display = 'none';
  }, 5000);
}