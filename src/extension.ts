import * as vscode from "vscode";
import { SqlfmtFormatProvider } from "./providers/formatProvider";
import { registerLogger, traceInfo } from "./common/logging";

export async function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel("shandy-sqlfmt", {
    log: true,
  });
  context.subscriptions.push(outputChannel, registerLogger(outputChannel));

  traceInfo("✨ shandy-sqlfmt is now active! ✨");

  const formatProvider = new SqlfmtFormatProvider();
  for (const language of [
    "sql",
    "jinja-sql",
    "sqlite",
    "postgres",
    "mysql",
    "snowflake-sql",
  ]) {
    vscode.languages.registerDocumentFormattingEditProvider(
      { scheme: "file", language },
      formatProvider,
    );
  }

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "shandy-sqlfmt.formatWorkspace",
      async () => {
        const document = vscode.window.activeTextEditor?.document;
        if (document) {
          await formatProvider.formatWorkspace(document);
        }
      },
    ),
  );
}
