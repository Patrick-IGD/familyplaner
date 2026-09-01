import argparse
import json
import re
import subprocess
from collections import Counter
from pathlib import Path


REQUIRED_FIELDS = ("MemTotal", "MemAvailable", "SwapTotal", "SwapFree")
CONTAINER_NAME_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,127}")


def validate_container_names(names: list[str]) -> list[str]:
    if not names or len(set(names)) != len(names):
        raise ValueError("invalid container name")
    if any(CONTAINER_NAME_PATTERN.fullmatch(name) is None for name in names):
        raise ValueError("invalid container name")
    return names


def validate_measurement_coverage(
    requested: list[str], inspect_items: list[dict], stats_rows: list[dict]
) -> None:
    expected = Counter(requested)
    inspect_names = Counter(
        item.get("Name", "").removeprefix("/")
        for item in inspect_items
        if isinstance(item.get("Name"), str)
    )
    if inspect_names != expected:
        raise ValueError("inspect coverage mismatch")
    stats_names = Counter(
        item.get("Name", "")
        for item in stats_rows
        if isinstance(item.get("Name"), str)
    )
    if stats_names != expected:
        raise ValueError("stats coverage mismatch")


def parse_container_inspect(items: list[dict]) -> list[dict]:
    result = []
    for item in items:
        state = item.get("State", {})
        result.append(
            {
                "name": str(item.get("Name", "")).removeprefix("/"),
                "oom_killed": bool(state.get("OOMKilled")),
                "restart_count": int(item.get("RestartCount", 0)),
                "running": bool(state.get("Running")),
            }
        )
    return sorted(result, key=lambda item: item["name"])


def parse_meminfo(content: str) -> dict[str, int]:
    values: dict[str, int] = {}
    for line in content.splitlines():
        if ":" not in line:
            continue
        key, raw_value = line.split(":", 1)
        if key not in REQUIRED_FIELDS:
            continue
        parts = raw_value.split()
        if len(parts) != 2 or parts[1] != "kB":
            raise ValueError(f"invalid meminfo field: {key}")
        values[key] = int(parts[0]) * 1024

    missing = [key for key in REQUIRED_FIELDS if key not in values]
    if missing:
        raise ValueError(f"missing meminfo field: {missing[0]}")

    return {
        "memory_total_bytes": values["MemTotal"],
        "memory_available_bytes": values["MemAvailable"],
        "swap_total_bytes": values["SwapTotal"],
        "swap_used_bytes": values["SwapTotal"] - values["SwapFree"],
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Capture bounded NAS memory and Docker recovery metrics as JSON."
    )
    parser.add_argument(
        "containers",
        nargs="+",
        help="Exact Familyboard and existing PostgreSQL container names to inspect.",
    )
    arguments = parser.parse_args()
    try:
        container_names = validate_container_names(arguments.containers)
    except ValueError as error:
        parser.error(str(error))

    inspect = subprocess.run(
        ["docker", "inspect", *container_names],
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    stats = subprocess.run(
        [
            "docker",
            "stats",
            "--no-stream",
            "--format",
            "{{json .}}",
            *container_names,
        ],
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    inspect_items = json.loads(inspect.stdout)
    stats_rows = [json.loads(line) for line in stats.stdout.splitlines() if line.strip()]
    validate_measurement_coverage(container_names, inspect_items, stats_rows)
    report = {
        "status": "captured",
        "host": parse_meminfo(Path("/proc/meminfo").read_text(encoding="utf8")),
        "containers": parse_container_inspect(inspect_items),
        "stats": sorted(stats_rows, key=lambda item: item.get("Name", "")),
    }
    print(json.dumps(report, separators=(",", ":"), sort_keys=True))


if __name__ == "__main__":
    main()
