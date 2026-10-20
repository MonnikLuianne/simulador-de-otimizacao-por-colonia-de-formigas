const DECADAS_ESCALA = 6; // ordens de grandeza cobertas pela escala de cor

/**
 * renderer3d.js — Visualização 3D com Three.js
 */
class Renderer3D {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.graph = null;
    this.depotId = null;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    this.nodeMeshes = {};
    this.edgeMeshes = {};
    this.bestRouteLines = [];
    this.antMeshes = [];
    this.antAnimations = [];
    this._animFrame = null;

    this.tooltip = document.getElementById('tooltip');
    this.raycaster = null;
    this.mouse = null;
    this.hoveredEdge = null;

    this.currentTau = null;
    this.tauRef = 1;   // referência da escala visual do feromônio

    this._init();
  }

  _init() {
    const W = this.canvas.clientWidth || 800;
    const H = this.canvas.clientHeight || 600;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060610);
    this.scene.fog = new THREE.Fog(0x060610, 800, 2000);

    this.camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 5000);
    this.camera.position.set(300, 200, 900);
    this.camera.lookAt(300, 200, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(W, H);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const ambient = new THREE.AmbientLight(0x223366, 1.2);
    this.scene.add(ambient);
    const point = new THREE.PointLight(0xff8844, 2, 2000);
    point.position.set(500, 500, 600);
    this.scene.add(point);
    const point2 = new THREE.PointLight(0x4488ff, 1.5, 2000);
    point2.position.set(0, 0, 400);
    this.scene.add(point2);

    /*const gridHelper = new THREE.GridHelper(1000, 10, 0x111133, 0x111133);
    gridHelper.position.set(500, 0, 500);
    gridHelper.rotation.x = Math.PI / 2;
    this.scene.add(gridHelper);*/

    if (THREE.OrbitControls) {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.target.set(300, 200, 0);
      this.controls.update();
    }

    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Line = { threshold: 8 };
    this.mouse = new THREE.Vector2();

    window.addEventListener('resize', () => this._onResize());
    this.canvas.addEventListener('mousemove', e => this._onMouseMove(e));
    this.canvas.addEventListener('mouseleave', () => {
      if (this.tooltip) this.tooltip.style.display = 'none';
    });

    this._animate();
  }

  _animate() {
    this._animFrame = requestAnimationFrame(() => this._animate());

    const dt = 0.016;
    for (const anim of this.antAnimations) {
      anim.t += anim.speed * dt;
      if (anim.t >= 1) {
        anim.segIndex++;
        anim.t = 0;
        if (anim.segIndex >= anim.path.length - 1) {
          anim.segIndex = 0;
        }
      }
      const a = anim.path[anim.segIndex];
      const b = anim.path[anim.segIndex + 1];
      if (a && b) {
        anim.mesh.position.lerpVectors(
          new THREE.Vector3(a.x, a.y, 12),
          new THREE.Vector3(b.x, b.y, 12),
          anim.t
        );
      }
    }

    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  _onResize() {
    const W = this.canvas.clientWidth;
    const H = this.canvas.clientHeight;
    this.camera.aspect = W / H;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(W, H);
  }

  _onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this._checkHover(e.clientX, e.clientY);
  }

  _checkHover(mx, my) {
    if (!this.graph) return;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const lines = Object.entries(this.edgeMeshes).map(([k, v]) => ({ key: k, line: v.line }));
    const objects = lines.map(l => l.line);
    const hits = this.raycaster.intersectObjects(objects);

    if (hits.length > 0) {
      const obj = hits[0].object;
      const entry = lines.find(l => l.line === obj);
      if (entry) {
        const [si, sj] = entry.key.split('-').map(Number);
        const vi = this.graph.vertices[si];
        const vj = this.graph.vertices[sj];
        const dist = this.graph.dist[si][sj].toFixed(4);
        const tau = this.currentTau ? this.currentTau[si][sj].toFixed(6) : '—';
        if (this.tooltip) {
          this.tooltip.style.display = 'block';
          this.tooltip.style.left = (mx + 14) + 'px';
          this.tooltip.style.top = (my + 14) + 'px';
          this.tooltip.innerHTML =
            `<strong>${vi.id} ↔ ${vj.id}</strong><br>` +
            `Distância: <b>${dist}</b><br>` +
            `Feromônio: <b>${tau}</b>`;
        }
        this.hoveredEdge = entry.key;
        return;
      }
    }
    if (this.tooltip) this.tooltip.style.display = 'none';
    this.hoveredEdge = null;
  }

  /** Constrói a cena completa a partir do grafo */
  buildScene(graph, depotId, tau) {
    this.graph = graph;
    this.depotId = depotId;
    this.currentTau = tau;

    for (const id in this.nodeMeshes) this.scene.remove(this.nodeMeshes[id]);
    for (const k in this.edgeMeshes) this.scene.remove(this.edgeMeshes[k].line);
    this.bestRouteLines.forEach(l => this.scene.remove(l));
    this.antMeshes.forEach(m => this.scene.remove(m));

    // Remove sprites (labels) antigos
    const sprites = [];
    this.scene.traverse(o => { if (o.isSprite) sprites.push(o); });
    sprites.forEach(s => this.scene.remove(s));

    this.nodeMeshes = {};
    this.edgeMeshes = {};
    this.bestRouteLines = [];
    this.antAnimations = [];
    this.antMeshes = [];

    this._resetTauScale(tau, graph);

    for (let i = 0; i < graph.n; i++) {
      for (let j = i + 1; j < graph.n; j++) {
        this._createEdge(i, j, tau[i][j]);
      }
    }

    for (const v of graph.vertices) {
      this._createNode(v, depotId);
    }

    // Centraliza câmera no grafo
    this._centerCamera(graph);
  }

  /** Centraliza e ajusta a câmera para enquadrar todos os vértices */
  _centerCamera(graph) {
    if (!graph.n) return;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    graph.vertices.forEach(v => {
      if (v.x < minX) minX = v.x;
      if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.y > maxY) maxY = v.y;
    });

    const cx   = (minX + maxX) / 2;
    const cy   = (minY + maxY) / 2;
    const span = Math.max(maxX - minX, maxY - minY, 100);
    const dist = span * 1.8;

    if (this.controls) {
      this.controls.target.set(cx, cy, 0);
      this.controls.update();
    }

    this.camera.position.set(cx, cy, dist);
    this.camera.lookAt(cx, cy, 0);
  }

  // Escala visual do feromônio (logarítmica e fixa)
  // A intensidade é 1 + log10(τ / τ_ref) / DECADAS_ESCALA, limitada a [0, 1]:
  // τ = τ_ref é o máximo e τ ≤ τ_ref × 10^-6 é o mínimo. τ_ref começa em τ₀ e
  // só aumenta (maior feromônio já observado na execução), então uma aresta
  // cujo feromônio diminuiu nunca aparece mais intensa; toda mudança de τ_ref
  // é informada na legenda. A escala logarítmica mantém o contraste mesmo
  // quando os depósitos Q/L são pequenos em relação a τ₀.
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

  _resetTauScale(tau, graph) {
    const { max } = this._tauStats(tau, graph);
    this.tauRef = max > 0 ? max : 1;
  }

  _tauToVisual(tauVal) {
    if (!(tauVal > 0)) return 0;
    const t = 1 + Math.log10(tauVal / this.tauRef) / DECADAS_ESCALA;
    return Math.max(0, Math.min(1, t));
  }

  _tauColor(t) {
    const r = Math.round(30 + t * 225);
    const g = Math.round(40 + t * 130);
    const b = Math.round(180 - t * 150);
    return new THREE.Color(r / 255, g / 255, b / 255);
  }

  _createEdge(i, j, tauVal) {
    const vi = this.graph.vertices[i];
    const vj = this.graph.vertices[j];
    const t = this._tauToVisual(tauVal);
    const color = this._tauColor(t);
    const thickness = 1 + t * 5;

    const mat = new THREE.LineBasicMaterial({ color, linewidth: thickness, transparent: true, opacity: 0.4 + t * 0.5 });
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(vi.x, vi.y, 0),
      new THREE.Vector3(vj.x, vj.y, 0),
    ]);
    const line = new THREE.Line(geo, mat);
    line.userData = { i, j };
    this.scene.add(line);
    this.edgeMeshes[`${i}-${j}`] = { line, tau: tauVal };
  }

  _createNode(v, depotId) {
    const isDepot = v.id === depotId;
    const radius = isDepot ? 22 : 14;
    const geo = new THREE.SphereGeometry(radius, 32, 32);
    const mat = new THREE.MeshPhongMaterial({
      color: isDepot ? 0xff6600 : 0x3399ff,
      emissive: isDepot ? 0xff3300 : 0x114488,
      emissiveIntensity: isDepot ? 0.6 : 0.3,
      shininess: 80,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(v.x, v.y, 0);
    mesh.userData = { vertexId: v.id };
    this.scene.add(mesh);
    this.nodeMeshes[v.id] = mesh;

    this._addLabel(v.id, v.x, v.y, isDepot);
  }

  _addLabel(text, x, y, isDepot) {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 128, 64);
    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = isDepot ? '#ff8833' : '#aaddff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 32);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(x, y, 35);
    sprite.scale.set(80, 40, 1);
    this.scene.add(sprite);
  }

  /**
   * Atualiza as cores das arestas e devolve as informações da escala
   * ({ min, max, ref, prevRef, changed }) para a legenda.
   */
  updatePheromones(tau, graph) {
    this.currentTau = tau;
    const { min, max } = this._tauStats(tau, graph);
    const prevRef = this.tauRef;
    if (max > this.tauRef) this.tauRef = max;
    for (let i = 0; i < graph.n; i++) {
      for (let j = i + 1; j < graph.n; j++) {
        const key = `${i}-${j}`;
        const entry = this.edgeMeshes[key];
        if (!entry) continue;
        const tauVal = tau[i][j];
        const t = this._tauToVisual(tauVal);
        entry.line.material.color = this._tauColor(t);
        entry.line.material.opacity = 0.35 + t * 0.6;
        entry.tau = tauVal;
      }
    }
    return { min, max, ref: this.tauRef, prevRef, changed: this.tauRef !== prevRef };
  }

  highlightBestRoute(route, graph) {
    this.bestRouteLines.forEach(l => this.scene.remove(l));
    this.bestRouteLines = [];

    for (let s = 0; s < route.length - 1; s++) {
      const vi = graph.vertices[route[s]];
      const vj = graph.vertices[route[s + 1]];
      const mat = new THREE.LineBasicMaterial({ color: 0x00ffaa, linewidth: 4, transparent: true, opacity: 0.95 });
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(vi.x, vi.y, 6),
        new THREE.Vector3(vj.x, vj.y, 6),
      ]);
      const line = new THREE.Line(geo, mat);
      this.scene.add(line);
      this.bestRouteLines.push(line);
    }
  }

  launchAnts(routes, graph) {
    this.antMeshes.forEach(m => this.scene.remove(m));
    this.antMeshes = [];
    this.antAnimations = [];

    const show = Math.min(routes.length, 15);
    for (let k = 0; k < show; k++) {
      const route = routes[k];
      const path = route.map(idx => ({ x: graph.vertices[idx].x, y: graph.vertices[idx].y }));

      const geo = new THREE.SphereGeometry(7, 12, 12);
      const mat = new THREE.MeshPhongMaterial({
        color: 0xffcc00,
        emissive: 0xff8800,
        emissiveIntensity: 0.7,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(path[0].x, path[0].y, 12);
      this.scene.add(mesh);
      this.antMeshes.push(mesh);

      this.antAnimations.push({
        mesh,
        path,
        segIndex: 0,
        t: (k / show),
        speed: 0.4 + Math.random() * 0.3,
      });
    }
  }

  clearAnts() {
    this.antMeshes.forEach(m => this.scene.remove(m));
    this.antMeshes = [];
    this.antAnimations = [];
  }

  dispose() {
    cancelAnimationFrame(this._animFrame);
    this.renderer.dispose();
  }
}