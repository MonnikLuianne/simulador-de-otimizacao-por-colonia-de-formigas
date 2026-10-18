/**
 * aco.js — Implementação do Ant System
 * Variante: Ant System clássico (Dorigo, 1992)
 */
class AntSystem {
  constructor(graph, params, rng, onIter, onAntStep) {
    this.graph = graph;
    this.params = params;
    this.rng = rng;
    this.onIter = onIter;
    this.onAntStep = onAntStep || null;

    const n = graph.n;
    // Matriz de feromônio simétrica; diagonal = 0
    this.tau = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 0 : params.tau0))
    );

    this.bestRoute = null;
    this.bestLength = Infinity;
    this.iterHistory = [];
    this.currentIter = 0;   // próxima iteração a executar (1-indexed na exibição)
    this._paused = false;
    this._stopped = false;
    this._resumeResolve = null;
  }

  // ── Peso de escolha w(i,j) = τ^α × η^β ─────────────────────────────────────
  _weight(i, j, tau) {
    const { alpha, beta } = this.params;
    const d = this.graph.dist[i][j];
    if (d === 0) return 0;
    // α=0 → τ^0 = 1 para qualquer τ; β=0 → η^0 = 1
    const tauPow = (alpha === 0) ? 1 : Math.pow(tau[i][j], alpha);
    const etaPow = (beta  === 0) ? 1 : Math.pow(1 / d, beta);
    return tauPow * etaPow;
  }

  // ── Constrói rota de uma formiga usando o snapshot de feromônio ─────────────
  _buildRoute(depotIdx, antIndex, tauSnap) {
    const n = this.graph.n;
    const visited = new Array(n).fill(false);
    const route = [depotIdx];
    const steps = [];
    visited[depotIdx] = true;
    let current = depotIdx;

    while (route.length < n) {
      const candidates = [];
      const weights = [];

      for (let j = 0; j < n; j++) {
        if (!visited[j]) {
          candidates.push(j);
          weights.push(this._weight(current, j, tauSnap));
        }
      }

      // Probabilidades p(i,j) = w(i,j) / Σw
      const totalW = weights.reduce((a, b) => a + b, 0);
      const probs = (totalW > 0)
        ? weights.map(w => w / totalW)
        : weights.map(() => 1 / candidates.length); // α=β=0: uniforme

      // Sorteio por roleta usando os pesos brutos (ou uniforme se todos zero)
      const chosenLocal = this.rng.rouletteSelect(
        totalW > 0 ? weights : weights.map(() => 1)
      );
      const chosen = candidates[chosenLocal];

      const stepInfo = {
        ant: antIndex,
        iter: this.currentIter + 1, // exibição 1-indexed
        from: current,
        chosen,
        fromId: this.graph.vertices[current].id,
        chosenId: this.graph.vertices[chosen].id,
        candidateIds: candidates.map(c => this.graph.vertices[c].id),
        probs: probs.slice(),
      };
      steps.push(stepInfo);
      if (this.onAntStep) this.onAntStep(stepInfo);

      visited[chosen] = true;
      route.push(chosen);
      current = chosen;
    }

    // Retorno obrigatório ao depósito
    route.push(depotIdx);

    // Comprimento total incluindo o retorno
    let length = 0;
    for (let k = 0; k < route.length - 1; k++) {
      length += this.graph.dist[route[k]][route[k + 1]];
    }

    return { route, length, steps };
  }

  // ── Executa uma iteração completa ────────────────────────────────────────────
  runIteration() {
    const { numAnts, rho, Q } = this.params;
    const depotIdx = this.graph.indexOf(this.params.depotId);
    const n = this.graph.n;

    // Snapshot: todas as formigas usam o tau do FIM da iteração anterior
    const tauSnap = this.tau.map(row => row.slice());

    // Constrói rotas de todas as formigas com o mesmo snapshot
    const antResults = [];
    for (let k = 0; k < numAnts; k++) {
      antResults.push(this._buildRoute(depotIdx, k, tauSnap));
    }

    // Melhor da iteração
    const iterBest = antResults.reduce((a, b) => a.length < b.length ? a : b);

    // Evaporação + depósito (somente depois de todas as formigas terminarem)
    const pheromoneLog = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const before    = this.tau[i][j];
        const afterEvap = (1 - rho) * before;

        // Soma depósito de cada formiga; cada formiga conta UMA vez por aresta
        let deposit = 0;
        for (const ant of antResults) {
          const r = ant.route;
          for (let s = 0; s < r.length - 1; s++) {
            const a = r[s], b = r[s + 1];
            if ((a === i && b === j) || (a === j && b === i)) {
              deposit += Q / ant.length;
              break; // evita dupla contagem na mesma aresta pela mesma formiga
            }
          }
        }

        // Piso numérico de 10^-12; diagonal nunca recebe feromônio
        const finalTau = Math.max(afterEvap + deposit, 1e-12);
        this.tau[i][j] = finalTau;
        this.tau[j][i] = finalTau;

        pheromoneLog.push({
          i, j,
          idI: this.graph.vertices[i].id,
          idJ: this.graph.vertices[j].id,
          before, afterEvap, deposit,
          final: finalTau,
        });
      }
    }

    // Atualiza melhor global (nunca aumenta)
    if (iterBest.length < this.bestLength) {
      this.bestLength = iterBest.length;
      this.bestRoute  = iterBest.route.slice();
    }

    const avgLength = antResults.reduce((s, a) => s + a.length, 0) / numAnts;
    const iterNum   = this.currentIter + 1; // exibição 1-indexed

    const iterResult = {
      iter: iterNum,
      antResults,
      iterBestRoute:  iterBest.route,
      iterBestLength: iterBest.length,
      avgLength,
      bestLength: this.bestLength,
      bestRoute:  this.bestRoute.slice(),
      pheromoneLog,
      tau: this.tau.map(r => r.slice()),
    };

    this.iterHistory.push(iterResult);
    this.currentIter++;
    if (this.onIter) this.onIter(iterResult);
    return iterResult;
  }

  // ── Execução assíncrona completa com suporte a pause/resume ─────────────────
  async runAll(speedMs = 300) {
    this._stopped = false;
    this._paused  = false;
    const total = this.params.numIter;

    while (this.currentIter < total && !this._stopped) {
      if (this._paused) {
        await new Promise(r => { this._resumeResolve = r; });
        if (this._stopped) break;
      }
      this.runIteration();
      if (speedMs > 0) await new Promise(r => setTimeout(r, speedMs));
    }
  }

  pause() {
    this._paused = true;
  }

  resume() {
    this._paused = false;
    if (this._resumeResolve) {
      this._resumeResolve();
      this._resumeResolve = null;
    }
  }

  stop() {
    this._stopped = true;
    this.resume(); // desbloqueia o await caso esteja pausado
  }

  /** Avança exatamente uma iteração e permanece pausado */
  step() {
    if (this.currentIter < this.params.numIter) {
      return this.runIteration();
    }
    return null;
  }

  /** Reinicia mantendo o mesmo grafo e parâmetros */
  reset() {
    const n    = this.graph.n;
    const tau0 = this.params.tau0;
    this.tau = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 0 : tau0))
    );
    this.bestRoute   = null;
    this.bestLength  = Infinity;
    this.iterHistory = [];
    this.currentIter = 0;
    this._paused     = false;
    this._stopped    = false;
    this._resumeResolve = null;
    this.rng.reset();
  }
}