type UntrustedHtmlBlockRegistry = {
  init: (element: HTMLElement, content: string) => void,
  toMarkdown: (...args: any) => any,
  toHtml: (...args: any) => any,
}

const registryUntrustedHtmlBlocks: { [htmlTag: string]: UntrustedHtmlBlockRegistry } = {};

export function registerUntrustedHtmlBlock(extensionData: { htmlTag: string } & UntrustedHtmlBlockRegistry) {
  if (extensionData.htmlTag) {
    registryUntrustedHtmlBlocks[extensionData.htmlTag] = {
      init: extensionData.init,
      toMarkdown: extensionData.toMarkdown,
      toHtml: extensionData.toHtml
    };

    console.log(`custom-element ${extensionData.htmlTag} registrado!`);
  }
}

export function getUntrustedHtmlBlocks(htmlTags: string[]): [string, UntrustedHtmlBlockRegistry][] {
  return Object.entries(registryUntrustedHtmlBlocks).filter(r => htmlTags.includes(r[0]));
}

export function getUntrustedHtmlBlock(htmlTag: string): UntrustedHtmlBlockRegistry {
  return registryUntrustedHtmlBlocks[htmlTag];
}

export function getUntrustedHtmlBlockKeys(): string[] {
  return Object.keys(registryUntrustedHtmlBlocks);
}