import time
import subprocess
import os
import shutil

os.makedirs('.tmp_benchmark/features/steps', exist_ok=True)

def create_features(scenarios):
    with open('.tmp_benchmark/features/test.feature', 'w') as f:
        f.write('Feature: Benchmark\n')
        for i in range(scenarios):
            f.write(f'  Scenario: Scenario {i}\n')
            f.write('    Given a step\n')
            f.write('    When another step\n')
            f.write('    Then a final step\n')

with open('.tmp_benchmark/features/steps/steps.py', 'w') as f:
    f.write('from behave import *\n')
    f.write('@given("a step")\ndef step_impl(c): pass\n')
    f.write('@when("another step")\ndef step_impl(c): pass\n')
    f.write('@then("a final step")\ndef step_impl(c): pass\n')

os.environ['PYTHONPATH'] = os.path.abspath('assets')

for count in [10, 100, 1000]:
    create_features(count)
    start = time.time()
    result = subprocess.run(['behave', '.tmp_benchmark/features/test.feature', '-f', 'vscode_behave_formatter:VSCodeFormatter', '--no-summary', '--no-snippets'], capture_output=True, text=True)
    elapsed = time.time() - start
    print(f"Scenarios: {count} | Time: {elapsed:.3f}s | ExitCode: {result.returncode}")
    if result.returncode != 0:
        print(result.stderr[:200])

shutil.rmtree('.tmp_benchmark')
