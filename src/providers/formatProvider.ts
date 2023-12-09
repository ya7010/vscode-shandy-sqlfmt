import * as vscode from "vscode";
import { spawn } from "child_process";
import { getInterpreterDetails } from "../common/python";
import { getSqlFmtArgs, getSqlFmtPath } from "../common/settings";
import {
  traceInfo,
  traceVerbose,
  traceError,
  traceLog,
} from "../common/logging";

export class SqlfmtFormatProvider
  implements vscode.DocumentFormattingEditProvider
{
  constructor() {}

  async provideDocumentFormattingEdits(
    document: vscode.TextDocument
  ): Promise<vscode.TextEdit[]> {
    return this.formatFile(document);
  }

  async formatFile(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
    traceInfo(`Formatting "${document.fileName}" file`);

    await this.executeSqlfmt(
      vscode.workspace.getWorkspaceFolder(document.uri),
      [document.uri.fsPath]
    );

    return [];
  }

  async formatWorkspace(document: vscode.TextDocument) {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    traceInfo(`Formatting "${workspaceFolder?.name}" workspace`);

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

    traceVerbose(`Execute: "${[command, ...args].join(" ")}"`);

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
          traceLog(stdoutBuffer);
        }
        if (stderrBuffer) {
          traceLog(stderrBuffer);
        }
      });

      commandProcess.once("error", (error) => {
        traceError(error);
      });
    }
  }
}
