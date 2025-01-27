# Stackeditto

## [BR] Contexto

No ano 2023 eu conheci o programa "Obsidian" e me apaixonei principalmente por esses 2 pontos:
- poder escrever documentos em formato markdown, oq dá uma liberdade do escritor de formatar com tipos de enfase(sublinhado,negrito, cabeçalhos, etc)
- extensões feitos pela comunidade usando javascript.

Porém no final desse mesmo ano, as normas de segurança da empresa foram alteradas e não pude mais utilizar esse software incrivel com todas as extensões que tinha instalado. Então no final do ano de 2023 e começo de 2024 comecei a buscar alternativas de software gratuitas que me dessem uma experiencia similar ao Obsidian oferecia, principalmente aos 2 pontos que foram citados anteriormente.

Após utilizar alternativas bem promissoras me deparei com esse projeto open-source, feito em Vue que propoe uma abordagem similar do obsidian de manipulação de arquivos markdown chamado [stackedit](https://github.com/benweet/stackedit). Com o projeto desses, eu utilizei o ano de 2024 todo para focar e analisar a arquitetura do projeto até pq eu gostaria de melhorar meus conhecimentos de arquitetura em projetos frontend com componentes, e depois gostaria de refatorar algumas funcionalidades que o projeto possui para deixar do jeito que eu gostaria. Mas como nem tudo são flores, o projeto nao era atualizado desde julho de 2019, e o projeto continha alguns padroes de projeto que confesso pra mim eram desconhecidos, oq aumentava a minha dificuldade de entendimento do projeto, sem contar que, o projeto possuia algumas "gambiarras" que me faziam questionar sempre a minha capacidade como desenvolvedor. Após diversas durante o ano, e muitas tentativas de abordagens diferentes em cima do mesmo projeto, no meio do ano de 2024, consegui fazer o projeto funcionar migrando o todo o seu repositório para o vite usando vue 2 ainda para compilar e executar o projeto, mas após muitas gambiarras tinha decidido encerrar esse ciclo de "bater em ponta de faca" com um projeto existente e comecei em dezembro de 2024 este projeto.

Na versão v0.1, este projeto consiste em testar um pouco as capacidades de
- monaco editor do vscode
- - principalmente para a parte de estilizacao (syntax highlight) quanto pra parte de troca de arquivos na web
- renderizacao do arquivo markdown pra html
- - markdown-it
- - marked

# ideias a serem implementadas na versao v0.1

~~[x] fazer funcionar a troca de arquivos~~
~~[x] configuracao basica do monaco editor no browser~~
~~[x] ver a renderizacao do markdown em html com o arquivo selecionado no editor~~
~~[x] salvar o arquivo com o texto alterado no browser pro arquivo local~~
~~[x] atualizacao reativa do texto no markdown renderizado~~
~~[x] carregar uma fonte bonita (JetBrains Mono) tanto no editor quanto na interface~~
~~[x] sistema de plugins (seguindo na ordem, katex, mermaid)~~
~~[x] sistema de plugins de scripts js simples (pensar um pouco melhor nessa ideia)~~
~~[x] pensar em uma interface simples~~

# ideias a serem implementadas na versao v0.2

[] melhoria das interfaces
[] refatoracao da estrutura de extensões
[] testes de componentes
[] add lib de tour do projeto
