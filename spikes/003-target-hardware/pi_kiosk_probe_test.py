import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from pi_kiosk_probe import (
    build_kiosk_command,
    is_safe_kiosk_command,
    read_service_process,
    systemctl_command,
    validate_origin,
    validate_service_name,
)


class ValidateOriginTest(unittest.TestCase):
    def test_accepts_https_tailscale_origin(self):
        self.assertEqual(
            validate_origin("https://familyboard.example-tailnet.ts.net"),
            "https://familyboard.example-tailnet.ts.net",
        )

    def test_rejects_plain_http_remote_origin(self):
        with self.assertRaisesRegex(ValueError, "invalid kiosk origin"):
            validate_origin("http://familyboard.example-tailnet.ts.net")


class KioskCommandTest(unittest.TestCase):
    def test_builds_fullscreen_command_with_ephemeral_runtime_profile(self):
        origin = "https://familyboard.example-tailnet.ts.net"
        command = build_kiosk_command(
            "/usr/bin/chromium", origin, "/run/user/1000/familyboard-kiosk"
        )

        self.assertEqual(command[0], "/usr/bin/chromium")
        self.assertIn("--kiosk", command)
        self.assertIn("--no-first-run", command)
        self.assertIn("--disable-session-crashed-bubble", command)
        self.assertIn(
            "--user-data-dir=/run/user/1000/familyboard-kiosk/profile", command
        )
        self.assertEqual(command[-1], origin)

    def test_requires_kiosk_mode_exact_origin_and_ephemeral_profile(self):
        origin = "https://familyboard.example-tailnet.ts.net"
        command = build_kiosk_command(
            "/usr/bin/chromium", origin, "/run/user/1000/familyboard-kiosk"
        )
        self.assertTrue(
            is_safe_kiosk_command(command, origin)
        )
        self.assertFalse(
            is_safe_kiosk_command(
                [
                    "/usr/bin/chromium",
                    "--kiosk",
                    "--user-data-dir=/home/pi/.config/chromium",
                    "https://familyboard.example-tailnet.ts.net",
                ],
                "https://familyboard.example-tailnet.ts.net",
            )
        )

    def test_rejects_every_additional_chromium_flag_fail_closed(self):
        origin = "https://familyboard.example-tailnet.ts.net"
        command = build_kiosk_command(
            "/usr/bin/chromium", origin, "/run/user/1000/familyboard-kiosk"
        )

        self.assertFalse(
            is_safe_kiosk_command(command[:-1] + ["--no-sandbox", origin], origin)
        )


class SystemdUserUnitTest(unittest.TestCase):
    def test_rejects_service_name_starting_with_option_character(self):
        with self.assertRaisesRegex(ValueError, "invalid kiosk service"):
            validate_service_name("--evil.service")

    def test_builds_user_manager_command_with_option_terminator(self):
        self.assertEqual(
            systemctl_command("restart", "familyboard-kiosk.service"),
            [
                "systemctl",
                "--user",
                "restart",
                "--",
                "familyboard-kiosk.service",
            ],
        )

    def test_reads_only_main_pid_owned_by_restarted_unit_control_group(self):
        with TemporaryDirectory() as temporary_directory:
            proc_root = Path(temporary_directory)
            process_directory = proc_root / "4242"
            process_directory.mkdir()
            (process_directory / "cmdline").write_bytes(
                b"/usr/bin/chromium\0--kiosk\0"
            )
            (process_directory / "cgroup").write_text(
                "0::/user.slice/user-1000.slice/familyboard-kiosk.service\n",
                encoding="utf8",
            )
            completed = __import__("subprocess").CompletedProcess(
                args=[],
                returncode=0,
                stdout=(
                    "MainPID=4242\n"
                    "ControlGroup=/user.slice/user-1000.slice/"
                    "familyboard-kiosk.service\n"
                ),
            )

            with patch("pi_kiosk_probe.subprocess.run", return_value=completed) as run:
                command = read_service_process(
                    "familyboard-kiosk.service", proc_root=proc_root
                )

            self.assertEqual(command, ["/usr/bin/chromium", "--kiosk"])
            self.assertEqual(
                run.call_args.args[0],
                [
                    "systemctl",
                    "--user",
                    "show",
                    "--property=MainPID",
                    "--property=ControlGroup",
                    "--",
                    "familyboard-kiosk.service",
                ],
            )

    def test_rejects_main_pid_outside_reported_control_group(self):
        with TemporaryDirectory() as temporary_directory:
            proc_root = Path(temporary_directory)
            process_directory = proc_root / "4242"
            process_directory.mkdir()
            (process_directory / "cmdline").write_bytes(b"/usr/bin/chromium\0")
            (process_directory / "cgroup").write_text(
                "0::/user.slice/unrelated.service\n", encoding="utf8"
            )
            completed = __import__("subprocess").CompletedProcess(
                args=[],
                returncode=0,
                stdout="MainPID=4242\nControlGroup=/user.slice/kiosk.service\n",
            )

            with patch("pi_kiosk_probe.subprocess.run", return_value=completed):
                self.assertIsNone(
                    read_service_process("familyboard-kiosk.service", proc_root=proc_root)
                )


class UserUnitConfigurationTest(unittest.TestCase):
    def test_does_not_claim_system_network_or_tailscale_dependencies(self):
        unit = Path(__file__).with_name("familyboard-kiosk.service").read_text(
            encoding="utf8"
        )

        self.assertNotIn("tailscaled.service", unit)
        self.assertNotIn("network-online.target", unit)

    def test_applies_chromium_compatible_service_hardening(self):
        unit = Path(__file__).with_name("familyboard-kiosk.service").read_text(
            encoding="utf8"
        )

        for setting in (
            "UMask=0077",
            "CapabilityBoundingSet=",
            "LockPersonality=true",
            "ProtectControlGroups=true",
            "ProtectKernelLogs=true",
            "ProtectKernelModules=true",
            "ProtectKernelTunables=true",
            "RestrictRealtime=true",
            "RestrictSUIDSGID=true",
            "SystemCallArchitectures=native",
        ):
            with self.subTest(setting=setting):
                self.assertIn(setting, unit)


if __name__ == "__main__":
    unittest.main()
