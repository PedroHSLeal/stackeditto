// v1 -> funcoes que contem o código que será executado pra registrar um custom element
// bem simples, mas queria que o usuario nao soubesse que precisava ter uma funcao dentro de outra que ele está programando
return function (registerHtmlBlock) {
  return import("https://unpkg.com/@strudel/repl@1.0.2").then(module => {
    registerHtmlBlock({
      htmlTag: "strudel-editor",
      init: (element, content) => {
        element.setAttribute('code', content.replace("<!--", "").replace("-->", "").replace("\n", ""))
      },
      toMarkdown: (containerElement, element) => {
        let editor = containerElement?.querySelector("strudel-editor");

        console.log(containerElement);
        console.log(element);
        console.log(element?.editor.code);

        return element?.editor.code;
      },
      toHtml: () => { },
    })
  })
}