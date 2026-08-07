
def add(x, y):
    """Return the sum of x and y"""
    return x + y

def subtract(x, y):
    """Return the difference of x and y"""
    return x - y

def multiply(x, y):
    """Return the product of x and y"""
    return x * y

def divide(x, y):
    """Return the quotient of x divided by y. Handle division by zero."""
    if y == 0:
        raise ValueError("Cannot divide by zero!")
    return x / y

def calculator():
    print("Basic Calculator")
    print("-----------------")

    # Get user input
    num1 = float(input("Enter first number: "))
    operator = input("Enter operator (+, -, *, /): ")
    num2 = float(input("Enter second number: "))

    try:
        if operator == "+":
            result = add(num1, num2)
        elif operator == "-":
            result = subtract(num1, num2)
        elif operator == "*":
            result = multiply(num1, num2)
        elif operator == "/":
            result = divide(num1, num2)
        else:
            raise ValueError("Invalid operator")

        print(f"Result: {result}")
    except ValueError as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    calculator()