import { StrictMode, useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { createRoot } from "react-dom/client";
import { getDefaultLocale, getSavedLocale, type Locale } from "../shared/i18n/locale";
import { messages } from "../shared/i18n/messages";
import {
  applyTextDiffBlockChange,
  createTextDiff,
  createTextDiffBlocks,
  createTextDiffDisplayBlocks,
  DEFAULT_UNCHANGED_COLLAPSE_THRESHOLD,
  getTextDiffBlockKey,
  type TextDiffBlock,
  type TextDiffLine
} from "../shared/textCompare/diff";
import {
  getSavedTextCompareState,
  saveTextCompareState
} from "../shared/textCompare/storage";
import manifest from "../../public/manifest.json";
import "./styles.css";

function OptionsApp() {
  const [locale, setLocale] = useState<Locale>(getDefaultLocale());
  const [leftText, setLeftText] = useState("");
  const [rightText, setRightText] = useState("");
  const [diffLines, setDiffLines] = useState<TextDiffLine[] | null>(null);
  const [expandedDiffBlockKeys, setExpandedDiffBlockKeys] = useState<ReadonlySet<string>>(
    () => new Set()
  );

  useEffect(() => {
    void getSavedLocale().then(setLocale);
    void getSavedTextCompareState().then((savedState) => {
      setLeftText(savedState.leftText);
      setRightText(savedState.rightText);

      if (savedState.hasCompared) {
        setDiffLines(createTextDiff(savedState.leftText, savedState.rightText));
      }
    });
  }, []);

  const t = messages[locale];
  const diffBlocks = useMemo(
    () => (diffLines ? createTextDiffBlocks(diffLines) : []),
    [diffLines]
  );
  const displayDiffBlocks = useMemo(
    () => createTextDiffDisplayBlocks(diffBlocks, expandedDiffBlockKeys),
    [diffBlocks, expandedDiffBlockKeys]
  );

  const handleLeftTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextLeftText = event.target.value;
    setLeftText(nextLeftText);
    setDiffLines(null);
    setExpandedDiffBlockKeys(new Set());
    void saveTextCompareState({
      leftText: nextLeftText,
      rightText,
      hasCompared: false
    });
  };

  const handleRightTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextRightText = event.target.value;
    setRightText(nextRightText);
    setDiffLines(null);
    setExpandedDiffBlockKeys(new Set());
    void saveTextCompareState({
      leftText,
      rightText: nextRightText,
      hasCompared: false
    });
  };

  const handleCompare = () => {
    setDiffLines(createTextDiff(leftText, rightText));
    setExpandedDiffBlockKeys(new Set());
    void saveTextCompareState({
      leftText,
      rightText,
      hasCompared: true
    });
  };

  const handleClear = () => {
    setLeftText("");
    setRightText("");
    setDiffLines(null);
    setExpandedDiffBlockKeys(new Set());
    void saveTextCompareState({
      leftText: "",
      rightText: "",
      hasCompared: false
    });
  };

  const applyDiffBlock = (block: TextDiffBlock, source: "left" | "right") => {
    const nextText = applyTextDiffBlockChange(leftText, rightText, block, source);

    setLeftText(nextText.leftText);
    setRightText(nextText.rightText);
    setDiffLines(createTextDiff(nextText.leftText, nextText.rightText));
    setExpandedDiffBlockKeys(new Set());
    void saveTextCompareState({
      leftText: nextText.leftText,
      rightText: nextText.rightText,
      hasCompared: true
    });
  };

  const toggleDiffBlock = (blockKey: string) => {
    setExpandedDiffBlockKeys((currentKeys) => {
      const nextKeys = new Set(currentKeys);

      if (nextKeys.has(blockKey)) {
        nextKeys.delete(blockKey);
      } else {
        nextKeys.add(blockKey);
      }

      return nextKeys;
    });
  };

  return (
    <main className={`options-shell${diffLines ? " has-diff" : ""}`}>
      <header className="options-header">
        <div>
          <h1>{t.longTextCompare}</h1>
          <p className="options-description">{t.longTextCompareHelp}</p>
        </div>
        <div className="header-actions">
          <span className="version-badge">{t.version}: {manifest.version}</span>
          <button className="text-button" type="button" onClick={handleClear}>
            {t.clear}
          </button>
          <button className="primary-action" type="button" onClick={handleCompare}>
            {t.compareText}
          </button>
        </div>
      </header>

      <section className="compare-workspace" aria-label={t.longTextCompare}>
        <label className="text-compare-field">
          <span>{t.originalText}</span>
          <textarea
            spellCheck="false"
            value={leftText}
            onChange={handleLeftTextChange}
          />
        </label>
        <label className="text-compare-field">
          <span>{t.changedText}</span>
          <textarea
            spellCheck="false"
            value={rightText}
            onChange={handleRightTextChange}
          />
        </label>
      </section>

      {diffLines ? (
        <section className="diff-section" aria-label={t.textCompareResult}>
          <div className="section-heading">
            <h2>{t.textCompareResult}</h2>
          </div>
          <div className="diff-output" role="list">
            {displayDiffBlocks.map((diffBlock, blockIndex) => (
              <div className="diff-block" key={`${diffBlock.type}-${blockIndex}`}>
                {diffBlock.type === "collapsed" ? (
                  <button
                    className="diff-collapsed-line"
                    type="button"
                    onClick={() => toggleDiffBlock(diffBlock.key)}
                  >
                    <span className="diff-line-number">{diffBlock.leftStartLineNumber}</span>
                    <span className="diff-line-number">{diffBlock.rightStartLineNumber}</span>
                    <span className="diff-line-marker">...</span>
                    <span>{t.expandUnchangedLines(diffBlock.lineCount)}</span>
                  </button>
                ) : null}
                {diffBlock.type === "unchanged" &&
                diffBlock.lines.length > DEFAULT_UNCHANGED_COLLAPSE_THRESHOLD ? (
                  <button
                    className="diff-collapsed-line"
                    type="button"
                    onClick={() => toggleDiffBlock(getTextDiffBlockKey(diffBlock))}
                  >
                    <span className="diff-line-number">
                      {diffBlock.lines[0]?.leftLineNumber ?? diffBlock.leftStartIndex + 1}
                    </span>
                    <span className="diff-line-number">
                      {diffBlock.lines[0]?.rightLineNumber ?? diffBlock.rightStartIndex + 1}
                    </span>
                    <span className="diff-line-marker">...</span>
                    <span>{t.collapseUnchangedLines(diffBlock.lines.length)}</span>
                  </button>
                ) : null}
                {diffBlock.type === "changed" ? (
                  <div className="diff-block-actions">
                    <button type="button" onClick={() => applyDiffBlock(diffBlock, "left")}>
                      {t.acceptLeft}
                    </button>
                    <button type="button" onClick={() => applyDiffBlock(diffBlock, "right")}>
                      {t.acceptRight}
                    </button>
                  </div>
                ) : null}
                {diffBlock.type !== "collapsed" ? diffBlock.lines.map((diffLine, lineIndex) => (
                  <div
                    className={`diff-line diff-line-${diffLine.type}`}
                    key={`${diffLine.type}-${blockIndex}-${lineIndex}`}
                    role="listitem"
                  >
                    <span className="diff-line-number">
                      {diffLine.leftLineNumber ?? ""}
                    </span>
                    <span className="diff-line-number">
                      {diffLine.rightLineNumber ?? ""}
                    </span>
                    <span className="diff-line-marker">
                      {diffLine.type === "added"
                        ? "+"
                        : diffLine.type === "removed"
                          ? "-"
                          : " "}
                    </span>
                    <code>
                      {diffLine.segments?.length
                        ? diffLine.segments.map((segment, segmentIndex) => (
                            <span
                              className={segment.highlighted ? "diff-segment-highlight" : undefined}
                              key={`${segment.value}-${segmentIndex}`}
                            >
                              {segment.value}
                            </span>
                          ))
                        : diffLine.value || " "}
                    </code>
                  </div>
                )) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

createRoot(document.getElementById("app") as HTMLElement).render(
  <StrictMode>
    <OptionsApp />
  </StrictMode>
);
