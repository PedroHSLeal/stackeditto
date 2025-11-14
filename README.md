# Stackeditto

## [BR] Contexto

No ano 2023 eu conheci o programa "Obsidian" e me apaixonei principalmente por esses 2 pontos:
- poder escrever documentos em formato markdown, oq dá uma liberdade do escritor de formatar com tipos de enfase(sublinhado,negrito, cabeçalhos, etc)
- extensões feitos pela comunidade usando javascript.

Porém no final desse mesmo ano, as normas de segurança da empresa foram alteradas e não pude mais utilizar esse software incrivel com todas as extensões que tinha instalado. Então no final do ano de 2023 e começo de 2024 comecei a buscar alternativas de software gratuitas que me dessem uma experiencia similar ao Obsidian oferecia, principalmente aos 2 pontos que foram citados anteriormente.

Após utilizar alternativas bem promissoras me deparei com esse projeto open-source, feito em Vue que propoe uma abordagem similar do obsidian de manipulação de arquivos markdown chamado [stackedit](https://github.com/benweet/stackedit). Com o projeto desses, eu utilizei o ano de 2024 todo para focar e analisar a arquitetura do projeto até pq eu gostaria de melhorar meus conhecimentos de arquitetura em projetos frontend com componentes, e depois gostaria de refatorar algumas funcionalidades que o projeto possui para deixar do jeito que eu gostaria. Mas como nem tudo são flores, o projeto nao era atualizado desde julho de 2019, e o projeto continha alguns padroes de projeto que confesso pra mim eram desconhecidos, oq aumentava a minha dificuldade de entendimento do projeto, sem contar que, o projeto possuia algumas "gambiarras" que me faziam questionar sempre a minha capacidade como desenvolvedor. Após diversas tentativas durante o ano, e muitas tentativas de abordagens diferentes em cima do mesmo projeto, no meio do ano de 2024, consegui fazer o projeto funcionar migrando o todo o seu repositório para o vite usando vue 2 ainda para compilar e executar o projeto, mas após muitas gambiarras tinha decidido encerrar esse ciclo de "bater em ponta de faca" com um projeto existente e comecei em dezembro de 2024 este projeto.

Na versão v0.1, este projeto consiste em testar um pouco as capacidades de
- monaco editor do vscode
  - principalmente para a parte de estilizacao (syntax highlight) quanto pra parte de troca de arquivos na web
- renderizacao do arquivo markdown pra html
  - markdown-it
  - marked

### ideias a serem implementadas na versao v0.1

[x] fazer funcionar a troca de arquivos
[x] configuracao basica do monaco editor no browser
[x] ver a renderizacao do markdown em html com o arquivo selecionado no editor
[x] salvar o arquivo com o texto alterado no browser pro arquivo local
[x] atualizacao reativa do texto no markdown renderizado
[x] carregar uma fonte bonita (JetBrains Mono) tanto no editor quanto na interface
[x] sistema de plugins (seguindo na ordem, katex, mermaid)
[x] sistema de plugins de scripts js simples (pensar um pouco melhor nessa ideia)
[x] pensar em uma interface simples

### ideias a serem implementadas na versao v0.2

[x] adicao de novos arquivos
[x] melhoria das interfaces
[ ] testes de componentes
[x] refatoracao da estrutura de extensões
[ ] add lib de tour do projeto (driver.js)
[x] teste com prosemirror
 - [x] teste para poder pegar o conteudo do editor transformado em markdown, para salvar no arquivo
 - - vou ter que instalar outra lib... kkkrying... :(
 - - - posso usar o turndown :) É bem facil extender as funcionalidades nessa lib
 - [x] fazer o teste de funcionalidade com cada tipo de escrita
 - - testando a versao mobile e desktop
 - - - copiando oq temos no whatsapp
 - - - [X] headings
 - - - [x] horizontal rules
 - - - [x] idk
 - - - [x] emphasis
 - - - - será que, dá pra fazer a decoracao de colocar os caracteres em volta do texto de enfase?
 - - - - por enquanto, aceito somente enfase que tem um par(um caracter em seguida do outro) de caracteres que condiz
 - - - [x] blockquotes
 - - - [x] lists
 - - - - tem que ver de como ajusta a ordem dos itens
 - - - - adicionar comando que adiciona mais um item na lista
 - - - [x] code
 - - - [x] tables
 - - - [x] links
 - - - [x] images
 - - - [x] plugins
 - - - [x] metadata
 - fazer o menu de topo com as acoes mais comuns do markdown
[ ] protocolo de failsafe
 - protocolo de segurança para somente os arquivos que vao ser utilizados pelo app
 - - salvar no opfs
 - - em formato zip

### backlog de estudos
 - web workers para as extensoes mais simples
 - indexedDB para indexar os arquivos e fazer processamento dos arquivos
 - ver a performance de leitura de arquivos, a principio para extensoes para posteriormente ser usado por find/replace
 - libs importantes pra adicionar pro projeto: browser-fs-access, dixie.js

### perguntas que surgiram que preciso responder depois...
 - com a troca de arquivos, os plugins nao reconhecem que foi o estado da view mudou
 - - será que o init() dos plugins é chamado?
 - - se, com a mudanca dos documentos, o update do state dos plugins pode ficar caro?