Feature: Account Withdrawal

  Scenario: Account has sufficient funds
    Given the account balance is $100
    And the card is valid
    When the user requests $20
    Then the ATM should dispense $20
    And the account balance should be $80
    And ddsdsds
    And dsds
    And dskdskds
