from behave import given
@given("a duplicated step")
def step_impl1(context): pass

@given("a duplicated step")
def step_impl2(context): pass
