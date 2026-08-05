Feature: Login
  Scenario: Valid login
    Given the user is on the login page
    When they enter valid credentials
    Then they should be logged in
