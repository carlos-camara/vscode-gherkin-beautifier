import * as assert from 'assert';
import * as vscode from 'vscode';
import { TestSelectionNormalizer } from '../../testSelectionNormalizer';
import { TestIdentity } from '../../testIdentity';

suite('TestSelectionNormalizer', () => {
    let normalizer: TestSelectionNormalizer;
    let ctrl: vscode.TestController;

    setup(() => {
        normalizer = new TestSelectionNormalizer();
        ctrl = vscode.tests.createTestController(`test-${Date.now()}`, 'test');
    });

    teardown(() => {
        ctrl.dispose();
    });

    function createMockItem(id: string, children: string[] = []): vscode.TestItem {
        const item = ctrl.createTestItem(id, 'label', vscode.Uri.file('/path.feature'));
        for (const childId of children) {
            item.children.add(createMockItem(childId));
        }
        return item;
    }

    test('decomposes Rule into Scenarios when included explicitly', () => {
        const uri = vscode.Uri.file('/path.feature');
        const ruleId = TestIdentity.createId(uri, 'rule', 10);
        const scId1 = TestIdentity.createId(uri, 'scenario', 12);
        const scId2 = TestIdentity.createId(uri, 'scenario', 15);
        
        const root = createMockItem(TestIdentity.createId(uri, 'feature'), [ruleId]);
        const ruleItem = root.children.get(ruleId)!;
        ruleItem.children.add(createMockItem(scId1));
        ruleItem.children.add(createMockItem(scId2));

        const request = new vscode.TestRunRequest([ruleItem]);
        const allRoots = ctrl.items;
        allRoots.add(root);

        const result = normalizer.normalize(request, allRoots);

        // Should return the two scenarios, not the rule itself
        assert.strictEqual(result.length, 2);
        assert.strictEqual(result[0].id, scId1);
        assert.strictEqual(result[1].id, scId2);
    });

    test('decomposes Examples into Rows when included explicitly', () => {
        const uri = vscode.Uri.file('/path.feature');
        const outlineId = TestIdentity.createId(uri, 'outline', 10);
        const exId = TestIdentity.createId(uri, 'examples', 12);
        const rowId1 = TestIdentity.createId(uri, 'row', 13);
        const rowId2 = TestIdentity.createId(uri, 'row', 14);
        
        const root = createMockItem(TestIdentity.createId(uri, 'feature'), [outlineId]);
        const outlineItem = root.children.get(outlineId)!;
        const exItem = createMockItem(exId);
        outlineItem.children.add(exItem);
        exItem.children.add(createMockItem(rowId1));
        exItem.children.add(createMockItem(rowId2));

        const request = new vscode.TestRunRequest([exItem]);
        const allRoots = ctrl.items;
        allRoots.add(root);

        const result = normalizer.normalize(request, allRoots);

        // Should return the two rows, not the examples block itself
        assert.strictEqual(result.length, 2);
        assert.strictEqual(result[0].id, rowId1);
        assert.strictEqual(result[1].id, rowId2);
    });
});
