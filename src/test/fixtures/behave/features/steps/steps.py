from behave import given, when, then

@given('I have a safe execution environment')
def step_impl(context):
    pass

@when('I run a scenario with malicious characters like $(rm -rf /)')
def step_impl(context):
    pass

@then('it should execute safely')
def step_impl(context):
    pass
