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

- `reviews.compare`: compare two branches. You need to provide the branch name you want to compare with main. This command:

  - fetch and update the two branches (if a remote exists)
  - find the branches common ancestor (_main_ancestor_)
  - reset --soft the branch to the common ancestor
  - switch to the VSCode source control view

  If you want to compare with another branch than main, you can type `{branchName}..{anotherBranchThanMain}`, ex. `fix/typo..develop`.
  The command also stores the branch last commit (_branch_commit2_) workspace wise so you can come back to it using the reset command.

- `reviews.reset`: reset the comparison. Comes back to the branch last commit.

## Release Notes

### 0.2.0

- Reset branch prior to comparing.
- Fix a bug where when comparing twice then resetting, the --hard reset was done on main and thus the commits of the branch added to main.

### 0.0.3

- Add reviews.reset command.
