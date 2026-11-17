import { useEffect, useState } from "react";

import type { CustomDirectory, CustomFile } from "@/models/file-system";
import { EXTENSION_STRUCTURE } from "@/services/untrusted-code-extensions";
import { useExtensionConfigs } from "@/services/untrusted-code-extensions";

type Props = {
  configDirectory: CustomDirectory | null;
  onCreate(): Promise<void>;
  onSave(file: CustomFile, content: string): Promise<void>;
  onClose(): void;
};

const { loadConfigsJson } = useExtensionConfigs();

/**
 * Versão simples do ExtensionModal.vue: edita o .stackeditto/index.js num textarea (o app usa Monaco
 * com os tipos de registerHtmlBlock/getModule), salva e executa as extensões de novo.
 */
export function ExtensionPanel({ configDirectory, onCreate, onSave, onClose }: Props) {
  const indexFile = configDirectory?.files.find((f) => f.name == EXTENSION_STRUCTURE.INDEX__JS.fileName) ?? null;
  const configsFile = configDirectory ? loadConfigsJson(configDirectory) : undefined;
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    setText(null);
    void indexFile?.text().then(setText);
  }, [indexFile]);

  return (
    <section style={{ borderBottom: "1px solid #eee", padding: 8, display: "flex", flexDirection: "column", gap: 6, maxHeight: "45%" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <strong style={{ flex: 1 }}>Extensões ({EXTENSION_STRUCTURE.EXTENSION_FOLDER}/{EXTENSION_STRUCTURE.INDEX__JS.fileName})</strong>
        {configsFile && <small style={{ color: "#999" }}>{configsFile.name} encontrado</small>}
        {indexFile && text != null && <button className="primary" onClick={() => void onSave(indexFile, text)}>Salvar e recarregar</button>}
        <button onClick={onClose}>Fechar</button>
      </div>

      {!configDirectory && (
        <p style={{ margin: 0 }}>
          Este workspace não tem a pasta <code>{EXTENSION_STRUCTURE.EXTENSION_FOLDER}</code>.{" "}
          <button className="secondary" onClick={() => void onCreate()}>Criar com o modelo padrão</button>
        </p>
      )}

      {configDirectory && !indexFile && <p style={{ margin: 0 }}>Sem {EXTENSION_STRUCTURE.INDEX__JS.fileName} na pasta de extensões.</p>}

      {indexFile && text != null && (
        <textarea
          value={text}
          spellCheck={false}
          onChange={(event) => setText(event.target.value)}
          style={{ minHeight: 180, fontSize: 12, fontFamily: "monospace", resize: "vertical" }}
        />
      )}

      <small style={{ color: "#b55" }}>
        Atenção: como no app, o código das extensões roda com todos os privilégios da página (não há sandbox).
      </small>
    </section>
  );
}
