import * as assert from 'assert';
import * as vscode from 'vscode';
import { WorkspaceEventBus, WorkspaceEvent } from '../../eventBus';

suite('WorkspaceEventBus Test Suite', () => {
    test('Can subscribe and receive events', () => {
        const eventBus = new WorkspaceEventBus();
        const receivedEvents: WorkspaceEvent[] = [];

        const disposable = eventBus.onEvent((e) => {
            receivedEvents.push(e);
        });

        const testUri = vscode.Uri.file('/path/to/test.feature');
        eventBus.publish({ type: 'featureFileCreated', uri: testUri });
        eventBus.publish({ type: 'featureFileDeleted', uri: testUri });

        assert.strictEqual(receivedEvents.length, 2);
        assert.strictEqual(receivedEvents[0].type, 'featureFileCreated');
        assert.strictEqual((receivedEvents[0] as any).uri, testUri);
        assert.strictEqual(receivedEvents[1].type, 'featureFileDeleted');

        disposable.dispose();
        eventBus.dispose();
    });

    test('Dispose prevents further events', () => {
        const eventBus = new WorkspaceEventBus();
        const receivedEvents: WorkspaceEvent[] = [];

        eventBus.onEvent((e) => {
            receivedEvents.push(e);
        });

        eventBus.dispose();
        
        const testUri = vscode.Uri.file('/path/to/test.feature');
        eventBus.publish({ type: 'featureFileCreated', uri: testUri });

        assert.strictEqual(receivedEvents.length, 0);
    });
});
