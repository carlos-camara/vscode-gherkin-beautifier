import * as cp from 'child_process';
import * as os from 'os';

/**
 * Gracefully and then forcefully kills a process and all its children.
 * Uses taskkill on Windows, and tree-kill/process group kill on POSIX.
 *
 * @param pid The process ID to kill
 */
export function killProcessTree(pid: number): void {
    try {
        if (os.platform() === 'win32') {
            cp.spawnSync('taskkill', ['/pid', pid.toString(), '/T', '/F']);
        } else {
            // For Unix, if the process was started with detached: true, 
            // we could kill the process group via process.kill(-pid, 'SIGKILL').
            try {
                process.kill(-pid, 'SIGKILL');
            } catch (e) {
                // Fallback if not a group leader
                try {
                    process.kill(pid, 'SIGKILL');
                } catch (e2) {
                    // Ignore
                }
            }
        }
    } catch (e) {
        // Ignore errors if process is already dead
    }
}
