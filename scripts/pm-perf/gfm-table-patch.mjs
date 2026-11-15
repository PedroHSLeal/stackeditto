// Runtime patch for micromark-extension-gfm-table's EditMap.add: O(n) scan per edit → O(1) via an index Map.
// Same semantics: edits at the same index merge (remove counts add up, inserted events concatenate in order).
import { EditMap } from "../../node_modules/micromark-extension-gfm-table/lib/edit-map.js";

const byIndex = new WeakMap();
EditMap.prototype.add = function (at, remove, add) {
  if (remove === 0 && add.length === 0) return;
  let index = byIndex.get(this);
  if (!index || index.list !== this.map) { index = { list: this.map, at: new Map() }; byIndex.set(this, index); }
  const existing = index.at.get(at);
  if (existing) { existing[1] += remove; existing[2].push(...add); return; }
  const entry = [at, remove, add];
  this.map.push(entry);
  index.at.set(at, entry);
};
const consume = EditMap.prototype.consume;
EditMap.prototype.consume = function (events) { consume.call(this, events); byIndex.delete(this); };
