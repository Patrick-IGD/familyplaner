#!/usr/bin/env python3
import json
import os
import secrets
import subprocess
import tempfile
import time
from pathlib import Path
from urllib.parse import quote

from restore_safety import (
    build_restore_run_arguments,
    isolated_environment,
    is_docker_not_found,
    is_owned_restore_container,
    is_single_zero_count,
    restore_identity,
    restore_proof_key,
    run_cleanup_tasks,
    write_private_docker_config,
    write_private_env_file,
)

from runtime_smoke_safety import install_cleanup_handlers

ROOT = Path(__file__).resolve().parents[1]
PASSWORD = os.environ.get("FAMILYBOARD_DB_PASSWORD")
if not PASSWORD:
    raise SystemExit("FAMILYBOARD_DB_PASSWORD is required")

RUN_ID = secrets.token_hex(8)
RESTORE_CONTAINER, RESTORE_LABEL = restore_identity(RUN_ID)
PROOF_KEY = restore_proof_key(RUN_ID)
DOCKER_CONFIG_SESSION = tempfile.TemporaryDirectory(prefix="familyboard-docker-config-")
DOCKER_CONFIG_DIRECTORY = Path(DOCKER_CONFIG_SESSION.name) / "docker"
write_private_docker_config(DOCKER_CONFIG_DIRECTORY)
ENV = isolated_environment(
    dict(os.environ),
    {
        "FAMILYBOARD_DB_PASSWORD": PASSWORD,
        "FAMILYBOARD_AUTH_SECRET": os.environ.get("FAMILYBOARD_AUTH_SECRET")
        or secrets.token_urlsafe(32),
    },
    str(DOCKER_CONFIG_DIRECTORY),
)


