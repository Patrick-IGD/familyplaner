#!/usr/bin/env python3
import json
import os
import secrets
import subprocess
import tempfile
import time
from pathlib import Path

from restore_safety import isolated_environment, write_private_docker_config
from runtime_smoke_safety import cleanup_new_compose_project, install_cleanup_handlers

ROOT = Path(__file__).resolve().parents[1]
PASSWORD = os.environ.get("FAMILYBOARD_DB_PASSWORD")
if not PASSWORD:
    raise SystemExit("FAMILYBOARD_DB_PASSWORD is required")

BUSINESS_KEY = f"runtime-smoke:{secrets.token_hex(16)}"
COMPOSE_PROJECT_NAME = f"familyboard-smoke-{secrets.token_hex(8)}"
COMPOSE_SESSION = tempfile.TemporaryDirectory(prefix="familyboard-compose-")
COMPOSE_OVERRIDE = Path(COMPOSE_SESSION.name) / "compose.override.yaml"
COMPOSE_OVERRIDE.write_text("services:\n  web:\n    ports: !reset []\n", encoding="utf-8")
DOCKER_CONFIG_SESSION = tempfile.TemporaryDirectory(prefix="familyboard-docker-config-")
DOCKER_CONFIG_DIRECTORY = Path(DOCKER_CONFIG_SESSION.name) / "docker"
write_private_docker_config(DOCKER_CONFIG_DIRECTORY)
BASE_ENV = isolated_environment(
    dict(os.environ),
    {
        "FAMILYBOARD_DB_PASSWORD": PASSWORD,
        "FAMILYBOARD_AUTH_SECRET": os.environ.get("FAMILYBOARD_AUTH_SECRET")
        or secrets.token_urlsafe(32),
        "COMPOSE_PROJECT_NAME": COMPOSE_PROJECT_NAME,
        "COMPOSE_FILE": f"{ROOT / 'compose.yaml'}:{COMPOSE_OVERRIDE}",
        "SPIKE_CRASH_AFTER_EFFECT_KEY": BUSINESS_KEY,
    },
    str(DOCKER_CONFIG_DIRECTORY),
)


def run(
    *args: str,
    env: dict[str, str] | None = None,
    input_text: str | None = None,
) -> str:
    completed = subprocess.run(
        args,
        cwd=ROOT,
        env=env or BASE_ENV,
        check=True,
        text=True,
        input=input_text,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=90,
    )
    return completed.stdout.strip()


def fetch_status(path: str) -> tuple[int, dict[str, str]]:
    script = (
        "fetch(process.argv[1]).then(async response => "
        "console.log(JSON.stringify([response.status, await response.json()]))).catch(error => { "
        "console.error(error.message); process.exit(1); })"
    )
    output = run(
        "docker",
        "compose",
        "exec",
        "-T",
        "web",
        "node",
        "-e",
        script,
        f"http://127.0.0.1:3000{path}",
    )
    status, body = json.loads(output)
    return int(status), body


def wait_for_status(path: str, expected: int, attempts: int = 20) -> dict[str, str]:
    last: tuple[int, dict[str, str]] | None = None
    for _ in range(attempts):
        try:
            last = fetch_status(path)
            if last[0] == expected:
                return last[1]
        except (OSError, subprocess.CalledProcessError):
            pass
        time.sleep(0.5)
    raise AssertionError(f"{path} did not reach status {expected}; last={last}")


def effect_counts(key: str) -> tuple[int, int] | None:
    sql = (
        "select effect_count || ',' || attempt_count "
        "from probe_effect where business_key = :'business_key'"
    )
    output = run(
        "docker",
        "compose",
        "exec",
        "-T",
        "db",
        "psql",
        "-U",
        "familyboard",
        "-d",
        "familyboard",
        "-tA",
        "-v",
        f"business_key={key}",
        input_text=sql,
    )
    if not output:
        return None
    effect_count, attempt_count = output.split(",")
    return int(effect_count), int(attempt_count)


def wait_for_effect(key: str, attempts: int) -> tuple[int, int]:
    last = None
    for _ in range(240):
        last = effect_counts(key)
        if last == (1, attempts):
            return (1, attempts)
        time.sleep(0.5)
    raise AssertionError(f"effect counts did not reach (1, {attempts}); last={last}")


def submit(key: str, count: int) -> None:
    env = BASE_ENV | {"PROBE_BUSINESS_KEY": key, "PROBE_COUNT": str(count)}
    run("docker", "compose", "--profile", "tools", "run", "--rm", "submit", env=env)


def service_container(service: str) -> str:
    container_id = run("docker", "compose", "ps", "-q", service)
    if not container_id:
        raise AssertionError(f"missing container for service: {service}")
    return container_id


def inspect(container: str, template: str) -> str:
    return run("docker", "inspect", container, "--format", template)


cleanup_started = False


def execute_cleanup_action(action: str, service: str) -> bool:
    if (action, service) != ("down", ""):
        raise AssertionError("new compose project cleanup must only run compose down")
    try:
        run("docker", "compose", "down", "--volumes", "--remove-orphans")
        return True
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return False


def cleanup_project() -> None:
    global cleanup_started
    if cleanup_started:
        return
    cleanup_started = True
    cleanup_new_compose_project(execute_cleanup_action)


install_cleanup_handlers(cleanup_project)


run("docker", "compose", "up", "-d", "--wait", "web", "worker")
wait_for_status("/health/live", 200)
wait_for_status("/health/ready", 200)

web = service_container("web")
worker = service_container("worker")
web_image = inspect(web, "{{.Image}}")
worker_image = inspect(worker, "{{.Image}}")
assert web_image == worker_image, "web and worker use different image digests"
assert inspect(web, "{{.Config.User}}") == "10001:10001"
assert inspect(worker, "{{.Config.User}}") == "10001:10001"

business_key = BUSINESS_KEY
run(
    "docker",
    "compose",
    "exec",
    "-T",
    "db",
    "psql",
    "-U",
    "familyboard",
    "-d",
    "familyboard",
    "-v",
    f"business_key={business_key}",
    input_text="delete from probe_effect where business_key = :'business_key'",
)
restart_count_before = int(inspect(worker, "{{.RestartCount}}"))
submit(business_key, 1)

for _ in range(60):
    if int(inspect(worker, "{{.RestartCount}}")) > restart_count_before:
        break
    time.sleep(0.5)
else:
    raise AssertionError("worker did not crash and restart after the persisted effect")

logs = run("docker", "compose", "logs", "--since", "90s", "worker")
if '"event":"injected_worker_crash"' not in logs:
    raise AssertionError("worker restart was not caused by the post-effect crash boundary")

wait_for_effect(business_key, 2)
submit(business_key, 1)
final_counts = wait_for_effect(business_key, 3)

run("docker", "compose", "stop", "db")
assert fetch_status("/health/live") == (200, {"status": "ok"})
assert fetch_status("/health/ready") == (503, {"status": "unavailable"})
run("docker", "compose", "up", "-d", "--wait", "db")
wait_for_status("/health/ready", 200)

stats = []
for container in [service_container("db"), web, worker]:
    stats.append(
        json.loads(
            run(
                "docker",
                "stats",
                "--no-stream",
                "--format",
                "{{json .}}",
                container,
            )
        )
    )

cleanup_project()

print(
    json.dumps(
        {
            "status": "passed",
            "same_image": True,
            "non_root": True,
            "effect_count": final_counts[0],
            "attempt_count": final_counts[1],
            "worker_crash_retry_detected": True,
            "db_outage_detected": True,
            "stats": stats,
        },
        separators=(",", ":"),
    )
)
