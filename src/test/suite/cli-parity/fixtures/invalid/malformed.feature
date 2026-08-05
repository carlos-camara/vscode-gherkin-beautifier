Feature: Malformed
  Scenario: Bad table
    Given a malformed table
      | col1 | col2
      | val1 | val2 | val3 |
    Then something breaks
