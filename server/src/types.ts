import * as LSP from 'vscode-languageserver/node'

export enum CompletionItemDataType {
  Builtin,
  Executable,
  ReservedWord,
  Symbol,
  Snippet,
}

export interface BashCompletionItem extends LSP.CompletionItem {
  data: {
    type: CompletionItemDataType
  }
}
