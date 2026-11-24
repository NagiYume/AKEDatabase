O AKEData foi transferido para o domínio www.akedata.wiki. O domínio anterior, akedata.top, agora redireciona para cá.

# Registro de atualizações do AKEData

### v1.3.9

Chegaram o rascunho [AKEGF](https://www.akedata.wiki/?plugin=akegf&id=home) v0.3, o exemplo com vários personagens e o [Validador AKEGF](/?plugin=akegf&id=validator). Artigos de pesquisa, AKEGF e avisos compartilham a renderização Markdown e o realce de sintaxe.

### v1.2.11

#### Navegação secundária e interface compartilhada

- A navegação secundária dos principais módulos de consulta foi refeita, unificando a estrutura dos itens, estados ativos, contagens, marcações de mudanças de versão, pesquisa, filtros e interação em computadores e dispositivos móveis.
- Foi criada uma camada de interface compartilhada para botões, campos, seletores, interruptores, filtros, cartões, estados e tabelas, reduzindo diferenças visuais e de uso entre os módulos.

#### Configurações e exibição

- As janelas de configurações globais e de anúncios do site foram redesenhadas, com melhor organização e aparência consistente nos temas claro, escuro e de conforto visual.
- Os estados de carregamento, conteúdo vazio e erro foram unificados. Cabeçalhos e conteúdos das tabelas compartilhadas agora ficam centralizados por padrão.

### v1.2.10-1

#### Comparação de versões do Arquivo

- Ao usar os dados Latest, o Arquivo é comparado com o Hotfix final da versão anterior do jogo. Os arquivos adicionados nesta versão ficam fixados no topo e marcados globalmente na visão inicial, além de fixados e marcados dentro de sua categoria no diretório; as novas entradas de cada grupo também aparecem primeiro. Versões históricas fixas não exibem indicadores de conteúdo novo.

### v1.2.10

#### Arquivo

- Adicionado o Arquivo como módulo público para consultar os arquivos, documentos e registros presentes no jogo.
- A página inicial oferece uma visão geral de todos os arquivos, um diretório por suporte e categoria, pesquisa em todo o texto e links diretos para cada grupo de arquivos.
#### Conteúdo dos arquivos

- Os detalhes exibem títulos e textos com formatação enriquecida, além das imagens originais do jogo. Quando um documento possui variações do protagonista, é possível alternar entre as imagens da protagonista feminina e do protagonista masculino.
- Os arquivos audiovisuais mostram apenas uma transcrição linha a linha; esta versão não solicita nem reproduz áudio.

#### Navegação e exibição

- Adicionados diretórios adaptados para computador e celular, restauração do estado de navegação ao retornar ao módulo e suporte à exportação como imagem longa.
- O texto enriquecido agora exibe corretamente as marcações de ocultação. Ícones que não puderem ser carregados usam a imagem padrão de ausência, enquanto imagens de conteúdo indisponíveis mostram um aviso claro.

### v1.2.9

#### Diversos e central de tarefas

- Adicionado o módulo Diversos, extensível por ferramentas independentes. A primeira versão abrange tarefas semanais, Passe de Protocolo e tarefas de atividades de Treinamento, Contratos, Masmorras de Corrida e Torneios.
- As tarefas do Passe de Protocolo podem ser filtradas por semana e agora exibem todos os níveis das três trilhas de recompensas.

#### Ícones e dados de obtenção

- Adicionado um gerador de ícones de personagem para escolher personagem e habilidade, visualizar a composição e baixá-la em PNG.
- As lojas agora mostram requisitos de desbloqueio e níveis de Despacho de Materiais; os detalhes de equipamento incluem fontes como lojas, missões e caixas de modelo no mapa. Os links do mapa OEM são calculados dinamicamente a partir do LevelData somente após o clique.

#### Experiência e estabilidade

- Padronizada a imagem substituta para falhas de carregamento, além de correções na rolagem independente de Diversos, nos controles móveis e em vários layouts de recompensas.
- Os novos módulos de dados de combate `v3_skill` e de Buff `v3_buff` continuam em validação e não estão disponíveis nesta versão.

### v1.2.8

#### Barras laterais e layout

- A barra lateral principal e as barras secundárias de cada módulo agora podem ser redimensionadas ao arrastar, e as larguras ajustadas são salvas separadamente. Quando uma barra fica estreita, as entradas com ícone exibem apenas o ícone, enquanto as entradas sem ícone mantêm o nome para identificação.
- Os botões de Configurações globais e exportação de imagem longa agora ocupam uma área inferior exclusiva e não se sobrepõem mais à lista de módulos.

#### Estado de navegação

- Durante a mesma sessão de navegação, ao voltar a um módulo são restaurados a página, a entrada e a posição de rolagem abertas anteriormente.
- As posições de rolagem dos detalhes são salvas separadamente para diferentes entradas do mesmo módulo. Atualizar a página limpa esses estados temporários e retorna à página inicial.

### v1.2.7

#### Masmorras e atividades

- Os detalhes das masmorras agora exibem recompensas fixas e aleatórias repetíveis que consomem Sanidade, separadas das recompensas da primeira conclusão.
- Os blocos da linha do tempo de atividades agora usam os horários exatos de início e fim, em vez de serem alinhados a dias inteiros.

#### Visões gerais e imagens

- Os cards de personagens e a barra lateral agora mostram ícones de elemento e profissão, com cores recalibradas e o ícone escolhido pelo ID da profissão.
- As estrelas de raridade foram removidas das visões de Personagens e Armas, e o nível de perigo da visão de Inimigos. Filtros, ordenação e detalhes permanecem iguais.
- Ícones embutidos em rich text, links de termos e tooltips agora são resolvidos pelo domínio de dados ativo, corrigindo a ausência de `data.akedata.wiki` e caminhos `//public/...` incorretos.

### v1.2.6

#### Comunicações do Baker

- Adicionado o módulo Baker para consultar conversas completas de Operadores, contatos e grupos, com filtros de tipo, busca de texto completo e links diretos por URL.
- Várias conversas com o mesmo contato agora aparecem como entradas separadas na barra lateral, e as opções de diálogo alteram a ramificação seguinte.
- Há suporte a texto, imagens, anexos de itens e missões, mensagens do sistema, reações e imagens de opções `sns_emoji`, além de melhorias em avatares, rolagem e layouts para desktop e celular.

### v1.2.5

#### Imagens e envio de ativos

- As imagens agora preservam a estrutura original em `assets/beyond/dynamicassets/gameplay`, e todos os módulos usam os novos caminhos.
- Corrigimos recursos ausentes causados pela correspondência de diretórios e pelo mapa interno incompleto do beyond-sdk, distinguindo também `charremoteicon` de `charremoteicon700`.
- AKE Data Tool agora envia imagens, dados Json ou ambos e verifica o tamanho atual e o pico projetado de todo o bucket R2, bloqueando o envio ao atingir 10 GB.
- `pluginversion` e `jsversion` atualizam HTML e JavaScript separadamente, mantendo os recursos inalterados no cache local.
- O módulo Baker não faz parte desta versão e foi adiado para a `1.2.6`.

### v1.2.3

#### Módulos e visibilidade

- O módulo de Missões foi ocultado temporariamente e marcado como “Em desenvolvimento”. Os módulos de depuração BuffData, SkillData e SpawnerConfig foram desativados, e a descrição de Echoes of War foi atualizada.
- Com “Mostrar módulos ocultos” desativado, IDs internos de personagens, equipamentos, atividades, Buffs e outros dados não são exibidos. Valores originais e fórmulas de cálculo agora ficam sempre disponíveis.
- Modificadores de atributos são agrupados por origem, como surgimento, Buff ou fase. Buffs de atributos do módulo de Inimigos participam dos cálculos; com o modo oculto desligado, IDs e Buffs sem efeito em atributos não aparecem.

#### Inimigos e modos de jogo

- Masmorras, Contingency Contract e Echoes of War agora compartilham um único renderizador de inimigos para atributos de nível, Buffs de surgimento e resultados modificados. As novas resistências elementais (94–99) são usadas e os coeficientes antigos (80–85) deixam de aparecer.
- As rotações de Echoes of War podem ser expandidas ou recolhidas e usam cores de borda para estados ativos, futuros e encerrados. Apenas a rotação ativa abre por padrão e, em cada rotação, somente a configuração de maior dificuldade fica expandida.
- Quando as três dificuldades têm as mesmas descrições de característica e bônus, elas aparecem uma vez antes da lista. Descrições diferentes permanecem em suas respectivas dificuldades.
- Corrigida a renderização de `v2cc-term-param` em Contingency Contract. A configuração da atividade começa recolhida e as condições de desbloqueio das missões ficam ocultas.

#### Atividades e interface

- A página inicial de Atividades recebeu uma linha do tempo com datas de início, fim e status. Ela mostra datas ao passar o cursor, mantém títulos fora da tela na borda esquerda e exibe à direita ícones que preenchem a altura. Voltar pelo botão Início agora a renderiza corretamente.
- Corrigidas as quebras de linha escapadas nas descrições de habilidades de personagens e armas. O ícone do componente padrão aparece ao lado do botão de custo de fabricação do equipamento.
- A exportação de imagem longa deixou de ser experimental e vem ativada por padrão. Ela exclui a barra lateral e usa o nome correto do módulo ou página.

#### Carregamento de dados e avisos

- O cache persistente de TableCfg muda apenas quando o Hotfix muda. Json e imagens usam uma revisão independente de dados compartilhados e não são recarregados apenas por alterações da versão do site ou do Hotfix.
- Os avisos agora renderizam corretamente títulos, listas e código em linha de Markdown. A página Sobre e o README também incluem o link parceiro “终末地一图流”.

### v1.2.2

Valores originais e fórmulas agora são abertos em um popover persistente ao clicar no número, substituindo a dica atrasada ao passar o mouse. Clicar em outro valor troca o conteúdo; clicar em uma área vazia da página ou pressionar Esc fecha o popover. Ele se reposiciona ao rolar ou redimensionar a janela, oferece suporte a dispositivos móveis e teclado e não altera o estilo visual dos números.

Foi corrigido um problema em que manipuladores de clique dos módulos impediam que cliques reais do mouse abrissem o popover. Também foi corrigida a exibição de `[object Object]` nos valores de habilidade de `chr_0032_lizhiyan`.

### v1.2.1

Corrigido um problema que podia fazer algumas imagens do jogo serem solicitadas incorretamente de `www.akedata.wiki` após trocar de módulo ou reiniciar o Service Worker. Os caminhos de imagem agora são reescritos de forma síncrona para `data.akedata.wiki` ao serem inseridos na página.

O Service Worker agora restaura a origem dos dados e a revisão dos dados compartilhados a partir de sua URL de registro. Assim, o roteamento de imagens continua correto mesmo depois que o navegador suspende e reinicia o Worker. O ícone do site também é carregado diretamente da origem de dados.

Foi adicionada a análise de inimigos de `LevelScriptData` aos cálculos de atributos de Masmorras, Contingency Contract e Echoes of War. Agora são lidos inimigos, níveis e Buffs de surgimento definidos diretamente nos scripts, além de Buffs condicionais aplicados por geradores. Isso permite calcular corretamente fases sem SpawnerConfig. Também foram corrigidos o pré-carregamento dos Buffs de condições de Contingency Contract e o recálculo após alterar condições.

As dicas de valores originais foram aprimoradas. Valores sem alteração de cálculo continuam exibindo o valor original; valores modificados por atributos, Buffs, condições de contrato ou expressões agora exibem o valor original, os parâmetros substituídos, a fórmula completa e o resultado final. O rastreamento de fórmulas cobre Masmorras, Contingency Contract, Echoes of War, inimigos e expressões calculadas de personagens, armas, equipamentos e itens.

### v1.2.0

Foi adicionada a comparação de dados entre versões do jogo. Ao selecionar `Latest`, o site compara automaticamente com o último Hotfix da versão anterior. Novas entradas ficam sempre no topo e recebem uma etiqueta; etiquetas de modificações e o Diff detalhado podem ser ativados pela opção experimental global, desativada por padrão.

O Diff detalhado compara somente as informações visíveis na página: remoções aparecem em vermelho, adições em verde e campos ocultos são ignorados. Atividades não participam da detecção de novidades. Equipamentos e medalhas são comparados por ID individual, e seus conjuntos ou categorias também recebem etiquetas. As bordas dos cartões continuam usando as cores de raridade.

### v1.2.0-pre2

O mapeamento completo de atributos foi atualizado, incluindo os IDs 93–100, e sincronizado com os arquivos `maps.json` dos 14 idiomas.

Os módulos de inimigos e masmorras agora usam os novos parâmetros de resistência elemental (IDs 94–99). Os antigos coeficientes de resistência, IDs 80–85, deixaram de aparecer nos cartões de atributos, resumos de modificadores e dicas de Buff relacionadas.

### v1.1.9

Foi adicionado o módulo do desafio permanente “Ecos da Guerra”, com visualização por temporada e rotação de fases, dificuldades, títulos de classificação, recompensas de mérito e instruções oficiais. O módulo também exibe ondas de inimigos, mapas de surgimento, Buff de nascimento e atributos ajustados por nível, com troca de ondas e destaque vinculado no mapa.

### v1.1.8

Foram adicionados o modo de depuração e a atualização forçada do cache da web; corrigidos os nós de atributos dos personagens e a análise dos custos de desenvolvimento com base nas descrições dos itens; os tipos de atividade passaram a usar ActivityTagTable; estilos e termos de texto rico agora são lidos diretamente de TableCfg; e módulos com página inicial receberam um botão de início na barra lateral.

### v1.1.6

Foram adicionados avisos no site e uma contagem regressiva para atualizações, adaptados os grupos de habilidades de duas formas de Jue, otimizadas as mensagens de carregamento e removidos vários módulos v2 descontinuados.

### v1.1.5

Foi lançada a estrutura multilíngue, permitindo alternar o idioma da interface, dos módulos, dos filtros e dos mapeamentos de dados, além da inclusão do primeiro conjunto de recursos localizados.

### v1.1.4

Foram corrigidos os parâmetros de versão das solicitações de dados, separadas as versões de atualização dos recursos do aplicativo e dos dados públicos, e unificada a verificação de versão do cache das páginas e do Service Worker.

### v1.1.3

O módulo de itens recebeu efeitos de uso de consumíveis e receitas de síntese, além de relações entre materiais e produtos, estilos de detalhes e a adaptação de dados v3 correspondente.

### v1.1.2

Foram adicionadas entradas de visão geral em cartões agrupados aos módulos de personagens, armas, inimigos, equipamentos, atividades, itens, dungeons, medalhas e pesquisas.

### v1.1.1

Os filtros de categorias de itens foram refeitos com recolhimento e contagem de resultados; também foram aprimorados a deduplicação de solicitações, o cache IndexedDB e a exibição do progresso de carregamento dos dados.

### v1.1.0

Foi lançada a camada de adaptação de dados v3 baseada em TableCfg e Json, abrangendo os principais módulos de consulta e adicionando a desativação de módulos e o cache de arquivos de dados grandes.

### v1.0.31

Foram adicionadas a alternância entre interfaces em chinês e inglês, a troca do diretório de dados e as configurações de internacionalização relacionadas, mas o recurso foi totalmente revertido depois e não continuou disponível nesta fase.

### v1.0.30

Foi adicionado um wrapper unificado de cache de solicitações, e todas as páginas passaram a usar akeFetch para carregar dados, reduzindo solicitações repetidas e otimizando o carregamento ao trocar de módulo.

### v1.0.29

Os scripts incorporados da página inicial e dos módulos foram separados para o diretório plugin/js, centralizando o gerenciamento de rotas, configurações, cálculos de atributos e controladores dos módulos.

### v1.0.28

Foram adicionadas dicas com valores originais aos parâmetros da maioria dos módulos, além de correções no cálculo de vida dos inimigos e na exibição de “redução de todos os danos”.

### v1.0.27

O Contrato de Contingência recebeu visualização das ondas de inimigos, com coordenadas de surgimento, troca de ondas e destaque vinculado, além da correção das estatísticas combinadas de ondas repetidas.

### v1.0.26

O Contrato de Contingência recebeu consulta de atributos dos inimigos, calculando e exibindo os valores reais conforme o nível, os Buff de nascimento e os termos de contrato selecionados.

### v1.0.25

O módulo Contrato de Contingência restrito por Token foi pré-carregado e liberado, com busca de temporadas, condições e conflitos de termos, pontuação, recompensas, missões e loja.

### v1.0.24

A exibição de habilidades de personagens v2 foi atualizada, corrigindo a ordem das habilidades combinadas e supremas e preservando parâmetros essenciais como tempo de recarga e consumo de energia.

### v1.0.23

O módulo de pesquisas foi aberto oficialmente, com melhorias em Markdown, destaque de código, índice, navegação por âncoras e prévia de imagens, além de novos artigos sobre mecânicas.

### v1.0.22

Foram adicionadas restrições de acesso a módulos e conteúdos baseadas em Token, com persistência, adição em lote e remoção de Token, além do pré-carregamento de conteúdo protegido.

### v1.0.21

A tabela de crescimento de atributos dos personagens v2 recebeu coeficientes de dano de anomalia física e mágica, exibidos com diferentes níveis de precisão conforme o modo de visualização.

### v1.0.20

A ordem e alguns nomes dos atributos detalhados dos inimigos foram ajustados, antecipando resistência a interrupção e execução e padronizando os termos de bônus de dano.

### v1.0.19

O módulo de equipamentos recebeu a exibição do ID do equipamento; os estilos v2 de personagens, armas e equipamentos foram organizados, e as cores dos atributos e a seleção dos valores de crescimento foram corrigidas.

### v1.0.18

Foram adicionados deep link para módulos e entradas, sincronizando a barra de endereços durante a navegação e tratando conteúdo oculto ou inexistente, além de completar a exibição dos tipos de correção de atributos dos personagens.

### v1.0.17

O módulo de armas v2 foi lançado oficialmente, oferecendo busca de armas e dados detalhados de atributos por nível, materiais de aprimoramento, potenciais e habilidades.

### v1.0.16

O módulo de equipamentos v2 foi lançado oficialmente, exibindo por conjunto as peças, os atributos principais e secundários, as habilidades do conjunto, as receitas de fabricação, a garantia de refinamento e as informações de aprimoramento.

### v1.0.15

O módulo de dungeons v2 foi lançado oficialmente, com séries, recompensas e detalhes dos inimigos, além da análise de configurações de surgimento e Buff para exibir ondas e atributos corrigidos.

### v1.0.14

O módulo de inimigos v2 foi lançado oficialmente, adicionando busca, lista móvel, atributos por nível, variantes de inimigos, modificações de atributos, resistências e informações de desequilíbrio.

### v1.0.13

O módulo de personagens v2 foi lançado oficialmente, reformulando atributos, habilidades, talentos, potenciais e crescimento dos personagens, além de corrigir características, imagens e exibição de nós.

### v1.0.12

A timeline do SkillData v2 foi aprimorada com filtro de ações, fluxograma de ramificações condicionais, controle de visibilidade dos nós e dicas de duração dos frames, além da correção de alguns valores de inimigos.

### v1.0.11

Foi adicionada uma visualização de depuração oculta do SkillData v2, que apresenta a lógica das habilidades por timeline e nós de ação, com busca e consulta dos dados originais.

### v1.0.10

A reformulação dos personagens v2 continuou, estabelecendo uma nova página de detalhes e integrando os dados completos dos personagens, com mapeamentos de campos e estrutura de exibição aperfeiçoados.

### v1.0.9

Foi adicionado o módulo de consulta SpawnerConfig, permitindo navegar pelos dados dos geradores por cena e configuração, além de ajustes nas entradas de consulta de BuffData e SkillData.

### v1.0.8

Foram adicionados os módulos de consulta BuffData e SkillData, com navegação por listas, busca e detalhes, oferecendo acesso à pesquisa dos dados fundamentais de combate.

### v1.0.7

Foi adicionada a consulta de informações de atividades, ajustada a exibição padrão dos termos de personagens com suporte aos termos especiais de Laecy e incluídas estatísticas de visitas ao site.

### v1.0.6

A página Sobre recebeu uma lista de apoiadores e os estilos correspondentes, aprimorando a apresentação dos agradecimentos do projeto.

### v1.0.5

A adaptação para dispositivos móveis foi concluída nos principais módulos de personagens, armas, inimigos, equipamentos, itens, dungeons e conquistas, incluindo os três temas.

### v1.0.4

Foram adicionados filtros aos módulos de personagens, armas e itens, com reformulação da área de filtros das listas para tornar mais eficiente a busca entre muitas entradas.

### v1.0.3

Foi adicionada a interface de consulta de itens e registrado o módulo correspondente, com lista de itens, detalhes e exibição das informações básicas relacionadas.

### v1.0.2

A página de personagens recebeu ícones de habilidades e habilidades logísticas, incluindo tipo de instalação, nível, descrição e condições de desbloqueio, além da correção dos dados relacionados.

### v1.0.1

Foi corrigida a exibição anormal dos dados de atributos fixos dos inimigos, e as informações dos inimigos na página de dungeons também foram aprimoradas.

### v1.0.0

O AKEData 1.0 foi lançado oficialmente, concentrando melhorias no conteúdo de consulta de dungeons e elevando a versão do projeto de 0.99 para 1.0.
