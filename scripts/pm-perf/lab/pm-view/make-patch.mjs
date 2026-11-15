// Builds patched COPIES of prosemirror-view dist (esm + cjs) from node_modules (read-only) into lab/pm-view/patched/.
//   node scripts/pm-perf/lab/pm-view/make-patch.mjs
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
const SRC = "node_modules/prosemirror-view", DST = "scripts/pm-perf/lab/pm-view/patched/prosemirror-view";
mkdirSync(`${DST}/dist`, { recursive: true });
copyFileSync(`${SRC}/package.json`, `${DST}/package.json`);

// P1: updateChildren fast path (skip the identical prefix/suffix of children when there are no decorations).
const edits = [
  [`    constructor(top, lock, view) {
        this.lock = lock;
        this.view = view;`, `    constructor(top, lock, view, preMatchOverride) {
        this.lock = lock;
        this.view = view;`],
  [`        this.preMatch = preMatch(top.node.content, top);
    }`, `        this.preMatch = preMatchOverride || preMatch(top.node.content, top);
    }
    // Used by the updateChildren fast path: the \`count\` trailing child
    // descs are known to match the trailing nodes, so drop whatever is
    // left between the current index and them and jump over them.
    skipMatchedSuffix(count) {
        this.destroyBetween(this.index, this.top.children.length - count);
        this.index = this.top.children.length;
    }`],
  [`        let updater = new ViewTreeUpdater(this, localComposition && localComposition.node, view);
        iterDeco(this.node, this.innerDeco, (widget, i, insideNode) => {`, `        // Fast path for big block containers without decorations: nodes (and
        // descs) at the start and end that are identical to the previous
        // version are neither matched nor visited.
        let fast = !inline && !composition && this.node.childCount >= FAST_UPDATE_MIN ? unchangedEnds(this) : null;
        let updater = new ViewTreeUpdater(this, localComposition && localComposition.node, view, fast ? fast.preMatch : undefined);
        let onWidget = (widget, i, insideNode) => {`],
  [`            updater.placeWidget(widget, view, off);
        }, (child, outerDeco, innerDeco, i) => {`, `            updater.placeWidget(widget, view, off);
        };
        let onNode = (child, outerDeco, innerDeco, i) => {`],
  [`            off += child.nodeSize;
        });
        // Drop all remaining descs after the current position.`, `            off += child.nodeSize;
        };
        if (fast) {
            let locals = this.innerDeco.locals(this.node);
            updater.index = fast.start;
            off = pos + fast.startOff;
            for (let i = fast.start; i < fast.end; i++) {
                let child = this.node.child(i);
                onNode(child, locals, this.innerDeco.forChild(off - pos, child), i);
            }
            updater.skipMatchedSuffix(fast.suffix);
        }
        else {
            iterDeco(this.node, this.innerDeco, onWidget, onNode);
        }
        // Drop all remaining descs after the current position.`],
  [`function preMatch(frag, parentDesc) {`, `const FAST_UPDATE_MIN = 64;
// For a block container whose child descs map one-to-one onto its
// children (no marks, widgets or decorations), find how many leading and
// trailing children are identical to what is already drawn.
function unchangedEnds(desc) {
    let node = desc.node, kids = desc.children, n = node.childCount, m = kids.length;
    let empty = DecorationSet.empty;
    if (desc.innerDeco != empty)
        return null;
    let lim = Math.min(n, m), start = 0, startOff = 0, suffix = 0;
    for (; start < lim; start++) {
        let d = kids[start], c = node.child(start);
        if (!(d instanceof NodeViewDesc) || d.node !== c || d.dirty != NOT_DIRTY || d.outerDeco.length || d.innerDeco != empty)
            break;
        startOff += c.nodeSize;
    }
    for (; start + suffix < lim; suffix++) {
        let d = kids[m - 1 - suffix], c = node.child(n - 1 - suffix);
        if (!(d instanceof NodeViewDesc) || d.node !== c || d.dirty != NOT_DIRTY || d.outerDeco.length || d.innerDeco != empty)
            break;
    }
    // Everything between the two ends has to be descs of this node too
    // (no widgets or marks), or the one-to-one mapping doesn't hold.
    for (let i = start; i < m - suffix; i++)
        if (!(kids[i] instanceof NodeViewDesc))
            return null;
    // updateNextNode/findNodeMatch only ever look at the first few
    // trailing descs, so the lookup table only needs those.
    let end = n - suffix, matched = new Map;
    for (let i = 0; i < Math.min(suffix, 8); i++)
        matched.set(kids[m - suffix + i], end + i);
    return { start, startOff, end, suffix, preMatch: { index: end, matched, matches: [] } };
}
function preMatch(frag, parentDesc) {`],
];

