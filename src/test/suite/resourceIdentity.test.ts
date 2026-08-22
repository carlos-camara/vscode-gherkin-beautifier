import * as assert from 'assert';
import * as vscode from 'vscode';
import { ResourceIdentity } from '../../utils/resourceIdentity';

suite('ResourceIdentity Test Suite', () => {
    test('isCaseSensitive returns false for local win32 and darwin', () => {
        const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
        
        try {
            // Mock platform to win32
            Object.defineProperty(process, 'platform', { value: 'win32' });
            assert.strictEqual(ResourceIdentity.isCaseSensitive(vscode.Uri.file('C:\\foo\\bar.txt')), false);
            
            // Mock platform to darwin
            Object.defineProperty(process, 'platform', { value: 'darwin' });
            assert.strictEqual(ResourceIdentity.isCaseSensitive(vscode.Uri.file('/users/mac/foo.txt')), false);
            
            // Mock platform to linux
            Object.defineProperty(process, 'platform', { value: 'linux' });
            assert.strictEqual(ResourceIdentity.isCaseSensitive(vscode.Uri.file('/home/linux/foo.txt')), true);
        } finally {
            if (originalPlatform) {
                Object.defineProperty(process, 'platform', originalPlatform);
            }
        }
    });

    test('isCaseSensitive returns true for non-file schemes', () => {
        assert.strictEqual(ResourceIdentity.isCaseSensitive(vscode.Uri.parse('vscode-remote://test/foo.txt')), true);
        assert.strictEqual(ResourceIdentity.isCaseSensitive(vscode.Uri.parse('untitled:Untitled-1')), true);
    });

    test('getCanonicalUriString handles case-sensitive URIs', () => {
        const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
        
        try {
            Object.defineProperty(process, 'platform', { value: 'linux' });
            const uri1 = vscode.Uri.file('/Home/Test/Foo.txt');
            const uri2 = vscode.Uri.file('/home/test/foo.txt');
            
            assert.notStrictEqual(ResourceIdentity.getCanonicalUriString(uri1), ResourceIdentity.getCanonicalUriString(uri2));
            assert.strictEqual(ResourceIdentity.getCanonicalUriString(uri1), uri1.toString());
        } finally {
            if (originalPlatform) {
                Object.defineProperty(process, 'platform', originalPlatform);
            }
        }
    });

    test('getCanonicalUriString handles case-insensitive URIs', () => {
        const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
        
        try {
            Object.defineProperty(process, 'platform', { value: 'win32' });
            const uri1 = vscode.Uri.file('C:\\Home\\Test\\Foo.txt');
            const uri2 = vscode.Uri.file('c:\\home\\test\\foo.txt');
            
            assert.strictEqual(ResourceIdentity.getCanonicalUriString(uri1), ResourceIdentity.getCanonicalUriString(uri2));
            assert.strictEqual(ResourceIdentity.getCanonicalUriString(uri1), uri1.with({ path: uri1.path.toLowerCase() }).toString());
        } finally {
            if (originalPlatform) {
                Object.defineProperty(process, 'platform', originalPlatform);
            }
        }
    });
});
