from behave import given
@given("I have {count} items")
def step_impl1(context, count): pass

@given("I have 5 items")
def step_impl2(context): pass
