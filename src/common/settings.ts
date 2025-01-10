import * as path from "node:path";
import * as vscode from "vscode";
import * as fs from "node:fs";

export function getSqlFmtPath(
  workspaceFolder?: vscode.WorkspaceFolder,
  interpreter?: string[],
): string {
  let sqlfmtPath = vscode.workspace
    .getConfiguration("shandy-sqlfmt")
    .get<string | null>("path");

  if (sqlfmtPath) {
    // Use the configured path
    sqlfmtPath = resolveVariables(
      [sqlfmtPath],
      workspaceFolder,
      interpreter,
    )[0];
  } else {
    // Try to find sqlfmt in the same directory as the Python interpreter
    for (const pythonBinPath of interpreter ?? []) {
      const candidatePath = path.join(path.dirname(pythonBinPath), "sqlfmt");
      if (fs.existsSync(candidatePath)) {
        sqlfmtPath = candidatePath;
        break;
      }
    }
  }

  // Fall back to just "sqlfmt" if we couldn't find it
  return sqlfmtPath ?? "sqlfmt";
}

export function getSqlFmtArgs(
  workspaceFolder?: vscode.WorkspaceFolder,
  interpreter?: string[],
): string[] {
  const args = (
    vscode.workspace.getConfiguration("shandy-sqlfmt").get<string[]>("args") ??
    []
  ).map((s) => s.toString());

  return resolveVariables(args, workspaceFolder, interpreter);
}

function resolveVariables(
  value: string[],
  workspace?: vscode.WorkspaceFolder,
  interpreter?: string[],
  env?: NodeJS.ProcessEnv,
): string[] {
  const substitutions = new Map<string, string>();
  const home = process.env.HOME || process.env.USERPROFILE;
  if (home) {
    substitutions.set("${userHome}", home);
  }
  if (workspace) {
    substitutions.set("${workspaceFolder}", workspace.uri.fsPath);
  }
  substitutions.set("${cwd}", process.cwd());
  for (const w of vscode.workspace.workspaceFolders ?? []) {
    substitutions.set(`\${workspaceFolder:${w.name}}`, w.uri.fsPath);
  }

  const environment = env || process.env;
  if (environment) {
    for (const [key, value] of Object.entries(environment)) {
      if (value) {
        substitutions.set(`\${env:${key}}`, value);
      }
    }
  }

  const modifiedValue = [];
  for (const v of value) {
    if (interpreter && v === "${interpreter}") {
      modifiedValue.push(...interpreter);
    } else {
      modifiedValue.push(v);
    }
  }

  return modifiedValue.map((s) => {
    let modifiedString = s;
    for (const [key, value] of substitutions) {
      modifiedString = modifiedString.replace(key, value);
    }
    return modifiedString;
  });
}
