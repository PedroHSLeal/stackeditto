# Stackeditto playground

com o playground, voce pode criar ambientes isolados pra testar funcoes especificas do projeto

basta apenas executar o comando `npm run playground` e já comeca a diversao

como o vite cria um servidor estatico de arquivos a partir dessa pasta, pra acessar pastas do playground, basta apenas colocar na URL `localhost:${PORT}/${CAMINHO_DA_PASTA}`. Por exemplo,
 - caso voce queira acessar a pasta "playground", basta colocar na URL `localhost:5173/playground/` que ele vai executar os arquivos do playground.

###### nota
 - no meu caso a porta de localhost para o vite é a 5173, possa ser que no seu ambiente seja diferente