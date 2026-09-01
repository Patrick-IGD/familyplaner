import os
import re
from collections.abc import Callable
from pathlib import Path

_ALLOWED_ENVIRONMENT_KEYS = ("PATH", "XDG_RUNTIME_DIR")
_RUN_ID_PATTERN = re.compile(r"[0-9a-f]{16,64}")
_LABEL_KEY = "familyboard.restore.run"


def isolated_environment(
    source: dict[str, str], overrides: dict[str, str], docker_config: str
) -> dict[str, str]:
    environment = {key: source[key] for key in _ALLOWED_ENVIRONMENT_KEYS if source.get(key)}
    environment["DOCKER_CONFIG"] = docker_config
    environment.update(overrides)
    return environment


def restore_identity(run_id: str) -> tuple[str, str]:
    if _RUN_ID_PATTERN.fullmatch(run_id) is None:
        raise ValueError("invalid restore run id")
    return f"familyboard-restore-{run_id}", f"{_LABEL_KEY}={run_id}"


def restore_proof_key(run_id: str) -> str:
    if _RUN_ID_PATTERN.fullmatch(run_id) is None:
        raise ValueError("invalid restore run id")
    return f"backup-restore:proof:{run_id}"


def is_docker_not_found(error_output: str) -> bool:
    return bool(
        re.search(r"(?:No such object|No such container):", error_output, flags=re.IGNORECASE)
    )


def is_single_zero_count(output: str) -> bool:
    return output == "0"


def build_restore_run_arguments(name: str, label: str, env_file: str) -> list[str]:
    return [
        "docker",
        "run",
        "-d",
        "--name",
        name,
        "--label",
        label,
        "--memory",
        "256m",
        "--cpus",
        "0.75",
        "--pids-limit",
        "100",
        "--network",
        "familyboard-spike_backend",
        "--env-file",
        env_file,
        "postgres:17.9-alpine",
    ]


def is_owned_restore_container(labels: dict[str, str], run_id: str) -> bool:
    return labels.get(_LABEL_KEY) == run_id


def run_cleanup_tasks(tasks: list[tuple[str, Callable[[], None]]]) -> None:
    failures: list[str] = []
    for name, task in tasks:
        try:
            task()
        except Exception as error:
            failures.append(f"{name}: {error}")
    if failures:
        raise RuntimeError(f"cleanup failed: {', '.join(failures)}")


def write_private_docker_config(directory: Path) -> None:
    directory.mkdir(mode=0o700)
    path = directory / "config.json"
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", closefd=False) as handle:
            handle.write('{"currentContext":"default"}\n')
            handle.flush()
            os.fsync(handle.fileno())
    finally:
        os.close(descriptor)


def write_private_env_file(path: Path, values: dict[str, str]) -> None:
    for key, value in values.items():
        if not re.fullmatch(r"[A-Z][A-Z0-9_]*", key) or "\n" in value or "\r" in value:
            raise ValueError("invalid environment file value")
    content = "".join(f"{key}={value}\n" for key, value in values.items())
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", closefd=False) as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
    finally:
        os.close(descriptor)
