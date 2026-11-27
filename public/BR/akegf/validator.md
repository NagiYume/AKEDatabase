# AKEGF · Certificação de ferramentas

A certificação exige importação e exportação de v1.1 / v1.2. Informe a versão suportada no aplicativo e inclua um link para [AKEGF](https://www.akedata.wiki/?plugin=akegf&id=home).

Projetos compatíveis podem solicitar sua inclusão em [Projetos parceiros](/?plugin=akegf&id=partners) por meio de um [Pull Request](https://github.com/NagiYume/AKEDatabase/pulls).

Importe o [Exemplo com vários personagens](/plugin/data/akegf/example.json) e exporte os dados novamente. O personagem chinês deve manter três registros e o global, um. Compare tipo, banner, resultado, raridade, horário em milissegundos e número de sequência. Preserve o recrutamento e o pedido de arma com o mesmo número, além do tipo gift_weapon do presente.

## Validador AKEGF

Cole o JSON ou selecione um arquivo local. O navegador verifica o esquema, grupos duplicados e sequências repetidas no mesmo tipo. /endfield/0/list/1 indica o segundo registro do primeiro personagem.
