import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { FeatureDiscoveryService } from '../../featureDiscovery';
import { WorkspaceEventBus } from '../../eventBus';

suite('FeatureDiscoveryService Test Suite', () => {
    let sandbox: sinon.SinonSandbox;
    let service: FeatureDiscoveryService;
    let mockEventBus: WorkspaceEventBus;

    setup(() => {
        sandbox = sinon.createSandbox();
        service = new FeatureDiscoveryService();
        mockEventBus = new WorkspaceEventBus();
        service.eventBus = mockEventBus;
    });

    teardown(() => {
        sandbox.restore();
        service.dispose();
        mockEventBus.dispose();
    });

    test('getFeatureGlobs returns default if no config provided', () => {
        assert.deepStrictEqual(service.getFeatureGlobs(), ['**/*.feature']);
    });

    test('isIgnored checks default ignores', () => {
        const ignoredUris = [
            vscode.Uri.file('/my/workspace/node_modules/test.feature'),
            vscode.Uri.file('/my/workspace/.venv/test.feature'),
            vscode.Uri.file('/my/workspace/.git/test.feature')
        ];
        
        ignoredUris.forEach(uri => {
            assert.strictEqual(service.isIgnored(uri), true, `${uri.fsPath} should be ignored`);
        });

        const validUri = vscode.Uri.file('/my/workspace/features/test.feature');
        assert.strictEqual(service.isIgnored(validUri), false, `${validUri.fsPath} should not be ignored`);
    });

    test('debounceEvent coalesces bursts', async () => {
        let callCount = 0;
        const fn = () => callCount++;

        // Fire 100 times quickly
        for (let i = 0; i < 100; i++) {
            service.debounceEvent('test-key', fn, 10);
        }

        assert.strictEqual(callCount, 0, 'Should not be called immediately');

        // Wait for debounce
        await new Promise(resolve => setTimeout(resolve, 20));
        assert.strictEqual(callCount, 1, 'Should only be called once after burst');
    });

    test('setupWatchers creates watchers and debounces events', async () => {
        // We will mock vscode.workspace.createFileSystemWatcher
        const fakeWatcher = {
            onDidCreate: sandbox.stub(),
            onDidChange: sandbox.stub(),
            onDidDelete: sandbox.stub(),
            dispose: sandbox.stub(),
            ignoreCreateEvents: false,
            ignoreChangeEvents: false,
            ignoreDeleteEvents: false
        };
        sandbox.stub(vscode.workspace, 'createFileSystemWatcher').returns(fakeWatcher as any);

        service.setupWatchers();

        assert.strictEqual(fakeWatcher.onDidCreate.called, true);
        assert.strictEqual(fakeWatcher.onDidChange.called, true);
        assert.strictEqual(fakeWatcher.onDidDelete.called, true);

        // Simulate a file create
        const createCb = fakeWatcher.onDidCreate.getCall(0).args[0];
        
        let eventFired = false;
        mockEventBus.onEvent(e => {
            if (e.type === 'featureFileCreated') {
                eventFired = true;
            }
        });

        const testUri = vscode.Uri.file('/test/workspace/features/test.feature');
        createCb(testUri);
        createCb(testUri); // Simulate duplicate burst
        
        await new Promise(resolve => setTimeout(resolve, 150));
        assert.strictEqual(eventFired, true);
    });

    test('getDiagnostics tracks included and ignored counts', async () => {
        // Mock findFiles
        sandbox.stub(vscode.workspace, 'findFiles').resolves([
            vscode.Uri.file('/test/valid1.feature'),
            vscode.Uri.file('/test/valid2.feature'),
            vscode.Uri.file('/test/node_modules/invalid.feature') // This will be ignored
        ]);

        await service.getFeatureFiles();
        
        const stats = service.getDiagnostics();
        assert.strictEqual(stats.includedCount, 2);
        assert.strictEqual(stats.ignoredCount, 1);
        assert.strictEqual(stats.staleCount, 0);
    });
});
