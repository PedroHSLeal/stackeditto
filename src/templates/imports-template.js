// adicone aqui seu código para ser executado pelas extensoes, como por exemplo...

await import("https://unpkg.com/@strudel/repl@1.0.2");

registerHtmlBlock({
  htmlTag: "strudel-editor",
  init: (element, content) => {
    element.setAttribute('code', content.replace("<!--", "").replace("-->", "").replace("\n", ""))
  },
  toMarkdown: (containerElement, element) => {
    return element?.editor.code;
  },
  toHtml: () => { },
});