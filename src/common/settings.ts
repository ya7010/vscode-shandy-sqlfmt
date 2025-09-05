import * as path from "node:path";
import * as vscode from "vscode";
import * as fs from "node:fs";
import { execSync } from "node:child_process";
import { traceError, traceInfo } from "./logging";

export function getSqlFmtPath(
  workspaceFolder?: vscode.WorkspaceFolder,
  interpreter?: string[],
): [string, boolean] {
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

  sqlfmtPath = sqlfmtPath ?? "sqlfmt";

  // Detailed validation of executable file before execution
  const [resolvedPath, isExecutable] = validateExecutablePath(sqlfmtPath);

  if (!isExecutable) {
    traceError(
      `sqlfmt executable not found or not executable: ${resolvedPath}`,
    );
    return [resolvedPath, false];
  }

  // Final validation by checking version to ensure executability
  let is_exist = true;
  try {
    execSync(`${resolvedPath} --version`, {
      stdio: "ignore",
    });
    traceInfo(`sqlfmt executable found and working: ${resolvedPath}`);
  } catch (err) {
    traceError(err);
    is_exist = false;
  }

  return [resolvedPath, is_exist];
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

/**
 * Validates executable file path and checks if it's executable
 * Handles both absolute/relative paths and command names (searched in PATH)
 * @param executablePath Path to the executable file to validate
 * @returns [Resolved path, Whether the file is executable]
 */
function validateExecutablePath(executablePath: string): [string, boolean] {
  // If it's a command name (no path separators), try to find it in PATH
  if (!executablePath.includes(path.sep)) {
    try {
      // Use 'which' command to find the executable in PATH
      const whichCommand = process.platform === "win32" ? "where" : "which";
      const resolvedPath = execSync(`${whichCommand} ${executablePath}`, {
        encoding: "utf8",
        stdio: "pipe",
      })
        .trim()
        .split("\n")[0];

      if (resolvedPath) {
        traceInfo(`Found executable in PATH: ${resolvedPath}`);
        return validateFileAtPath(resolvedPath);
      }
    } catch (error) {
      traceError(`Command not found in PATH: ${executablePath}`);
      return [executablePath, false];
    }
  }

  // For absolute or relative paths, resolve and validate
  const normalizedPath = path.resolve(executablePath);
  return validateFileAtPath(normalizedPath);
}

/**
 * Validates a file at a specific path
 * @param filePath Absolute path to the file to validate
 * @returns [Resolved path, Whether the file is executable]
 */
function validateFileAtPath(filePath: string): [string, boolean] {
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    traceError(`Executable file does not exist: ${filePath}`);
    return [filePath, false];
  }

  // Check if it's a file (not a directory)
  const stats = fs.statSync(filePath);
  if (!stats.isFile()) {
    traceError(`Path is not a file: ${filePath}`);
    return [filePath, false];
  }

  // Check execution permissions (Unix-like systems)
  if (process.platform !== "win32") {
    const mode = stats.mode;
    const isExecutable = !!(mode & 0o111); // Check execution permission bits
    if (!isExecutable) {
      traceError(`File is not executable: ${filePath}`);
      return [filePath, false];
    }
  }

  traceInfo(`Executable file validated: ${filePath}`);
  return [filePath, true];
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
