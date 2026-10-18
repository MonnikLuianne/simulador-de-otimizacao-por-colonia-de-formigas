/**
 * graph.js — Estrutura de dados do grafo de entregas
 */
class Graph {
  constructor() {
    /** @type {Array<{id: string, x: number, y: number}>} */
    this.vertices = [];
    /** dist[i][j] — distância euclidiana entre vértice i e j */
    this.dist = [];
  }

  /** Adiciona vértice; retorna mensagem de erro ou null */
  addVertex(id, x, y) {
    id = id.trim();
    if (!id) return 'Identificador vazio.';
    if (this.vertices.find(v => v.id === id)) return `Identificador "${id}" já existe.`;
    x = parseFloat(x); y = parseFloat(y);
    if (isNaN(x) || isNaN(y)) return 'Coordenadas inválidas.';
    if (x < 0 || x > 1000 || y < 0 || y > 1000) return 'Coordenadas devem estar entre 0 e 1000.';
    x = Math.round(x * 100) / 100;
    y = Math.round(y * 100) / 100;
    if (this.vertices.find(v => v.x === x && v.y === y)) return 'Já existe um vértice nessas coordenadas.';
    this.vertices.push({ id, x, y });
    this._rebuildDist();
    return null;
  }

  /** Remove vértice pelo id; retorna erro ou null */
  removeVertex(id) {
    if (this.vertices.length <= 4) return 'O grafo precisa de pelo menos 4 vértices.';
    const idx = this.vertices.findIndex(v => v.id === id);
    if (idx === -1) return `Vértice "${id}" não encontrado.`;
    this.vertices.splice(idx, 1);
    this._rebuildDist();
    return null;
  }

  /** Edita coordenadas de um vértice */
  editVertex(id, newId, x, y) {
    const idx = this.vertices.findIndex(v => v.id === id);
    if (idx === -1) return `Vértice "${id}" não encontrado.`;
    newId = newId.trim();
    if (!newId) return 'Identificador vazio.';
    if (newId !== id && this.vertices.find(v => v.id === newId)) return `Identificador "${newId}" já existe.`;
    x = parseFloat(x); y = parseFloat(y);
    if (isNaN(x) || isNaN(y)) return 'Coordenadas inválidas.';
    if (x < 0 || x > 1000 || y < 0 || y > 1000) return 'Coordenadas devem estar entre 0 e 1000.';
    x = Math.round(x * 100) / 100;
    y = Math.round(y * 100) / 100;
    const dup = this.vertices.find((v, i) => i !== idx && v.x === x && v.y === y);
    if (dup) return 'Já existe um vértice nessas coordenadas.';
    this.vertices[idx] = { id: newId, x, y };
    this._rebuildDist();
    return null;
  }

  _rebuildDist() {
    const n = this.vertices.length;
    this.dist = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => {
        if (i === j) return 0;
        const a = this.vertices[i], b = this.vertices[j];
        return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
      })
    );
  }

  get n() { return this.vertices.length; }

  indexOf(id) { return this.vertices.findIndex(v => v.id === id); }
}