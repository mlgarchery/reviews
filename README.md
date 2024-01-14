# ![Alt text](https://raw.githubusercontent.com/mlgarchery/reviews/main/images/reviews.png) reviews


Compare branches using native VSCode feature.

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

As in GitHub pull request, the branch is compared to main before new commits were added to it (main_ancestor). Said differently, all changes from main_ancestor to branch_commit2 are shown.

## Features

Two commands are available:
* `reviews.compare` - compare two branches. You need to provide the branch name you want to compare with main.
If you want to compare with another branch than main, you can use type `{branchName}..{anotherBranchName}` (separator is two dots).
This command fetch the branch, `reset --soft` to the last common ancestor of the two branches (ignoring new commits on the main branch), and switch to the VSCode source control view.


It store the branch last commit (branch_commit2 in the example)so you can come back to it using the reset command.
* `reviews.reset` - reset the comparison. Comes back to the branch last commit.

## Release Notes

### 0.0.3

Add reviews.reset command.

