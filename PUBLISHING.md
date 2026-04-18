## PUBLISHING

`npm install -g @vscode/vsce` is needed

Update the package version and add a changelog line in the README.

Run `npm run pretest && npm run test`: fix any issue found here and retry until there is none.

### VS Code Marketplace

Then do `npm run publish:vsce` (or `vsce publish` directly).

- Login first if needed with `vsce login mlgarchery`, then provide your personal access token.

### Open VSX Registry (Cursor, VSCodium, and other editors)

Cursor uses the [Open VSX Registry](https://open-vsx.org/) instead of the VS Code Marketplace, so publishing there is required for Cursor users to find the extension.

#### One-time setup

1. Create an Eclipse Foundation account at https://accounts.eclipse.org/user/register (fill in your GitHub username).
2. Log into https://open-vsx.org with your GitHub account.
3. Go to your profile settings, click _Log in with Eclipse_, and sign the Publisher Agreement.
4. Generate an access token at https://open-vsx.org/user-settings/tokens.
5. Create the namespace (once only): `npx ovsx create-namespace mlgarchery -p <token>`

#### Publishing

Set your token in the environment and run the script:

```sh
# if not already available in your envs, do: export OVSX_TOKEN=<your-open-vsx-token>
npm run publish:ovsx
```
