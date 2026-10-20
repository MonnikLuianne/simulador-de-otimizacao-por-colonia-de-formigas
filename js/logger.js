/**
 * logger.js — Registro de iterações, rotas e feromônios
 */
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

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${iter}</td>
      <td>${iterBest.toFixed(4)}</td>
      <td>${avg.toFixed(4)}</td>
      <td>${bestAcc.toFixed(4)}</td>
      <td class="route-cell">${routeStr}</td>
    `;
    this.tbody.prepend(tr); // mais recente no topo
  }

  logPheromone(pheromoneLog) {
    if (!this.logPanel) return;
    const lines = pheromoneLog.map(p =>
      `  ${p.idI}↔${p.idJ}: anterior ${p.before.toFixed(6)} | após evap ${p.afterEvap.toFixed(6)} | depósito ${p.deposit.toFixed(6)} | final ${p.final.toFixed(6)}`
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