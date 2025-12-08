import { useFileSystem as fsaUseFileSystem } from "./fsa";
import { useFileSystem as inMemoryFileSystem } from "./in-memory";

export function useFileSystem(implementation: "physical"): ReturnType<typeof fsaUseFileSystem>;
export function useFileSystem(implementation: "inMemory"): ReturnType<typeof inMemoryFileSystem>;
export function useFileSystem(implementation: string = "physical") {
  if (implementation == "physical") return fsaUseFileSystem();
  else if (implementation == "inMemory") return inMemoryFileSystem();
  else return;
}