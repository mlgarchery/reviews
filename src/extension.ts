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

const switchAndSyncBranch = (branch: string) => {
  try {
    execSync(`git switch --guess ${branch};`);
  } catch (error) {
    const msg = `Branch ${branch} does not exist`;
    throw Error(msg); // stops command execution
  }
  // pull branch latest changes if a remote is set
  const remotes = execSync("git remote").toString().trim(); // should return a list of remote repos if any
  if (remotes) {
    try {
      execSync(`git pull`);
    } catch (error) {
      throw Error(
        `Unable to pull latest changes on ${branch}. Details: ${error}`
      );
    }
  }
};

const resetSoftToCommonCommitAncestor = (
  branch: string,
  compareToBranch: string
) => {
  const commonAncestor = execSync(`git merge-base ${compareToBranch} ${branch}`)
    .toString()
    .trim();
  execSync(`git reset --soft ${commonAncestor}`);
  return commonAncestor;
};

// const getBranches = () => {
// 	return execSync("git for-each-ref --format='%(refname:short)' refs/heads/").toString().trim().split('\n');
// };

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

      for (const b of [compareToBranch, branch]) {
        switchAndSyncBranch(b);
      }

      // get branch current commit ref
      const branchHeadCommit = execSync(`git rev-parse ${branch}`)
        .toString()
        .trim()
        .slice(0, 7);
      const commonAncestor = resetSoftToCommonCommitAncestor(
        branch,
        compareToBranch
      ).slice(0, 7);
      if (branchHeadCommit === commonAncestor) {
        vscode.window.showInformationMessage(
          `No changes on ${branch} since ${compareToBranch}`
        );
        return;
      }
      context.workspaceState.update("branchHeadCommit", branchHeadCommit);
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
    async () => {
      setWorkspacePath();
      const branchHeadCommit = context.workspaceState.get("branchHeadCommit");
      const branch = context.workspaceState.get("branch");
      if (!branchHeadCommit || !branch) {
        vscode.window.showErrorMessage(
          "No previously reviewed head commit found."
        );
        return;
      }
      execSync(`git reset --hard ${branchHeadCommit}`);
      vscode.window.showInformationMessage(
        `Reset to ${branch} head commit ${branchHeadCommit}.`
      );
    }
  );

  context.subscriptions.push(compareDisposable);
  context.subscriptions.push(resetDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
