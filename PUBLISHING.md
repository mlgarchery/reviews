## PUBLISHING

`npm install -g @vscode/vsce` is needed

Update the package version and add a changelog line in the README.

Run `npm run pretest && npm run test`: fix any issue found here and retry until there is none.

Then do `vsce publish`.

- Login first if needed with `vsce login <publisher>`, where`publisher` is mlgarchery here and then you need to provide the personal access token
