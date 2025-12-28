type File = {
  kind: "file";
  name: string;
  content: string;
};

type Directory = {
  kind: "directory";
  name: string;
  children: (Directory | File)[];
};

export type Structure = Directory;

export function traverseStructure(json: Structure, directoryFn: (args: any) => any, fileFn: (args: any) => any): any {
  const values: { [k: string]: any } = {};

  for (let i = 0; i < json.children.length; i++) {
    if (json.children[i].kind == "directory") {
      const children: { [k: string]: any } = {};

      for (const [childName, childValue] of Object.entries(traverseStructure((json.children[i] as Directory), directoryFn, fileFn))) {
        children[childName] = childValue;
      }

      values[json.children[i].name] = directoryFn({ name: json.children[i].name, children });
    }
    else if (json.children[i].kind == "file") {
      values[json.children[i].name] = fileFn({ name: json.children[i].name, content: [(json.children[i] as File).content] });
    }
  }

  return values;
}