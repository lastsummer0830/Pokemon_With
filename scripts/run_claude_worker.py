#!/usr/bin/env python3
"""Run Claude Code as a bounded Pokemon_With worker under Hermes supervision."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
from typing import Any, NoReturn

ROOT = Path(__file__).resolve().parents[1]
CLAUDE = Path.home() / ".local/bin/claude"
BLOCKED_ENV = (
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_AUTH_TOKEN",
    "ANTHROPIC_BASE_URL",
    "CLAUDE_CODE_USE_BEDROCK",
    "CLAUDE_CODE_USE_VERTEX",
    "CLAUDE_CODE_USE_FOUNDRY",
    "CLAUDE_CONFIG_DIR",
)
PROJECT_SETTINGS = ROOT / ".claude" / "settings.json"
PWH006_REFERENCE_DIRS = (
    Path("/mnt/c/Users/ONE/Desktop/각폴더별참조").resolve(),
    Path(
        "/mnt/c/Users/ONE/Documents/Pokemon_With_Codex/"
        "references/curated-images/Drafts"
    ).resolve(),
)
VERIFY_COMMANDS = {
    "game-build": "npm --prefix myPokemon_AJ run build",
}
IMMUTABLE_VERIFICATION_PATHS = (
    "myPokemon_AJ/package.json",
    "myPokemon_AJ/vite.config.ts",
    "scripts/run_claude_worker.py",
    "scripts/guard_claude_worker_command.py",
    "scripts/test_claude_worker.py",
    "scripts/test_claude_worker_guard.py",
    "scripts/check_agent_skills.py",
    "scripts/test_agent_skills.py",
    "scripts/check_hermes_control.py",
    "scripts/hermes_response_gate.py",
    "scripts/test_hermes_response_gate.py",
)
COMMAND_GUARD = "python3 scripts/guard_claude_worker_command.py"
RESULT_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "changed_files": {"type": "array", "items": {"type": "string"}},
        "commands": {"type": "array", "items": {"type": "string"}},
        "verification": {"type": "array", "items": {"type": "string"}},
        "risks": {"type": "array", "items": {"type": "string"}},
        "unverified": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["summary", "changed_files", "commands", "verification", "risks", "unverified"],
    "additionalProperties": False,
}
MIN_CLAUDE_VERSION = (2, 1, 226)
MAX_CLAUDE_VERSION_EXCLUSIVE = (2, 2, 0)


def fail(message: str, code: int = 2) -> NoReturn:
    print(f"BLOCKED: {message}", file=sys.stderr)
    raise SystemExit(code)


def digest(path: Path) -> str:
    if path.is_symlink():
        return "LINK:" + os.readlink(path)
    if not path.exists():
        return "MISSING"
    if not path.is_file():
        return "NONFILE"
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def parse_claude_version(output: str) -> tuple[int, int, int] | None:
    token = output.strip().split(maxsplit=1)[0]
    parts = token.split(".")
    if len(parts) != 3 or not all(part.isdigit() for part in parts):
        return None
    major, minor, patch = (int(part) for part in parts)
    return major, minor, patch


def status_paths() -> dict[str, tuple[str, str]]:
    proc = subprocess.run(
        ["git", "status", "--porcelain=v1", "-z", "--untracked-files=all"],
        cwd=ROOT,
        capture_output=True,
        check=False,
    )
    if proc.returncode:
        fail(proc.stderr.decode(errors="replace").strip() or "git status failed")
    result: dict[str, tuple[str, str]] = {}
    skip_original = False
    for record in proc.stdout.split(b"\0"):
        if not record:
            continue
        if skip_original:
            skip_original = False
            continue
        text = record.decode("utf-8", errors="surrogateescape")
        if len(text) < 4:
            continue
        status, path = text[:2], text[3:]
        result[path] = (status, digest(ROOT / path))
        if "R" in status or "C" in status:
            skip_original = True
    return result


def normalize_paths(raw_paths: list[str], mode: str) -> tuple[str, ...]:
    paths: list[str] = []
    for raw in raw_paths:
        path = Path(raw)
        if path.is_absolute() or ".." in path.parts or not path.parts:
            fail(f"invalid allowed path: {raw}")
        paths.append(path.as_posix().rstrip("/"))
    if mode == "implement" and not paths:
        fail("implement mode requires at least one --allow-path")
    return tuple(dict.fromkeys(paths))


def normalize_reference_dirs(raw_paths: list[str]) -> tuple[Path, ...]:
    paths: list[Path] = []
    for raw in raw_paths:
        candidate = Path(raw).expanduser()
        if not candidate.is_absolute() or candidate.is_symlink():
            fail(f"invalid external reference directory: {raw}")
        resolved = candidate.resolve()
        if resolved not in PWH006_REFERENCE_DIRS or not resolved.is_dir():
            fail(f"external reference directory is not allowlisted: {raw}")
        paths.append(resolved)
    return tuple(dict.fromkeys(paths))


def normalize_verify_commands(names: list[str]) -> tuple[str, ...]:
    commands: list[str] = []
    for name in names:
        command = VERIFY_COMMANDS.get(name)
        if command is None:
            fail(f"verification profile is not allowlisted: {name}")
        commands.append(command)
    return tuple(dict.fromkeys(commands))


def validate_execution_phase(mode: str, verify_commands: tuple[str, ...]) -> None:
    if mode == "implement" and verify_commands:
        fail("implementation and Bash verification must use separate worker runs")


def reference_state(roots: tuple[Path, ...]) -> dict[str, str]:
    state: dict[str, str] = {}
    for root in roots:
        for path in sorted(root.rglob("*")):
            if path.is_file() or path.is_symlink():
                state[str(path)] = digest(path)
    return state


def worker_settings(
    references: tuple[Path, ...], verify_commands: tuple[str, ...]
) -> dict[str, Any]:
    try:
        settings = json.loads(PROJECT_SETTINGS.read_text(encoding="utf-8-sig"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        fail(f"cannot load project worker settings: {exc}")
    permissions = settings.setdefault("permissions", {})
    deny = [
        rule
        for rule in permissions.get("deny", [])
        if not (isinstance(rule, str) and rule.startswith("Write("))
    ]
    deny.extend(f"Edit({path})" for path in IMMUTABLE_VERIFICATION_PATHS)
    if verify_commands:
        deny = [rule for rule in deny if rule != "Bash"]
        settings["disableAllHooks"] = False
        settings["hooks"] = {
            "PreToolUse": [
                {
                    "matcher": "Bash",
                    "hooks": [
                        {
                            "type": "command",
                            "command": COMMAND_GUARD,
                            "timeout": 10,
                        }
                    ],
                }
            ]
        }
    else:
        deny.append("Bash")
        settings["disableAllHooks"] = True
        settings.pop("hooks", None)
    for reference in references:
        absolute = reference.as_posix().lstrip("/")
        deny.append(f"Edit(//{absolute}/**)")
    permissions["deny"] = list(dict.fromkeys(deny))
    return settings


def verify_runtime(env: dict[str, str]) -> None:
    active = [name for name in BLOCKED_ENV if env.get(name)]
    if active:
        fail("API/provider override environment is set: " + ", ".join(active))
    if not CLAUDE.is_file():
        fail(f"Claude Code executable missing: {CLAUDE}")
    version = subprocess.run(
        [str(CLAUDE), "--version"], text=True, capture_output=True, env=env
    )
    installed = parse_claude_version(version.stdout)
    if (
        version.returncode
        or installed is None
        or not MIN_CLAUDE_VERSION <= installed < MAX_CLAUDE_VERSION_EXCLUSIVE
    ):
        fail("Claude Code must be in the verified range >=2.1.226,<2.2.0")
    auth = subprocess.run(
        [str(CLAUDE), "auth", "status", "--text"],
        text=True,
        capture_output=True,
        env=env,
    )
    if auth.returncode or "Login method: Claude Max account" not in auth.stdout:
        fail("Claude Max OAuth login is required; API billing fallback is prohibited")
    root = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"], cwd=ROOT, text=True, capture_output=True
    )
    if root.returncode or Path(root.stdout.strip()).resolve() != ROOT.resolve():
        fail("Pokemon_With worker must run at the repository Git root")


def build_command(
    task: str,
    mode: str,
    paths: tuple[str, ...],
    references: tuple[Path, ...],
    verify_commands: tuple[str, ...],
    max_turns: int,
) -> list[str]:
    tools = ["Read", "Grep", "Glob"]
    allowed = ["Read(**)"]
    if not verify_commands:
        tools.append("Skill")
        allowed.append("Skill")
    if mode == "implement":
        tools.extend(["Edit", "Write"])
        for path in paths:
            allowed.extend(
                [
                    f"Edit({path})",
                    f"Edit({path}/**)",
                ]
            )
    if verify_commands:
        tools.append("Bash")
        allowed.extend(f"Bash({command})" for command in verify_commands)
    scope = ", ".join(paths) if paths else "no writes"
    reference_scope = ", ".join(str(path) for path in references) or "none"
    command_scope = ", ".join(verify_commands) or "none"
    prompt = f"""Hermes-supervised Pokemon_With Claude worker contract
