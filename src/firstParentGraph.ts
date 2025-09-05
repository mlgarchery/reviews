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

// Cache folded results per merge commit
type FoldedCache = Map<string, FoldedSection[]>;

interface FoldedSection {
  parentSha: string; // non-first parent sha
  commits: CommitItem[]; // oldest -> newest along ancestry path
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
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    CommitTreeItem | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private commits: CommitItem[] = [];
  private foldedCache: FoldedCache = new Map();

  constructor(public readonly repoRoot?: string) {}

  refresh() {
    this.load().finally(() => this._onDidChangeTreeData.fire());
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
      const format = ["%H", "%P", "%s", "%an", "%cr"].join("%x1f") + "%x1e";
      const out = await execGit(
        [
          "log",
          "--first-parent",
          "--max-count=300",
          `--pretty=format:${format}`,
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

  async getChildren(element?: CommitTreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      return this.commits.map((c) => {
        const isMerge = c.parents.length > 1;
        const label = `${c.subject}`;
        const description = `${c.author} — ${c.date}`;
        const item = new CommitTreeItem(
          label,
          description,
          c,
          isMerge
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None
        );
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

        // We can add a command on click on the element
        // item.command = {
        //   command: "reviews.firstParentGraph.showCommit",
        //   title: "Show Commit",
        //   arguments: [item],
        // };
        return item;
      });
    }

    // Expanding a merge node -> show headers for each non-first parent (or directly the commits)
    if (
      element instanceof CommitTreeItem &&
      element.commit.parents.length > 1
    ) {
      const sections = await this.getFoldedSections(element.commit);

      // Flatten: oldest -> newest across all non-first parents, de-duplicated by sha
      const seen = new Set<string>();
      const children: vscode.TreeItem[] = [];
      for (const s of sections) {
        for (const c of s.commits) {
          if (seen.has(c.sha)) continue;
          seen.add(c.sha);
          children.push(new FoldedCommitItem(c));
        }
      }

      if (children.length === 0) {
        const tip = new vscode.TreeItem(
          "No folded commits",
          vscode.TreeItemCollapsibleState.None
        );
        tip.iconPath = new vscode.ThemeIcon("info");
        tip.contextValue = "firstParentInfo";
        tip.tooltip =
          "This merge didn’t bring additional non-first-parent commits.";
        return [tip];
      }

      return children;
    }

    return [];
  }

  private async getFoldedSections(merge: CommitItem): Promise<FoldedSection[]> {
    const cached = this.foldedCache.get(merge.sha);
    if (cached) return cached;

    const sections: FoldedSection[] = [];
    const [firstParent, ...others] = merge.parents;
    if (!this.repoRoot || !firstParent || others.length === 0) {
      this.foldedCache.set(merge.sha, sections);
      return sections;
    }

    for (const parent of others) {
      try {
        // Find merge-base with first parent
        const mergeBase = (
          await execGit(["merge-base", firstParent, parent], this.repoRoot)
        ).trim();
        if (!mergeBase) continue;

        // Walk commits along the ancestry path from the merge-base to the non-first parent
        const fmt = ["%H", "%P", "%s", "%an", "%ad"].join("%x1f") + "%x1e";
        const out = await execGit(
          [
            "log",
            "--pretty=format:" + fmt,
            "--date=iso",
            "--topo-order",
            "--ancestry-path",
            "--reverse",
            `${mergeBase}..${parent}`,
          ],
          this.repoRoot
        );
        const commits = parseLog(out);

        sections.push({ parentSha: parent, commits });
      } catch {
        // Ignore failures for a parent; keep going
      }
    }

    this.foldedCache.set(merge.sha, sections);
    return sections;
  }

  private async getFoldedSectionsByMergeSha(
    mergeSha: string
  ): Promise<FoldedSection[]> {
    const found = this.commits.find((c) => c.sha === mergeSha);
    if (!found) return [];
    return this.getFoldedSections(found);
  }
}

export class CommitTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    description: string,
    public readonly commit: CommitItem,
    collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.description = description;
    const isMerge = commit.parents.length > 1;
    this.contextValue = isMerge ? "firstParentMerge" : "firstParentCommit";
    this.iconPath = new vscode.ThemeIcon(isMerge ? "git-merge" : "git-commit");
    this.tooltip = [
      `$(git-commit) ${commit.sha}`,
      isMerge
        ? `$(git-merge) Merge commit (parents: ${commit.parents.length})`
        : `Parent(s): ${commit.parents.length}`,
      `Author: ${commit.author}`,
      `Date: ${commit.date}`,
    ].join("\n");
  }
}

class FoldedCommitItem extends vscode.TreeItem {
  constructor(public readonly commit: CommitItem) {
    super(`${commit.subject}`, vscode.TreeItemCollapsibleState.None);
    this.description = `${commit.author} — ${commit.date}`;
    this.contextValue = "firstParentFoldedCommit";
    this.iconPath = new vscode.ThemeIcon(
      commit.parents.length > 1 ? "git-merge" : "git-commit"
    );
    // this.command = {
    //   command: "firstParentGraph.showCommit",
    //   title: "Show Commit",
    //   arguments: [this],
    // };
    this.tooltip = `$(git-commit) ${commit.sha}\nAuthor: ${commit.author}\nDate: ${commit.date}`;
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
    const [h, p, s, an, cr] = rec.split("\x1f");
    const parents = (p || "").trim() ? p.trim().split(/\s+/) : [];
    return { sha: h, subject: s, author: an, date: cr, parents };
  });
}
