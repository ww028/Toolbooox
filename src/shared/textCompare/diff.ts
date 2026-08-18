export type TextDiffSegment = {
  readonly value: string;
  readonly highlighted: boolean;
};

export type TextDiffLine = {
  readonly type: "added" | "removed" | "unchanged";
  readonly value: string;
  readonly leftLineNumber?: number;
  readonly rightLineNumber?: number;
  readonly segments?: TextDiffSegment[];
};

export type TextDiffBlock = {
  readonly type: "changed" | "unchanged";
  readonly lines: TextDiffLine[];
  readonly leftStartIndex: number;
  readonly rightStartIndex: number;
  readonly removedValues: string[];
  readonly addedValues: string[];
};

export type CollapsedTextDiffBlock = {
  readonly type: "collapsed";
  readonly key: string;
  readonly lineCount: number;
  readonly leftStartLineNumber: number;
  readonly rightStartLineNumber: number;
  readonly block: TextDiffBlock;
};

export type TextDiffDisplayBlock = TextDiffBlock | CollapsedTextDiffBlock;

export const DEFAULT_UNCHANGED_COLLAPSE_THRESHOLD = 5;

export function splitComparableLines(text: string): string[] {
  return text.length > 0 ? text.split(/\r\n|\n|\r/) : [];
}

function compactTextDiffSegments(segments: TextDiffSegment[]): TextDiffSegment[] {
  return segments.reduce<TextDiffSegment[]>((mergedSegments, segment) => {
    const lastSegment = mergedSegments[mergedSegments.length - 1];

    if (lastSegment?.highlighted === segment.highlighted) {
      mergedSegments[mergedSegments.length - 1] = {
        highlighted: lastSegment.highlighted,
        value: `${lastSegment.value}${segment.value}`
      };
      return mergedSegments;
    }

    mergedSegments.push(segment);
    return mergedSegments;
  }, []);
}

function createInlineTextDiffSegments(
  removedValue: string,
  addedValue: string
): {
  readonly removedSegments: TextDiffSegment[];
  readonly addedSegments: TextDiffSegment[];
} {
  const removedChars = Array.from(removedValue);
  const addedChars = Array.from(addedValue);
  const lcsLengths = Array.from({ length: removedChars.length + 1 }, () =>
    Array<number>(addedChars.length + 1).fill(0)
  );

  for (let removedIndex = removedChars.length - 1; removedIndex >= 0; removedIndex -= 1) {
    for (let addedIndex = addedChars.length - 1; addedIndex >= 0; addedIndex -= 1) {
      lcsLengths[removedIndex][addedIndex] =
        removedChars[removedIndex] === addedChars[addedIndex]
          ? lcsLengths[removedIndex + 1][addedIndex + 1] + 1
          : Math.max(
              lcsLengths[removedIndex + 1][addedIndex],
              lcsLengths[removedIndex][addedIndex + 1]
            );
    }
  }

  const removedSegments: TextDiffSegment[] = [];
  const addedSegments: TextDiffSegment[] = [];
  let removedIndex = 0;
  let addedIndex = 0;

  while (removedIndex < removedChars.length || addedIndex < addedChars.length) {
    if (
      removedIndex < removedChars.length &&
      addedIndex < addedChars.length &&
      removedChars[removedIndex] === addedChars[addedIndex]
    ) {
      removedSegments.push({ value: removedChars[removedIndex], highlighted: false });
      addedSegments.push({ value: addedChars[addedIndex], highlighted: false });
      removedIndex += 1;
      addedIndex += 1;
      continue;
    }

    if (
      addedIndex >= addedChars.length ||
      (removedIndex < removedChars.length &&
        lcsLengths[removedIndex + 1][addedIndex] >=
          lcsLengths[removedIndex][addedIndex + 1])
    ) {
      removedSegments.push({ value: removedChars[removedIndex], highlighted: true });
      removedIndex += 1;
      continue;
    }

    addedSegments.push({ value: addedChars[addedIndex], highlighted: true });
    addedIndex += 1;
  }

  return {
    removedSegments: compactTextDiffSegments(removedSegments),
    addedSegments: compactTextDiffSegments(addedSegments)
  };
}

function addInlineTextDiffSegments(diffLines: TextDiffLine[]): TextDiffLine[] {
  const nextDiffLines: TextDiffLine[] = [];

  for (let index = 0; index < diffLines.length; index += 1) {
    const currentLine = diffLines[index];
    const nextLine = diffLines[index + 1];

    if (currentLine.type === "removed" && nextLine?.type === "added") {
      const { removedSegments, addedSegments } = createInlineTextDiffSegments(
        currentLine.value,
        nextLine.value
      );

      nextDiffLines.push({ ...currentLine, segments: removedSegments });
      nextDiffLines.push({ ...nextLine, segments: addedSegments });
      index += 1;
      continue;
    }

    nextDiffLines.push(currentLine);
  }

  return nextDiffLines;
}

