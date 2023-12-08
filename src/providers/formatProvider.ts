import * as vscode from "vscode";
import { exec } from "child_process";
import { getInterpreterDetails } from "../common/python";
import { getSqlFmtArgs, getSqlFmtPath } from "../common/settings";

export class SqlfmtFormatProvider
  implements vscode.DocumentFormattingEditProvider
{
  constructor(private outputChannel: vscode.OutputChannel) {}

  async provideDocumentFormattingEdits(
    document: vscode.TextDocument
  ): Promise<vscode.TextEdit[]> {
    return this.formatFile(document);
  }

  async formatFile(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
    this.outputChannel.appendLine(`Formatting "${document.fileName}" file`);

    await this.executeSqlfmt(
      vscode.workspace.getWorkspaceFolder(document.uri),
      [document.uri.fsPath]
    );

    return [];
  }

  async formatWorkspace(document: vscode.TextDocument) {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    this.outputChannel.appendLine(
      `Formatting "${workspaceFolder?.name}" workspace`
    );
    if (!workspaceFolder) {
      return;
    }

    this.executeSqlfmt(workspaceFolder, [workspaceFolder.uri.fsPath]);
  }

  private async executeSqlfmt(
    workspaceFolder: vscode.WorkspaceFolder | undefined,
    commandArgs: string[]
  ) {
    const interpreterDetails = await getInterpreterDetails(
      workspaceFolder?.uri
    );

    const command = [
      getSqlFmtPath(workspaceFolder, interpreterDetails?.path),
      ...getSqlFmtArgs(workspaceFolder, interpreterDetails?.path),
      ...commandArgs,
    ].join(" ");

    this.outputChannel.appendLine(`Execute: "${command}"`);
    exec(command, (err, stdout, stderr) => {
      if (stderr) {
        this.outputChannel.appendLine(stderr);
      }
    });
  }
}
