import requests
import json

SUPABASE_URL = "https://cyolmcowhfhymemmxgrn.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5b2xtY293aGZoeW1lbW14Z3JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMTcyNDgsImV4cCI6MjA5ODg5MzI0OH0.l-foX9J_ZhV7a-k8eUFLraZ1OQdDibXwani7c7yRXeE"

payload = {
    "method": "GET",
    "path": "/api/teste",
    "payload": {
        "source": "script-python",
        "status": "ok",
        "message": "requisição fictícia gravada"
    }
}

headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

url = f"{SUPABASE_URL}/rest/v1/simple_requests"
response = requests.post(url, headers=headers, json=payload, timeout=20)

print("Status:", response.status_code)
print(response.text)
