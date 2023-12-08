import * as vscode from "vscode";
import { SqlfmtFormatProvider } from "./providers/formatProvider";

export async function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel("shandy-sqlfmt");
  outputChannel.appendLine("✨ shandy-sqlfmt is now active! ✨");

  const formatProvider = new SqlfmtFormatProvider(outputChannel);
  for (const language of ["sql", "jinja-sql"]) {
    vscode.languages.registerDocumentFormattingEditProvider(
      { scheme: "file", language },
      formatProvider
    );
  }

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "shandy-sqlfmt.formatWorkspace",
      async function () {
        const document = vscode.window.activeTextEditor?.document;
        if (document) {
          await formatProvider.formatWorkspace(document);
        }
      }
    )
  );
}
