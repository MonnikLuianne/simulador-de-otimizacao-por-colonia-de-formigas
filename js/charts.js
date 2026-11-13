/**
 * charts.js — Gráfico de evolução com Chart.js
 */
class EvolutionChart {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.chart = null;
    this._init();
    this.aplicarTema();
    // troca de tema claro/escuro (botão no cabeçalho)
    document.addEventListener('temachange', () => this.aplicarTema());
  }

  /** Cores do gráfico conforme o tema atual (claro é o padrão). */
  aplicarTema() {
    const escuro = document.documentElement.dataset.tema === 'escuro';
    const cor = escuro
      ? { texto: '#aabbcc', eixo: '#8090b0', grade: '#1a2238', melhor: '#00ffaa', iter: '#ff8844', media: '#7f9ccc' }
      : { texto: '#1e293b', eixo: '#475569', grade: '#e2e8f0', melhor: '#059669', iter: '#ea580c', media: '#64748b' };

    const ds = this.chart.data.datasets;
    ds[0].borderColor = cor.melhor; ds[0].pointBackgroundColor = cor.melhor; ds[0].pointBorderColor = cor.melhor;
    ds[1].borderColor = cor.iter;   ds[1].pointBackgroundColor = cor.iter;   ds[1].pointBorderColor = cor.iter;
    ds[2].borderColor = cor.media;  ds[2].pointBackgroundColor = cor.media;  ds[2].pointBorderColor = cor.media;

    const o = this.chart.options;
    o.plugins.legend.labels.color = cor.texto;
    for (const eixo of [o.scales.x, o.scales.y]) {
      eixo.title.color = cor.eixo;
      eixo.ticks.color = cor.eixo;
      eixo.grid.color = cor.grade;
    }
    this.chart.update('none');
  }

  _init() {
    const ctx = this.canvas.getContext('2d');
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Melhor acumulada',
            data: [],
            borderColor: '#00ffaa',
            backgroundColor: 'rgba(0,255,170,0.08)',
            tension: 0.3,
            pointRadius: 3,
            borderWidth: 2,
          },
          {
            label: 'Melhor da iteração',
            data: [],
            borderColor: '#ff8844',
            backgroundColor: 'rgba(255,136,68,0.06)',
            tension: 0.3,
            pointRadius: 2,
            borderWidth: 1.5,
            borderDash: [4, 3],
          },
          {
            label: 'Média das formigas',
            data: [],
            borderColor: '#6688bb',
            backgroundColor: 'rgba(100,136,187,0.05)',
            tension: 0.3,
            pointRadius: 2,
            borderWidth: 1.2,
            borderDash: [2, 4],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 150 },
        plugins: {
          legend: { labels: { color: '#aabbcc', font: { size: 11 } } },
          tooltip: { mode: 'index', intersect: false },
        },
        scales: {
          x: {
            title: { display: true, text: 'Iteração', color: '#778899' },
            ticks: { color: '#778899', maxTicksLimit: 20 },
            grid: { color: '#111a2a' },
          },
          y: {
            title: { display: true, text: 'Distância', color: '#778899' },
            ticks: { color: '#778899' },
            grid: { color: '#111a2a' },
          },
        },
      },
    });
  }

  addPoint(iter, bestAcc, iterBest, avg) {
    this.chart.data.labels.push(iter);
    this.chart.data.datasets[0].data.push(bestAcc);
    this.chart.data.datasets[1].data.push(iterBest);
    this.chart.data.datasets[2].data.push(avg);
    this.chart.update('none');
  }

  reset() {
    this.chart.data.labels = [];
    this.chart.data.datasets.forEach(d => (d.data = []));
    this.chart.update();
  }
}
