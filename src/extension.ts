// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('héhéhé, your extension is active! (at');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('reviews.compare', async () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		const userInput = await vscode.window.showInputBox({
            prompt: "Enter a branch name",
            placeHolder: "Branch to compare"
        });
		console.log("log user input: ", userInput);

		vscode.window.showInformationMessage('My command output');
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
