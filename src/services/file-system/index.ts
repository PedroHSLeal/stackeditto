import { useFileSystem as fsaUseFileSystem } from "./fsa";
// import { useFileSystem as inMemoryFileSystem } from "./in-memory";

type Implementations = {
  physical: ReturnType<typeof fsaUseFileSystem>;
  // inMemory: ReturnType<typeof inMemoryFileSystem>;
}

// export function useFileSystem(implementation?: "physical"): ReturnType<typeof fsaUseFileSystem>;
// export function useFileSystem(implementation?: "inMemory"): ReturnType<typeof inMemoryFileSystem>;
// export function useFileSystem(implementation: string = "physical") {
export function useFileSystem<TImpl extends keyof Implementations = "physical">(implementation: TImpl): Implementations[TImpl] | undefined {
  if (implementation == "physical") return fsaUseFileSystem() as Implementations[TImpl];
  // else if (implementation == "inMemory") return inMemoryFileSystem() as Implementations[TImpl];
  else return;
}