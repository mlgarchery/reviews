// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { execSync } from "child_process";
import * as vscode from "vscode";

/**
 * Set current path for shells command to the current workspace folder path
 */
const setWorkspacePath = () => {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    const error = "No workspace folder found.";
    vscode.window.showErrorMessage(error);
    throw Error(error); // stops command execution
  }
  const workspacePath = workspaceFolders[0].uri.fsPath;
  process.chdir(workspacePath);
};

const findCurrentBranch = () => {
  return execSync("git branch --show-current").toString().trim();
};

/**
 * Returns the last commit first 7 chars of the branch.
 * @param branch
 */
const getLastCommitOnBranch = (branch: string) => {
  return execSync(`git rev-parse ${branch}`).toString().trim().slice(0, 7);
};

const getLatestChangesFromRemoteBranches = (
  branch: string,
  branch2: string
) => {
  const remotes = execSync("git remote").toString().trim();
  if (remotes) {
    execSync(
      `git fetch --quiet origin ${branch}:${branch} ${branch2}:${branch2} 2>/dev/null || true`
    );
  }
};

const enterDetachedHeadMode = (branch: string, branchCommit: string) => {
  try {
    // Checkout the commit hash directly to enter detached HEAD mode
    execSync(`git checkout ${branchCommit}`);
  } catch (error) {
    const msg = `Failed to checkout in detached HEAD to ${branch}'s latest commit. ${error}`;
    throw Error(msg);
  }
};

const getCommonAncestorCommit = (branch: string, compareToBranch: string) => {
  return execSync(`git merge-base ${compareToBranch} ${branch}`)
    .toString()
    .trim();
};

const resetSoftToCommonCommitAncestor = (commonAncestor: string) => {
  // Reset soft to common ancestor while in detached HEAD
  execSync(`git reset --soft ${commonAncestor}`);
};

const resetBranch = async (
  context: vscode.ExtensionContext,
  showMessage: boolean = false
) => {
  setWorkspacePath();
  const branch = context.workspaceState.get("branch");

  if (!branch) {
    if (showMessage) {
      vscode.window.showInformationMessage("No branch being compared found.");
    }
    return;
  }

  execSync(`git switch ${branch}`);
  context.workspaceState.update("branch", undefined);

  if (showMessage) {
    vscode.window.showInformationMessage(
      `Switched back to branch ${branch} and out of detached HEAD mode.`
    );
  }
};

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  // console.log('reviews extension is active for the first time');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json

  let compareDisposable = vscode.commands.registerCommand(
    "reviews.compare",
    async () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user

      // if the compare command has already been executed on a branch, we reset the other branch
      await resetBranch(context);

      setWorkspacePath();

      const inputBranch = await vscode.window.showInputBox({
        prompt: "Enter a branch name",
        placeHolder: "Branch to compare with main (default is current branch)",
      });

      // By default the branch to compare to is the "main" branch
      // to compare to something else than main, the syntax is <branch>..<compare_to_branch>
      // if nothing is inputed, default behaviour is <current_branch>..main
      const currentBranch = findCurrentBranch();

      let compareToBranch = "main";
      let branch = currentBranch;

      if (inputBranch) {
        if (inputBranch.split("..").length === 2) {
          [branch, compareToBranch] = inputBranch.split("..");
        } else {
          branch = inputBranch;
        }
      }

      getLatestChangesFromRemoteBranches(branch, compareToBranch);

      // get branch current commit ref
      const branchHeadCommit = getLastCommitOnBranch(branch);
      const commonAncestor = getCommonAncestorCommit(branch, compareToBranch);
      enterDetachedHeadMode(branch, branchHeadCommit);
      resetSoftToCommonCommitAncestor(commonAncestor);

      if (branchHeadCommit === commonAncestor) {
        vscode.window.showInformationMessage(
          `No changes on ${branch} since ${compareToBranch}`
        );
        return;
      }
      context.workspaceState.update("branch", branch);

      vscode.commands.executeCommand("workbench.view.scm");
      vscode.window
        .showInformationMessage(
          `Review changes on ${branch} (${branchHeadCommit}) since ${compareToBranch} (${commonAncestor})`,
          "Copy ancestor commit"
        )
        .then((value) => {
          if (value === "Copy ancestor commit") {
            // copy commit ref to clipboard
            vscode.env.clipboard.writeText(commonAncestor);
          }
        });
    }
  );

  let resetDisposable = vscode.commands.registerCommand(
    "reviews.reset",
    async () => resetBranch(context, true)
  );

  context.subscriptions.push(compareDisposable);
  context.subscriptions.push(resetDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
