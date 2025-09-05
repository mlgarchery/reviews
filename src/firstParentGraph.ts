import * as vscode from "vscode";
import { execFile } from "child_process";
import * as path from "path";
import * as fs from "fs";

type Maybe<T> = T | undefined;

interface CommitItem {
  sha: string;
  subject: string;
  author: string;
  date: string; // iso
  parents: string[]; // length > 1 => merge commit
}

/** Picks a repo root directory, preferring the built-in Git extension if present. */
export async function pickRepositoryRoot(): Promise<string | undefined> {
  // Prefer the built-in Git extension (if available)
  try {
    const gitExt = vscode.extensions.getExtension<any>("vscode.git");
    await gitExt?.activate();
    const api = gitExt?.exports?.getAPI?.(1);
    const repo = api?.repositories?.[0];
    if (repo?.rootUri?.fsPath) return repo.rootUri.fsPath;
  } catch {
    // ignore and fall back to heuristic
  }

  // Fallback: find a .git folder starting from the first workspace folder
  const ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!ws) return undefined;

  // Walk up the tree to find .git
  let dir = ws;
  while (true) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

/** Simple watcher for .git/HEAD changes to refresh the view. */
export function headFileWatcher(
  repoRoot: Maybe<string>,
  onChange: () => void
): vscode.FileSystemWatcher | { dispose(): void } {
  if (!repoRoot) return { dispose() {} };
  const headUri = vscode.Uri.file(path.join(repoRoot, ".git", "HEAD"));
  // Watch both HEAD and refs, as HEAD may be a symbolic ref
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(path.join(repoRoot, ".git"), "**/*")
  );
  watcher.onDidChange((uri) => {
    if (
      uri.fsPath === headUri.fsPath ||
      uri.fsPath.includes(path.sep + "refs" + path.sep)
    )
      onChange();
  });
  watcher.onDidCreate(onChange);
  watcher.onDidDelete(onChange);
  return watcher;
}

/** Tree Data Provider */
export class FirstParentProvider
  implements vscode.TreeDataProvider<CommitTreeItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    CommitTreeItem | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private commits: CommitItem[] = [];
  constructor(public readonly repoRoot?: string) {}

  refresh() {
    this.load().finally(() => this._onDidChangeTreeData.fire());
  }

  async load() {
    if (!this.repoRoot) {
      this.commits = [];
      return;
    }
    try {
      // --first-parent folds other-parent history by design; we still see the merge commit.
      // Using ASCII unit separators for robust parsing.
      const format = ["%H", "%P", "%s", "%an", "%ad"].join("%x1f") + "%x1e";
      const out = await execGit(
        [
          "log",
          "--first-parent",
          "--max-count=300",
          `--pretty=format:${format}`,
          "--date=iso",
        ],
        this.repoRoot
      );
      this.commits = parseLog(out);
    } catch (e: any) {
      vscode.window.showErrorMessage(
        `Failed to read git log: ${e?.message ?? e}`
      );
      this.commits = [];
    }
  }

  getTreeItem(element: CommitTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: CommitTreeItem): Thenable<CommitTreeItem[]> {
    if (element) return Promise.resolve([]);
    const items = this.commits.map((c) => {
      const isMerge = c.parents.length > 1;
      const label = `${c.subject}`;
      const description = `${c.author} — ${new Date(c.date).toLocaleString()}`;
      const item = new CommitTreeItem(label, description, c);
      item.iconPath = new vscode.ThemeIcon(
        isMerge ? "git-merge" : "git-commit"
      );
      item.tooltip = [
        `$(git-commit) ${c.sha}`,
        isMerge
          ? `$(git-merge) Merge commit (parents: ${c.parents.length})`
          : `Parent(s): ${c.parents.length}`,
        `Author: ${c.author}`,
        `Date: ${c.date}`,
      ].join("\n");
      item.command = {
        command: "reviews.firstParentGraph.showCommit",
        title: "Show Commit",
        arguments: [item],
      };
      return item;
    });
    return Promise.resolve(items);
  }
}

export class CommitTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    description: string,
    public readonly commit: CommitItem
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
    this.contextValue = "firstParentCommit";
  }
}

/** Exec git and return stdout as string. */
export function execGit(args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile("git", args, { cwd }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
    // Just in case: kill long-running in odd environments
    setTimeout(() => {
      try {
        child.kill();
      } catch {}
    }, 20000);
  });
}

/** Parse custom-delimited git log output. */
export function parseLog(raw: string): CommitItem[] {
  const records = raw
    .split("\x1e")
    .map((r) => r.trim())
    .filter(Boolean);
  return records.map((rec) => {
    const [h, p, s, an, ad] = rec.split("\x1f");
    const parents = (p || "").trim() ? p.trim().split(/\s+/) : [];
    return { sha: h, subject: s, author: an, date: ad, parents };
  });
}
