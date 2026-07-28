Feature: E2E Execution Hardening Test
  Scenario: Safe Shell Execution
    Given I have a safe execution environment
    When I run a scenario with malicious characters like $(rm -rf /)
    Then it should execute safely
