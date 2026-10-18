# Simulador de Otimização por Colônia de Formigas

Simulador visual do algoritmo **Ant System** (Dorigo, 1992) para encontrar rotas de entrega em um grafo completo não direcionado, minimizando a distância total percorrida com retorno obrigatório ao depósito.

🔗 **[Acesse a aplicação no GitHub Pages](https://monnikluianne.github.io/simulador-de-otimizacao-por-colonia-de-formigas/)**
📂 **[Repositório no GitHub](https://github.com/MonnikLuianne/simulador-de-otimizacao-por-colonia-de-formigas)**

---

## Autores

- Monnik Luianne Oliveira Nascimento Veloso Barbosa
- João Pedro Pereira da Luz
- Guilherme Ribeiro Nunes Batista

---

## Descrição da solução

O simulador implementa o **Ant System clássico** com as seguintes etapas por iteração:

1. Todas as formigas constroem rotas usando um *snapshot* do feromônio do fim da iteração anterior (sem atualização durante a construção).
2. A escolha do próximo vértice é feita por **roleta proporcional** ao peso `w(i,j) = τ^α × η^β`, onde `η = 1/d`.
3. Após todas as formigas terminarem, aplica-se **evaporação**: `τ ← (1 - ρ) × τ`.
4. Cada formiga deposita `Q / L` nas arestas que percorreu, onde `L` é o comprimento da sua rota.
5. A **melhor solução global** é registrada e nunca aumenta entre iterações.

A visualização é feita em 3D com Three.js, com arestas coloridas proporcionalmente ao feromônio e destaque da melhor rota em verde.

---

## Instruções de uso

1. Acesse a aplicação pelo link do GitHub Pages acima — não é necessário instalar nada.
2. Configure os parâmetros no painel esquerdo.
3. Gerencie os vértices (adicionar, editar, remover) na tabela de vértices.
4. Clique em **Executar** para rodar todas as iterações, **Passo** para avançar uma por vez, ou **Pausar/Retomar** para controlar a execução.
5. Arraste a borda superior do painel inferior para ampliar o gráfico de evolução e o log.
6. Use os botões **+** / **−** / **⌖** no cabeçalho para zoom e centralização do grafo.
7. Passe o mouse sobre as arestas para ver distância e feromônio atual.

---

## Parâmetros

| Parâmetro | Descrição | Intervalo |
|-----------|-----------|-----------|
| α | Influência do feromônio na escolha | 0 – 5 |
| β | Influência da distância (heurística) na escolha | 0 – 5 |
| ρ | Taxa de evaporação do feromônio | 0% – 90% |
| τ₀ | Feromônio inicial em todas as arestas | 0,01 – 100 |
| Q | Constante de depósito de feromônio | 0,01 – 10000 |
| Formigas | Número de formigas por iteração | 1 – 100 |
| Iterações | Número total de iterações | 1 – 200 |
| Semente | Semente do gerador pseudoaleatório (reprodutibilidade) | ≥ 0 |
| Depósito | Vértice de partida e retorno obrigatório | — |

---

## Bibliotecas auxiliares

- **[Three.js r128](https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js)** — renderização 3D do grafo
- **[Chart.js 3.9.1](https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js)** — gráfico de evolução das distâncias
- **RNG próprio** (`js/rng.js`) — gerador Mulberry32 com semente para reprodutibilidade

O algoritmo ACO é implementado integralmente no projeto, sem uso de bibliotecas de otimização prontas.

---

## Resultados dos testes

### 6.1 — Instância de referência (A, B, C, D)

Vértices: A=(0,0), B=(3,0), C=(3,4), D=(0,4). Depósito: A.

Distâncias: A-B=3, A-C=5, A-D=4, B-C=4, B-D=5, C-D=3.

As seis rotas possíveis e seus comprimentos:

| Rota | Comprimento |
|------|-------------|
| A → B → C → D → A | **14** ✅ ótimo |
| A → B → D → C → A | 16 |
| A → C → B → D → A | 18 |
| A → C → D → B → A | 16 |
| A → D → B → C → A | 18 |
| A → D → C → B → A | **14** ✅ ótimo |

### 6.2 — Probabilidades de escolha

Com a formiga em A, τ=1 em todas as arestas, α=1, β=2:

| Aresta | Peso w | Probabilidade |
|--------|--------|---------------|
| A→B | 1/9 ≈ 0,1111 | 400/769 ≈ **0,5202** |
| A→C | 1/25 = 0,0400 | 144/769 ≈ **0,1873** |
| A→D | 1/16 = 0,0625 | 225/769 ≈ **0,2926** |

Soma = 1,0000 ✅

Após visitar B, com candidatos C e D:
- p(B,C) = 25/41 ≈ **0,6098** ✅
- p(B,D) = 16/41 ≈ **0,3902** ✅

Com α=0 e β=0: probabilidades iguais entre todos os candidatos ✅  
Com único candidato restante: probabilidade = 1 ✅

### 6.3 — Evaporação e depósito

Configuração: τ₀=1, ρ=50%, Q=14, 1 formiga, rota forçada A→B→C→D→A (L=14).

Após a 1ª iteração:

| Aresta | Antes | Após evap | Depósito | Final |
|--------|-------|-----------|----------|-------|
| AB, BC, CD, DA | 1 | 0,5 | 1 | **1,5** ✅ |
| AC, BD | 1 | 0,5 | 0 | **0,5** ✅ |

Após a 2ª iteração com mesma rota:

| Aresta | Final |
|--------|-------|
| Perímetro (AB, BC, CD, DA) | **1,75** ✅ |
| Diagonais (AC, BD) | **0,25** ✅ |

Com 2 formigas na mesma rota, 1 iteração:

| Aresta | Final |
|--------|-------|
| Perímetro | **2,5** ✅ |
| Diagonais | **0,5** ✅ |

### 6.4 — Execução completa

Configuração: instância 6.1, depósito A, 10 formigas, 30 iterações, α=1, β=2, ρ=50%, τ₀=1, Q=14, semente 42.

- Resultado obtido: **A → B → C → D → A**, comprimento **14** ✅ (ótimo global)
- 30 registros de resultados gerados, um por iteração ✅
- Estado inicial exibe "ainda não calculada" para a melhor distância ✅
- Melhor distância acumulada nunca aumentou ao longo das iterações ✅
- Repetindo dados, parâmetros e semente: histórico idêntico reproduzido ✅

### 6.5 — Efeito dos parâmetros

Comparação β=0 vs β=2, demais parâmetros da seção 6.4, 5 execuções com sementes 1–5:

| Configuração | Média da melhor distância | Execuções com distância 14 |
|---|---|---|
| β=0 | 16,0 | 2/5 |
| β=2 | 14,4 | 4/5 |

β=2 favorece a exploração de rotas mais curtas com mais consistência, como esperado — a heurística de distância guia melhor as formigas em instâncias pequenas.

Validações de entradas inválidas:
- Coordenadas duplicadas → mensagem de erro ✅
- Identificadores repetidos → mensagem de erro ✅
- Menos de 4 vértices → bloqueado com mensagem ✅
- Campos vazios → bloqueado com mensagem ✅
- Valores fora do intervalo → bloqueado com mensagem ✅
- ρ=0%: feromônio não reduz por evaporação, apenas depósito altera ✅

---

## Organização dos arquivos

```
index.html          — interface e estrutura da página
css/style.css       — estilos auxiliares
js/graph.js         — vértices e distâncias euclidianas
js/aco.js           — implementação do Ant System
js/rng.js           — gerador pseudoaleatório com semente (Mulberry32)
js/renderer3d.js    — visualização 3D com Three.js
js/charts.js        — gráfico de evolução das distâncias
js/logger.js        — histórico e log de execução
js/main.js          — integração da interface e controles
```