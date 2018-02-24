export interface Declaration {
  kind: string;
  name: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export function Function(
  name: string,
  startLine: number,
  startColumn: number,
  endLine: number,
  endColumn: number
): Declaration {
  return {
    kind: "function",
    name,
    startLine,
    startColumn,
    endLine,
    endColumn
  }
}

export function Variable(
  name: string,
  startLine: number,
  startColumn: number,
  endLine: number,
  endColumn: number
): Declaration {
  return {
    kind: "variable",
    name,
    startLine,
    startColumn,
    endLine,
    endColumn
  }
}
