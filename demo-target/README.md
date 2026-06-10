# Demo Target Service

Intentionally buggy microservice used to demonstrate the Autonomic Sentinel.

## Bugs

| Endpoint | Bug | Trigger |
|----------|-----|---------|
| `GET /discount?price=100&quantity=0` | ZeroDivisionError | `quantity=0` |
| `GET /user-age/2` | KeyError: 'birthdate' | User without birthdate |
| `POST /payment` with negative amount | No input validation | `amount=-999` |
| `GET /search?query=...` | SQL injection pattern | Any query with special chars |

## Run

```bash
pip install fastapi uvicorn
uvicorn app:app --port 8001 --reload
```