const cjsEdits = [
  [`  function ViewTreeUpdater(top, lock, view) {
    _classCallCheck(this, ViewTreeUpdater);`, `  function ViewTreeUpdater(top, lock, view, preMatchOverride) {
    _classCallCheck(this, ViewTreeUpdater);`],
  [`    this.preMatch = preMatch(top.node.content, top);
  }
  _createClass(ViewTreeUpdater, [{`, `    this.preMatch = preMatchOverride || preMatch(top.node.content, top);
  }
  _createClass(ViewTreeUpdater, [{
    key: "skipMatchedSuffix",
    value: function skipMatchedSuffix(count) {
      this.destroyBetween(this.index, this.top.children.length - count);
      this.index = this.top.children.length;
    }
  }, {`],
  [`      var updater = new ViewTreeUpdater(this, localComposition && localComposition.node, view);
      iterDeco(this.node, this.innerDeco, function (widget, i, insideNode) {`, `      var fast = !inline && !composition && this.node.childCount >= FAST_UPDATE_MIN ? unchangedEnds(this) : null;
      var updater = new ViewTreeUpdater(this, localComposition && localComposition.node, view, fast ? fast.preMatch : undefined);
      var onWidget = function onWidget(widget, i, insideNode) {`],
  [`        updater.placeWidget(widget, view, off);
      }, function (child, outerDeco, innerDeco, i) {`, `        updater.placeWidget(widget, view, off);
      };
      var onNode = function onNode(child, outerDeco, innerDeco, i) {`],
  [`        off += child.nodeSize;
      });
      updater.syncToMarks([], inline, view);`, `        off += child.nodeSize;
      };
      if (fast) {
        var locals = this.innerDeco.locals(this.node);
        updater.index = fast.start;
        off = pos + fast.startOff;
        for (var _i = fast.start; _i < fast.end; _i++) {
          var _child = this.node.child(_i);
          onNode(_child, locals, this.innerDeco.forChild(off - pos, _child), _i);
        }
        updater.skipMatchedSuffix(fast.suffix);
      } else {
        iterDeco(this.node, this.innerDeco, onWidget, onNode);
      }
      updater.syncToMarks([], inline, view);`],
  [`function preMatch(frag, parentDesc) {`, `var FAST_UPDATE_MIN = 64;
function unchangedEnds(desc) {
  var node = desc.node,
    kids = desc.children,
    n = node.childCount,
    m = kids.length;
  var empty = DecorationSet.empty;
  if (desc.innerDeco != empty) return null;
  var lim = Math.min(n, m),
    start = 0,
    startOff = 0,
    suffix = 0;
  for (; start < lim; start++) {
    var d = kids[start],
      c = node.child(start);
    if (!(d instanceof NodeViewDesc) || d.node !== c || d.dirty != NOT_DIRTY || d.outerDeco.length || d.innerDeco != empty) break;
    startOff += c.nodeSize;
  }
  for (; start + suffix < lim; suffix++) {
    var _d = kids[m - 1 - suffix],
      _c = node.child(n - 1 - suffix);
    if (!(_d instanceof NodeViewDesc) || _d.node !== _c || _d.dirty != NOT_DIRTY || _d.outerDeco.length || _d.innerDeco != empty) break;
  }
  for (var i = start; i < m - suffix; i++) if (!(kids[i] instanceof NodeViewDesc)) return null;
  var end = n - suffix,
    matched = new Map();
  for (var _i2 = 0; _i2 < Math.min(suffix, 8); _i2++) matched.set(kids[m - suffix + _i2], end + _i2);
  return {
    start: start,
    startOff: startOff,
    end: end,
    suffix: suffix,
    preMatch: {
      index: end,
      matched: matched,
      matches: []
    }
  };
}
function preMatch(frag, parentDesc) {`],
];
for (const [file, out, list] of [["index.js", "index.js", edits], ["index.cjs", "index.cjs", cjsEdits]]) {
  let s = readFileSync(`${SRC}/dist/${file}`, "utf8");
  for (const [a, b] of list) {
    const parts = s.split(a);
    if (parts.length != 2) throw new Error(`${file}: expected exactly 1 match, got ${parts.length - 1} for:\n${a.slice(0, 80)}`);
    s = parts.join(b);
  }
  writeFileSync(`${DST}/dist/${out}`, s);
}
console.log("ok");
