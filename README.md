# ![Alt text](https://raw.githubusercontent.com/mlgarchery/reviews/main/images/reviews.png) reviews

Do reviews in VSCode comparing branches using its native git source control view.

Example:

```
                   main
                    │
                    │
                ┌───x main_ancestor
                │   │
                │   ▼
branch_commit1  x   x main_newcommit
                │
                ▼
branch_commit2  x
```

As in GitHub pull requests, the branch is compared to main before new commits were added to it (_main_ancestor_). Said differently, all changes from _main_ancestor_ to _branch_commit2_ are shown (_branch_commit1_ + _branch_commit2_ changes).

## Features

Two commands are available:

- `reviews.compare`: compare two branches. You need to provide the branch name you want to compare with main. If you don't the current branch will be used. This command:

  - fetch the two branches last changes (if a remote exists, otherwise the local branch is used)
  - find the branches common ancestor (_main_ancestor_)
  - reset --soft the branch to the common ancestor in detached HEAD mode (you can't mess your history there).
  - switch to the VSCode source control view

  If you want to compare with another branch than main, you can type `{branchName}..{anotherBranchThanMain}`, ex. `fix/typo..develop`. You can also use the syntax `..dev` if you want to compare the current branch with the `dev` branch.
  The command stores the `branchName` so you can switch back to it later with the reset command.

- `reviews.reset`: comes back to the branch state previous to the comparison, and go out of the detached HEAD mode.

## Release Notes

### 0.4.1

- First parent graph works for git worktree

### 0.4.0

- Added the First-Parent Graph view in the source control tab. It shows only the commits on the current branch up to the base branch (default is 'main'), folding the commits from merges, which is handy to have a quick view of the PR commits, even in the case of a complex git history.

![first parent graph view example](/images/first-parent-graph-view.png)

### 0.3.5

- reverting to switching to branch instead of "branch prior to comparison", as the staged changes were kept after the reset.

### 0.3.4

- now reseting by switching to the branch prior to the comparison, not the branch we compare (more stable)
- fix unwanted change introduced just before in v0.3.3 related to `git --detach` causing staged changes not to be cleared properly

### 0.3.3

- fix an issue where refs used where not from the remote

### 0.3.2

- short commit displayed are now consistently of length 8 everywhere
- add MIT licence
- exclude some file from final extension package

### 0.3.0

- Using detached HEAD mode to prevent polluting the repository state.
- `..dev` syntax to quickly change the base branch is now possible

### 0.2.0

- Reset branch prior to comparing.
- Fix a bug where when comparing twice then resetting, the --hard reset was done on main and thus the commits of the branch added to main.

### 0.0.3

- Add reviews.reset command.
