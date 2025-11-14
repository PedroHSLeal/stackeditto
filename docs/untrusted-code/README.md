# UNSTRUSTED CODE EXTENSIONS

## linha de pensamento
Quando se fala sobre extensoes, penso na ideia de aumentar a capacidade do sujeito para que ele cumpra uma missao.
No caso das extensoes, sei que pode ocorrer riscos de que, algum usuario escreva alguma extensao que nao seja segura, a ponto de afetar a performance do app e a seguranca das informacoes que residem no workspace do usuario. Mas seguindo a premissa que, caso o usuario queira extender o app pra alcançar o objetivo, as extensões vão dar total liberdade pra ele cumprir o seu objetivo.


## ideias basicas de uma extensao
- ~~um arquivo .md que tem uma tag html~~ implementado!
  ```md
  # estudo sobre notas musicas com interacao usando strudel.cc

  <strudel>
    // escala de dó
    // note("c d e f g a b c4")
    
    // escala de dó menor
    // note("c d eb f g ab bb c4")
    
    // escala cromatica
    note("c c# d d# e f f# g g# a a# b c4")
    .sound("piano")
    .cpm(10)
  </strudel>
  ```
- ~~um arquivo .md que tem uma interpolacao de strings que tem no angular e vue~~ implementado!
  ```md
  # resolucao financeira

  - Janeiro tivemos uma alta de {{ pegar_valor_da_planilha('Janeiro') }}% em relacao ao mes anterior
  ```


## pontos pra estudos
- se, dentro de uma estrutura de extensoes, o usuario fizer um import, nao vai funcionar esse import, pq a execucao precisa ser com o scriptType == `module` (ex: `{ type: module }`)
```js
import mod from './asdf.js'
```