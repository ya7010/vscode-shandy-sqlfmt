import * as path from "path";
import * as vscode from "vscode";
import * as fs from "fs";

export function getSqlFmtPath(
  workspaceFolder?: vscode.WorkspaceFolder,
  interpreter?: string[]
): string {
  let sqlfmtPath = vscode.workspace
    .getConfiguration("shandy-sqlfmt")
    .get<string | null>("path");

  if (sqlfmtPath) {
    // Use the configured path
    sqlfmtPath = resolveVariables(
      [sqlfmtPath],
      workspaceFolder,
      interpreter
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
  interpreter?: string[]
): string[] {
  const args =
    vscode.workspace.getConfiguration("shandy-sqlfmt").get<string[]>("args") ??
    [];
  return resolveVariables(args, workspaceFolder, interpreter);
}

function resolveVariables(
  value: string[],
  workspace?: vscode.WorkspaceFolder,
  interpreter?: string[],
  env?: NodeJS.ProcessEnv
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
  (vscode.workspace.workspaceFolders ?? []).forEach((w) => {
    substitutions.set("${workspaceFolder:" + w.name + "}", w.uri.fsPath);
  });

  env = env || process.env;
  if (env) {
    for (const [key, value] of Object.entries(env)) {
      if (value) {
        substitutions.set("${env:" + key + "}", value);
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
    for (const [key, value] of substitutions) {
      s = s.replace(key, value);
    }
    return s;
  });
}
