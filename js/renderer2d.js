const DECADAS_ESCALA = 6; // ordens de grandeza cobertas pela escala de cor

/**
 * renderer2d.js — Visualização do grafo em 2D (Canvas)
 *
 * Desenha o grafo completo com as arestas coloridas e engrossadas conforme o
 * feromônio (escala logarítmica), destaque da melhor rota acumulada, rótulos
 * dos vértices e do depósito, consulta de distância e feromônio pelo cursor e
 * animação opcional das formigas. Usa apenas a API Canvas 2D do navegador.
 *
 * Legibilidade:
 *  - o grafo ocupa a maior área livre do painel, desviando dos quadros de
 *    status e de legenda (o espaço é recalculado quando a janela muda);
 *  - zoom pelos botões ou pela roda do mouse; arrastar move a vista;
 *  - rótulos com fundo, posicionados para fora do grafo para não cobrir arestas.
 *
 * Esta classe só desenha: nenhum cálculo do algoritmo depende dela.
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
    this.pan = { x: 0, y: 0 };  // deslocamento da vista em pixels
    this.view = null;           // { ox, oy, s, cx, cy } calculado a cada quadro
    this.is2D = true;

    this._arrastando = false;
    this._ultimoMouse = null;

    this.canvas.style.cursor = 'grab';
    this.canvas.addEventListener('mousemove', e => this._onMouseMove(e));
    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredEdge = null;
      this._arrastando = false;
      this.canvas.style.cursor = 'grab';
      if (this.tooltip) this.tooltip.style.display = 'none';
    });
    this.canvas.addEventListener('mousedown', e => {
      this._arrastando = true;
      this._ultimoMouse = { x: e.clientX, y: e.clientY };
      this.canvas.style.cursor = 'grabbing';
    });
    window.addEventListener('mouseup', () => {
      this._arrastando = false;
      this.canvas.style.cursor = 'grab';
    });
    this.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      this.zoomBy(e.deltaY < 0 ? 0.9 : 1.1);
    }, { passive: false });
    this.canvas.addEventListener('dblclick', () => this._centerCamera());

    window.addEventListener('resize', () => this._resize());
    this._resize();
    this._animate();
  }

  // ── Tamanho e área livre ───────────────────────────────────────────────────
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

  /** Retângulo (em pixels do canvas) ocupado por um quadro sobreposto. */
  _retanguloOverlay(id) {
    const el = document.getElementById(id);
    if (!el || el.offsetParent === null) return null;
    const c = this.canvas.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x0: r.left - c.left, y0: r.top - c.top, x1: r.right - c.left, y1: r.bottom - c.top };
  }

  /**
   * Escolhe a maior região retangular que não fica embaixo dos quadros de
   * status (canto superior direito) e de legenda (canto inferior esquerdo).
   */
  _areaLivre() {
    const W = this.W, H = this.H, m = 8;
    const st = this._retanguloOverlay('status-overlay');
    const lg = this._retanguloOverlay('tau-legend');

    const candidatos = [{ x0: 0, y0: 0, x1: W, y1: H }];
    if (st || lg) {
      const stL = st ? st.x0 - m : W, stB = st ? st.y1 + m : 0;
      const lgR = lg ? lg.x1 + m : 0, lgT = lg ? lg.y0 - m : H;
      candidatos.length = 0;
      candidatos.push(
        { x0: lgR, y0: 0,   x1: stL, y1: H },   // faixa entre os dois quadros
        { x0: 0,   y0: 0,   x1: stL, y1: lgT }, // à esquerda do status, acima da legenda
        { x0: lgR, y0: stB, x1: W,   y1: H },   // à direita da legenda, abaixo do status
        { x0: 0,   y0: stB, x1: W,   y1: lgT }  // entre o status e a legenda (vertical)
      );
    }

    const { minX, maxX, minY, maxY } = this._bounds();
    const spanX = Math.max(maxX - minX, 1), spanY = Math.max(maxY - minY, 1);
    const folga = 46; // espaço para nós e rótulos nas bordas

    let melhor = null;
    for (const r of candidatos) {
      const w = r.x1 - r.x0 - 2 * folga, h = r.y1 - r.y0 - 2 * folga;
      if (w <= 20 || h <= 20) continue;
      const s = Math.min(w / spanX, h / spanY);
      if (!melhor || s > melhor.s) melhor = { s, r };
    }
    if (!melhor) {
      // painel muito pequeno: usa a área toda
      const w = Math.max(W - 2 * folga, 20), h = Math.max(H - 2 * folga, 20);
      melhor = { s: Math.min(w / spanX, h / spanY), r: { x0: 0, y0: 0, x1: W, y1: H } };
    }
    return melhor;
  }

  _atualizarVista() {
    const { minX, maxX, minY, maxY } = this._bounds();
    const { s, r } = this._areaLivre();
    this.view = {
      s: s * this.zoom,
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      ox: (r.x0 + r.x1) / 2 + this.pan.x,
      oy: (r.y0 + r.y1) / 2 + this.pan.y,
    };
  }

  /** Coordenadas do problema → pixels (eixo y para cima, como no plano cartesiano). */
  _toScreen(x, y) {
    if (!this.view) this._atualizarVista();
    const v = this.view;
    return { x: v.ox + (x - v.cx) * v.s, y: v.oy - (y - v.cy) * v.s };
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

  /** Botões de zoom e roda do mouse (fator < 1 aproxima). */
  zoomBy(factor) {
    this.zoom = Math.max(0.4, Math.min(6, this.zoom / factor));
  }

  /** Botão ⌖ ou duplo clique: volta ao enquadramento automático. */
  _centerCamera() {
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
  }

  // ── Escala de feromônio (logarítmica) ─────────────────────────────────────
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

  // ── Mouse: arrastar a vista e consultar arestas ────────────────────────────
  _onMouseMove(e) {
    if (this._arrastando && this._ultimoMouse) {
      this.pan.x += e.clientX - this._ultimoMouse.x;
      this.pan.y += e.clientY - this._ultimoMouse.y;
      this._ultimoMouse = { x: e.clientX, y: e.clientY };
      if (this.tooltip) this.tooltip.style.display = 'none';
      return;
    }
    if (!this.graph || !this.currentTau) return;

    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    let best = null, bestD = 7; // tolerância em pixels

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
    return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
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

  _fundo() {
    const ctx = this.ctx;
    const grad = ctx.createRadialGradient(this.W / 2, this.H / 2, 0, this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.7);
    grad.addColorStop(0, '#0d0d22');
    grad.addColorStop(1, '#05050d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.W, this.H);

    // grade discreta, apenas decorativa
    ctx.strokeStyle = 'rgba(80,90,160,0.07)';
    ctx.lineWidth = 1;
    const passo = 32;
    ctx.beginPath();
    for (let x = (this.pan.x % passo + passo) % passo; x < this.W; x += passo) { ctx.moveTo(x, 0); ctx.lineTo(x, this.H); }
    for (let y = (this.pan.y % passo + passo) % passo; y < this.H; y += passo) { ctx.moveTo(0, y); ctx.lineTo(this.W, y); }
    ctx.stroke();
  }

  _draw() {
    const ctx = this.ctx;
    this._fundo();
    if (!this.graph || !this.graph.n || !this.currentTau) return;

    this._atualizarVista();
    const g = this.graph;
    const P = g.vertices.map(v => this._toScreen(v.x, v.y));

    // Tamanhos proporcionais ao espaço disponível (com limites)
    const lado = Math.min(this.W, this.H);
    const rNo = Math.max(7, Math.min(13, lado / 38));
    const fonte = Math.max(12, Math.min(16, lado / 30));
    const espMax = Math.max(3, Math.min(7, lado / 70));

    ctx.lineCap = 'round';

    // 1) Arestas: as de menor feromônio primeiro, as mais fortes por cima
    const arestas = [];
    for (let i = 0; i < g.n; i++) {
      for (let j = i + 1; j < g.n; j++) {
        arestas.push({ i, j, key: `${i}-${j}`, t: this._tauToVisual(this.currentTau[i][j]) });
      }
    }
    arestas.sort((a, b) => a.t - b.t);
    for (const a of arestas) {
      ctx.beginPath();
      ctx.moveTo(P[a.i].x, P[a.i].y);
      ctx.lineTo(P[a.j].x, P[a.j].y);
      ctx.strokeStyle = this._tauColor(a.t, 0.18 + a.t * 0.72);
      ctx.lineWidth = 0.8 + a.t * (espMax - 0.8);
      ctx.stroke();
    }

    // 2) Melhor rota acumulada, com brilho
    if (this.bestRoute) {
      const tracar = () => {
        ctx.beginPath();
        this.bestRoute.forEach((idx, k) => {
          if (k === 0) ctx.moveTo(P[idx].x, P[idx].y);
          else ctx.lineTo(P[idx].x, P[idx].y);
        });
      };
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(0,255,170,0.7)';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = 'rgba(0,255,170,0.35)';
      ctx.lineWidth = espMax + 4;
      tracar(); ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = 'rgba(0,255,170,0.95)';
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      tracar(); ctx.stroke();
    }

    // 3) Aresta selecionada na tabela ou sob o cursor
    for (const key of [this.selectedEdge, this.hoveredEdge]) {
      if (!key) continue;
      const [a, b] = key.split('-').map(Number);
      if (!P[a] || !P[b]) continue;
      ctx.save();
      ctx.shadowColor = 'rgba(255,255,255,0.8)';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(P[a].x, P[a].y); ctx.lineTo(P[b].x, P[b].y); ctx.stroke();
      ctx.restore();
    }

    // 4) Formigas (opcional, apenas visual)
    ctx.save();
    ctx.fillStyle = '#ffd23f';
    ctx.shadowColor = 'rgba(255,190,0,0.9)';
    ctx.shadowBlur = 6;
    for (const anim of this.antAnimations) {
      const a = anim.path[anim.segIndex], b = anim.path[anim.segIndex + 1];
      if (!a || !b) continue;
      const pa = this._toScreen(a.x, a.y), pb = this._toScreen(b.x, b.y);
      ctx.beginPath();
      ctx.arc(pa.x + (pb.x - pa.x) * anim.t, pa.y + (pb.y - pa.y) * anim.t, Math.max(3, rNo * 0.35), 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.restore();

    // 5) Vértices
    const centro = P.reduce((acc, p) => ({ x: acc.x + p.x / P.length, y: acc.y + p.y / P.length }), { x: 0, y: 0 });
    g.vertices.forEach((v, i) => {
      const isDepot = v.id === this.depotId;
      const r = isDepot ? rNo * 1.35 : rNo;
      const p = P[i];

      ctx.save();
      ctx.shadowColor = isDepot ? 'rgba(255,120,0,0.8)' : 'rgba(60,160,255,0.7)';
      ctx.shadowBlur = 14;
      const grad = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.35, r * 0.1, p.x, p.y, r);
      grad.addColorStop(0, isDepot ? '#ffc38a' : '#bfe3ff');
      grad.addColorStop(1, isDepot ? '#ff6600' : '#2f86e6');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 2 * Math.PI); ctx.fill();
      ctx.restore();

      ctx.lineWidth = 2;
      ctx.strokeStyle = isDepot ? '#ffd2a8' : '#e2f2ff';
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 2 * Math.PI); ctx.stroke();

      if (isDepot) { // anel extra no depósito
        ctx.strokeStyle = 'rgba(255,160,77,0.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, r + 5, 0, 2 * Math.PI); ctx.stroke();
      }
    });

    // 6) Rótulos com fundo, empurrados para fora do centro do grafo
    ctx.font = `600 ${fonte}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    g.vertices.forEach((v, i) => {
      const isDepot = v.id === this.depotId;
      const r = isDepot ? rNo * 1.35 : rNo;
      const p = P[i];
      const texto = isDepot ? `${v.id} · depósito` : v.id;

      let dx = p.x - centro.x, dy = p.y - centro.y;
      const len = Math.hypot(dx, dy);
      if (len < 1) { dx = 0; dy = -1; } else { dx /= len; dy /= len; }

      const w = ctx.measureText(texto).width + 12, h = fonte + 8;
      const dist = r + 6 + Math.max(w * Math.abs(dx), h * Math.abs(dy)) / 2;
      let lx = p.x + dx * dist, ly = p.y + dy * dist;
      lx = Math.max(w / 2 + 2, Math.min(this.W - w / 2 - 2, lx));
      ly = Math.max(h / 2 + 2, Math.min(this.H - h / 2 - 2, ly));

      ctx.fillStyle = isDepot ? 'rgba(60,25,5,0.88)' : 'rgba(10,14,34,0.85)';
      ctx.strokeStyle = isDepot ? 'rgba(255,160,77,0.8)' : 'rgba(120,170,230,0.55)';
      ctx.lineWidth = 1;
      this._retanguloArredondado(lx - w / 2, ly - h / 2, w, h, 6);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = isDepot ? '#ffb46b' : '#e6f3ff';
      ctx.fillText(texto, lx, ly + 0.5);
    });
  }

  _retanguloArredondado(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
