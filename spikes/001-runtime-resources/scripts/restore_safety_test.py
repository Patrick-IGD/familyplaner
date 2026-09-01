import os
import tempfile
import unittest
from pathlib import Path

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


class RestoreSafetyTest(unittest.TestCase):
    def test_strips_compose_and_docker_context_controls_from_child_environment(self):
        result = isolated_environment(
            {
                "PATH": "/usr/bin",
                "HOME": "/home/test",
                "XDG_RUNTIME_DIR": "/run/user/1000",
                "COMPOSE_FILE": "/tmp/hostile.yaml",
                "COMPOSE_PROJECT_NAME": "other-project",
                "DOCKER_HOST": "tcp://untrusted:2375",
                "DOCKER_CONTEXT": "remote",
            },
            {"FAMILYBOARD_DB_PASSWORD": "synthetic"},
            "/private/docker-config",
        )

        self.assertEqual(
            result,
            {
                "PATH": "/usr/bin",
                "XDG_RUNTIME_DIR": "/run/user/1000",
                "DOCKER_CONFIG": "/private/docker-config",
                "FAMILYBOARD_DB_PASSWORD": "synthetic",
            },
        )

    def test_builds_unique_labeled_container_without_secret_cli_argument(self):
        name, label = restore_identity("0123456789abcdef")
        arguments = build_restore_run_arguments(name, label, "/private/restore.env")

        self.assertEqual(name, "familyboard-restore-0123456789abcdef")
        self.assertIn("familyboard.restore.run=0123456789abcdef", arguments)
        network_index = arguments.index("--network")
        self.assertEqual(arguments[network_index + 1], "familyboard-spike_backend")
        self.assertIn("--env-file", arguments)
        self.assertIn("/private/restore.env", arguments)
        self.assertFalse(any("password" in value.lower() for value in arguments))

    def test_derives_a_run_specific_proof_key(self):
        self.assertEqual(
            restore_proof_key("0123456789abcdef"),
            "backup-restore:proof:0123456789abcdef",
        )

    def test_only_recognizes_explicit_docker_not_found_errors(self):
        self.assertTrue(is_docker_not_found("Error: No such object: restore-run"))
        self.assertTrue(is_docker_not_found("Error response from daemon: No such container: restore-run"))
        self.assertFalse(is_docker_not_found("permission denied while trying to connect to the Docker daemon"))
        self.assertFalse(is_docker_not_found("context deadline exceeded"))

    def test_only_accepts_a_quiet_single_zero_count_for_source_cleanup(self):
        self.assertTrue(is_single_zero_count("0"))
        self.assertFalse(is_single_zero_count("DELETE 1\n0"))
        self.assertFalse(is_single_zero_count("1"))

    def test_cleanup_runs_every_owned_task_and_aggregates_failures(self):
        attempted = []

        def remove_restore():
            attempted.append("restore")
            raise RuntimeError("restore removal failed")

        def remove_source_proof():
            attempted.append("source")

        with self.assertRaisesRegex(RuntimeError, "restore"):
            run_cleanup_tasks(
                [("restore", remove_restore), ("source", remove_source_proof)]
            )

        self.assertEqual(attempted, ["restore", "source"])

    def test_cleanup_requires_exact_run_label(self):
        self.assertTrue(
            is_owned_restore_container(
                {"familyboard.restore.run": "0123456789abcdef"}, "0123456789abcdef"
            )
        )
        self.assertFalse(
            is_owned_restore_container(
                {"familyboard.restore.run": "someone-else"}, "0123456789abcdef"
            )
        )

    def test_writes_isolated_default_docker_context(self):
        with tempfile.TemporaryDirectory() as directory:
            config_directory = Path(directory) / "docker"
            write_private_docker_config(config_directory)

            config_path = config_directory / "config.json"
            self.assertEqual(config_path.stat().st_mode & 0o777, 0o600)
            self.assertEqual(config_path.read_text(encoding="utf-8"), '{"currentContext":"default"}\n')

    def test_writes_secret_environment_file_with_owner_only_permissions(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "restore.env"
            write_private_env_file(path, {"POSTGRES_PASSWORD": "synthetic"})

            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            self.assertEqual(path.read_text(encoding="utf-8"), "POSTGRES_PASSWORD=synthetic\n")


if __name__ == "__main__":
    unittest.main()
