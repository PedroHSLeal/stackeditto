~~como injetar um elemento html no prosemirror~~ consegui registrar o html_block no schema do prosemirror pra cadastrar o novo elemento.
- e como fica a sua interacao
- - esse elemento html DEVE integarir com outros elementos html?
- - - o problema dessa abordagem de "hooks" injetaveis no código, é que, o usuario caso queira, pode ter acesso ao `window`
~~- - - como o conteudo vai ser salvo no arquivo?~~ tem um "hook" que consegue ter acesso ao elemento e ao direito do usuario, consegue manipular o conteudo da forma que ele desejar
- - como "cadastrar" o custom element?
- - - vai ser via script de extensao?

~~- O problema é a falta de implementacao na hora de:~~ o hook consegue dar ao usuario o poder pra ele ditar como que o conteudo usado naquele custom-elements pode ser salvo
~~- - instanciar o elemento~~
~~- - salvar o documento~~

- na hora de declarar o `import()` nas extensoes, temos alguns casos na hora de importar o codigo js:
- - o codigo pode estar no formato antigo de import/export (commonJS!?)
- - o código pode estar usando javascript ESM(ECMAScript Modules)
- nesse caso, o preferencial de importacao tem que ser o ESM para funcionar em conjunto com a estrategia de extensao
- - DUVIDA: tem alguns modulos que sao importados e já sao executados (como por exemplo o strudel). Como dar suporte pra esse tipo de modulo usando em conjunto `import()`
- lembrando que, o modulo pode conter apenas um exportacao de código `default`, acessivel pelo `$module.default` (o jquery é assim)
- e o modulo pode ter varios exports, daí é possivel acessar os exports como se fosse um objeto `$module.asdf`

- como os imports acontecem no começo de abrir um workspace, poderia existir uma tela de loading pra carregar as extensoes?
- - nessa tela, assim como acontece no obsidian, poderia ter um titulo, e uma barra de loading
- - com relacao ao tempo de loading, 30 segundos poderia ser o tempo maximo?
- - - essa informacao poderia ser alterada pelo arquivo de config

- pensei em usar web workers pra executar as extensoes criadas pelo usuario, mas como pode existir extensoes de inserir elementos html no window, nao é uma boa ideia isso...

- como as extensoes, principalmente as assincronas, precisam ser executadas e registradas, para depois mostrar o componente em tela`
- - será que posso criar um mecanismo de, enquanto o elemento nao for registrado, o elemento que é o container do custom-elements renderizar um loading!?