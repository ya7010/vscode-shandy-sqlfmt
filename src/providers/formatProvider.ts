import * as vscode from "vscode";
import { spawn } from "node:child_process";
import { getInterpreterDetails } from "../common/python";
import { getSqlFmtArgs, getSqlFmtPath } from "../common/settings";
import { traceError, traceInfo, traceLog } from "../common/logging";
import { file as tmpfile } from "tmp-promise";
import { SqlfmtNotInstalled } from "../error";

export class SqlfmtFormatProvider
  implements vscode.DocumentFormattingEditProvider
{
  async provideDocumentFormattingEdits(
    document: vscode.TextDocument,
  ): Promise<vscode.TextEdit[]> {
    return this.formatFile(document);
  }

  async formatFile(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
    const textEdits: vscode.TextEdit[] = [];

    traceInfo(`Formatting "${document.fileName}" file`);
    const { path: tmpFilePath, cleanup } = await tmpfile({ postfix: ".sql" });

    try {
      const tmpFileUri = vscode.Uri.file(tmpFilePath);
      await vscode.workspace.fs.writeFile(
        tmpFileUri,
        new TextEncoder().encode(document.getText()),
      );

      const text = await this.getFormatedSQL(
        vscode.workspace.getWorkspaceFolder(document.uri),
        tmpFilePath,
      );

      textEdits.push(
        vscode.TextEdit.replace(
          document.validateRange(
            new vscode.Range(0, 0, Number.MAX_VALUE, Number.MAX_VALUE),
          ),
          text.toString(),
        ),
      );
    } catch (error) {
      vscode.window.showErrorMessage(`${error}`);
    } finally {
      cleanup();
    }

    return textEdits;
  }

  async formatWorkspace(document: vscode.TextDocument) {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    traceInfo(`Formatting "${workspaceFolder?.name}" workspace`);

    if (!workspaceFolder) {
      return;
    }
    try {
      await this.executeSqlfmt(workspaceFolder, [workspaceFolder.uri.fsPath]);
    } catch (error) {
      vscode.window.showErrorMessage(`${error}`);
    }
  }

  private async executeSqlfmt(
    workspaceFolder: vscode.WorkspaceFolder | undefined,
    commandArgs: string[],
  ) {
    const interpreterDetails = await getInterpreterDetails(
      workspaceFolder?.uri,
    );

    const [command, is_exist] = getSqlFmtPath(
      workspaceFolder,
      interpreterDetails?.path,
    );
    if (!is_exist) {
      throw new SqlfmtNotInstalled(command);
    }

    const args = [
      ...getSqlFmtArgs(workspaceFolder, interpreterDetails?.path),
      ...commandArgs,
    ];

    traceLog(`Execute: "${[command, ...args].join(" ")}"`);

    return await new Promise((resolve, reject) => {
      const commandProcess = spawn(command, args, {
        cwd: workspaceFolder?.uri.fsPath,
      });

      if (commandProcess.pid) {
        let stdoutBuffer = "";
        let stderrBuffer = "";

        commandProcess.stdout?.on("data", (chunk) => {
          stdoutBuffer += chunk.toString();
        });
        commandProcess.stderr?.on("data", (chunk) => {
          stderrBuffer += chunk.toString();
        });

        commandProcess.once("close", () => {
          if (stdoutBuffer) {
            traceLog(stdoutBuffer);
          }
          if (stderrBuffer) {
            if (commandProcess.exitCode !== 0) {
              traceError(stderrBuffer);
              reject(stderrBuffer);
            }

            traceLog(stderrBuffer);
            resolve({ success: true });
          }
        });

        commandProcess.once("error", (error) => {
          traceError(error);
          reject(error);
        });
      }
    });
  }

  private async getFormatedSQL(
    workspaceFolder: vscode.WorkspaceFolder | undefined,
    tempFilePath: string,
  ): Promise<string> {
    const interpreterDetails = await getInterpreterDetails(
      workspaceFolder?.uri,
    );

    const [command, is_exist] = getSqlFmtPath(
      workspaceFolder,
      interpreterDetails?.path,
    );
    if (!is_exist) {
      throw new SqlfmtNotInstalled(command);
    }

    const args = [
      "-",
      ...getSqlFmtArgs(workspaceFolder, interpreterDetails?.path),
    ];

    traceLog(
      `Execute: "cat ${tempFilePath} | ${[command, ...args].join(" ")}"`,
    );

    return await new Promise((resolve, reject) => {
      const commandProcess = spawn(command, args, {
        cwd: workspaceFolder?.uri.fsPath,
      });

      const inputProcess = spawn("cat", [tempFilePath]);

      inputProcess.stdout?.pipe(commandProcess.stdin);

      if (commandProcess.pid) {
        let stdoutBuffer = "";
        let stderrBuffer = "";

        commandProcess.stdout?.on("data", (chunk) => {
          stdoutBuffer += chunk.toString();
        });
        commandProcess.stderr?.on("data", (chunk) => {
          stderrBuffer += chunk.toString();
        });

        commandProcess.once("close", (code) => {
          if (code === 0) {
            resolve(stdoutBuffer);
          } else {
            reject(new Error(stderrBuffer));
          }
        });

        commandProcess.once("error", (error) => {
          traceError(error);
          reject(error);
        });
      }
    });
  }
}
