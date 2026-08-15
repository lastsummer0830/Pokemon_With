#!/usr/bin/env python3
"""Fail-closed PreToolUse guard for bounded Claude worker Bash commands."""
from __future__ import annotations

import json
import os
import sys
from typing import Any

ENV_NAME = "CLAUDE_WORKER_VERIFY_COMMANDS_JSON"


def command_is_allowed(payload: Any, allowed: tuple[str, ...]) -> bool:
    if not isinstance(payload, dict) or payload.get("tool_name") != "Bash":
        return False
    tool_input = payload.get("tool_input")
    if not isinstance(tool_input, dict):
        return False
    command = tool_input.get("command")
    return isinstance(command, str) and command in allowed


def main() -> int:
    try:
        raw_allowed = json.loads(os.environ.get(ENV_NAME, ""))
        if not isinstance(raw_allowed, list) or not all(
            isinstance(item, str) for item in raw_allowed
        ):
            raise ValueError("allowlist must be a JSON string list")
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, OSError, ValueError) as exc:
        print(f"BLOCKED: invalid worker command guard input: {exc}", file=sys.stderr)
        return 2
    allowed = tuple(raw_allowed)
    if not command_is_allowed(payload, allowed):
        print("BLOCKED: Bash command is outside the worker verification allowlist", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
