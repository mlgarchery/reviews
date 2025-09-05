import * as vscode from "vscode";

export type Change = {
  status: string; // M, A, D, R100, C100, ...
  path: string; // new path
  oldPath?: string; // for renames/copies
};

export function toGitUri(absFsPath: string, ref: string): vscode.Uri {
  return vscode.Uri.from({
    scheme: "git",
    path: absFsPath, // absolute path on disk
    query: JSON.stringify({ path: absFsPath, ref }),
  });
}

// Parse `git show --name-status` output
export function parseNameStatus(raw: string): Change[] {
  // lines like:
  // M\tpath
  // A\tpath
  // D\tpath
  // R100\told\tnew
  // C100\told\tnew
  const changes: Change[] = [];
  for (const line of raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)) {
    const parts = line.split("\t");
    if (!parts.length) continue;
    const status = parts[0];

    if (status.startsWith("R") || status.startsWith("C")) {
      const [, oldPath, newPath] = parts;
      if (oldPath && newPath) changes.push({ status, path: newPath, oldPath });
    } else {
      const p = parts[1];
      if (p) changes.push({ status, path: p });
    }
  }
  return changes;
}
