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
let simPaused  = false;
let needsReset = true;
let _runAllPromise = null; // evita dois runAll simultâneos

// ─── Inicialização ────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  renderer = new Renderer3D(document.getElementById('three-canvas'));
  evChart  = new EvolutionChart('chart-canvas');
  logger   = new Logger('history-tbody', 'log-panel');
  rng      = new SeededRNG(42);

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
    el.addEventListener('change', () => { needsReset = true; _markNeedsReset(); });
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

// ─── Grafo padrão inicial (5-12 vértices conforme enunciado) ─────────────────
function _initDefaultGraph() {
  // Inicia com 7 vértices (entre 5 e 12)
  graph.addVertex('A', 0,   0);
  graph.addVertex('B', 300, 0);
  graph.addVertex('C', 300, 400);
  graph.addVertex('D', 0,   400);
  graph.addVertex('E', 150, 200);
  graph.addVertex('F', 600, 300);
  graph.addVertex('G', 500, 100);
}

// ─── Gerenciamento de vértices ────────────────────────────────────────────────
function _renderVertexTable() {
  const tbody = document.getElementById('vertex-tbody');
  tbody.innerHTML = '';
  graph.vertices.forEach(v => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td>${v.id}</td><td>${v.x}</td><td>${v.y}</td>` +
      `<td>` +
        `<button class="btn-sm btn-edit" onclick="openEditModal('${v.id}')">✏️</button>` +
        `<button class="btn-sm btn-del"  onclick="removeVertex('${v.id}')">🗑️</button>` +
      `</td>`;
    tbody.appendChild(tr);
  });
  const el = document.getElementById('vtx-count');
  if (el) el.textContent = `(${graph.n}/12)`;
}

function _onAddVertex() {
  const id = document.getElementById('v-id').value.trim();
  const x  = document.getElementById('v-x').value;
  const y  = document.getElementById('v-y').value;
  if (!id) { _showError('Informe um identificador.'); return; }
  if (x === '' || y === '') { _showError('Informe as coordenadas X e Y.'); return; }
  if (graph.n >= 12) { _showError('Máximo de 12 vértices atingido.'); return; }
  const err = graph.addVertex(id, x, y);
  if (err) { _showError(err); return; }
  document.getElementById('v-id').value = '';
  document.getElementById('v-x').value  = '';
  document.getElementById('v-y').value  = '';
  _afterGraphChange();
}

function removeVertex(id) {
  if (graph.n <= 4) { _showError('Mínimo de 4 vértices — não é possível remover.'); return; }
  const err = graph.removeVertex(id);
  if (err) { _showError(err); return; }
  _afterGraphChange();
}
window.removeVertex = removeVertex;

function openEditModal(id) {
  const v = graph.vertices.find(v => v.id === id);
  if (!v) return;
  document.getElementById('edit-old-id').value = id;
  document.getElementById('edit-id').value     = v.id;
  document.getElementById('edit-x').value      = v.x;
  document.getElementById('edit-y').value      = v.y;
  document.getElementById('edit-modal').style.display = 'flex';
}
window.openEditModal = openEditModal;

function _onEditSave() {
  const oldId = document.getElementById('edit-old-id').value;
  const newId = document.getElementById('edit-id').value.trim();
  const x     = document.getElementById('edit-x').value;
  const y     = document.getElementById('edit-y').value;
  if (!newId) { _showError('Identificador não pode ser vazio.'); return; }
  if (x === '' || y === '') { _showError('Coordenadas não podem ser vazias.'); return; }
  const err = graph.editVertex(oldId, newId, x, y);
  if (err) { _showError(err); return; }
  document.getElementById('edit-modal').style.display = 'none';
  _afterGraphChange();
}

function _afterGraphChange() {
  _renderVertexTable();
  _buildDepotSelect();
  _buildScene();
  needsReset = true;
  _markNeedsReset();
}

function _buildDepotSelect() {
  const sel  = document.getElementById('depot-select');
  const prev = sel.value;
  sel.innerHTML = '';
  graph.vertices.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = v.id;
    if (v.id === prev) opt.selected = true;
    sel.appendChild(opt);
  });
}

// ─── Cena 3D ──────────────────────────────────────────────────────────────────
function _buildScene() {
  const tau0 = parseFloat(document.getElementById('tau0').value) || 1;
  const n    = graph.n;
  const tau  = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 0 : tau0))
  );
  renderer.buildScene(graph, _getDepotId(), tau);
}

function _getDepotId() {
  return document.getElementById('depot-select').value || graph.vertices[0]?.id;
}

// ─── Parâmetros e validação ───────────────────────────────────────────────────
function _getParams() {
  const get    = id => parseFloat(document.getElementById(id).value);
  const getInt = id => parseInt(document.getElementById(id).value, 10);
  return {
    alpha:   get('alpha'),
    beta:    get('beta'),
    rho:     get('rho') / 100,   // % → fração
    tau0:    get('tau0'),
    Q:       get('q-val'),
    numAnts: getInt('num-ants'),
    numIter: getInt('num-iter'),
    depotId: _getDepotId(),
    seed:    getInt('seed'),
  };
}

function _validateParams(p) {
  const empty = v => v === '' || v === null || v === undefined;
  if (isNaN(p.alpha)   || p.alpha < 0       || p.alpha > 5)      return 'α deve estar entre 0 e 5.';
  if (isNaN(p.beta)    || p.beta  < 0       || p.beta  > 5)      return 'β deve estar entre 0 e 5.';
  if (isNaN(p.rho)     || p.rho   < 0       || p.rho   > 0.9)    return 'ρ deve estar entre 0% e 90%.';
  if (isNaN(p.tau0)    || p.tau0  < 0.01    || p.tau0  > 100)    return 'τ₀ deve estar entre 0,01 e 100.';
  if (isNaN(p.Q)       || p.Q     < 0.01    || p.Q     > 10000)  return 'Q deve estar entre 0,01 e 10000.';
  if (isNaN(p.numAnts) || p.numAnts < 1     || p.numAnts > 100)  return 'Formigas: inteiro entre 1 e 100.';
  if (isNaN(p.numIter) || p.numIter < 1     || p.numIter > 200)  return 'Iterações: inteiro entre 1 e 200.';
  if (graph.n < 4)                                                return 'O grafo precisa de pelo menos 4 vértices.';
  if (!p.depotId)                                                 return 'Selecione o vértice depósito.';
  return null;
}

// ─── Controles ────────────────────────────────────────────────────────────────
async function _onRun() {
  // Se já está rodando (não pausado), ignora
  if (simRunning && !simPaused) return;

  // Retomar após pausa: não cria novo ACO, não reseta RNG
  if (simPaused && aco) {
    simPaused  = false;
    simRunning = true;
    _setButtons('running');
    aco.resume();
    return;
  }

  // Novo run
  const params = _getParams();
  const err = _validateParams(params);
  if (err) { _showError(err); return; }

  // Novo RNG com semente — só aqui, não no retomar
  rng = new SeededRNG(params.seed);

  // Reinicia se dados/params mudaram
  logger.reset();
  evChart.reset();
  needsReset = false;
  _clearNeedsReset();

  aco = new AntSystem(graph, params, rng, _onIterComplete, null);
  aco.onAntStep = step => {
    if (document.getElementById('chk-log-steps')?.checked) {
      logger.logAntStep(step);
    }
  };
  _buildScene();
  _updateStatusBar(null);

  simRunning = true;
  simPaused  = false;
  _setButtons('running');

  const speedMs = parseInt(document.getElementById('speed-range').value, 10);
  _runAllPromise = aco.runAll(speedMs);
  await _runAllPromise;

  // Terminou normalmente
  if (!aco._stopped) {
    simRunning = false;
    simPaused  = false;
    _setButtons('idle');
  }
}

function _onPause() {
  if (!simRunning || simPaused) return;
  simPaused = true;
  aco.pause();
  _setButtons('paused');
}

function _onStep() {
  // Não permite step durante execução contínua
  if (simRunning && !simPaused) return;

  // Inicializa ACO se necessário
  if (!aco || needsReset) {
    const params = _getParams();
    const err = _validateParams(params);
    if (err) { _showError(err); return; }
    rng = new SeededRNG(params.seed);
    logger.reset();
    evChart.reset();
    needsReset = false;
    _clearNeedsReset();
    aco = new AntSystem(graph, params, rng, _onIterComplete, null);
    aco.onAntStep = step => {
      if (document.getElementById('chk-log-steps')?.checked) logger.logAntStep(step);
    };
    _buildScene();
    _updateStatusBar(null);
  }

  if (aco.currentIter >= aco.params.numIter) {
    _showError('Todas as iterações já foram concluídas. Reinicie para recomeçar.');
    return;
  }

  simPaused = true;
  aco.step();
  _setButtons('paused');
}

function _onReset() {
  if (aco) aco.stop();
  _runAllPromise = null;
  aco        = null;
  simRunning = false;
  simPaused  = false;
  needsReset = true;
  logger.reset();
  evChart.reset();
  renderer.clearAnts();
  _buildScene();
  _updateStatusBar(null);
  _setButtons('idle');
  _clearNeedsReset();
}

// ─── Callback de iteração ─────────────────────────────────────────────────────
function _onIterComplete(result) {
  renderer.updatePheromones(result.tau, graph);
  renderer.highlightBestRoute(result.bestRoute, graph);

  if (document.getElementById('chk-animate-ants')?.checked) {
    renderer.launchAnts(result.antResults.map(a => a.route), graph);
  }

  evChart.addPoint(result.iter, result.bestLength, result.iterBestLength, result.avgLength);
  logger.addIterRow(result.iter, result.iterBestLength, result.avgLength, result.bestLength, result.bestRoute, graph);

  if (document.getElementById('chk-log-pheromone')?.checked) {
    logger.logPheromone(result.pheromoneLog);
  }

  _updateStatusBar(result);
}

// ─── Status bar ───────────────────────────────────────────────────────────────
function _updateStatusBar(result) {
  const el = id => document.getElementById(id);
  if (!result) {
    el('stat-iter').textContent      = '0 / —';
    el('stat-best').textContent      = 'ainda não calculada';
    el('stat-iter-best').textContent = '—';
    el('stat-avg').textContent       = '—';
    el('stat-route').textContent     = '—';
    return;
  }
  const total = aco?.params?.numIter ?? '?';
  el('stat-iter').textContent      = `${result.iter} / ${total}`;
  el('stat-best').textContent      = result.bestLength.toFixed(4);
  el('stat-iter-best').textContent = result.iterBestLength.toFixed(4);
  el('stat-avg').textContent       = result.avgLength.toFixed(4);
  el('stat-route').textContent     = result.bestRoute.map(i => graph.vertices[i].id).join(' → ');
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function _setButtons(state) {
  const run   = document.getElementById('btn-run');
  const pause = document.getElementById('btn-pause');
  const step  = document.getElementById('btn-step');

  if (state === 'running') {
    run.disabled   = true;
    run.textContent = '▶ Executar';
    pause.disabled = false;
    step.disabled  = true;
  } else if (state === 'paused') {
    run.disabled   = false;
    run.textContent = '▶ Retomar';
    pause.disabled = true;
    step.disabled  = false;
  } else { // idle
    run.disabled   = false;
    run.textContent = '▶ Executar';
    pause.disabled = true;
    step.disabled  = false;
  }
}

function _markNeedsReset() {
  const el = document.getElementById('reset-banner');
  if (el) el.style.display = 'block';
}
function _clearNeedsReset() {
  const el = document.getElementById('reset-banner');
  if (el) el.style.display = 'none';
}
function _showError(msg) {
  const el = document.getElementById('error-msg');
  if (!el) { alert(msg); return; }
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => { el.style.display = 'none'; }, 5000);
}