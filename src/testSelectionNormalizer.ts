import * as vscode from 'vscode';
import { TestIdentity } from './testIdentity';

/**
 * Normalizes a VS Code TestRunRequest into a deterministic, flat array of exactly which
 * TestItems should be executed, correctly processing include/exclude intersections, 
 * parent/child exclusions, and preventing duplicate executions.
 */
export class TestSelectionNormalizer {
    /**
     * @param request The test run request containing include/exclude arrays
     * @param allRootItems A collection of all root test items (used if request.include is undefined)
     */
    public normalize(
        request: vscode.TestRunRequest,
        allRootItems: vscode.TestItemCollection
    ): vscode.TestItem[] {
        const includes = new Set<vscode.TestItem>();
        if (request.include) {
            request.include.forEach(i => includes.add(i));
        } else {
            allRootItems.forEach(i => includes.add(i));
        }

        const excludes = new Set<vscode.TestItem>(request.exclude ?? []);

        if (includes.size === 0) {
            return [];
        }

        const result = new Set<vscode.TestItem>();

        const traverse = (item: vscode.TestItem, isIncludedAncestor: boolean) => {
            // 1. If explicitly excluded, prune this entire branch immediately
            if (excludes.has(item)) {
                return;
            }

            const isTargeted = isIncludedAncestor || includes.has(item);

            // 2. Check for exclusions or inclusions in descendants
            const hasExcludedDescendant = this.hasDescendantInSet(item, excludes);
            const hasIncludedDescendant = this.hasDescendantInSet(item, includes);

            if (isTargeted) {
                const identity = TestIdentity.parse(item.id);
                const isUnrunnableNode = identity.type === 'rule' || identity.type === 'examples';
                
                if (hasExcludedDescendant || isUnrunnableNode) {
                    // Cannot run this parent directly, decompose into children
                    item.children.forEach(child => traverse(child, true));
                } else {
                    // Safe to run as a single unit, stop traversal to prevent duplicates
                    result.add(item);
                }
            } else {
                if (hasIncludedDescendant) {
                    // Recurse to find the included children
                    item.children.forEach(child => traverse(child, false));
                }
            }
        };

        // If request.include is defined, we should only traverse from root items that 
        // are either included or have included descendants, or just traverse all roots.
        allRootItems.forEach(root => traverse(root, false));

        return Array.from(result).sort((a, b) => {
            const uriA = a.uri?.toString() || '';
            const uriB = b.uri?.toString() || '';
            const uriCmp = uriA.localeCompare(uriB);
            if (uriCmp !== 0) return uriCmp;

            const identityA = TestIdentity.parse(a.id);
            const identityB = TestIdentity.parse(b.id);
            const lineA = identityA.line ?? 0;
            const lineB = identityB.line ?? 0;
            return lineA - lineB;
        });
    }

    private hasDescendantInSet(item: vscode.TestItem, set: Set<vscode.TestItem>): boolean {
        let found = false;
        item.children.forEach(child => {
            if (found) return;
            if (set.has(child) || this.hasDescendantInSet(child, set)) {
                found = true;
            }
        });
        return found;
    }
}