def run(
    *args: str,
    text: bool = True,
    input_data: str | bytes | None = None,
    check: bool = True,
) -> subprocess.CompletedProcess:
    return subprocess.run(
        args,
        cwd=ROOT,
        env=ENV,
        check=check,
        text=text,
        input=input_data,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def compose_psql(sql: str, *psql_arguments: str) -> str:
    result = run(
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
        *psql_arguments,
        text=True,
        input_data=sql,
    )
    return result.stdout.strip()


cleanup_started = False


def cleanup_owned_restore_container() -> None:
    inspected = run(
        "docker",
        "inspect",
        RESTORE_CONTAINER,
        "--format",
        "{{json .Config.Labels}}",
        check=False,
    )
    if inspected.returncode != 0:
        if is_docker_not_found(f"{inspected.stdout}\n{inspected.stderr}"):
            return
        raise AssertionError(
            f"restore container inspection failed: {inspected.stderr.strip()}"
        )
    try:
        labels = json.loads(inspected.stdout)
    except json.JSONDecodeError as error:
        raise AssertionError("restore container identity is unreadable") from error
    if not isinstance(labels, dict) or not is_owned_restore_container(labels, RUN_ID):
        raise AssertionError("refusing to remove a container not owned by this restore run")
    run("docker", "rm", "-f", RESTORE_CONTAINER)


def remove_source_proof() -> None:
    remaining = compose_psql(
        "delete from probe_effect where business_key = :'proof_key'; "
        "select count(*) from probe_effect where business_key = :'proof_key';",
        "-q",
        "-v",
        f"proof_key={PROOF_KEY}",
    )
    if not is_single_zero_count(remaining):
        raise AssertionError("source proof row was not removed")


def cleanup() -> None:
    global cleanup_started
    if cleanup_started:
        return
    cleanup_started = True
    run_cleanup_tasks(
        [
            ("restore container", cleanup_owned_restore_container),
            ("source proof", remove_source_proof),
        ]
    )


install_cleanup_handlers(cleanup)


def restore_dump(dump_bytes: bytes) -> None:
    dropped = run(
        "docker",
        "exec",
        RESTORE_CONTAINER,
        "dropdb",
        "-U",
        "postgres",
        "--if-exists",
        "--force",
        "familyboard_restore",
        text=False,
        check=False,
    )
    if dropped.returncode != 0:
        raise AssertionError("restore database reset failed")
    created = run(
        "docker",
        "exec",
        RESTORE_CONTAINER,
        "createdb",
        "-U",
        "postgres",
        "familyboard_restore",
        text=False,
        check=False,
    )
    if created.returncode != 0:
        raise AssertionError("restore database reset failed")
    restored = run(
        "docker",
        "exec",
        "-i",
        RESTORE_CONTAINER,
        "pg_restore",
        "-U",
        "postgres",
        "-d",
        "familyboard_restore",
        "--no-owner",
        "--no-privileges",
        text=False,
        input_data=dump_bytes,
        check=False,
    )
    if restored.returncode != 0:
        raise AssertionError("restore failed")


def run_migration(env_file: Path) -> None:
    migrated = run(
        "docker",
        "run",
        "--rm",
        "--network",
        "familyboard-spike_backend",
        "--env-file",
        str(env_file),
        "familyboard-spike:local",
        "node",
        "dist/migrate.js",
        check=False,
    )
    if migrated.returncode != 0:
        raise AssertionError("restored migration check failed")


compose_psql(
    "insert into probe_effect (business_key) values (:'proof_key') "
    "on conflict (business_key) do nothing;",
    "-v",
    f"proof_key={PROOF_KEY}",
)

with tempfile.TemporaryDirectory(prefix="familyboard-restore-") as temporary_directory:
    private_directory = Path(temporary_directory)
    dump_path = private_directory / "familyboard.dump"
    postgres_env_path = private_directory / "postgres.env"
    migration_env_path = private_directory / "migration.env"
    write_private_env_file(
        postgres_env_path,
        {"POSTGRES_PASSWORD": PASSWORD, "POSTGRES_DB": "familyboard_restore"},
    )
    encoded_password = quote(PASSWORD, safe="")
    write_private_env_file(
        migration_env_path,
        {
            "FAMILYBOARD_DATABASE_URL": (
                f"postgresql://postgres:{encoded_password}@{RESTORE_CONTAINER}:5432/familyboard_restore"
            ),
            "FAMILYBOARD_APP_ORIGIN": "http://localhost:3300",
            "FAMILYBOARD_ROLE": "worker",
            "FAMILYBOARD_LOG_LEVEL": "info",
        },
    )

    dump = run(
        "docker",
        "compose",
        "exec",
        "-T",
        "db",
        "pg_dump",
        "-U",
        "familyboard",
        "-d",
        "familyboard",
        "--format=custom",
        text=False,
    )
    dump_path.write_bytes(dump.stdout)
    if dump_path.stat().st_size == 0:
        raise AssertionError("database dump is empty")

    try:
        run(*build_restore_run_arguments(RESTORE_CONTAINER, RESTORE_LABEL, str(postgres_env_path)))

        for _ in range(30):
            ready = run(
                "docker",
                "exec",
                RESTORE_CONTAINER,
                "psql",
                "-U",
                "postgres",
                "-d",
                "familyboard_restore",
                "-tAc",
                "select 1",
                check=False,
            )
            if ready.returncode == 0:
                break
            time.sleep(0.5)
        else:
            raise AssertionError("restore database did not become ready")

        dump_bytes = dump_path.read_bytes()
        restore_dump(dump_bytes)
        restore_dump(dump_bytes)
        run_migration(migration_env_path)
        run_migration(migration_env_path)

        verification_sql = (
            "select "
            "(select count(*) from familyboard_migration where migration_id in ('0001-probe-effect', '0002-better-auth-passkey')) || ',' || "
            "(select effect_count from probe_effect where business_key = :'proof_key') || ',' || "
            "(select count(*) from information_schema.tables where table_schema = 'pgboss') || ',' || "
            "(select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'passkey');"
        )
        verification = run(
            "docker",
            "exec",
            "-i",
            RESTORE_CONTAINER,
            "psql",
            "-U",
            "postgres",
            "-d",
            "familyboard_restore",
            "-tA",
            "-v",
            f"proof_key={PROOF_KEY}",
            text=True,
            input_data=verification_sql,
        ).stdout.strip()
        migration_count, effect_count, queue_table_count, passkey_table_count = map(
            int, verification.split(",")
        )
        if (
            migration_count != 2
            or effect_count != 1
            or queue_table_count < 1
            or passkey_table_count != 1
        ):
            raise AssertionError("restored semantic invariants are incomplete")

        print(
            json.dumps(
                {
                    "status": "passed",
                    "dump_bytes": dump_path.stat().st_size,
                    "restore_runs": 2,
                    "migration_runs": 2,
                    "migration_marker": migration_count,
                    "effect_count": effect_count,
                    "queue_tables": queue_table_count,
                    "passkey_table": passkey_table_count,
                },
                separators=(",", ":"),
            )
        )
    finally:
        cleanup()
