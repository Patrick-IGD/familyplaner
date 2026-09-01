import atexit
import signal
from collections.abc import Callable


ServiceState = str | None


def cleanup_actions(initial_states: dict[str, ServiceState]) -> list[tuple[str, str]]:
    if all(state is None for state in initial_states.values()):
        return [("down", "")]

    actions: list[tuple[str, str]] = []
    for service, state in initial_states.items():
        if state is None:
            actions.append(("rm", service))
        elif state == "stopped":
            actions.append(("stop", service))
        elif state == "running":
            actions.append(("start", service))
        else:
            raise ValueError("invalid initial service state")
    return actions


def cleanup_new_compose_project(execute: Callable[[str, str], bool]) -> None:
    execute_cleanup([("down", "")], execute)


def execute_cleanup(
    actions: list[tuple[str, str]], execute: Callable[[str, str], bool]
) -> None:
    failures: list[str] = []
    for action, service in actions:
        if not execute(action, service):
            failures.append(" ".join(part for part in (action, service) if part))
    if failures:
        raise RuntimeError(f"cleanup action failed: {', '.join(failures)}")


def install_cleanup_handlers(
    cleanup: Callable[[], None],
    *,
    register_exit: Callable[[Callable[[], None]], object] = atexit.register,
    set_signal: Callable[..., object] = signal.signal,
) -> None:
    cleaned = False

    def cleanup_once() -> None:
        nonlocal cleaned
        if cleaned:
            return
        cleaned = True
        cleanup()

    register_exit(cleanup_once)

    def terminate(signum: int, _frame: object) -> None:
        try:
            cleanup_once()
        except Exception:
            raise SystemExit(1) from None
        raise SystemExit(128 + signum)

    set_signal(signal.SIGTERM, terminate)
    set_signal(signal.SIGINT, terminate)
