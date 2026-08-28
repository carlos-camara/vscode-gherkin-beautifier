import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('Integration Test Suite', () => {
    test('Hover and Definition work without colons', async () => {
        // Open a feature file
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!workspaceFolder) throw new Error("No workspace folder");
        
        const featurePath = path.join(workspaceFolder, 'test_no_colon.feature');
        fs.writeFileSync(featurePath, "Feature Linter testing\nScenario Missing colon\nGiven a step\nAnd another step");
        
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(featurePath));
        await vscode.window.showTextDocument(doc);

        // Wait for extension to activate and symbol cache to populate
        await new Promise(r => setTimeout(r, 2000));

        // Let's create a fake python file with step definitions just in case
        const pyPath = path.join(workspaceFolder, 'test_steps.py');
        fs.writeFileSync(pyPath, "from behave import given\n@given('a step')\ndef step_impl(context):\n  pass\n@given('another step')\ndef step_impl(context):\n  pass");
        
        // Wait for symbol cache
        await new Promise(r => setTimeout(r, 2000));

        // Test Hover on line 3 (Given a step)
        const hovers = await vscode.commands.executeCommand<vscode.Hover[]>('vscode.executeHoverProvider', doc.uri, new vscode.Position(2, 6));
        console.log("Hovers for line 2:", hovers?.length);
        if (hovers && hovers.length > 0) {
            console.log("Hover content:", hovers[0].contents[0]);
        }
        
        // Test Definition on line 3
        const defs = await vscode.commands.executeCommand<vscode.Location[]>('vscode.executeDefinitionProvider', doc.uri, new vscode.Position(2, 6));
        console.log("Definitions for line 2:", defs?.length);
        
        fs.unlinkSync(featurePath);
        fs.unlinkSync(pyPath);
    }).timeout(10000);
});