Role: repository implementation/audit worker. Hermes owns scope, approval, independent verification, and user reporting.
Repository: {ROOT}
Mode: {mode}
Allowed write paths: {scope}
Read-only external reference directories: {reference_scope}
Allowed verification commands: {command_scope}
Do not access any other external path or sibling repository, modify external references, install packages, delete or move files, commit, push, deploy, change control files, invoke agents/MCP/plugins, or seek permission bypasses.
Preserve all existing dirty changes. Report real files and evidence; your own PASS is not completion.

Task from Hermes:
{task.strip()}
"""
    setting_sources = "local" if verify_commands else "project,local"
    command = [
        str(CLAUDE), "-p", prompt,
        "--model", "opus",
        "--settings", json.dumps(worker_settings(references, verify_commands), separators=(",", ":")),
        "--setting-sources", setting_sources,
        "--permission-mode", "dontAsk",
        "--no-session-persistence",
        "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}',
        "--max-turns", str(max_turns),
        "--tools", *tools,
        "--allowedTools", *allowed,
        "--output-format", "json",
        "--json-schema", json.dumps(RESULT_SCHEMA, separators=(",", ":")),
    ]
    if references:
        command.extend(["--add-dir", *(str(path) for path in references)])
    return command


def worker_environment(verify_commands: tuple[str, ...]) -> dict[str, str]:
    env = os.environ.copy()
    env["DISABLE_AUTOUPDATER"] = "1"
    env["CLAUDE_CODE_DISABLE_AUTO_MEMORY"] = "1"
    env["CLAUDE_CODE_SKIP_PROMPT_HISTORY"] = "1"
    env["CLAUDE_WORKER_VERIFY_COMMANDS_JSON"] = json.dumps(verify_commands)
    return env


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prompt-file", required=True)
    parser.add_argument("--mode", choices=("audit", "implement"), required=True)
    parser.add_argument("--allow-path", action="append", default=[])
    parser.add_argument("--reference-dir", action="append", default=[])
    parser.add_argument("--verify", action="append", default=[])
    parser.add_argument("--max-turns", type=int, default=12)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if not 1 <= args.max_turns <= 30:
        fail("--max-turns must be between 1 and 30")
    prompt_path = Path(args.prompt_file).expanduser().resolve()
    if not prompt_path.is_file() or prompt_path.stat().st_size > 50_000:
        fail("prompt file must exist and be 50 KB or smaller")
    task = prompt_path.read_text(encoding="utf-8")
    if not task.strip():
        fail("prompt file is empty")
    paths = normalize_paths(args.allow_path, args.mode)
    references = normalize_reference_dirs(args.reference_dir)
    verify_commands = normalize_verify_commands(args.verify)
    validate_execution_phase(args.mode, verify_commands)
    env = worker_environment(verify_commands)
    verify_runtime(env)
    command = build_command(
        task, args.mode, paths, references, verify_commands, args.max_turns
    )
    if args.dry_run:
        safe = command.copy()
        safe[2] = "[HERMES_WORKER_PROMPT]"
        print(json.dumps({"cwd": str(ROOT), "command": safe}, ensure_ascii=False, indent=2))
        return 0
    before = status_paths()
    references_before = reference_state(references)
    proc = subprocess.run(command, cwd=ROOT, text=True, capture_output=True, env=env)
    after = status_paths()
    references_after = reference_state(references)
    changed = sorted(path for path in before.keys() | after.keys() if before.get(path) != after.get(path))
    violations = changed if args.mode == "audit" else [
        path for path in changed if not any(path == item or path.startswith(item + "/") for item in paths)
    ]
    if violations:
        fail("Claude changed paths outside the contract: " + ", ".join(violations), 3)
    if references_before != references_after:
        fail("Claude changed an external read-only reference", 3)
    if proc.returncode:
        print(proc.stdout, end="")
        print(proc.stderr, file=sys.stderr, end="")
        fail(f"Claude process failed with exit code {proc.returncode}", proc.returncode)
    payload = json.loads(proc.stdout)
    usage = payload.get("modelUsage", {})
    if not any(
        isinstance(item, dict)
        and item.get("canonicalModel") == "claude-opus-5"
        and item.get("provider") == "firstParty"
        for item in usage.values()
    ):
        fail("run did not verify first-party Claude Opus 5 usage", 4)
    print(proc.stdout, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
