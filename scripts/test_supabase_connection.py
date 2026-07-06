import os
import subprocess
import sys
import requests

SUPABASE_URL = "https://cyolmcowhfhymemmxgrn.supabase.co"
PROJECT_REF = "cyolmcowhfhymemmxgrn"
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY") or "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5b2xtY293aGZoeW1lbW14Z3JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMTcyNDgsImV4cCI6MjA5ODg5MzI0OH0.l-foX9J_ZhV7a-k8eUFLraZ1OQdDibXwani7c7yRXeE"
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5b2xtY293aGZoeW1lbW14Z3JuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzMxNzI0OCwiZXhwIjoyMDk4ODkzMjQ4fQ.t8yL_N-9vGsvG4jW2KEWik4LPQAUx8HcnGI9hQZtCdQ"
SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY
SUPABASE_KEY_TYPE = "service_role" if SUPABASE_SERVICE_ROLE_KEY else "anon"


def run_command(command):
    print(f"Executando: {' '.join(command)}")
    result = subprocess.run(command, shell=False)
    if result.returncode != 0:
        raise RuntimeError(f"Comando falhou: {' '.join(command)}")


def test_supabase_cli():
    print("\n=== Teste do Supabase CLI ===")
    try:
        run_command(["supabase", "login"])
        run_command(["supabase", "init"])
        run_command(["supabase", "link", "--project-ref", PROJECT_REF])
        print("Supabase CLI executado com sucesso.")
    except FileNotFoundError:
        print("Supabase CLI não encontrado. Instale o CLI em https://supabase.com/docs/guides/cli e verifique o PATH.")
        sys.exit(1)
    except RuntimeError as exc:
        print(exc)
        sys.exit(1)


def test_public_endpoints():
    print("\n=== Teste de endpoint público Supabase ===")
    endpoints = [
        "/auth/v1/.well-known/openid-configuration",
        "/",
    ]
    for endpoint in endpoints:
        url = SUPABASE_URL.rstrip("/") + endpoint
        print(f"Requisitando: {url}")
        response = requests.get(url, timeout=15)
        print(f"Status: {response.status_code}")
        if response.headers.get("content-type", "").startswith("application/json"):
            print(response.json())
        else:
            print(response.text[:300])


def test_rest_api():
    print("\n=== Teste do endpoint REST Supabase ===")
    if not SUPABASE_KEY:
        print("Nenhuma chave Supabase encontrada. Defina SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_ANON_KEY no ambiente para testar o REST API.")
        return

    url = SUPABASE_URL.rstrip("/") + "/rest/v1/"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }
    print(f"Usando chave do tipo: {SUPABASE_KEY_TYPE}")
    print(f"Requisitando REST: {url}")
    response = requests.get(url, headers=headers, timeout=15)
    print(f"Status: {response.status_code}")
    print(response.text[:1000])


def main():
    print("Iniciando teste de conexão Supabase")
    test_public_endpoints()
    test_rest_api()
    print("\nSe quiser executar o CLI Supabase, certifique-se de estar logado e rode o script novamente.")


if __name__ == "__main__":
    main()
