import * as assert from 'assert';
import * as vscode from 'vscode';
import { TestSelectionNormalizer } from '../../testSelectionNormalizer';

class MockTestItem implements vscode.TestItem {
    id: string;
    label: string;
    uri: vscode.Uri;
    children: vscode.TestItemCollection;
    parent: vscode.TestItem | undefined;
    
    // Unused by normalizer but required by interface
    tags: readonly vscode.TestTag[] = [];
    canResolveChildren: boolean = false;
    busy: boolean = false;
    description: string | undefined;
    sortText: string | undefined;
    range: vscode.Range | undefined;
    error: string | vscode.MarkdownString | undefined;

    constructor(id: string, uriStr: string) {
        this.id = id;
        this.label = id;
        this.uri = vscode.Uri.parse(uriStr);
        this.children = new MockTestItemCollection();
    }
}

class MockTestItemCollection implements vscode.TestItemCollection {
    private items = new Map<string, vscode.TestItem>();

    get size() { return this.items.size; }

    add(item: vscode.TestItem) { this.items.set(item.id, item); }
    delete(id: string) { this.items.delete(id); }
    get(id: string) { return this.items.get(id); }
    replace(items: readonly vscode.TestItem[]) {
        this.items.clear();
        items.forEach(i => this.add(i));
    }
    forEach(callback: (item: vscode.TestItem, collection: vscode.TestItemCollection) => unknown, thisArg?: any) {
        this.items.forEach(item => callback.call(thisArg, item, this));
    }
    [Symbol.iterator]() { return this.items.entries(); }
}

class MockTestRunRequest implements vscode.TestRunRequest {
    include: readonly vscode.TestItem[] | undefined;
    exclude: readonly vscode.TestItem[] | undefined;
    profile: vscode.TestRunProfile | undefined;
    continuous: boolean | undefined;
    preserveFocus: boolean = false;

    constructor(include?: vscode.TestItem[], exclude?: vscode.TestItem[]) {
        this.include = include;
        this.exclude = exclude;
    }
}

suite('TestSelectionNormalizer', () => {
    let normalizer: TestSelectionNormalizer;
    let roots: vscode.TestItemCollection;
    
    // File 1
    let file1: vscode.TestItem;
    let f1Feature: vscode.TestItem;
    let f1Scenario1: vscode.TestItem;
    let f1Scenario2: vscode.TestItem;
    
    // File 2 (Outline)
    let file2: vscode.TestItem;
    let f2Feature: vscode.TestItem;
    let f2Outline: vscode.TestItem;
    let f2Row1: vscode.TestItem;
    let f2Row2: vscode.TestItem;

    setup(() => {
        normalizer = new TestSelectionNormalizer();
        roots = new MockTestItemCollection();

        // Build File 1 hierarchy
        file1 = new MockTestItem('file:///f1.feature', 'file:///f1.feature');
        f1Feature = new MockTestItem('file:///f1.feature#feature', 'file:///f1.feature');
        f1Scenario1 = new MockTestItem('file:///f1.feature#scenario:10', 'file:///f1.feature');
        f1Scenario2 = new MockTestItem('file:///f1.feature#scenario:20', 'file:///f1.feature');

        file1.children.add(f1Feature);
        f1Feature.children.add(f1Scenario1);
        f1Feature.children.add(f1Scenario2);
        roots.add(file1);

        // Build File 2 hierarchy
        file2 = new MockTestItem('file:///f2.feature', 'file:///f2.feature');
        f2Feature = new MockTestItem('file:///f2.feature#feature', 'file:///f2.feature');
        f2Outline = new MockTestItem('file:///f2.feature#scenario:5', 'file:///f2.feature');
        f2Row1 = new MockTestItem('file:///f2.feature#scenario:8', 'file:///f2.feature');
        f2Row2 = new MockTestItem('file:///f2.feature#scenario:9', 'file:///f2.feature');

        file2.children.add(f2Feature);
        f2Feature.children.add(f2Outline);
        f2Outline.children.add(f2Row1);
        f2Outline.children.add(f2Row2);
        roots.add(file2);
    });

    test('Includes all roots if request.include is undefined', () => {
        const req = new MockTestRunRequest(undefined, undefined);
        const result = normalizer.normalize(req, roots);
        
        // When included directly with no exclusions, it stops traversing at roots
        assert.deepStrictEqual(result.map(r => r.id), [file1.id, file2.id]);
    });

    test('Explicit include returns exactly the requested items (deduplicated by ancestry)', () => {
        // Including file1 implicitly includes children, so we expect just file1 to run as a whole
        const req = new MockTestRunRequest([file1, f1Feature, f1Scenario1], undefined);
        const result = normalizer.normalize(req, roots);
        
        assert.deepStrictEqual(result.map(r => r.id), [file1.id]);
    });

    test('Parent include / child exclude breaks down the parent', () => {
        // Run all of File 1, EXCEPT scenario 2
        const req = new MockTestRunRequest([file1], [f1Scenario2]);
        const result = normalizer.normalize(req, roots);
        
        // file1 has excluded descendant. feature has excluded descendant. 
        // scenario1 has no excluded descendant.
        assert.deepStrictEqual(result.map(r => r.id), [f1Scenario1.id]);
    });

    test('Multiple explicit includes on different files', () => {
        const req = new MockTestRunRequest([f1Scenario2, f2Row1], undefined);
        const result = normalizer.normalize(req, roots);
        
        // Ordering should sort by URI (f1 before f2), then by line (20 vs 8)
        assert.deepStrictEqual(result.map(r => r.id), [f1Scenario2.id, f2Row1.id]);
    });

    test('Exclude prunes entire branch regardless of includes', () => {
        // Try to include the whole outline, but exclude the entire file2
        const req = new MockTestRunRequest([f2Outline], [file2]);
        const result = normalizer.normalize(req, roots);
        
        assert.strictEqual(result.length, 0);
    });

    test('Exclude specific row from outline', () => {
        // Run file2 outline, but skip row 2
        const req = new MockTestRunRequest([f2Outline], [f2Row2]);
        const result = normalizer.normalize(req, roots);
        
        assert.deepStrictEqual(result.map(r => r.id), [f2Row1.id]);
    });

    test('Deterministic ordering', () => {
        // Include children out of order
        const req = new MockTestRunRequest([f2Row2, f1Scenario2, f2Row1, f1Scenario1], undefined);
        const result = normalizer.normalize(req, roots);
        
        // Should sort by URI then by line number
        assert.deepStrictEqual(result.map(r => r.id), [
            f1Scenario1.id,
            f1Scenario2.id,
            f2Row1.id,
            f2Row2.id
        ]);
    });

    test('Implicit inclusion fallback to all files minus exclusions', () => {
        // Run everything, but exclude file1 completely
        const req = new MockTestRunRequest(undefined, [file1]);
        const result = normalizer.normalize(req, roots);
        
        assert.deepStrictEqual(result.map(r => r.id), [file2.id]);
    });

    test('Overlapping explicit includes and excludes', () => {
        // Include f1 feature, exclude f1 feature. Exclude wins.
        const req = new MockTestRunRequest([f1Feature], [f1Feature]);
        const result = normalizer.normalize(req, roots);
        
        assert.strictEqual(result.length, 0);
    });
});
