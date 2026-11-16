import { createHighlightPlugin, type Parser } from 'prosemirror-highlight';
import { createParser } from 'prosemirror-highlight/shiki';
import { bundledLanguagesInfo, getSingletonHighlighter, type BundledLanguage } from 'shiki';

export const plainText = "plaintext";

// carregadas já na abertura; as demais linguagens do Shiki são carregadas sob demanda na primeira vez que aparecem
const baseLanguages: BundledLanguage[] = ['javascript', 'typescript', 'python', 'csharp', 'powershell', 'asm'];

// id e apelidos (js, ts, py, sh, c#...) de todas as linguagens que o Shiki conhece, apontando para o id canônico
const languageIds = new Map<string, string>(
  bundledLanguagesInfo.flatMap(info => [info.id, ...(info.aliases ?? [])].map(name => [name, info.id] as const))
);

// normaliza o que vem depois das crases (```js, ```TS, ```c#) para o id canônico do Shiki, ou plaintext se ele não conhecer
export function extractLanguageForHighlight(desiredLanguage: string | null | undefined) {
  const language = (desiredLanguage ?? "").trim().toLowerCase();
  return languageIds.get(language) ?? plainText;
}

const highlighter = await getSingletonHighlighter({
  themes: ['github-light'],
  langs: baseLanguages,
})

const shikiParser = createParser(highlighter);

const parser: Parser = (options) => {
  const language = options.language ?? plainText;
  if (language !== plainText && !highlighter.getLoadedLanguages().includes(language)) {
    // o plugin espera a promise e redesenha as decorações quando a linguagem terminar de carregar
    return highlighter.loadLanguage(language as BundledLanguage);
  }
  return shikiParser(options);
};

export const highlightPlugin = createHighlightPlugin({
  parser,
  nodeTypes: ['code_block'],
  languageExtractor: (node) => extractLanguageForHighlight(node.attrs.language)
});