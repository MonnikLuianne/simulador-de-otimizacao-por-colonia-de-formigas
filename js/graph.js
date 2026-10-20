/**
 * graph.js — Estrutura de dados do grafo de entregas
 */
const DUAS_CASAS = /^\d+(\.\d{1,2})?$/;

class Graph {
  constructor() {
    /** @type {Array<{id: string, x: number, y: number}>} */
    this.vertices = [];
    /** dist[i][j] — distância euclidiana entre vértice i e j */
    this.dist = [];
  }

  /** Adiciona vértice; retorna mensagem de erro ou null */
  addVertex(id, x, y) {
    id = String(id).trim();

    if (!id) return 'Identificador vazio.';
    if (this.vertices.find(v => v.id === id)) {
      return `Identificador "${id}" já existe.`;
    }

    const rawX = String(x).trim();
    const rawY = String(y).trim();

    if (!rawX || !rawY) {
      return 'Informe as coordenadas X e Y.';
    }

    x = Number(rawX);
    y = Number(rawY);

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return 'Coordenadas inválidas.';
    }

    if (x < 0 || x > 1000 || y < 0 || y > 1000) {
      return 'Coordenadas devem estar entre 0 e 1000.';
    }

    // Verifica o texto digitado (x * 100 sofre erro de ponto flutuante:
    // 1.15 * 100 = 114.99999999999999).
    if (!DUAS_CASAS.test(rawX) || !DUAS_CASAS.test(rawY)) {
      return 'As coordenadas podem ter no máximo duas casas decimais (ex.: 150 ou 150.25).';
    }

    if (this.vertices.find(v => v.x === x && v.y === y)) {
      return 'Já existe um vértice nessas coordenadas.';
    }

    this.vertices.push({ id, x, y });
    this._rebuildDist();

    return null;
  }

  /** Remove vértice pelo id; retorna erro ou null */
  removeVertex(id) {
    if (this.vertices.length <= 4) {
      return 'O grafo precisa de pelo menos 4 vértices.';
    }

    const idx = this.vertices.findIndex(v => v.id === id);

    if (idx === -1) {
      return `Vértice "${id}" não encontrado.`;
    }

    this.vertices.splice(idx, 1);
    this._rebuildDist();

    return null;
  }

  /** Edita identificador e coordenadas de um vértice */
  editVertex(id, newId, x, y) {
    const idx = this.vertices.findIndex(v => v.id === id);

    if (idx === -1) {
      return `Vértice "${id}" não encontrado.`;
    }

    newId = String(newId).trim();

    if (!newId) {
      return 'Identificador vazio.';
    }

    if (newId !== id &&
        this.vertices.find(v => v.id === newId)) {
      return `Identificador "${newId}" já existe.`;
    }

    const rawX = String(x).trim();
    const rawY = String(y).trim();

    if (!rawX || !rawY) {
      return 'Informe as coordenadas X e Y.';
    }

    x = Number(rawX);
    y = Number(rawY);

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return 'Coordenadas inválidas.';
    }

    if (x < 0 || x > 1000 || y < 0 || y > 1000) {
      return 'Coordenadas devem estar entre 0 e 1000.';
    }

    // Verifica o texto digitado (x * 100 sofre erro de ponto flutuante:
    // 1.15 * 100 = 114.99999999999999).
    if (!DUAS_CASAS.test(rawX) || !DUAS_CASAS.test(rawY)) {
      return 'As coordenadas podem ter no máximo duas casas decimais (ex.: 150 ou 150.25).';
    }

    const dup = this.vertices.find(
      (v, i) => i !== idx && v.x === x && v.y === y
    );

    if (dup) {
      return 'Já existe um vértice nessas coordenadas.';
    }

    this.vertices[idx] = { id: newId, x, y };
    this._rebuildDist();

    return null;
  }

  /** Recalcula a matriz de distâncias euclidianas */
  _rebuildDist() {
    const n = this.vertices.length;

    this.dist = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => {
        if (i === j) return 0;

        const a = this.vertices[i];
        const b = this.vertices[j];

        return Math.sqrt(
          (a.x - b.x) ** 2 + (a.y - b.y) ** 2
        );
      })
    );
  }

  get n() {
    return this.vertices.length;
  }

  indexOf(id) {
    return this.vertices.findIndex(v => v.id === id);
  }

  /** Cópia independente (a execução não é afetada por edições posteriores). */
  clone() {
    const g = new Graph();
    g.vertices = this.vertices.map(v => ({ ...v }));
    g._rebuildDist();
    return g;
  }
}