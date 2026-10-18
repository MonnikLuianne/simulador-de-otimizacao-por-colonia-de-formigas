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
    this.logPanel.textContent += text + '\n';
    this.logPanel.scrollTop = this.logPanel.scrollHeight;
  }

  clearLog() {
    if (this.logPanel) this.logPanel.textContent = '';
    if (this.tbody) this.tbody.innerHTML = '';
    this.rows = [];
  }

  reset() { this.clearLog(); }
}