import * as assert from 'assert';
import * as net from 'net';
import { NDJSONSocketReader, ProtocolEnvelope } from '../../protocol';

suite('Protocol Decoder Stress Tests', () => {

    test('Should decode perfectly framed NDJSON', (done) => {
        let emitted: ProtocolEnvelope[] = [];
        const mockSocket = new net.Socket();
        
        new NDJSONSocketReader(mockSocket as any, (event) => {
            emitted.push(event);
        }, () => {});

        const payload = JSON.stringify({ version: 1, type: 'eof', payload: {} }) + '\n';
        mockSocket.emit('data', Buffer.from(payload));

        assert.strictEqual(emitted.length, 1);
        assert.strictEqual(emitted[0].type, 'eof');
        done();
    });

    test('Should decode fragmented chunks (1 byte at a time)', (done) => {
        let emitted: ProtocolEnvelope[] = [];
        const mockSocket = new net.Socket();
        
        new NDJSONSocketReader(mockSocket as any, (event) => {
            emitted.push(event);
        }, () => {});

        const payload = JSON.stringify({ version: 1, type: 'step', payload: { name: "test", status: "passed" } }) + '\n';
        
        for (let i = 0; i < payload.length; i++) {
            mockSocket.emit('data', Buffer.from(payload[i]));
        }

        assert.strictEqual(emitted.length, 1);
        assert.strictEqual(emitted[0].type, 'step');
        done();
    });

    test('Should drop malformed JSON safely without crashing', (done) => {
        let emitted: ProtocolEnvelope[] = [];
        const mockSocket = new net.Socket();
        
        new NDJSONSocketReader(mockSocket as any, (event) => {
            emitted.push(event);
        }, () => {});

        // Send bad JSON then good JSON
        mockSocket.emit('data', Buffer.from('{ bad json \n'));
        const goodPayload = JSON.stringify({ version: 1, type: 'eof', payload: {} }) + '\n';
        mockSocket.emit('data', Buffer.from(goodPayload));

        assert.strictEqual(emitted.length, 1); // Only the good one should emit
        assert.strictEqual(emitted[0].type, 'eof');
        done();
    });

    test('Should drop unrecognized event types', (done) => {
        let emitted: ProtocolEnvelope[] = [];
        const mockSocket = new net.Socket();
        
        new NDJSONSocketReader(mockSocket as any, (event) => {
            emitted.push(event);
        }, () => {});

        const badType = JSON.stringify({ version: 1, type: 'hacked_event', payload: {} }) + '\n';
        mockSocket.emit('data', Buffer.from(badType));

        assert.strictEqual(emitted.length, 0);
        done();
    });

    test('Should handle multiple messages in one chunk', (done) => {
        let emitted: ProtocolEnvelope[] = [];
        const mockSocket = new net.Socket();
        
        new NDJSONSocketReader(mockSocket as any, (event) => {
            emitted.push(event);
        }, () => {});

        const m1 = JSON.stringify({ version: 1, type: 'feature', payload: { name: 'f1', filename: 'f1.feature', line: 1 } }) + '\n';
        const m2 = JSON.stringify({ version: 1, type: 'scenario', payload: { name: 's1', filename: 'f1.feature', line: 5 } }) + '\n';
        const m3 = JSON.stringify({ version: 1, type: 'eof', payload: {} }) + '\n';
        
        mockSocket.emit('data', Buffer.from(m1 + m2 + m3));

        assert.strictEqual(emitted.length, 3);
        assert.strictEqual(emitted[0].type, 'feature');
        assert.strictEqual(emitted[1].type, 'scenario');
        assert.strictEqual(emitted[2].type, 'eof');
        done();
    });

    test('Benchmark: 10,000 events throughput', (done) => {
        let emitted: ProtocolEnvelope[] = [];
        const mockSocket = new net.Socket();
        
        new NDJSONSocketReader(mockSocket as any, (event) => {
            emitted.push(event);
        }, () => {});

        const m1 = JSON.stringify({ version: 1, type: 'step', payload: { name: 'f1', status: 'passed' } }) + '\n';
        let hugeChunk = '';
        for (let i = 0; i < 10000; i++) {
            hugeChunk += m1;
        }
        
        mockSocket.emit('data', Buffer.from(hugeChunk));

        assert.strictEqual(emitted.length, 10000);
        done();
    });
});
