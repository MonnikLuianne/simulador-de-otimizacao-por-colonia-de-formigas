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
4. Clique em **Executar** para rodar até o número de iterações configurado, **Avançar uma iteração** para executar exatamente uma iteração e continuar pausado, ou **Pausar**/**Retomar** para controlar a execução. Executar continua de onde parou, inclusive depois de Avançar.
5. Qualquer alteração em vértices ou parâmetros pausa a execução e exige **Reiniciar** (aviso amarelo). Reiniciar limpa o histórico, restaura τ₀ em todas as arestas e restabelece a semente.
6. Arraste a borda superior do painel inferior para ampliar o gráfico de evolução e o log.
7. Use os botões **+** / **−** / **⌖** no cabeçalho para zoom e centralização do grafo.
8. Passe o mouse sobre as arestas para ver a distância e o feromônio numérico atual.
9. O log mostra, a cada iteração: a construção completa da rota da formiga 1 (vértice atual, candidatos com probabilidades, vértice sorteado, retorno ao depósito e comprimento), o comprimento da rota de cada formiga e, para cada aresta, o feromônio anterior, após evaporação, o depósito total e o final.

### Escala visual do feromônio

A cor de cada aresta segue uma escala **logarítmica fixa**: a intensidade é 1 + log₁₀(τ / τ_ref) / 6, limitada entre 0 e 1. Ou seja, τ = τ_ref é a cor mais intensa, τ ≤ τ_ref × 10⁻⁶ é a mais fraca, e cada sexto da barra corresponde a um fator 10.

- A referência τ_ref começa em τ₀ e só aumenta (é o maior feromônio já observado na execução). Por isso, uma aresta cujo feromônio diminuiu nunca aparece mais intensa.
- A legenda mostra os limites numéricos da escala, o mínimo e o máximo atuais e avisa sempre que τ_ref muda.
- A escala logarítmica mantém o contraste mesmo quando os depósitos Q/L são pequenos perto de τ₀ (por exemplo, no cenário inicial, com distâncias de centenas de unidades e Q = 14).
- O valor exato de cada aresta aparece ao passar o mouse sobre ela.

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

- Resultado obtido: **A → D → C → B → A**, comprimento **14** ✅. É o ótimo global, na orientação inversa de A → B → C → D → A. A rota foi encontrada já na iteração 1.
- Comprimentos observados em todas as rotas de todas as formigas: apenas 14, 16 e 18 ✅ (nenhuma rota inválida).
- Média das distâncias das formigas: 15,0 na iteração 1 e 14,0 na iteração 30.
- 30 registros de resultados, um por iteração ✅. O estado inicial (iteração 0) mostra τ = 1 e "ainda não calculada" para a melhor distância ✅.
- A melhor distância acumulada nunca aumentou ✅.
- Repetir dados, parâmetros e semente reproduziu o mesmo histórico ✅. Avançar 10 iterações e depois Executar até o fim gera exatamente o mesmo histórico de uma execução contínua; o intervalo visual só controla a espera entre iterações ✅.

### 6.5 — Efeito dos parâmetros

Comparação β=0 vs β=2, demais parâmetros da seção 6.4, sementes 1 a 5:

| Semente | β=0: melhor final | β=0: média das formigas na iteração 30 | β=2: melhor final | β=2: média das formigas na iteração 30 |
|:---:|:---:|:---:|:---:|:---:|
| 1 | 14 | 16,8 | 14 | 14,0 |
| 2 | 14 | 15,4 | 14 | 14,0 |
| 3 | 14 | 15,4 | 14 | 14,0 |
| 4 | 14 | 16,4 | 14 | 14,0 |
| 5 | 14 | 15,0 | 14 | 14,0 |

| Configuração | Média da melhor distância final | Execuções que atingiram 14 | Média das formigas na iteração 30 |
|---|---|---|---|
| β=0 | **14,0** | **5/5** | 15,8 |
| β=2 | **14,0** | **5/5** | 14,0 |

**Interpretação:** pela métrica pedida (melhor distância final), não houve diferença: as duas configurações encontraram o ótimo 14 em todas as execuções, já na primeira iteração. Isso é esperado nesta instância: só existem 3 ciclos distintos (14, 16 e 18), e 10 formigas sorteando rotas quase sempre encontram o de 14 logo no início, mesmo sem usar a distância.

A diferença aparece no comportamento da colônia:
- Com **β=2**, a distância favorece as arestas do perímetro (mais curtas) e o depósito reforça essas mesmas arestas. Na iteração 30, todas as formigas percorrem a rota de 14 (média 14,0).
- Com **β=0**, a escolha depende só do feromônio. A colônia converge mais devagar: na iteração 30, apenas 10% a 50% das formigas estavam na rota ótima, e a média ficou entre 15,0 e 16,8.

Em instâncias maiores, em que o ótimo não aparece por acaso nas primeiras iterações, espera-se que essa diferença também apareça na melhor distância final.

Validações de entradas inválidas:
- Coordenadas duplicadas → "Já existe um vértice nessas coordenadas." ✅
- Coordenadas com até duas casas decimais (ex.: 4.35; 19.99) aceitas; com três casas recusadas ✅
- Identificadores repetidos → mensagem de erro ✅
- Menos de 4 vértices → bloqueado com mensagem ✅
- Campos vazios → bloqueado com mensagem ✅
- Valores fora do intervalo → bloqueado com mensagem ✅
- Campos inteiros com decimais (ex.: 10.7 formigas) → recusados, sem truncar ✅
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