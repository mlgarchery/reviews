
























































































































      // By default the branch to compare to is the "main" branch
      // to compare to something else than main, the syntax is <branch>..<compare_to_branch>
      // Additional shorthand syntax supported:
      // - `..branch` means compare current branch to branch
      // - `branch..` means compare branch to main
      // if nothing is inputed, default behaviour is <current_branch>..main
      const currentBranch = findCurrentBranch();


      let branch = currentBranch;

      if (inputBranch) {
        if (inputBranch.includes("..")) {
          const [leftBranch, rightBranch] = inputBranch.split("..");
          
          // Handle shorthand syntax
          if (leftBranch === "" && rightBranch !== "") {
            // ..branch -> compare current branch to branch
            branch = currentBranch;
            compareToBranch = rightBranch;
          } else if (leftBranch !== "" && rightBranch === "") {
            // branch.. -> compare branch to main
            branch = leftBranch;
            compareToBranch = "main";
          } else if (leftBranch !== "" && rightBranch !== "") {
            // branch1..branch2 -> compare branch1 to branch2 (existing behavior)
            branch = leftBranch;
            compareToBranch = rightBranch;
          } else {
            // Handle edge case of just ".." - use current branch vs main
            branch = currentBranch;
            compareToBranch = "main";
          }
        } else {
          // Single branch name -> compare to main (existing behavior)
          branch = inputBranch;
        }
      }