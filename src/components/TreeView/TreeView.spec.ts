import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import TreeView from "./TreeView.vue";

// testes pulados por questao de insaniedade
describe.skip("TreeView component suite", async () => {
  it("should render the component", async () => {
    const component = mount(TreeView, {
      props: {
        directory: { directories: [], files: [] },
      },
    });

    expect(component).toBeDefined();
  });

  it("should render the component with some directories and files at root level", async () => {
    const props = {
      directory: {
        childDirectories: [
          {
            directoryName: "root-folder",
            childDirectories: [],
            childFiles: [],
          },
        ],
        childFiles: [{ fileName: "root-file" }],
      },
    };

    const component = mount(TreeView, { props });

    const foundedRootFolder = component.find("#directory").html().includes(props.directory.childDirectories[0].directoryName);
    const foundedRootFile = component.find("#file").html().includes(props.directory.childFiles[0].fileName);

    expect(foundedRootFolder).toBeDefined();
    expect(foundedRootFile).toBeDefined();
  });

  it("should open the child recursive directory when the user clicks in a folder", async () => {
    const props = {
      directory: {
        childDirectories: [
          {
            directoryName: "root-folder",
            childDirectories: [],
            childFiles: [
              { fileName: "root_level_1-file" },
              { fileName: "root_level_1-file2" },
              { fileName: "root_level_1-file3" },
            ],
          },
        ],
        childFiles: [],
      },
    };


    const component = mount(TreeView, { props });

    const foundedRootFolder = component.find("#directory");

    await foundedRootFolder.trigger('click');

    expect(component.findAll("#file")).toHaveLength(3);
  });

  it("should emits a selected directory when the user trigger a dbclick", async () => {
    const props = {
      directory: {
        childDirectories: [
          {
            directoryName: "root-folder",
            childDirectories: [],
            childFiles: [],
          },
        ],
        childFiles: [],
      },
    };


    const component = mount(TreeView, { props });

    const foundedRootFolder = component.find("#directory");

    await foundedRootFolder.trigger('dblclick');

    const onSelectDirectoryEvent = component.emitted<SimpleDirectory[]>("onSelectDirectory");

    expect(onSelectDirectoryEvent).toBeDefined();
    expect(onSelectDirectoryEvent![0][0].directoryName).toEqual(props.directory.childDirectories[0].directoryName);
  });

  it("should emits a selected file when the user clicks in a file", async () => {
    const props = {
      directory: {
        childDirectories: [],
        childFiles: [{
          fileName: "test-file"
        }],
      },
    };

    const component = mount(TreeView, { props });

    const foundedRootFolder = component.find("#file");

    await foundedRootFolder.trigger('click');

    const onSelectDirectoryEvent = component.emitted<SimpleFile[]>("onSelectFile");

    expect(onSelectDirectoryEvent).toBeDefined();
    expect(onSelectDirectoryEvent![0][0].fileName).toEqual(props.directory.childFiles[0].fileName);
  });
});
