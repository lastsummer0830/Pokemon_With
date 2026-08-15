from __future__ import annotations

import io
import json
import os
import unittest
from unittest import mock

from scripts import guard_claude_worker_command as guard


class ClaudeWorkerCommandGuardTests(unittest.TestCase):
    def test_uses_general_worker_allowlist_environment_name(self) -> None:
        self.assertEqual("CLAUDE_WORKER_VERIFY_COMMANDS_JSON", guard.ENV_NAME)

    def test_allows_only_exact_selected_command(self) -> None:
        allowed = ("python3 scripts/check_agent_skills.py",)
        self.assertTrue(
            guard.command_is_allowed(
                {"tool_name": "Bash", "tool_input": {"command": allowed[0]}}, allowed
            )
        )

    def test_rejects_non_allowlisted_builtin(self) -> None:
        self.assertFalse(
            guard.command_is_allowed(
                {"tool_name": "Bash", "tool_input": {"command": "pwd"}}, ()
            )
        )

    def test_rejects_compound_variant_of_allowed_command(self) -> None:
        allowed = ("python3 scripts/check_agent_skills.py",)
        self.assertFalse(
            guard.command_is_allowed(
                {
                    "tool_name": "Bash",
                    "tool_input": {
                        "command": "python3 scripts/check_agent_skills.py; echo $?"
                    },
                },
                allowed,
            )
        )

    def test_rejects_malformed_payload(self) -> None:
        self.assertFalse(guard.command_is_allowed({}, ("pwd",)))
        self.assertFalse(
            guard.command_is_allowed(
                {"tool_name": "Bash", "tool_input": {"command": 7}}, ("7",)
            )
        )

    def test_main_fails_closed_on_malformed_allowlist_environment(self) -> None:
        with mock.patch.dict(os.environ, {guard.ENV_NAME: "{"}, clear=True), mock.patch(
            "sys.stdin", io.StringIO("{}")
        ):
            self.assertEqual(2, guard.main())

    def test_main_fails_closed_on_malformed_hook_stdin(self) -> None:
        with mock.patch.dict(
            os.environ, {guard.ENV_NAME: '["pwd"]'}, clear=True
        ), mock.patch("sys.stdin", io.StringIO("{")):
            self.assertEqual(2, guard.main())

    def test_main_fails_closed_on_valid_json_with_invalid_payload(self) -> None:
        with mock.patch.dict(
            os.environ, {guard.ENV_NAME: '["pwd"]'}, clear=True
        ), mock.patch("sys.stdin", io.StringIO("{}")):
            self.assertEqual(2, guard.main())


if __name__ == "__main__":
    unittest.main()
