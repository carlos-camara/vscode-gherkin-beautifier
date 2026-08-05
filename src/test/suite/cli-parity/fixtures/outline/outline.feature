Feature: Outline
  Scenario Outline: Data driven
    Given <setup>
    When <action>
    Then <result>

    Examples:
      | setup | action | result |
      | A     | B      | C      |
