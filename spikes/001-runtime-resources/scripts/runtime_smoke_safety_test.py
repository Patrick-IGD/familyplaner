import signal
import unittest

from runtime_smoke_safety import cleanup_actions, execute_cleanup, install_cleanup_handlers


class CleanupActionsTest(unittest.TestCase):
    def test_restores_each_service_to_its_initial_state(self):
        self.assertEqual(
            cleanup_actions({"web": None, "worker": "stopped", "db": "running"}),
            [("rm", "web"), ("stop", "worker"), ("start", "db")],
        )

    def test_rejects_an_unknown_initial_state(self):
        with self.assertRaisesRegex(ValueError, "invalid initial service state"):
            cleanup_actions({"db": "restarting"})

    def test_removes_an_entirely_new_compose_project(self):
        self.assertEqual(
            cleanup_actions({"web": None, "worker": None, "migrate": None, "db": None}),
            [("down", "")],
        )

    def test_new_project_cleanup_only_uses_compose_down_with_volumes(self):
        attempted = []

        from runtime_smoke_safety import cleanup_new_compose_project

        cleanup_new_compose_project(lambda action, service: attempted.append((action, service)) or True)

        self.assertEqual(attempted, [("down", "")])

    def test_cleanup_attempts_every_action_and_aggregates_failures(self):
        attempted = []

        def execute(action, service):
            attempted.append((action, service))
            return service != "db"

        with self.assertRaisesRegex(RuntimeError, "stop db"):
            execute_cleanup([("stop", "db"), ("rm", "web")], execute)

        self.assertEqual(attempted, [("stop", "db"), ("rm", "web")])


class CleanupHandlerTest(unittest.TestCase):
    def test_registers_exit_cleanup_and_turns_termination_into_system_exit(self):
        registered = []
        handlers = {}

        install_cleanup_handlers(
            lambda: registered.append("cleaned"),
            register_exit=lambda callback: registered.append(callback),
            set_signal=lambda number, callback: handlers.update({number: callback}),
        )

        self.assertTrue(callable(registered[0]))
        self.assertIn(signal.SIGTERM, handlers)
        self.assertIn(signal.SIGINT, handlers)
        with self.assertRaises(SystemExit):
            handlers[signal.SIGTERM](signal.SIGTERM, None)
        self.assertEqual(registered[1:], ["cleaned"])

    def test_signal_cleanup_failure_still_exits_nonzero(self):
        handlers = {}

        install_cleanup_handlers(
            lambda: (_ for _ in ()).throw(RuntimeError("down failed")),
            register_exit=lambda _callback: None,
            set_signal=lambda number, callback: handlers.update({number: callback}),
        )

        with self.assertRaises(SystemExit) as exit_error:
            handlers[signal.SIGINT](signal.SIGINT, None)

        self.assertNotEqual(exit_error.exception.code, 0)


if __name__ == "__main__":
    unittest.main()
