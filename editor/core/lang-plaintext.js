import { TOKEN, Token, HighlightState } from "./highlighter.js";

export function tokenizeLine(line, startState) {
  const state = startState ? startState.clone() : new HighlightState();
  const tokens = [];
  if (line.length > 0) {
    tokens.push(new Token(TOKEN.TEXT, 0, line.length, line));
  }
  return { tokens, state };
}

export const plaintext = {
  name: "plaintext",
  tokenizeLine,
};