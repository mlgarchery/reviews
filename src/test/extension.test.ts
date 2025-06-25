import * as assert from "assert";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
import { parseBranchNames } from "../extension";
// import * as myExtension from '../../extension';

suite("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");

  test("parseBranchNames", () => {
    const [branch, compareToBranch] = parseBranchNames("main..develop", "main");
    assert.strictEqual(branch, "main");
    assert.strictEqual(compareToBranch, "develop");
  });
  test("parseBranchNames with no input (undefined)", () => {
    const [branch, compareToBranch] = parseBranchNames(undefined, "current");
    assert.strictEqual(branch, "current");
    assert.strictEqual(compareToBranch, "main");
  });
  test("parseBranchNames with no input (empty string)", () => {
    const [branch, compareToBranch] = parseBranchNames("", "current");
    assert.strictEqual(branch, "current");
    assert.strictEqual(compareToBranch, "main");
  });
  test("parseBranchNames with no compareToBranch", () => {
    const [branch, compareToBranch] = parseBranchNames("feature", "main");
    assert.strictEqual(branch, "feature");
    assert.strictEqual(compareToBranch, "main");
  });
  test("parseBranchNames with no compareToBranch 2", () => {
    const [branch, compareToBranch] = parseBranchNames("feature..", "main");
    assert.strictEqual(branch, "feature");
    assert.strictEqual(compareToBranch, "main");
  });
  test("parseBranchNames with no current branch specified", () => {
    const [branch, compareToBranch] = parseBranchNames("..dev", "current");
    assert.strictEqual(branch, "current");
    assert.strictEqual(compareToBranch, "dev");
  });
});
