import unittest

from nas_metrics import (
    parse_container_inspect,
    parse_meminfo,
    validate_container_names,
    validate_measurement_coverage,
)


class ParseMeminfoTest(unittest.TestCase):
    def test_converts_kernel_kib_values_to_bytes(self):
        metrics = parse_meminfo(
            """MemTotal:       2097152 kB
MemAvailable:    716800 kB
SwapTotal:      1048576 kB
SwapFree:        786432 kB
"""
        )

        self.assertEqual(
            metrics,
            {
                "memory_total_bytes": 2_147_483_648,
                "memory_available_bytes": 734_003_200,
                "swap_total_bytes": 1_073_741_824,
                "swap_used_bytes": 268_435_456,
            },
        )


class ParseContainerInspectTest(unittest.TestCase):
    def test_extracts_restart_oom_and_running_state(self):
        result = parse_container_inspect(
            [
                {
                    "Name": "/familyboard-web",
                    "RestartCount": 2,
                    "State": {"OOMKilled": False, "Running": True},
                },
                {
                    "Name": "/existing-postgres",
                    "RestartCount": 0,
                    "State": {"OOMKilled": True, "Running": False},
                },
            ]
        )

        self.assertEqual(
            result,
            [
                {
                    "name": "existing-postgres",
                    "oom_killed": True,
                    "restart_count": 0,
                    "running": False,
                },
                {
                    "name": "familyboard-web",
                    "oom_killed": False,
                    "restart_count": 2,
                    "running": True,
                },
            ],
        )


class ValidateContainerNamesTest(unittest.TestCase):
    def test_rejects_docker_option_injection(self):
        with self.assertRaisesRegex(ValueError, "invalid container name"):
            validate_container_names(["familyboard-web", "--format"])

    def test_accepts_normal_compose_container_names(self):
        self.assertEqual(
            validate_container_names(["familyboard-spike-web-1", "existing_postgres.1"]),
            ["familyboard-spike-web-1", "existing_postgres.1"],
        )


class ValidateMeasurementCoverageTest(unittest.TestCase):
    def test_rejects_partial_inspect_results(self):
        with self.assertRaisesRegex(ValueError, "inspect coverage mismatch"):
            validate_measurement_coverage(
                ["web", "worker", "db"],
                [{"Name": "/web"}, {"Name": "/db"}],
                [{"Name": "web"}, {"Name": "worker"}, {"Name": "db"}],
            )

    def test_rejects_duplicate_stats_results(self):
        with self.assertRaisesRegex(ValueError, "stats coverage mismatch"):
            validate_measurement_coverage(
                ["web", "worker", "db"],
                [{"Name": "/web"}, {"Name": "/worker"}, {"Name": "/db"}],
                [
                    {"Name": "web"},
                    {"Name": "worker"},
                    {"Name": "worker"},
                    {"Name": "db"},
                ],
            )


if __name__ == "__main__":
    unittest.main()
