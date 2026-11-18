/// <reference lib="webworker" />
// FileSystemSyncAccessHandle only exists in dedicated workers and only for OPFS files,
// so everything that touches it runs here and times itself.
import { FIXTURE_DIR } from "./shared";

type Request =
  | { id: number; type: "read"; path: string }
  | { id: number; type: "write"; path: string; data: ArrayBuffer }
  | { id: number; type: "probe"; handle: FileSystemFileHandle };

async function opfsFile(path: string, create = false): Promise<FileSystemFileHandle> {
  let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(FIXTURE_DIR, { create: true });
  const parts = path.split("/");
  for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create });
  return dir.getFileHandle(parts.at(-1)!, { create });
}

self.onmessage = async ({ data }: MessageEvent<Request>) => {
  try {
    if (data.type == "probe") {
      // Is a sync access handle available for this handle at all? (Only OPFS files.)
      const access = await (data.handle as any).createSyncAccessHandle();
      access.close();
      self.postMessage({ id: data.id, ok: true });
      return;
    }

    const handle = await opfsFile(data.path, data.type == "write");
    const started = performance.now();
    const access = await (handle as any).createSyncAccessHandle();
    const openMs = performance.now() - started;

    if (data.type == "read") {
      const size = access.getSize();
      const buffer = new Uint8Array(size);
      const bytes = access.read(buffer, { at: 0 });
      access.close();
      self.postMessage({ id: data.id, ok: true, sample: { ms: performance.now() - started, getFileMs: openMs, firstDataMs: performance.now() - started, bytes } });
    } else {
      access.truncate(0);
      const bytes = access.write(new Uint8Array(data.data), { at: 0 });
      access.flush();
      access.close();
      self.postMessage({ id: data.id, ok: true, sample: { ms: performance.now() - started, bytes } });
    }
  } catch (error: any) {
    self.postMessage({ id: data.id, ok: false, error: `${error?.name}: ${error?.message}` });
  }
};
