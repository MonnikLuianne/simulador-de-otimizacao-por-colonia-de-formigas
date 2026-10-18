# Simulador de Otimização por Colônia de Formigas

Simulador visual do algoritmo **Ant System** para encontrar rotas de entrega em um grafo completo não direcionado, minimizando a distância total e retornando ao depósito.

## Como executar

1. Baixe ou clone este repositório.
2. Abra a pasta do projeto.
3. Execute `index.html` em um navegador moderno. Não é necessário servidor de aplicação.
4. Para publicar no GitHub Pages, configure a publicação a partir da branch principal e da pasta raiz (`/`), onde está o `index.html`.

É necessário ter acesso à internet para carregar as bibliotecas auxiliares via CDN.

## Organização

- `index.html`: interface e estrutura da página.
- `css/style.css`: folha de estilos auxiliar do projeto.
- `js/graph.js`: vértices e distâncias euclidianas.
- `js/aco.js`: implementação do Ant System.
- `js/rng.js`: gerador pseudoaleatório com semente.
- `js/renderer3d.js`: visualização 3D do grafo, arestas e feromônios.
- `js/charts.js`: gráfico de evolução.
- `js/logger.js`: histórico e registros da execução.
- `js/main.js`: integração da interface e controles.

## Bibliotecas auxiliares

- Three.js: renderização 3D do grafo.
- Chart.js: gráfico da evolução das distâncias.
- Gerador pseudoaleatório com semente: implementado no próprio projeto em `js/rng.js`.

O algoritmo Ant System e seus procedimentos centrais são implementados no código do projeto; não é usado um solucionador pronto de colônia de formigas.

## Parâmetros

A interface permite configurar número de formigas e iterações, influência do feromônio (α), influência da distância (β), taxa de evaporação (ρ), feromônio inicial (τ₀), constante de depósito (Q), semente aleatória e depósito.

## Observação

Os resultados dependem da semente, da instância e dos parâmetros. O histórico é reproduzível no mesmo navegador quando os dados, parâmetros, semente e ordem dos sorteios são os mesmos.