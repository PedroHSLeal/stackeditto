import { createHighlightPlugin } from 'prosemirror-highlight';
import { createParser } from 'prosemirror-highlight/shiki';
import { getSingletonHighlighter } from 'shiki';

export const plainText = "plaintext";

const baseLanguages = ['javascript', 'typescript', 'python', 'csharp', 'powershell', 'asm'];

export function extractLanguageForHighlight(desiredLanguage: string) {
  const i = baseLanguages.indexOf(desiredLanguage);
  return baseLanguages[i] ?? plainText;
}

const highlighter = await getSingletonHighlighter({
  themes: ['github-light'],
  langs: baseLanguages,
})

export const highlightPlugin = createHighlightPlugin({
  parser: createParser(highlighter),
  nodeTypes: ['code_block'],
  languageExtractor: (node) => extractLanguageForHighlight(node.attrs.language)
});