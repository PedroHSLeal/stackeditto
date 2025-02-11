import { beforeEach, describe, expect, test, vi } from "vitest";
import { useFileSystem } from ".";

describe("browser file system test suite", async () => {
  /* beforeEach(() => {
    vi.stubGlobal(
      "showDirectoryPicker",
      vi.fn(
        (): FileSystemDirectoryHandle => ({
          kind: "directory",
          values() {
            return {
              [Symbol.asyncIterator]() {
                return {
                  next() {
                    return { value: "seila", done: false };
                  },
                };
              },
            };
          },
        })
      )
    );
  }); */

  test("it should receive a virtual representation of a directory and return the actual directory and application directory", async () => {
    const { populateDirectory } = useFileSystem();
    const testDirectory = [{...(new File([""], "index.js")), directoryHandle: new FileSystemDirectoryHandle(), handle: new FileSystemFileHandle(), webkitRelativePath: "", extensionFile: "" }];

    const result = populateDirectory(testDirectory);

    console.log(result);
  });
});