export function createTextDiff(leftText: string, rightText: string): TextDiffLine[] {
  const leftLines = splitComparableLines(leftText);
  const rightLines = splitComparableLines(rightText);
  const lcsLengths = Array.from({ length: leftLines.length + 1 }, () =>
    Array<number>(rightLines.length + 1).fill(0)
  );

  for (let leftIndex = leftLines.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (let rightIndex = rightLines.length - 1; rightIndex >= 0; rightIndex -= 1) {
      lcsLengths[leftIndex][rightIndex] =
        leftLines[leftIndex] === rightLines[rightIndex]
          ? lcsLengths[leftIndex + 1][rightIndex + 1] + 1
          : Math.max(
              lcsLengths[leftIndex + 1][rightIndex],
              lcsLengths[leftIndex][rightIndex + 1]
            );
    }
  }

  const diffLines: TextDiffLine[] = [];
  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < leftLines.length || rightIndex < rightLines.length) {
    if (
      leftIndex < leftLines.length &&
      rightIndex < rightLines.length &&
      leftLines[leftIndex] === rightLines[rightIndex]
    ) {
      diffLines.push({
        type: "unchanged",
        value: leftLines[leftIndex],
        leftLineNumber: leftIndex + 1,
        rightLineNumber: rightIndex + 1
      });
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }

    if (
      rightIndex >= rightLines.length ||
      (leftIndex < leftLines.length &&
        lcsLengths[leftIndex + 1][rightIndex] >= lcsLengths[leftIndex][rightIndex + 1])
    ) {
      diffLines.push({
        type: "removed",
        value: leftLines[leftIndex],
        leftLineNumber: leftIndex + 1
      });
      leftIndex += 1;
      continue;
    }

    diffLines.push({
      type: "added",
      value: rightLines[rightIndex],
      rightLineNumber: rightIndex + 1
    });
    rightIndex += 1;
  }

  return addInlineTextDiffSegments(diffLines);
}

export function createTextDiffBlocks(diffLines: readonly TextDiffLine[]): TextDiffBlock[] {
  const blocks: TextDiffBlock[] = [];
  let leftCursor = 0;
  let rightCursor = 0;
  let index = 0;

  while (index < diffLines.length) {
    const currentLine = diffLines[index];

    if (currentLine.type === "unchanged") {
      const lines: TextDiffLine[] = [];
      const leftStartIndex = leftCursor;
      const rightStartIndex = rightCursor;

      while (index < diffLines.length && diffLines[index].type === "unchanged") {
        lines.push(diffLines[index]);
        leftCursor += 1;
        rightCursor += 1;
        index += 1;
      }

      blocks.push({
        type: "unchanged",
        lines,
        leftStartIndex,
        rightStartIndex,
        removedValues: [],
        addedValues: []
      });
      continue;
    }

    const lines: TextDiffLine[] = [];
    const removedValues: string[] = [];
    const addedValues: string[] = [];
    const leftStartIndex = leftCursor;
    const rightStartIndex = rightCursor;

    while (index < diffLines.length && diffLines[index].type !== "unchanged") {
      const changedLine = diffLines[index];
      lines.push(changedLine);

      if (changedLine.type === "removed") {
        removedValues.push(changedLine.value);
        leftCursor += 1;
      } else {
        addedValues.push(changedLine.value);
        rightCursor += 1;
      }

      index += 1;
    }

    blocks.push({
      type: "changed",
      lines,
      leftStartIndex,
      rightStartIndex,
      removedValues,
      addedValues
    });
  }

  return blocks;
}

export function getTextDiffBlockKey(block: TextDiffBlock): string {
  return `${block.type}-${block.leftStartIndex}-${block.rightStartIndex}-${block.lines.length}`;
}

export function createTextDiffDisplayBlocks(
  blocks: readonly TextDiffBlock[],
  expandedBlockKeys: ReadonlySet<string>,
  collapseThreshold = DEFAULT_UNCHANGED_COLLAPSE_THRESHOLD
): TextDiffDisplayBlock[] {
  return blocks.map((block) => {
    if (block.type !== "unchanged" || block.lines.length <= collapseThreshold) {
      return block;
    }

    const key = getTextDiffBlockKey(block);

    if (expandedBlockKeys.has(key)) {
      return block;
    }

    return {
      type: "collapsed",
      key,
      lineCount: block.lines.length,
      leftStartLineNumber: block.lines[0]?.leftLineNumber ?? block.leftStartIndex + 1,
      rightStartLineNumber: block.lines[0]?.rightLineNumber ?? block.rightStartIndex + 1,
      block
    };
  });
}

export function applyTextDiffBlockChange(
  leftText: string,
  rightText: string,
  block: TextDiffBlock,
  source: "left" | "right"
): {
  readonly leftText: string;
  readonly rightText: string;
} {
  const leftLines = splitComparableLines(leftText);
  const rightLines = splitComparableLines(rightText);

  if (source === "left") {
    rightLines.splice(block.rightStartIndex, block.addedValues.length, ...block.removedValues);
  } else {
    leftLines.splice(block.leftStartIndex, block.removedValues.length, ...block.addedValues);
  }

  return {
    leftText: leftLines.join("\n"),
    rightText: rightLines.join("\n")
  };
}
