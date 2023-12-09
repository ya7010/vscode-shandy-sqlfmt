import * as vscode from "vscode";
import { spawn } from "child_process";
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

    const command = getSqlFmtPath(workspaceFolder, interpreterDetails?.path);
    const args = [
      ...getSqlFmtArgs(workspaceFolder, interpreterDetails?.path),
      ...commandArgs,
    ];

    this.outputChannel.appendLine(`Execute: "${[command, ...args].join(" ")}"`);

    const commandProcess = spawn(command, args);

    if (commandProcess.pid) {
      let stdoutBuffer = "";
      let stderrBuffer = "";

      commandProcess.stdout!.on(
        "data",
        (chunk) => (stdoutBuffer += chunk.toString())
      );
      commandProcess.stderr!.on(
        "data",
        (chunk) => (stderrBuffer += chunk.toString())
      );

      commandProcess.once("close", () => {
        if (stdoutBuffer) {
          this.outputChannel.appendLine(stderrBuffer);
        }
        if (stderrBuffer) {
          this.outputChannel.appendLine(stderrBuffer);
        }
      });

      commandProcess.once("error", (error) => {
        this.outputChannel.appendLine(`Error: ${error}`);
      });
    }
  }
}
