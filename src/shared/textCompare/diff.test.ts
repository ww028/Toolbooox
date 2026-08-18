import { describe, expect, it } from "vitest";
import {
  applyTextDiffBlockChange,
  createTextDiff,
  createTextDiffBlocks,
  createTextDiffDisplayBlocks,
  getTextDiffBlockKey
} from "./diff";

describe("text compare diff", () => {
  it("creates character-level highlights for changed lines", () => {
    const diffLines = createTextDiff("你好呀", "你好啊");

    expect(diffLines).toEqual([
      {
        type: "removed",
        value: "你好呀",
        leftLineNumber: 1,
        segments: [
          { value: "你好", highlighted: false },
          { value: "呀", highlighted: true }
        ]
      },
      {
        type: "added",
        value: "你好啊",
        rightLineNumber: 1,
        segments: [
          { value: "你好", highlighted: false },
          { value: "啊", highlighted: true }
        ]
      }
    ]);
  });

  it("groups changed lines and keeps unchanged lines separate", () => {
    const blocks = createTextDiffBlocks(createTextDiff("a\nb\nc", "a\nx\nc"));

    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatchObject({ type: "unchanged", leftStartIndex: 0, rightStartIndex: 0 });
    expect(blocks[1]).toMatchObject({
      type: "changed",
      leftStartIndex: 1,
      rightStartIndex: 1,
      removedValues: ["b"],
      addedValues: ["x"]
    });
    expect(blocks[2]).toMatchObject({ type: "unchanged", leftStartIndex: 2, rightStartIndex: 2 });
  });

  it("applies a changed block from either side", () => {
    const [block] = createTextDiffBlocks(createTextDiff("left", "right"));

    expect(applyTextDiffBlockChange("left", "right", block, "left")).toEqual({
      leftText: "left",
      rightText: "left"
    });
    expect(applyTextDiffBlockChange("left", "right", block, "right")).toEqual({
      leftText: "right",
      rightText: "right"
    });
  });

  it("collapses unchanged blocks longer than the threshold and expands them by key", () => {
    const blocks = createTextDiffBlocks(createTextDiff("1\n2\n3\n4\n5\n6", "1\n2\n3\n4\n5\n6"));
    const [block] = blocks;
    const collapsedBlocks = createTextDiffDisplayBlocks(blocks, new Set());

    expect(collapsedBlocks).toEqual([
      {
        type: "collapsed",
        key: getTextDiffBlockKey(block),
        lineCount: 6,
        leftStartLineNumber: 1,
        rightStartLineNumber: 1,
        block
      }
    ]);
    expect(createTextDiffDisplayBlocks(blocks, new Set([getTextDiffBlockKey(block)]))).toEqual([
      block
    ]);
  });
});
