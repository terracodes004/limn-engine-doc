export function computeIndentGuides(lineText, tabSize) {
  const guides = [];
  let visualCols = 0;
  for (let i = 0; i < lineText.length; i++) {
    const c = lineText[i];
    if (c === " ") visualCols++;
    else if (c === "\t") visualCols += tabSize - (visualCols % tabSize);
    else break;
  }
  const levels = Math.floor(visualCols / tabSize);
  for (let i = 0; i < levels; i++) {
    guides.push(i * tabSize);
  }
  return guides;
}