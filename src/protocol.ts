import * as net from 'net';
import { logger } from './logger';

export type BehaveEventType = 'feature' | 'scenario' | 'step_start' | 'step' | 'scenario_result' | 'eof';

export interface ProtocolEnvelope {
    version: 1;
    type: BehaveEventType;
    payload: unknown;
}

export interface FeaturePayload {
    name: string;
    filename: string;
    line: number;
}

export interface ScenarioPayload {
    name: string;
    filename: string;
    line: number;
}

export interface StepStartPayload {
    name: string;
    line: number;
}

export interface StepPayload {
    name: string;
    status: string; // 'passed', 'failed', 'undefined', 'skipped', etc.
    duration?: number;
    error_message?: string;
    error_file?: string;
    error_line?: number;
}

export interface ScenarioResultPayload {
    line: number;
    status: string;
    error_message?: string;
    context_snapshot?: Record<string, string> | null;
}

export interface EofPayload {
    // empty object
}

// Runtime Type Guards
function isProtocolEnvelope(obj: any): obj is ProtocolEnvelope {
    return typeof obj === 'object' && obj !== null &&
           obj.version === 1 &&
           typeof obj.type === 'string' &&
           obj.hasOwnProperty('payload');
}

function isFeaturePayload(obj: any): obj is FeaturePayload {
    return typeof obj === 'object' && obj !== null &&
           typeof obj.name === 'string' &&
           typeof obj.filename === 'string' &&
           typeof obj.line === 'number';
}

function isScenarioPayload(obj: any): obj is ScenarioPayload {
    return typeof obj === 'object' && obj !== null &&
           typeof obj.name === 'string' &&
           typeof obj.filename === 'string' &&
           typeof obj.line === 'number';
}

function isStepStartPayload(obj: any): obj is StepStartPayload {
    return typeof obj === 'object' && obj !== null &&
           typeof obj.name === 'string' &&
           typeof obj.line === 'number';
}

function isStepPayload(obj: any): obj is StepPayload {
    return typeof obj === 'object' && obj !== null &&
           typeof obj.name === 'string' &&
           typeof obj.status === 'string';
}

function isScenarioResultPayload(obj: any): obj is ScenarioResultPayload {
    return typeof obj === 'object' && obj !== null &&
           typeof obj.line === 'number' &&
           typeof obj.status === 'string';
}

/**
 * NDJSONSocketReader reads raw TCP chunks, splits them by Newline, 
 * validates the JSON against the Envelope Schema, and emits typed events.
 */
export class NDJSONSocketReader {
    private buffer: string = '';

    constructor(
        private socket: net.Socket,
        private onEvent: (envelope: ProtocolEnvelope) => void,
        private onError: (error: string) => void
    ) {
        this.socket.on('data', (chunk: any) => this.handleData(chunk));
        this.socket.on('error', (err) => {
            logger.error(`Protocol Socket Error: ${err.message}`);
            this.onError(err.message);
        });
    }

    private handleData(chunk: any) {
        this.buffer += chunk.toString('utf8');
        
        let newlineIndex;
        while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
            const line = this.buffer.substring(0, newlineIndex).trim();
            this.buffer = this.buffer.substring(newlineIndex + 1);
            
            if (line.length === 0) continue;

            try {
                const parsed = JSON.parse(line);
                if (!isProtocolEnvelope(parsed)) {
                    logger.warn(`Protocol Degraded: Dropping malformed or unrecognized envelope type/version: ${line.substring(0, 100)}`);
                    continue;
                }
                
                // Validate payloads
                switch (parsed.type) {
                    case 'feature':
                        if (!isFeaturePayload(parsed.payload)) {
                            logger.warn(`Protocol Degraded: Invalid feature payload`);
                            continue;
                        }
                        break;
                    case 'scenario':
                        if (!isScenarioPayload(parsed.payload)) {
                            logger.warn(`Protocol Degraded: Invalid scenario payload`);
                            continue;
                        }
                        break;
                    case 'step_start':
                        if (!isStepStartPayload(parsed.payload)) {
                            logger.warn(`Protocol Degraded: Invalid step_start payload`);
                            continue;
                        }
                        break;
                    case 'step':
                        if (!isStepPayload(parsed.payload)) {
                            logger.warn(`Protocol Degraded: Invalid step payload`);
                            continue;
                        }
                        break;
                    case 'scenario_result':
                        if (!isScenarioResultPayload(parsed.payload)) {
                            logger.warn(`Protocol Degraded: Invalid scenario_result payload`);
                            continue;
                        }
                        break;
                    case 'eof':
                        // no-op validation for eof
                        break;
                    default:
                        logger.warn(`Protocol Degraded: Unknown event type '${(parsed as any).type}'`);
                        continue;
                }

                // If we get here, it's structurally sound
                this.onEvent(parsed);

            } catch (err: any) {
                logger.error(`Protocol Fatal: JSON parsing failed for frame. Error: ${err.message}. Frame: ${line.substring(0, 100)}`);
                // Do not throw, keep reading in case it recovers, but log aggressively
            }
        }
    }

    public close() {
        this.socket.destroy();
    }
}
