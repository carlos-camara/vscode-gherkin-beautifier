import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { MetricsLogger } from '../../metrics';

suite('MetricsLogger Test Suite', () => {
    let metricsLogger: MetricsLogger;
    let getConfigurationStub: sinon.SinonStub;

    setup(() => {
        metricsLogger = new MetricsLogger();
        getConfigurationStub = sinon.stub(vscode.workspace, 'getConfiguration');
    });

    teardown(() => {
        sinon.restore();
    });

    test('Does not record metrics when disabled', () => {
        getConfigurationStub.withArgs('gherkinPowerTools.diagnostics').returns({
            get: sinon.stub().withArgs('metricsEnabled', false).returns(false)
        } as any);

        assert.strictEqual(metricsLogger.isEnabled(), false);

        metricsLogger.recordCacheHit();
        metricsLogger.recordCacheMiss();
        metricsLogger.recordParse(10, 5, 2, 3, 10, 0);

        // Access internal state for assertions using any type cast
        const anyLogger = metricsLogger as any;
        assert.strictEqual(anyLogger.parseRequests, 0);
        assert.strictEqual(anyLogger.cacheHits, 0);
        assert.strictEqual(anyLogger.cacheMisses, 0);
        assert.strictEqual(anyLogger.totalFeatures, 0);
    });

    test('Records metrics when enabled', () => {
        getConfigurationStub.withArgs('gherkinPowerTools.diagnostics').returns({
            get: sinon.stub().withArgs('metricsEnabled', false).returns(true)
        } as any);

        assert.strictEqual(metricsLogger.isEnabled(), true);

        metricsLogger.recordCacheHit();
        metricsLogger.recordCacheMiss();
        metricsLogger.recordCacheHit();
        metricsLogger.recordParse(100, 50, 1, 2, 5, 1);

        const anyLogger = metricsLogger as any;
        assert.strictEqual(anyLogger.parseRequests, 3);
        assert.strictEqual(anyLogger.cacheHits, 2);
        assert.strictEqual(anyLogger.cacheMisses, 1);
        assert.strictEqual(anyLogger.totalParseTimeMs, 100);
        assert.strictEqual(anyLogger.totalAstGenerationTimeMs, 50);
        assert.strictEqual(anyLogger.totalFeatures, 1);
        assert.strictEqual(anyLogger.totalScenarios, 2);
        assert.strictEqual(anyLogger.totalSteps, 5);
        assert.strictEqual(anyLogger.parserFailures, 1);
    });

    test('showMetrics outputs correctly and does not crash when disabled', () => {
        getConfigurationStub.withArgs('gherkinPowerTools.diagnostics').returns({
            get: sinon.stub().withArgs('metricsEnabled', false).returns(false)
        } as any);

        const outputChannelStub = {
            clear: sinon.spy(),
            appendLine: sinon.spy(),
            show: sinon.spy()
        };

        const createOutputChannelStub = sinon.stub(vscode.window, 'createOutputChannel').returns(outputChannelStub as any);

        metricsLogger.showMetrics();

        assert.ok(createOutputChannelStub.calledOnceWith('Gherkin PowerTools - Developer Metrics'));
        assert.ok(outputChannelStub.clear.calledOnce);
        assert.ok(outputChannelStub.show.calledOnce);
        
        // Assert that we get the disabled message
        assert.ok(outputChannelStub.appendLine.calledWith('Metrics are currently disabled.'));
    });

    test('showMetrics outputs correctly and does not crash when enabled', () => {
        getConfigurationStub.withArgs('gherkinPowerTools.diagnostics').returns({
            get: sinon.stub().withArgs('metricsEnabled', false).returns(true)
        } as any);

        const outputChannelStub = {
            clear: sinon.spy(),
            appendLine: sinon.spy(),
            show: sinon.spy()
        };

        sinon.stub(vscode.window, 'createOutputChannel').returns(outputChannelStub as any);

        metricsLogger.recordCacheHit(); // parseRequests = 1, hits = 1
        metricsLogger.showMetrics();

        assert.ok(outputChannelStub.clear.calledOnce);
        assert.ok(outputChannelStub.show.calledOnce);
        
        // Assert it outputs the hit ratio
        assert.ok(outputChannelStub.appendLine.calledWith('Cache Hit Ratio:      100.00%'));
    });
});
