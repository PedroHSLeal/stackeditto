import { executeCommand } from "@/services/prosemirror";

export type Menu = { icon?: string, text?: string, placeholder?: string, fn: (...args: any) => any }[];

export const defaultTopMenuActions: Menu[] = [
  // basic actions
  [
    // headings
    { icon: "material-symbols:format-h1", fn: () => setHeadingAction(1) },
    { icon: "material-symbols:format-h2", fn: () => setHeadingAction(2) },
    { icon: "material-symbols:format-h3", fn: () => setHeadingAction(3) },
    { icon: "material-symbols:format-h4", fn: () => setHeadingAction(4) },
    { icon: "material-symbols:format-h5", fn: () => setHeadingAction(5) },
    { icon: "material-symbols:format-h6", fn: () => setHeadingAction(6) },

    // lists
    { icon: "material-symbols:format-list-numbered", fn: setOrderedListAction },
    { icon: "material-symbols:format-list-bulleted", fn: setBulletedListAction }
  ]
]

function setHeadingAction(headingLevel: number) {
  executeCommand((view, state, dispatch) => {
    let selection = state.selection;
    let transaction = state.tr;

    if (selection.empty) {
      let headingNode = state.schema.nodes.heading.create({ level: headingLevel });

      transaction.insert(selection.from ?? 0, headingNode);
      dispatch(transaction);
    }
    else {
      transaction.setBlockType(selection.from, selection.to, state.schema.nodes.heading, { level: headingLevel });
      dispatch(transaction);
    }
  })
}

function setBulletedListAction() {
  executeCommand((view, state, dispatch) => {
    let selection = state.selection;
    let transaction = state.tr;

    if (selection.empty) {
      let listItemNode = state.schema.nodes.list_item.create({}, state.schema.node("paragraph", {}));
      let bulletListNode = state.schema.nodes.bullet_list.create({}, listItemNode);

      transaction.insert(selection.from ?? 0, bulletListNode);
      dispatch(transaction);
    }
  })
}

function setOrderedListAction() {
  executeCommand((view, state, dispatch) => {
    let selection = state.selection;
    let transaction = state.tr;

    if (selection.empty) {
      let listItemNode = state.schema.nodes.list_item.create({}, state.schema.node("paragraph", {}));
      let orderedListNode = state.schema.nodes.ordered_list.create({}, listItemNode);

      transaction.insert(selection.from ?? 0, orderedListNode);
      dispatch(transaction);
    }
  })
}