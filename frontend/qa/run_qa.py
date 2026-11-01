"""Run the Robot Framework QA suite against a throwaway DiplomTrack stack.

    python frontend/qa/run_qa.py                      # headless Chrome
    python frontend/qa/run_qa.py --browser edge --headed
    python frontend/qa/run_qa.py --include smoke      # extra args go to robot

It creates a fresh SQLite database in a temp folder, runs init_db.py, starts
the Flask API and the Vite dev server on their own ports (so a running dev
setup is not touched), runs `robot`, then stops both servers.

Use --base-url/--api-url to test an already running stack instead; the
database must then be fresh, because the suite seeds its own accounts.

Run it with a Python that has backend/requirements.txt and
frontend/qa/requirements.txt installed.
"""

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

QA_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = QA_DIR.parent
BACKEND_DIR = FRONTEND_DIR.parent / "backend"
ADMIN_PASSWORD = "QaAdmin-2026!"  # must match qa/resources/variables.resource


def wait_for(url, name, process=None, timeout=90):
    """Poll until `url` answers (any HTTP status counts as up)."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        if process is not None and process.poll() is not None:
            sys.exit(f"{name} exited early with code {process.returncode}; see the log above")
        try:
            urllib.request.urlopen(url, timeout=2)
            return
        except urllib.error.HTTPError:
            return
        except OSError:
            time.sleep(0.5)
    sys.exit(f"{name} did not answer at {url} within {timeout}s")


def stop(process):
    if process is None or process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()


def start_stack(args, workdir):
    env = {
        **os.environ,
        "FLASK_ENV": "development",
        "JWT_SECRET_KEY": "qa-only-secret",
        "DATABASE_TYPE": "url",  # anything but "sqlite" makes config.py read DATABASE_URL
        "DATABASE_URL": f"sqlite:///{(workdir / 'qa.db').as_posix()}",
        "ADMIN_PASSWORD": ADMIN_PASSWORD,
        "ENABLE_SCHEDULER": "false",
        "USE_MINIO": "false",
        "MAIL_SUPPRESS_SEND": "true",
        # init_db.py prints emoji; Windows' default cp1252 crashes on them when piped
        "PYTHONUTF8": "1",
    }

    print(f"[qa] database: {env['DATABASE_URL']}")
    subprocess.run([args.python, "init_db.py"], cwd=BACKEND_DIR, env=env, check=True,
                   stdout=subprocess.DEVNULL)

    backend = subprocess.Popen(
        [args.python, "-m", "flask", "--app", "wsgi:app", "run",
         "--host", "127.0.0.1", "--port", str(args.api_port)],
        cwd=BACKEND_DIR, env=env,
    )
    api_url = f"http://127.0.0.1:{args.api_port}/api"
    wait_for(f"{api_url}/milestones", "Flask API", backend)

    node = shutil.which("node")
    if not node:
        stop(backend)
        sys.exit("node is not on PATH")
    frontend = subprocess.Popen(
        [node, "node_modules/vite/bin/vite.js", "--host", "127.0.0.1",
         "--port", str(args.web_port), "--strictPort"],
        cwd=FRONTEND_DIR,
        env={**os.environ, "VITE_API_URL": "/api", "VITE_API_PROXY_TARGET": f"http://127.0.0.1:{args.api_port}"},
    )
    base_url = f"http://127.0.0.1:{args.web_port}"
    try:
        wait_for(base_url, "Vite dev server", frontend)
    except SystemExit:
        stop(backend)
        raise
    return backend, frontend, base_url, api_url


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--browser", default=os.getenv("QA_BROWSER", "chrome"), help="chrome, edge or firefox")
    parser.add_argument("--headed", action="store_true", help="show the browser window")
    parser.add_argument("--python", default=sys.executable, help="Python with the backend requirements")
    parser.add_argument("--api-port", type=int, default=5055)
    parser.add_argument("--web-port", type=int, default=8095)
    parser.add_argument("--base-url", help="use a running SPA instead of starting one")
    parser.add_argument("--api-url", help="API URL of that running stack (needed for seeding)")
    parser.add_argument("--outputdir", default=str(QA_DIR / "results"))
    args, robot_args = parser.parse_known_args()

    backend = frontend = None
    workdir = Path(tempfile.mkdtemp(prefix="diplomtrack-qa-"))
    try:
        if args.base_url:
            if not args.api_url:
                parser.error("--base-url needs --api-url")
            base_url, api_url = args.base_url.rstrip("/"), args.api_url.rstrip("/")
        else:
            backend, frontend, base_url, api_url = start_stack(args, workdir)

        command = [
            sys.executable, "-m", "robot",
            "--outputdir", args.outputdir,
            "--variable", f"BASE_URL:{base_url}",
            "--variable", f"API_URL:{api_url}",
            "--variable", f"BROWSER:{args.browser}",
            "--variable", f"HEADLESS:{not args.headed}",
            "--variable", f"ADMIN_PASSWORD:{ADMIN_PASSWORD}",
            *robot_args,
            str(QA_DIR / "tests"),
        ]
        print("[qa]", " ".join(command))
        return subprocess.run(command).returncode
    finally:
        stop(frontend)
        stop(backend)
        shutil.rmtree(workdir, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
