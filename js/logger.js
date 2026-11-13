/**
 * logger.js — Registro de iterações, rotas e feromônios
 */
/**
 * Formata feromônio para exibição: valores muito pequenos (ex.: 1e-9) aparecem
 * em notação científica para não serem confundidos com zero. Os cálculos
 * internos não são arredondados.
 */
function fmtTauLog(v) {
  return (v !== 0 && Math.abs(v) < 1e-4) ? v.toExponential(3) : v.toFixed(6);
}

class Logger {
  constructor(tableBodyId, logPanelId) {
    this.tbody = document.getElementById(tableBodyId);
    this.logPanel = document.getElementById(logPanelId);
    this.rows = [];
  }

  addIterRow(iter, iterBest, avg, bestAcc, route, graph) {
    const routeStr = route.map(i => graph.vertices[i].id).join(' → ');
    const row = { iter, iterBest, avg, bestAcc, routeStr };
    this.rows.push(row);

    // Duas linhas por iteração: os números e, abaixo, a rota completa
    // (sem cortar com "..." mesmo com muitos vértices).
    const trNums = document.createElement('tr');
    trNums.className = 'iter-nums';
    trNums.innerHTML = `
      <td>${iter}</td>
      <td>${iterBest.toFixed(4)}</td>
      <td>${avg.toFixed(4)}</td>
      <td>${bestAcc.toFixed(4)}</td>
    `;
    const trRota = document.createElement('tr');
    trRota.className = 'iter-route';
    const td = document.createElement('td');
    td.colSpan = 4;
    td.className = 'route-cell';
    td.textContent = routeStr;
    trRota.appendChild(td);

    this.tbody.prepend(trRota); // mais recente no topo
    this.tbody.prepend(trNums);
  }

  logPheromone(pheromoneLog) {
    if (!this.logPanel) return;
    const lines = pheromoneLog.map(p =>
      `  ${p.idI}↔${p.idJ}: anterior ${fmtTauLog(p.before)} | após evap ${fmtTauLog(p.afterEvap)} | depósito ${fmtTauLog(p.deposit)} | final ${fmtTauLog(p.final)}`
    );
    this._appendLog('🧪 Feromônios:\n' + lines.join('\n'));
  }

  /**
   * Construção completa de uma rota: vértice atual, candidatos com
   * probabilidades, vértice escolhido, retorno ao depósito e comprimento.
   */
  logRouteConstruction(antResult, antIndex, graph) {
    if (!this.logPanel) return;
    const id = i => graph.vertices[i].id;
    const lines = [`🐜 Construção da rota da formiga ${antIndex + 1}:`];
    antResult.steps.forEach((s, k) => {
      const cands = s.candidateIds
        .map((c, m) => `${c} (p=${s.probs[m].toFixed(6)})`)
        .join(', ');
      lines.push(`  ${k + 1}. em ${s.fromId} → candidatos: ${cands} → sorteado: ${s.chosenId}`);
    });
    const r = antResult.route;
    lines.push(`  ${antResult.steps.length + 1}. todos visitados → retorno obrigatório ao depósito: ${id(r[r.length - 2])} → ${id(r[r.length - 1])}`);
    lines.push(`  Rota: ${r.map(id).join(' → ')} | comprimento L = ${antResult.length.toFixed(6)}`);
    this._appendLog(lines.join('\n'));
  }

  /** Melhor rota da iteração e melhor rota acumulada. */
  logBestRoutes(result, graph) {
    if (!this.logPanel) return;
    const str = r => r.map(i => graph.vertices[i].id).join(' → ');
    this._appendLog(
      `🏁 Melhor da iteração: ${str(result.iterBestRoute)} (L = ${result.iterBestLength.toFixed(6)})\n` +
      `🏆 Melhor acumulada: ${str(result.bestRoute)} (L = ${result.bestLength.toFixed(6)})`
    );
  }

  /** Comprimento da rota de cada formiga da iteração. */
  logRouteLengths(antResults) {
    if (!this.logPanel) return;
    const items = antResults.map((a, k) => `F${k + 1}=${a.length.toFixed(4)}`).join(', ');
    this._appendLog(`📏 Comprimentos das rotas: ${items}`);
  }

  logAntStep(step) {
    if (!this.logPanel) return;
    const candStr = step.candidateIds.map((id, k) =>
      `${id}(p=${(step.probs[k] * 100).toFixed(1)}%)`
    ).join(', ');
    this._appendLog(
      `🐜 Formiga ${step.ant + 1} | ${step.fromId} → candidatos: [${candStr}] → escolheu: ${step.chosenId}`
    );
  }

  logIterHeader(iter) {
    this._appendLog(`\n━━━ Iteração ${iter} ━━━`);
  }

  _appendLog(text) {
    if (!this.logPanel) return;
    // Acrescenta um nó de texto (textContent += recopiaria o log inteiro a
    // cada linha e travaria a página em execuções longas).
    this.logPanel.insertAdjacentText('beforeend', text + '\n');
    this.logPanel.scrollTop = this.logPanel.scrollHeight;
  }

  clearLog() {
    if (this.logPanel) this.logPanel.textContent = '';
    if (this.tbody) this.tbody.innerHTML = '';
    this.rows = [];
  }

  reset() { this.clearLog(); }
}
