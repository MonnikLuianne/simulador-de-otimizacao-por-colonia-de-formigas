/**
 * renderer2d.js — Visualização 2D (Canvas) usada como reserva
 *
 * Quando o navegador não consegue criar um contexto WebGL (aceleração de
 * hardware desativada, driver bloqueado, máquina virtual) ou quando o
 * Three.js não carrega, o Renderer3D não pode ser criado. Esta classe tem a
 * mesma interface usada por main.js e desenha o mesmo grafo em 2D, com a
 * mesma escala de cores do feromônio, destaque da melhor rota, rótulos,
 * consulta de valores pelo cursor e animação opcional das formigas.
 * Ela só desenha: nenhum cálculo do algoritmo depende dela.
 */
class Renderer2D {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.graph = null;
    this.depotId = null;
    this.currentTau = null;
    this.tauRef = 1;          // referência da escala visual do feromônio
    this.selectedEdge = null; // aresta escolhida na tabela de arestas ("i-j")
    this.bestRoute = null;
    this.hoveredEdge = null;
    this.antAnimations = [];
    this.tooltip = document.getElementById('tooltip');
    this.zoom = 1;
    this.is2D = true;

    this.canvas.addEventListener('mousemove', e => this._onMouseMove(e));
    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredEdge = null;
      if (this.tooltip) this.tooltip.style.display = 'none';
    });
    window.addEventListener('resize', () => this._resize());
    this._resize();
    this._animate();
  }

  // ── Tamanho e transformação de coordenadas ─────────────────────────────────
  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = this.canvas.clientWidth || 800;
    const H = this.canvas.clientHeight || 600;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.W = W;
    this.H = H;
  }

  _bounds() {
    const vs = this.graph ? this.graph.vertices : [];
    if (!vs.length) return { minX: 0, maxX: 1000, minY: 0, maxY: 1000 };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    vs.forEach(v => {
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    });
    return { minX, maxX, minY, maxY };
  }

  /** Coordenadas do problema → pixels (eixo y para cima, como no modo 3D). */
  _toScreen(x, y) {
    const { minX, maxX, minY, maxY } = this._bounds();
    // margens deixam espaço para os painéis sobrepostos (status e legenda)
    const padL = 90, padR = 250, padT = 60, padB = 170;
    const spanX = Math.max(maxX - minX, 1);
    const spanY = Math.max(maxY - minY, 1);
    const areaW = Math.max(this.W - padL - padR, 50);
    const areaH = Math.max(this.H - padT - padB, 50);
    const s = Math.min(areaW / spanX, areaH / spanY) * this.zoom;
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const ox = padL + areaW / 2, oy = padT + areaH / 2;
    return { x: ox + (x - cx) * s, y: oy - (y - cy) * s };
  }

  // ── Interface usada por main.js ────────────────────────────────────────────
  buildScene(graph, depotId, tau) {
    this.graph = graph;
    this.depotId = depotId;
    this.currentTau = tau;
    this.bestRoute = null;
    this.antAnimations = [];
    const { max } = this._tauStats(tau, graph);
    this.tauRef = max > 0 ? max : 1;
  }

  updatePheromones(tau, graph) {
    this.currentTau = tau;
    this.graph = graph;
    const { min, max } = this._tauStats(tau, graph);
    const prevRef = this.tauRef;
    if (max > this.tauRef) this.tauRef = max;
    return { min, max, ref: this.tauRef, prevRef, changed: this.tauRef !== prevRef };
  }

  setSelectedEdge(key) {
    this.selectedEdge = key;
  }

  highlightBestRoute(route) {
    this.bestRoute = route ? route.slice() : null;
  }

  launchAnts(routes, graph) {
    this.antAnimations = [];
    const show = Math.min(routes.length, 15);
    for (let k = 0; k < show; k++) {
      const path = routes[k].map(idx => ({ x: graph.vertices[idx].x, y: graph.vertices[idx].y }));
      this.antAnimations.push({
        path,
        segIndex: 0,
        t: k / show,
        // variação fixa por formiga (apenas visual; não usa o gerador do algoritmo)
        speed: 0.4 + ((k * 7) % 10) * 0.03,
      });
    }
  }

  clearAnts() {
    this.antAnimations = [];
  }

  /** Usado pelos botões de zoom do cabeçalho. */
  zoomBy(factor) {
    this.zoom = Math.max(0.3, Math.min(5, this.zoom / factor));
  }

  _centerCamera() {
    this.zoom = 1;
  }

  // ── Escala de feromônio (idêntica à do Renderer3D) ─────────────────────────
  _tauStats(tau, graph) {
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < graph.n; i++) {
      for (let j = i + 1; j < graph.n; j++) {
        if (tau[i][j] > mx) mx = tau[i][j];
        if (tau[i][j] < mn) mn = tau[i][j];
      }
    }
    return { min: mn, max: mx };
  }

  _tauToVisual(tauVal) {
    if (!(tauVal > 0)) return 0;
    const t = 1 + Math.log10(tauVal / this.tauRef) / DECADAS_ESCALA;
    return Math.max(0, Math.min(1, t));
  }

  _tauColor(t, alpha) {
    const r = Math.round(30 + t * 225);
    const g = Math.round(40 + t * 130);
    const b = Math.round(180 - t * 150);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // ── Consulta de distância e feromônio pelo cursor ──────────────────────────
  _onMouseMove(e) {
    if (!this.graph || !this.currentTau) return;
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    let best = null, bestD = 8; // tolerância de 8 px

    for (let i = 0; i < this.graph.n; i++) {
      for (let j = i + 1; j < this.graph.n; j++) {
        const a = this._toScreen(this.graph.vertices[i].x, this.graph.vertices[i].y);
        const b = this._toScreen(this.graph.vertices[j].x, this.graph.vertices[j].y);
        const d = this._distPontoSegmento(mx, my, a, b);
        if (d < bestD) { bestD = d; best = [i, j]; }
      }
    }

    if (best) {
      const [i, j] = best;
      this.hoveredEdge = `${i}-${j}`;
      if (this.tooltip) {
        this.tooltip.style.display = 'block';
        this.tooltip.style.left = (e.clientX + 14) + 'px';
        this.tooltip.style.top = (e.clientY + 14) + 'px';
        this.tooltip.innerHTML =
          `<strong>${this.graph.vertices[i].id} ↔ ${this.graph.vertices[j].id}</strong><br>` +
          `Distância: <b>${this.graph.dist[i][j].toFixed(4)}</b><br>` +
          `Feromônio: <b>${fmtTauLog(this.currentTau[i][j])}</b>`;
      }
    } else {
      this.hoveredEdge = null;
      if (this.tooltip) this.tooltip.style.display = 'none';
    }
  }

  _distPontoSegmento(px, py, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((px - a.x) * dx + (py - a.y) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const qx = a.x + t * dx, qy = a.y + t * dy;
    return Math.hypot(px - qx, py - qy);
  }

  // ── Desenho ────────────────────────────────────────────────────────────────
  _animate() {
    requestAnimationFrame(() => this._animate());

    const dt = 0.016;
    for (const anim of this.antAnimations) {
      anim.t += anim.speed * dt;
      if (anim.t >= 1) {
        anim.segIndex++;
        anim.t = 0;
        if (anim.segIndex >= anim.path.length - 1) anim.segIndex = 0;
      }
    }

    if (this.canvas.clientWidth !== this.W || this.canvas.clientHeight !== this.H) this._resize();
    this._draw();
  }

  _draw() {
    const ctx = this.ctx;
    ctx.fillStyle = '#060610';
    ctx.fillRect(0, 0, this.W, this.H);
    if (!this.graph || !this.graph.n || !this.currentTau) return;

    const g = this.graph;
    const P = g.vertices.map(v => this._toScreen(v.x, v.y));

    // Arestas coloridas pelo feromônio
    for (let i = 0; i < g.n; i++) {
      for (let j = i + 1; j < g.n; j++) {
        const key = `${i}-${j}`;
        const t = this._tauToVisual(this.currentTau[i][j]);
        ctx.beginPath();
        ctx.moveTo(P[i].x, P[i].y);
        ctx.lineTo(P[j].x, P[j].y);
        if (key === this.selectedEdge || key === this.hoveredEdge) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
        } else {
          ctx.strokeStyle = this._tauColor(t, 0.35 + t * 0.6);
          ctx.lineWidth = 1 + t * 4;
        }
        ctx.stroke();
      }
    }

    // Melhor rota acumulada
    if (this.bestRoute) {
      ctx.strokeStyle = 'rgba(0,255,170,0.95)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      this.bestRoute.forEach((idx, k) => {
        if (k === 0) ctx.moveTo(P[idx].x, P[idx].y);
        else ctx.lineTo(P[idx].x, P[idx].y);
      });
      ctx.stroke();
      // repõe a aresta selecionada por cima da rota
      if (this.selectedEdge) {
        const [a, b] = this.selectedEdge.split('-').map(Number);
        if (P[a] && P[b]) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(P[a].x, P[a].y); ctx.lineTo(P[b].x, P[b].y); ctx.stroke();
        }
      }
    }

    // Formigas (opcional, apenas visual)
    ctx.fillStyle = '#ffcc00';
    for (const anim of this.antAnimations) {
      const a = anim.path[anim.segIndex], b = anim.path[anim.segIndex + 1];
      if (!a || !b) continue;
      const pa = this._toScreen(a.x, a.y), pb = this._toScreen(b.x, b.y);
      ctx.beginPath();
      ctx.arc(pa.x + (pb.x - pa.x) * anim.t, pa.y + (pb.y - pa.y) * anim.t, 4, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Vértices e rótulos
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = 'bold 15px sans-serif';
    g.vertices.forEach((v, i) => {
      const isDepot = v.id === this.depotId;
      const r = isDepot ? 11 : 7;
      ctx.beginPath();
      ctx.arc(P[i].x, P[i].y, r, 0, 2 * Math.PI);
      ctx.fillStyle = isDepot ? '#ff6600' : '#3399ff';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = isDepot ? '#ffa04d' : '#aaddff';
      ctx.stroke();

      const label = isDepot ? `${v.id} (depósito)` : v.id;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(6,6,16,0.95)';
      ctx.strokeText(label, P[i].x, P[i].y - r - 4);
      ctx.fillStyle = isDepot ? '#ffa04d' : '#d8f0ff';
      ctx.fillText(label, P[i].x, P[i].y - r - 4);
    });
  }
}
