import { useState } from "react";

import type { CustomDirectory, CustomFile } from "@/models/file-system";

export type TreeActions = {
  openFile(file: CustomFile): void;
  newFile(directory: CustomDirectory): void;
  newDirectory(directory: CustomDirectory): void;
  renameFile(file: CustomFile): void;
  deleteFile(file: CustomFile): void;
  deleteDirectory(directory: CustomDirectory): void;
};

type Props = {
  root: CustomDirectory;
  openedPath: string | null;
  dirty: ReadonlySet<string>;
  actions: TreeActions;
};

/** Versão simples do TreeView.vue: pastas recolhíveis e ações por item (sem menu de contexto). */
export function TreeView({ root, openedPath, dirty, actions }: Props) {
  return (
    <div style={{ fontSize: 13, padding: "6px 4px", userSelect: "none" }}>
      <Row depth={0} label={`📁 ${root.handle.name}`} bold>
        <Action title="Novo arquivo" onClick={() => actions.newFile(root)}>+📄</Action>
        <Action title="Nova pasta" onClick={() => actions.newDirectory(root)}>+📁</Action>
      </Row>
      <DirectoryChildren directory={root} depth={1} openedPath={openedPath} dirty={dirty} actions={actions} />
    </div>
  );
}

function DirectoryChildren({ directory, depth, ...rest }: { directory: CustomDirectory, depth: number } & Omit<Props, "root">) {
  return (
    <>
      {directory.directories.map((child) => <DirectoryItem key={child.webkitRelativePath} directory={child} depth={depth} {...rest} />)}
      {directory.files.map((file) => <FileItem key={file.webkitRelativePath} file={file} depth={depth} {...rest} />)}
    </>
  );
}

function DirectoryItem({ directory, depth, actions, ...rest }: { directory: CustomDirectory, depth: number } & Omit<Props, "root">) {
  const [open, setOpen] = useState(true);

  return (
    <>
      <Row depth={depth} label={`${open ? "▾" : "▸"} ${directory.handle.name}`} onClick={() => setOpen(!open)}>
        <Action title="Novo arquivo" onClick={() => actions.newFile(directory)}>+📄</Action>
        <Action title="Nova pasta" onClick={() => actions.newDirectory(directory)}>+📁</Action>
        <Action title="Excluir pasta" onClick={() => actions.deleteDirectory(directory)}>🗑</Action>
      </Row>
      {open && <DirectoryChildren directory={directory} depth={depth + 1} actions={actions} {...rest} />}
    </>
  );
}

function FileItem({ file, depth, openedPath, dirty, actions }: { file: CustomFile, depth: number } & Omit<Props, "root">) {
  const path = file.webkitRelativePath;

  return (
    <Row depth={depth} label={`${file.name}${dirty.has(path) ? " ●" : ""}`} active={openedPath == path} onClick={() => actions.openFile(file)}>
      <Action title="Renomear" onClick={() => actions.renameFile(file)}>✎</Action>
      <Action title="Excluir" onClick={() => actions.deleteFile(file)}>🗑</Action>
    </Row>
  );
}

function Row({ depth, label, active, bold, onClick, children }: { depth: number, label: string, active?: boolean, bold?: boolean, onClick?(): void, children?: React.ReactNode }) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 4, cursor: "pointer", borderRadius: 4,
        padding: `2px 4px 2px ${8 + depth * 12}px`,
        background: active ? "var(--primary)" : hover ? "#f3f3f3" : "transparent",
        fontWeight: bold ? 600 : 400,
      }}
    >
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ display: "flex", gap: 2, visibility: hover ? "visible" : "hidden" }}>{children}</span>
    </div>
  );
}

function Action({ title, onClick, children }: { title: string, onClick(): void, children: React.ReactNode }) {
  return (
    <button title={title} style={{ background: "transparent", padding: "0 3px", minHeight: 0 }} onClick={(event) => { event.stopPropagation(); onClick(); }}>
      {children}
    </button>
  );
}
