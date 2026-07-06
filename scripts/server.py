import json
import os
import threading
import time
import uuid
from datetime import date, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT_DIR / "data" / "expenses.json"
DATA_FILE.parent.mkdir(parents=True, exist_ok=True)


def load_env_file():
    env_path = ROOT_DIR / ".env"
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file()

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://cyolmcowhfhymemmxgrn.supabase.co")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))
POLL_INTERVAL_SECONDS = int(os.getenv("POLL_INTERVAL_SECONDS", "5"))


def load_local_expenses():
    if DATA_FILE.exists():
        try:
            return json.loads(DATA_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return []
    return []


def save_local_expenses(expenses):
    DATA_FILE.write_text(json.dumps(expenses, ensure_ascii=False, indent=2), encoding="utf-8")


def normalize_expense(payload):
    description = (payload.get("description") or "").strip()
    amount = payload.get("amount")
    category = (payload.get("category") or "").strip()
    expense_date = payload.get("expense_date") or date.today().isoformat()
    notes = (payload.get("notes") or "").strip()

    if not description or not category or not expense_date:
        raise ValueError("description, category and expense_date are required")

    try:
        amount_value = float(amount)
    except (TypeError, ValueError) as exc:
        raise ValueError("amount must be numeric") from exc

    if amount_value < 0:
        raise ValueError("amount must be greater than or equal to zero")

    return {
        "id": payload.get("id") or str(uuid.uuid4()),
        "description": description,
        "amount": round(amount_value, 2),
        "category": category,
        "expense_date": expense_date,
        "notes": notes,
        "created_at": payload.get("created_at") or datetime.utcnow().isoformat() + "Z",
    }


def supabase_request(method, path, payload=None):
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("Supabase credentials are not configured")

    url = f"{SUPABASE_URL.rstrip('/')}{path}"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Accept": "application/json",
        "Prefer": "return=representation",
    }
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(req, timeout=10) as response:
            body = response.read().decode("utf-8")
            if not body:
                return []
            return json.loads(body)
    except Exception as exc:  # pragma: no cover - runtime integration path
        raise RuntimeError(str(exc)) from exc


def fetch_expenses_from_supabase(user_id=None):
    try:
        query = "/rest/v1/expenses?select=*&order=created_at.desc"
        if user_id:
            query += f"&user_id=eq.{user_id}"
        return supabase_request("GET", query)
    except Exception:
        return []


class ExpenseHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def _send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send_json(200, {"status": "ok"})

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self._send_json(200, {"status": "ok"})
            return

        if parsed.path != "/api/expenses":
            self._send_json(404, {"error": "not found"})
            return

        user_id = parsed.query.split("user_id=")[-1].split("&")[0] if "user_id=" in parsed.query else None
        expenses = fetch_expenses_from_supabase(user_id=user_id)
        if not expenses:
            expenses = [item for item in load_local_expenses() if not user_id or item.get("user_id") == user_id]
        self._send_json(200, expenses)

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/api/expenses":
            self._send_json(404, {"error": "not found"})
            return

        length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(length).decode("utf-8")
        payload = json.loads(raw_body or "{}") if raw_body else {}

        try:
            expense = normalize_expense(payload)
            user_id = self.headers.get("X-User-Id") or (payload.get("user_id") or "")
            if user_id:
                expense["user_id"] = user_id
            else:
                raise ValueError("user_id is required")

            try:
                created = supabase_request("POST", "/rest/v1/expenses", [expense])
            except Exception:
                expenses = load_local_expenses()
                expenses.append(expense)
                save_local_expenses(expenses)
                created = expense
            self._send_json(201, created)
        except ValueError as exc:
            self._send_json(400, {"error": str(exc)})
        except Exception as exc:
            self._send_json(500, {"error": str(exc)})

    def do_DELETE(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/expenses/"):
            expense_id = parsed.path.split("/")[-1]
            user_id = parsed.query.split("user_id=")[-1].split("&")[0] if "user_id=" in parsed.query else None
            try:
                if user_id:
                    supabase_request("DELETE", f"/rest/v1/expenses?id=eq.{expense_id}&user_id=eq.{user_id}")
                else:
                    supabase_request("DELETE", f"/rest/v1/expenses?id=eq.{expense_id}")
            except Exception:
                expenses = load_local_expenses()
                expenses = [item for item in expenses if item.get("id") != expense_id and (not user_id or item.get("user_id") == user_id)]
                save_local_expenses(expenses)

            self._send_json(200, {"deleted": expense_id})
            return

        self._send_json(404, {"error": "not found"})


def run_server(host=API_HOST, port=API_PORT):
    server = ThreadingHTTPServer((host, port), ExpenseHandler)
    print(f"Expense API running at http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run_server()
