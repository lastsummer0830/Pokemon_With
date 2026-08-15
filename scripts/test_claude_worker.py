from __future__ import annotations

import contextlib
import io
import json
import os
import re
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

from scripts import run_claude_worker as worker


class ClaudeWorkerBoundaryTests(unittest.TestCase):
    def test_reference_dirs_accept_only_exact_pwh006_allowlist(self) -> None:
        accepted = worker.normalize_reference_dirs(
            [str(path) for path in worker.PWH006_REFERENCE_DIRS]
        )
        self.assertEqual(worker.PWH006_REFERENCE_DIRS, accepted)

        with self.assertRaises(SystemExit):
            worker.normalize_reference_dirs([str(worker.PWH006_REFERENCE_DIRS[0].parent)])
        with self.assertRaises(SystemExit):
            worker.normalize_reference_dirs(["/tmp"])

    def test_verification_profiles_expand_to_exact_commands_only(self) -> None:
        names = tuple(worker.VERIFY_COMMANDS)
        commands = worker.normalize_verify_commands(list(names))
        self.assertEqual(tuple(worker.VERIFY_COMMANDS.values()), commands)
        self.assertNotIn("*", " ".join(commands))

        with self.assertRaises(SystemExit):
            worker.normalize_verify_commands(["shell"])

    def test_build_command_grants_read_only_external_dirs_and_exact_bash(self) -> None:
        references = worker.PWH006_REFERENCE_DIRS
        verify = (worker.VERIFY_COMMANDS["game-build"],)
        command = worker.build_command("probe", "audit", (), references, verify, 4)

        self.assertEqual("local", command[command.index("--setting-sources") + 1])
        settings = json.loads(command[command.index("--settings") + 1])
        deny = settings["permissions"]["deny"]
        self.assertFalse(settings["disableAllHooks"])
        hooks = settings["hooks"]["PreToolUse"]
        self.assertEqual(["Bash"], [item["matcher"] for item in hooks])
        self.assertEqual(worker.COMMAND_GUARD, hooks[0]["hooks"][0]["command"])
        self.assertEqual(10, hooks[0]["hooks"][0]["timeout"])
        self.assertNotIn("Bash", deny)
        for reference in references:
            rule_path = reference.as_posix()
            self.assertIn(f"Edit(//{rule_path.lstrip('/')}/**)", deny)
        self.assertFalse(any(rule.startswith("Write(") for rule in deny))

        self.assertIn("Bash", command)
        tools = command[command.index("--tools") + 1 : command.index("--allowedTools")]
        self.assertNotIn("Skill", tools)
        allowed_index = command.index("--allowedTools")
        self.assertIn(f"Bash({verify[0]})", command[allowed_index:])
        for reference in references:
            self.assertIn(str(reference), command[command.index("--add-dir") + 1 :])

    def test_implement_mode_allows_edits_only_inside_exact_paths(self) -> None:
        paths = (".agents/skills/native-rpg-pixel-sprites", "scripts/test_agent_skills.py")
        command = worker.build_command("implement", "implement", paths, (), (), 4)
        allowed_index = command.index("--allowedTools")
        allowed = command[allowed_index:]
        for path in paths:
            self.assertIn(f"Edit({path})", allowed)
            self.assertIn(f"Edit({path}/**)", allowed)
        self.assertFalse(any(rule.startswith("Write(") for rule in allowed))

    def test_implement_and_bash_verification_are_separate_phases(self) -> None:
        with self.assertRaises(SystemExit):
            worker.validate_execution_phase(
                "implement", (worker.VERIFY_COMMANDS["game-build"],)
            )
        worker.validate_execution_phase("implement", ())
        worker.validate_execution_phase("audit", (worker.VERIFY_COMMANDS["game-build"],))

    def test_verification_dependencies_are_immutable(self) -> None:
        deny = worker.worker_settings((), ())["permissions"]["deny"]
        required = {
            "scripts/run_claude_worker.py",
            "scripts/guard_claude_worker_command.py",
            "scripts/test_claude_worker.py",
            "scripts/test_claude_worker_guard.py",
        }
        self.assertTrue(required.issubset(worker.IMMUTABLE_VERIFICATION_PATHS))
        for path in worker.IMMUTABLE_VERIFICATION_PATHS:
            self.assertIn(f"Edit({path})", deny)

    def test_read_allow_rule_is_cwd_relative_not_filesystem_global(self) -> None:
        command = worker.build_command("probe", "audit", (), (), (), 4)
        allowed = command[command.index("--allowedTools") + 1 :]
        self.assertIn("Read(**)", allowed)
        self.assertFalse(any(rule.startswith("Read(//") for rule in allowed))
        self.assertFalse(any(rule.startswith("Read(~") for rule in allowed))

    def test_build_command_without_verify_keeps_bash_removed(self) -> None:
        command = worker.build_command("probe", "audit", (), (), (), 4)
        settings = json.loads(command[command.index("--settings") + 1])
        self.assertIn("Bash", settings["permissions"]["deny"])
        tools = command[command.index("--tools") + 1 : command.index("--allowedTools")]
        self.assertNotIn("Bash", tools)

    def test_build_command_exposes_skill_tool(self) -> None:
        command = worker.build_command("probe", "audit", (), (), (), 4)
        tools = command[command.index("--tools") + 1 : command.index("--allowedTools")]
        allowed = command[command.index("--allowedTools") + 1 :]
        self.assertIn("Skill", tools)
        self.assertIn("Skill", allowed)

    def test_worker_environment_disables_background_state(self) -> None:
        self.assertIn("CLAUDE_CONFIG_DIR", worker.BLOCKED_ENV)
        env = worker.worker_environment(())
        self.assertEqual("1", env["DISABLE_AUTOUPDATER"])
        self.assertEqual("1", env["CLAUDE_CODE_DISABLE_AUTO_MEMORY"])
        self.assertEqual("1", env["CLAUDE_CODE_SKIP_PROMPT_HISTORY"])

    def test_runtime_preflight_uses_the_isolated_environment(self) -> None:
        env = worker.worker_environment(())
        results = [
            SimpleNamespace(returncode=0, stdout="2.1.226 (Claude Code)\n"),
            SimpleNamespace(returncode=0, stdout="Login method: Claude Max account\n"),
            SimpleNamespace(returncode=0, stdout=str(worker.ROOT) + "\n"),
        ]
        with mock.patch.dict(os.environ, {}, clear=True), mock.patch.object(
            worker.subprocess, "run", side_effect=results
        ) as run:
            worker.verify_runtime(env)
        self.assertIs(run.call_args_list[0].kwargs["env"], env)
        self.assertIs(run.call_args_list[1].kwargs["env"], env)

    def test_claude_version_policy_accepts_verified_patch_updates(self) -> None:
        self.assertEqual(
            worker.MIN_CLAUDE_VERSION,
            worker.parse_claude_version("2.1.226 (Claude Code)\n"),
        )
        self.assertEqual(
            (2, 1, 233),
            worker.parse_claude_version("2.1.233 (Claude Code)\n"),
        )

    def test_claude_version_policy_exposes_bounds_and_rejects_malformed(self) -> None:
        self.assertEqual((2, 1, 226), worker.MIN_CLAUDE_VERSION)
        self.assertEqual((2, 2, 0), worker.MAX_CLAUDE_VERSION_EXCLUSIVE)
        self.assertEqual(
            (2, 1, 225), worker.parse_claude_version("2.1.225 (Claude Code)\n")
        )
        self.assertEqual(
            (2, 2, 0), worker.parse_claude_version("2.2.0 (Claude Code)\n")
        )
        self.assertIsNone(worker.parse_claude_version("not-a-version\n"))

    def test_game_build_verification_profile_is_exact(self) -> None:
        self.assertEqual(
            "npm --prefix myPokemon_AJ run build",
            worker.VERIFY_COMMANDS["game-build"],
        )
        commands = worker.normalize_verify_commands(["game-build"])
        self.assertEqual(("npm --prefix myPokemon_AJ run build",), commands)

    def test_reference_state_detects_content_change(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            sample = root / "sample.png"
            sample.write_bytes(b"before")
            before = worker.reference_state((root,))
            sample.write_bytes(b"after")
            after = worker.reference_state((root,))
            self.assertNotEqual(before, after)


if __name__ == "__main__":
    unittest.main()
