// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import assert from 'assert';
import { execSync } from 'child_process';
import * as vscode from 'vscode';

/**
 * Set current path for shells command to the current workspace folder path
 */
const setWorkspacePath = () => {
	const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage("No workspace folder found.");
        return;
    }
    const workspacePath = workspaceFolders[0].uri.fsPath;
	// console.log("workspace path", workspacePath);
	process.chdir(workspacePath);
};

const  findCurrentBranch = async () => {
	const result = execSync("git rev-parse --abbrev-ref HEAD", );
	return result.toString().trim();
};

const checkoutBranch = async (branch: string) => {
	execSync(`git checkout ${branch}`);
};

const resetSoftToCommonCommitAncestor = async (branch: string, compareToBranch: string) => {
	let command = `ancestor=$(git merge-base ${compareToBranch} ${branch}); git reset --soft $ancestor`;
	execSync(command);
};

const getBranches = () => {
	return execSync("git for-each-ref --format='%(refname:short)' refs/heads/").toString().trim().split('\n');
};


// Error utils

const checkBranchExists = (branch: string, availableBranches: string[]) => {
	if(!availableBranches.includes(branch)) {
		const msg = `Branch ${branch} do not exist`;
		vscode.window.showErrorMessage(msg);
		throw Error(msg); // stops command execution
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
	let disposable = vscode.commands.registerCommand('reviews.compare', async () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		setWorkspacePath();

		const inputBranch = await vscode.window.showInputBox({
            prompt: "Enter a branch name",
            placeHolder: "Branch to compare (default is current branch)"
        });
		
		// By default the branch to compare to is the "main" branch
		// to compare to something else than main, the syntax is <branch>..<compare_to_branch>
		// if nothing is inputed, default behaviour is <current_branch>..main
		const currentBranch = await findCurrentBranch();

		let compareToBranch = "main";
		let branch = currentBranch;

		if(inputBranch) {
			const availableBranches = getBranches();
			
			if(inputBranch.split("..").length === 2){
				[branch, compareToBranch] = inputBranch.split("..");
			} else {
				branch = inputBranch;
			}
			[branch, compareToBranch].forEach((b) => checkBranchExists(b, availableBranches));
		};
		
		console.log(`${branch}..${compareToBranch}`);
		
		checkoutBranch(branch);
		// get branch current commit ref
		const branchHeadCommit = execSync(`git rev-parse ${branch}`).toString().trim();
		context.workspaceState.update("branchHeadCommit", branchHeadCommit);
		resetSoftToCommonCommitAncestor(branch, compareToBranch);

		// vscode.window.showInformationMessage('My command output');
		vscode.commands.executeCommand('workbench.view.scm');
	});

	let disposable2 = vscode.commands.registerCommand('reviews.reset', async () => {
		setWorkspacePath();
		const branchHeadCommit = context.workspaceState.get("branchHeadCommit");
		if(!branchHeadCommit) {
			vscode.window.showErrorMessage("No branch head commit found.");
			return;
		}
		execSync(`git reset --hard ${branchHeadCommit}`);
	});
	
	context.subscriptions.push(disposable);
	context.subscriptions.push(disposable2);
}

// This method is called when your extension is deactivated
export function deactivate() {}
