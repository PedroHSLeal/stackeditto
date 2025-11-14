type RegisterHtmlBlockEntry = {
  htmlTag: string,
  init: (element: HTMLElement, content?: string) => void,
  toMarkdown: (...args: any) => any,
  toHtml: (...args: any) => any,
}

declare function registerHtmlBlock(entry: RegisterHtmlBlockEntry);