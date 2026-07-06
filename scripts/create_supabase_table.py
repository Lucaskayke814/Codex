import os
import subprocess
import sys
import shutil
from pathlib import Path

PROJECT_REF = "cyolmcowhfhymemmxgrn"
SUPABASE_CLI = shutil.which("supabase") or shutil.which("supabase.exe") or os.getenv("SUPABASE_CLI_PATH") or r"C:\Users\x21588131\AppData\Local\supabase-cli\supabase.exe"
SUPABASE_ACCESS_TOKEN = os.getenv("SUPABASE_ACCESS_TOKEN") or "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5b2xtY293aGZoeW1lbW14Z3JuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzMxNzI0OCwiZXhwIjoyMDk4ODkzMjQ4fQ.t8yL_N-9vGsvG4jW2KEWik4LPQAUx8HcnGI9hQZtCdQ"
TABLE_SQL = """
CREATE TABLE IF NOT EXISTS simple_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    method text NOT NULL,
    path text NOT NULL,
    payload jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
"""


def run_command(command):
    if command[0] == "supabase":
        if not SUPABASE_CLI or not Path(SUPABASE_CLI).exists():
            print("Supabase CLI não encontrado. Instale o CLI em https://supabase.com/docs/guides/cli e verifique o PATH.")
            sys.exit(1)
        command = [SUPABASE_CLI] + command[1:]
    env = os.environ.copy()
    env["SUPABASE_ACCESS_TOKEN"] = SUPABASE_ACCESS_TOKEN
    print(f"Executando: {' '.join(command)}")
    try:
        result = subprocess.run(command, check=True, env=env)
        return result.returncode
    except FileNotFoundError:
        print("Supabase CLI não encontrado. Instale o CLI em https://supabase.com/docs/guides/cli e verifique o PATH.")
        sys.exit(1)
    except subprocess.CalledProcessError as exc:
        print(f"Comando falhou com código {exc.returncode}:")
        sys.exit(exc.returncode)


def create_table():
    print("Criando tabela simple_requests no banco Supabase...")
    run_command(["supabase", "link", "--project-ref", PROJECT_REF])
    run_command(["supabase", "db", "query", TABLE_SQL])
    print("Tabela simple_requests criada com sucesso.")


def main():
    create_table()


if __name__ == "__main__":
    main()
