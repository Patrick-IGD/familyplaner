import argparse
import json
import re
import subprocess
import time
from pathlib import Path
from urllib.parse import urlsplit


def validate_origin(value: str) -> str:
    try:
        parsed = urlsplit(value)
        valid = (
            parsed.scheme == "https"
            and parsed.hostname is not None
            and parsed.hostname.endswith(".ts.net")
            and parsed.username is None
            and parsed.password is None
            and parsed.port is None
            and parsed.path == ""
            and parsed.query == ""
            and parsed.fragment == ""
        )
    except ValueError:
        valid = False
    if not valid:
        raise ValueError("invalid kiosk origin")
    return value


def validate_service_name(value: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.@-]*\.service", value):
        raise ValueError("invalid kiosk service")
    return value


def systemctl_command(action: str, service: str, *options: str) -> list[str]:
    return ["systemctl", "--user", action, *options, "--", validate_service_name(service)]


def read_service_process(service: str, proc_root: Path = Path("/proc")) -> list[str] | None:
    identity = subprocess.run(
        systemctl_command(
            "show", service, "--property=MainPID", "--property=ControlGroup"
        ),
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    if identity.returncode != 0:
        return None
    properties = dict(
        line.split("=", 1) for line in identity.stdout.splitlines() if "=" in line
    )
    try:
        pid = int(properties["MainPID"])
        control_group = properties["ControlGroup"]
    except (KeyError, ValueError):
        return None
    if pid <= 0 or not control_group.startswith("/"):
        return None
    process_directory = proc_root / str(pid)
    try:
        process_control_groups = {
            line.split(":", 2)[2]
            for line in (process_directory / "cgroup").read_text(
                encoding="utf8"
            ).splitlines()
            if line.count(":") >= 2
        }
        if control_group not in process_control_groups:
            return None
        return (
            (process_directory / "cmdline")
            .read_bytes()
            .decode("utf8")
            .rstrip("\0")
            .split("\0")
        )
    except (FileNotFoundError, PermissionError, UnicodeDecodeError):
        return None


def build_kiosk_command(executable: str, origin: str, runtime_directory: str) -> list[str]:
    validated_origin = validate_origin(origin)
    if not re.fullmatch(r"/run/user/[0-9]+/familyboard-kiosk", runtime_directory):
        raise ValueError("invalid kiosk runtime directory")
    return [
        executable,
        "--kiosk",
        "--no-first-run",
        "--disable-session-crashed-bubble",
        "--disable-features=Translate",
        "--overscroll-history-navigation=0",
        f"--user-data-dir={runtime_directory}/profile",
        validated_origin,
    ]


def is_safe_kiosk_command(arguments: list[str], origin: str) -> bool:
    if len(arguments) != 8:
        return False
    executable = Path(arguments[0])
    if not executable.is_absolute() or executable.name not in {"chromium", "chromium-browser"}:
        return False
    profile_prefix = "--user-data-dir="
    if not arguments[6].startswith(profile_prefix):
        return False
    profile = arguments[6].removeprefix(profile_prefix)
    if not re.fullmatch(r"/run/user/[0-9]+/familyboard-kiosk/profile", profile):
        return False
    runtime_directory = str(Path(profile).parent)
    try:
        expected = build_kiosk_command(arguments[0], origin, runtime_directory)
    except ValueError:
        return False
    return arguments == expected


def main() -> None:
    parser = argparse.ArgumentParser(description="Restart and verify the Pi Chromium kiosk service.")
    parser.add_argument("origin", help="Exact HTTPS Tailscale origin ending in .ts.net")
    parser.add_argument("--service", default="familyboard-kiosk.service")
    parser.add_argument("--timeout", type=float, default=30.0)
    arguments = parser.parse_args()

    origin = validate_origin(arguments.origin)
    try:
        service = validate_service_name(arguments.service)
    except ValueError as error:
        raise SystemExit(str(error)) from error
    if arguments.timeout <= 0 or arguments.timeout > 120:
        raise SystemExit("invalid kiosk timeout")

    enabled = subprocess.run(
        systemctl_command("is-enabled", service),
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    if enabled.returncode != 0 or enabled.stdout.strip() != "enabled":
        raise SystemExit("kiosk service is not enabled")

    subprocess.run(
        systemctl_command("restart", service),
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    started = time.monotonic()
    safe_command_found = False
    while time.monotonic() - started < arguments.timeout:
        active = subprocess.run(
            systemctl_command("is-active", service),
            check=False,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )
        if active.stdout.strip() == "active":
            command = read_service_process(service)
            safe_command_found = command is not None and is_safe_kiosk_command(
                command, origin
            )
        if safe_command_found:
            break
        time.sleep(0.25)

    if not safe_command_found:
        raise SystemExit("kiosk did not recover safely")
    elapsed = round(time.monotonic() - started, 3)
    print(
        json.dumps(
            {
                "status": "passed",
                "origin": origin,
                "recovery_seconds": elapsed,
                "service": arguments.service,
                "ephemeral_profile": True,
            },
            separators=(",", ":"),
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
