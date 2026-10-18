/**
 * renderer3d.js — Visualização 3D com Three.js
 *
 * Responsabilidades:
 *  - Renderizar vértices como esferas 3D
 *  - Renderizar arestas com espessura/cor proporcional ao feromônio
 *  - Animar formigas se deslocando pelas arestas
 *  - Destacar melhor rota
 *  - Tooltip com distância e feromônio ao passar o mouse
 */
class Renderer3D {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.graph = null;
    this.depotId = null;

    // Objetos Three.js
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    // Meshes
    this.nodeMeshes = {};      // id -> Mesh (esfera)
    this.edgeMeshes = {};      // "i-j" -> { line, tau }
    this.bestRouteLines = [];
    this.antMeshes = [];       // formigas animadas

    // Animação de formigas
    this.antAnimations = [];   // [{mesh, path, t, speed}]
    this._animFrame = null;

    // Tooltip
    this.tooltip = document.getElementById('tooltip');
    this.raycaster = null;
    this.mouse = null;
    this.hoveredEdge = null;

    // Feromônio atual para tooltip
    this.currentTau = null;
    this.tauMin = 1e-12;
    this.tauMax = 1;

    this._init();
  }

  _init() {
    const W = this.canvas.clientWidth || 800;
    const H = this.canvas.clientHeight || 600;

    // Cena
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060610);
    this.scene.fog = new THREE.Fog(0x060610, 800, 2000);

    // Câmera perspectiva
    this.camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 5000);
    this.camera.position.set(500, 500, 900);
    this.camera.lookAt(500, 500, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(W, H);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Luzes
    const ambient = new THREE.AmbientLight(0x223366, 1.2);
    this.scene.add(ambient);
    const point = new THREE.PointLight(0xff8844, 2, 2000);
    point.position.set(500, 500, 600);
    this.scene.add(point);
    const point2 = new THREE.PointLight(0x4488ff, 1.5, 2000);
    point2.position.set(0, 0, 400);
    this.scene.add(point2);

    // Grid sutil no plano base
    const gridHelper = new THREE.GridHelper(1000, 10, 0x111133, 0x111133);
    gridHelper.position.set(500, 0, 500);
    gridHelper.rotation.x = Math.PI / 2;
    this.scene.add(gridHelper);

    // OrbitControls
    if (THREE.OrbitControls) {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.target.set(500, 500, 0);
      this.controls.update();
    }

    // Raycaster para tooltip
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Line = { threshold: 8 };
    this.mouse = new THREE.Vector2();

    // Eventos
    window.addEventListener('resize', () => this._onResize());
    this.canvas.addEventListener('mousemove', e => this._onMouseMove(e));
    this.canvas.addEventListener('mouseleave', () => {
      if (this.tooltip) this.tooltip.style.display = 'none';
    });

    // Loop de renderização
    this._animate();
  }

  _animate() {
    this._animFrame = requestAnimationFrame(() => this._animate());

    // Avança formigas
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

    // Coleta todas as linhas de arestas
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

    // Limpa cena (exceto luzes e grid)
    for (const id in this.nodeMeshes) this.scene.remove(this.nodeMeshes[id]);
    for (const k in this.edgeMeshes) this.scene.remove(this.edgeMeshes[k].line);
    this.bestRouteLines.forEach(l => this.scene.remove(l));
    this.antMeshes.forEach(m => this.scene.remove(m));
    this.nodeMeshes = {};
    this.edgeMeshes = {};
    this.bestRouteLines = [];
    this.antAnimations = [];
    this.antMeshes = [];

    // Calcula faixa de tau
    this._updateTauRange(tau, graph);

    // Arestas
    for (let i = 0; i < graph.n; i++) {
      for (let j = i + 1; j < graph.n; j++) {
        this._createEdge(i, j, tau[i][j]);
      }
    }

    // Vértices
    for (const v of graph.vertices) {
      this._createNode(v, depotId);
    }
  }

  _updateTauRange(tau, graph) {
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < graph.n; i++) {
      for (let j = i + 1; j < graph.n; j++) {
        if (tau[i][j] > mx) mx = tau[i][j];
        if (tau[i][j] < mn) mn = tau[i][j];
      }
    }
    this.tauMin = mn;
    this.tauMax = mx === mn ? mn + 1 : mx;
  }

  _tauToVisual(tauVal) {
    const t = (tauVal - this.tauMin) / (this.tauMax - this.tauMin);
    return Math.max(0, Math.min(1, t));
  }

  _tauColor(t) {
    // Gradiente: azul escuro → âmbar → laranja brilhante
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
    const thickness = 1 + t * 5; // espessura proporcional ao feromônio

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

    // Label (sprite de texto)
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

  /** Atualiza feromônios nas arestas após uma iteração */
  updatePheromones(tau, graph) {
    this.currentTau = tau;
    this._updateTauRange(tau, graph);
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
  }

  /** Destaca a melhor rota com linha brilhante */
  highlightBestRoute(route, graph) {
    // Remove destaques anteriores
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

  /**
   * Lança formigas animadas percorrendo um caminho.
   * @param {number[][]} routes — lista de rotas (índices de vértices)
   * @param {number} count — quantas formigas animar (máx 20 para perf)
   */
  launchAnts(routes, graph) {
    // Remove formigas anteriores
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
        t: (k / show), // fase inicial diferente p/ cada formiga
        speed: 0.4 + Math.random() * 0.3,
      });
    }
  }

  /** Remove todas as formigas animadas */
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