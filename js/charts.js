/**
 * charts.js — Gráfico de evolução com Chart.js
 */
class EvolutionChart {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.chart = null;
    this._init();
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