"""
Demo Target Service - Intentionally buggy microservice for the Autonomic Sentinel demo.

Bugs present:
1. calculate_discount: Division by zero when quantity is 0
2. get_user_age: KeyError when 'birthdate' key missing from user dict
3. process_payment: No validation — negative amounts accepted
4. search_products: SQL injection vulnerability (string formatting)
"""

from fastapi import FastAPI

app = FastAPI(title="E-Commerce Service (Demo Target)")

# --- Bug 1: Division by zero ---
@app.get("/discount")
def calculate_discount(price: float, quantity: int):
    # BUG: ZeroDivisionError when quantity=0
    average = price / quantity
    discount = average * 0.1
    return {"discount": discount, "average_price": average}


# --- Bug 2: Missing key handling ---
@app.get("/user-age/{user_id}")
def get_user_age(user_id: int):
    users = {
        1: {"name": "Alice", "birthdate": "1990-05-15"},
        2: {"name": "Bob"},  # BUG: missing 'birthdate' key
    }
    user = users.get(user_id, {})
    # BUG: KeyError when user has no 'birthdate'
    age = 2024 - int(user["birthdate"].split("-")[0])
    return {"user_id": user_id, "age": age}


# --- Bug 3: Missing input validation ---
@app.post("/payment")
def process_payment(amount: float, card_number: str):
    # BUG: negative amounts are accepted and "processed"
    if len(card_number) != 16:
        return {"error": "Invalid card number"}
    return {
        "status": "approved",
        "amount_charged": amount,
        "message": f"Charged ${amount} successfully",
    }


# --- Bug 4: Potential injection ---
@app.get("/search")
def search_products(query: str):
    # BUG: simulated unsafe query construction
    raw_query = f"SELECT * FROM products WHERE name LIKE '%{query}%'"
    # (not actually executing, just demonstrating the pattern)
    return {"query_executed": raw_query, "results": []}


@app.get("/health")
def health():
    return {"status": "ok"}
