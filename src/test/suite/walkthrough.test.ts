import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

suite('Walkthrough Manifest Tests', () => {
    let packageJson: any;
    let workspaceRoot: string;

    suiteSetup(() => {
        workspaceRoot = path.resolve(__dirname, '../../../');
        const packageJsonPath = path.join(workspaceRoot, 'package.json');
        packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    });

    test('All commands referenced in completionEvents must exist', () => {
        const commands = new Set<string>();
        packageJson.contributes.commands.forEach((c: any) => commands.add(c.command));

        // Built-in VS Code commands we use
        commands.add('workbench.action.openSettings');
        commands.add('workbench.view.testing.focus');

        packageJson.contributes.walkthroughs.forEach((walkthrough: any) => {
            walkthrough.steps.forEach((step: any) => {
                if (step.completionEvents) {
                    step.completionEvents.forEach((event: string) => {
                        if (event.startsWith('onCommand:')) {
                            const commandId = event.replace('onCommand:', '');
                            assert.ok(
                                commands.has(commandId),
                                `Walkthrough step '${step.id}' completionEvent references missing command: ${commandId}`
                            );
                        }
                    });
                }
                
                if (step.description) {
                    const commandRegex = /\]\(command:([^?)]+)(\?[^)]+)?\)/g;
                    let match;
                    while ((match = commandRegex.exec(step.description)) !== null) {
                        const commandId = match[1];
                        assert.ok(
                            commands.has(commandId),
                            `Walkthrough step '${step.id}' description references missing command: ${commandId}`
                        );
                    }
                }
            });
        });
    });

    test('All media paths must exist in the file system', () => {
        packageJson.contributes.walkthroughs.forEach((walkthrough: any) => {
            walkthrough.steps.forEach((step: any) => {
                if (step.media) {
                    const markdownPath = step.media.markdown;
                    if (markdownPath) {
                        const fullPath = path.join(workspaceRoot, markdownPath);
                        assert.ok(
                            fs.existsSync(fullPath),
                            `Walkthrough step '${step.id}' media path does not exist: ${markdownPath}`
                        );
                    }
                }
            });
        });
    });
});
