import * as LSP from 'vscode-languageserver'

export enum CompletionItemDataType {
  Builtin,
  Executable,
  ReservedWord,
  Symbol,
}

export interface BashCompletionItem extends LSP.CompletionItem {
  data: {
    type: CompletionItemDataType
    name: string
  }
}
