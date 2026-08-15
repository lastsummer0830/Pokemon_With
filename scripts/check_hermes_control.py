#!/usr/bin/env python3
"""Validate the compact Hermes and Claude project control plane."""

import json
import os

from pathlib import Path

try:
    from scripts.check_agent_skills import validate_repository
    from scripts import run_claude_worker
except ModuleNotFoundError:  # Direct `python3 scripts/check_hermes_control.py` execution.
    from check_agent_skills import validate_repository
    import run_claude_worker

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
ROOT = REPOSITORY_ROOT
LIMITS = {
    ".hermes.md": (60, 5 * 1024),
    "HERMES_HANDOFF.md": (40, 3 * 1024),
    "HERMES_CHECKLIST.md": (60, 5 * 1024),
}
MAX_OPEN_ITEMS = 15
REQUIRED_PROJECT_SETTINGS = {
    "autoMemoryEnabled": False,
    "disableAllHooks": False,
    "disableClaudeAiConnectors": True,
    "disableBundledSkills": False,
    "disableSkillShellExecution": True,
}
REQUIRED_SENSITIVE_DENY = {
    "Agent",
    "mcp__*",
    "Read(00_ImportBox/Important/**)",
    "Edit(00_ImportBox/Important/**)",
    "Edit(/.git/**)",
    "Edit(/.claude/**)",
    "Edit(/.hermes/**)",
    "Edit(/.hermes.md)",
    "Edit(/CLAUDE.md)",
    "Edit(/HERMES_HANDOFF.md)",
    "Edit(/HERMES_CHECKLIST.md)",
    "Edit(/scripts/run_claude_worker.py)",
    "Edit(/scripts/guard_claude_worker_command.py)",
    "Edit(/scripts/test_claude_worker.py)",
    "Edit(/scripts/test_claude_worker_guard.py)",
    "Edit(/scripts/check_agent_skills.py)",
    "Edit(/scripts/test_agent_skills.py)",
    "Edit(/scripts/check_hermes_control.py)",
    "Edit(/scripts/hermes_response_gate.py)",
    "Edit(/scripts/test_hermes_response_gate.py)",
    "Edit(/myPokemon_AJ/package.json)",
    "Edit(/myPokemon_AJ/vite.config.ts)",
}
# Native Claude Code verifies build/runtime itself, so a bare `Bash` deny is forbidden.
FORBIDDEN_DENY_RULES = {"Bash"}
# The single project hook: after compaction, recall which `paths:` rules were dropped.
RECALL_HOOK_SCRIPT = ".claude/hooks/recall-path-rules.sh"
RECALL_HOOK_COMMAND = f'"$CLAUDE_PROJECT_DIR"/{RECALL_HOOK_SCRIPT}'
PROJECT_HOOK_EVENT = "SessionStart"
PROJECT_HOOK_MATCHER = "compact"
VALID_SKILL_OVERRIDES = {"on", "name-only", "user-invocable-only", "off"}
FORBIDDEN_PROVIDER_ENV = {
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_AUTH_TOKEN",
    "ANTHROPIC_BASE_URL",
    "CLAUDE_CODE_USE_BEDROCK",
    "CLAUDE_CODE_USE_VERTEX",
    "CLAUDE_CODE_USE_FOUNDRY",
    "CLAUDE_CONFIG_DIR",
}
EXPECTED_PWH006_REFERENCE_DIRS = {
    "/mnt/c/Users/ONE/Desktop/각폴더별참조",
    "/mnt/c/Users/ONE/Documents/Pokemon_With_Codex/references/curated-images/Drafts",
}
EXPECTED_VERIFY_COMMANDS = {
    "game-build": "npm --prefix myPokemon_AJ run build",
}
EXPECTED_IMMUTABLE_VERIFICATION_PATHS = {
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
}
REQUIRED_HERMES_RULES = (
    (
        "Hermes(`hermes-agent.nousresearch.com/docs`)·Claude Code(`code.claude.com/docs`) 동작을 판단·수정하기 전에 현재 공식 문서를 확인하고 읽은 절을 밝힌다. 확인 못 한 동작은 추측하지 않고 `미검증`으로 중지한다.",
        "official documentation gate is missing",
    ),
    (
        "산출물·중간 실물(파일·이미지)은 첨부해 눈으로 확인하게 한다. 중요 checkpoint 결과와 renderer 이미지는 확인 즉시 보내며 최종 보고까지 미루지 않는다.",
        "immediate image checkpoint rule is missing",
    ),
    (
        "결과 품질의 최종 판정자는 사용자다. response gate·exact-text 강제 같은 기계 장치나 전수 감사로 보고·전달을 막지 않는다.",
        "no-response-gate contract is missing",
    ),
    (
        "제품 개발자는 Claude Code다. 저장소 루트와 `myPokemon_AJ` 어디서 실행해도 같은 계약으로 일한다.",
        "native Claude Code entry points are missing",
    ),
    (
        "네이티브 Claude Code는 project Skill과 `.claude/rules`를 로드한 상태로 실행하고, one-shot은 기존 wrapper 설정(자동업데이트·auto-memory·세션 지속 off, empty MCP)을 유지한다.",
        "project Skill and path rule loading is missing",
    ),
    (
        "Claude Code가 build·runtime·renderer 실행과 화면 확인·반복 수정까지 직접 하고 1차 자체검증 후 넘긴다. 장면의 방향·화자·대사 의미 등 사용자에게 보이는 의미까지 스스로 확인한다.",
        "Claude self-verification of build/runtime/renderer is missing",
    ),
    (
        "너는 감독자다: 목표·환경·범위·승인·worker 계약·독립 검증·checkpoint·인계를 책임진다. 제품 코드를 직접 수정하지 않는다.",
        "Hermes assistant boundary is missing",
    ),
    (
        "너의 2차 검증은 사용자가 직접 볼 수 없는 기본만: ① 실행 실재(세션·변경 파일) ② 캡처가 현재 실행의 최신 결과이고 실제 그 장면인가 ③ 명백한 계약 위반.",
        "independent Hermes verification is missing",
    ),
)
REQUIRED_HERMES_RULE_MARKERS = tuple(marker for marker, _ in REQUIRED_HERMES_RULES)


def validate_required_hermes_rules(text: str) -> list[str]:
    return [
        f".hermes.md: {message}"
        for marker, message in REQUIRED_HERMES_RULES
        if marker not in text
    ]


def validate_local_settings_policy(local: dict) -> list[str]:
    """Project hooks are active, so the local file may neither kill nor extend them."""
    failures: list[str] = []
    if local.get("disableAllHooks") is True:
        failures.append(".claude/settings.local.json: disableAllHooks must not be true")
    if local.get("hooks"):
        failures.append(".claude/settings.local.json: local hooks are forbidden")
    permissions = local.get("permissions")
    if isinstance(permissions, dict) and permissions.get("allow"):
        failures.append(".claude/settings.local.json: persistent tool allow rules are forbidden")
    return failures


def validate_project_hooks(hooks: object) -> list[str]:
    """`SessionStart`/`compact` recall of path rules is the only project hook."""
    prefix = ".claude/settings.json"
    if not isinstance(hooks, dict) or not hooks:
        return [f"{prefix}: the {PROJECT_HOOK_EVENT} path rule recall hook is missing"]

    failures: list[str] = []
    extra = sorted(event for event in hooks if event != PROJECT_HOOK_EVENT)
    if extra:
        failures.append(f"{prefix}: unexpected hook events: {', '.join(extra)}")
    entries = hooks.get(PROJECT_HOOK_EVENT)
    if not isinstance(entries, list) or len(entries) != 1 or not isinstance(entries[0], dict):
        failures.append(f"{prefix}: {PROJECT_HOOK_EVENT} must declare exactly one entry")
        return failures

    entry = entries[0]
    if entry.get("matcher") != PROJECT_HOOK_MATCHER:
        failures.append(f"{prefix}: {PROJECT_HOOK_EVENT} matcher must be {PROJECT_HOOK_MATCHER!r}")
    commands = entry.get("hooks")
    declared = (
        [
            (item.get("type"), item.get("command"))
            for item in commands
            if isinstance(item, dict)
        ]
        if isinstance(commands, list)
        else []
    )
    if declared != [("command", RECALL_HOOK_COMMAND)]:
        failures.append(f"{prefix}: the only hook command must be {RECALL_HOOK_COMMAND}")
    if not (ROOT / RECALL_HOOK_SCRIPT).is_file():
        failures.append(f"{RECALL_HOOK_SCRIPT}: hook script is missing")
    return failures


def _frontmatter_name(path: Path) -> str | None:
    try:
        for line in path.read_text(encoding="utf-8").splitlines()[:30]:
            if line.startswith("name:"):
                return line.split(":", 1)[1].strip().strip('"\'')
    except (OSError, UnicodeDecodeError):
        return None
    return None


def validate_claude_local_environment() -> list[str]:
    """Validate current-WSL inputs that supervised Claude runs must isolate."""
    failures: list[str] = []
    home = Path.home()
    local_path = ROOT / ".claude" / "settings.local.json"
    try:
        local = json.loads(local_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        return [f".claude/settings.local.json: cannot parse for local audit: {exc}"]

    overrides = local.get("skillOverrides", {})
    user_skills = home / ".claude" / "skills"
    if user_skills.is_dir():
        names = {
            name
            for path in user_skills.glob("*/SKILL.md")
            if (name := _frontmatter_name(path))
        }
        uncovered = sorted(name for name in names if overrides.get(name) != "off")
        if uncovered:
            failures.append(f"local user skills not disabled: {', '.join(uncovered)}")

    enabled_plugins = local.get("enabledPlugins", {})
    installed_path = home / ".claude" / "plugins" / "installed_plugins.json"
    if installed_path.is_file():
        try:
            installed = json.loads(installed_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            failures.append(f"installed_plugins.json: cannot parse: {exc}")
        else:
            plugin_names = (installed.get("plugins") or {}).keys()
            uncovered = sorted(name for name in plugin_names if enabled_plugins.get(name) is not False)
            if uncovered:
                failures.append(f"local plugins not disabled: {', '.join(uncovered)}")

    if (home / ".claude" / "CLAUDE.md").is_file():
        failures.append("active user CLAUDE.md requires an isolation review")
    user_agents = home / ".claude" / "agents"
    if user_agents.is_dir() and any(user_agents.glob("*.md")):
        failures.append("user agents require an isolation review")
    managed = Path("/etc/claude-code")
    if managed.exists() and any(managed.rglob("*")):
        failures.append("managed Claude configuration requires an isolation review")

    state_path = home / ".claude.json"
    if state_path.is_file():
        try:
            state = json.loads(state_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            failures.append(f"~/.claude.json: cannot parse: {exc}")
        else:
            project = (state.get("projects") or {}).get(str(ROOT), {})
            mcp_names = set((state.get("mcpServers") or {})) | set(project.get("mcpServers") or {})
            if mcp_names:
                failures.append(f"MCP servers require an explicit contract: {', '.join(sorted(mcp_names))}")

    active_provider_env = sorted(name for name in FORBIDDEN_PROVIDER_ENV if os.environ.get(name))
    if active_provider_env:
        failures.append(f"alternate provider environment is active: {', '.join(active_provider_env)}")
    return failures


def validate_claude_project_settings() -> list[str]:
    failures: list[str] = []
    path = ROOT / ".claude" / "settings.json"
    try:
        settings = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        return [f".claude/settings.json: cannot parse: {exc}"]

    for key, expected in REQUIRED_PROJECT_SETTINGS.items():
        if settings.get(key) is not expected:
            failures.append(f".claude/settings.json: {key} must be {expected!r}")
    permissions = settings.get("permissions")
    deny = permissions.get("deny", []) if isinstance(permissions, dict) else []
    if not isinstance(deny, list) or not REQUIRED_SENSITIVE_DENY.issubset(deny):
        failures.append(".claude/settings.json: sensitive Read/Edit deny contract differs")
    if any(isinstance(rule, str) and rule.startswith("Write(") for rule in deny):
        failures.append(".claude/settings.json: path Write rules are not enforced; use Edit")
    denied_tools = sorted(FORBIDDEN_DENY_RULES.intersection(deny))
    if denied_tools:
        failures.append(
            f".claude/settings.json: {', '.join(denied_tools)} deny blocks native Claude verification"
        )

    failures.extend(validate_project_hooks(settings.get("hooks")))

    for rel in (".claude/agents", ".claude/personas"):
        root = ROOT / rel
        if root.is_dir() and any(path.is_file() for path in root.rglob("*.md")):
            failures.append(f"{rel}: custom entries require an explicit contract update")

    local_path = ROOT / ".claude" / "settings.local.json"
    if local_path.is_file():
        try:
            local = json.loads(local_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            failures.append(f".claude/settings.local.json: cannot parse: {exc}")
        else:
            failures.extend(validate_local_settings_policy(local))
            overrides = local.get("skillOverrides", {})
            if not isinstance(overrides, dict) or any(
                value not in VALID_SKILL_OVERRIDES for value in overrides.values()
            ):
                failures.append(".claude/settings.local.json: invalid skillOverrides value")
            plugins = local.get("enabledPlugins", {})
            if not isinstance(plugins, dict) or plugins.get(
                "frontend-design@claude-plugins-official"
            ) is not False:
                failures.append(".claude/settings.local.json: frontend-design plugin must be disabled")

    if any(ROOT.glob(".mcp.json")) or any(ROOT.glob("**/.mcp.json")):
        failures.append("MCP config requires an explicit control-plane contract")
    return failures


def validate_claude_worker_contract() -> list[str]:
    failures: list[str] = []
    references = {str(path) for path in run_claude_worker.PWH006_REFERENCE_DIRS}
    if references != EXPECTED_PWH006_REFERENCE_DIRS:
        failures.append("scripts/run_claude_worker.py: PWH-006 reference allowlist differs")
    if run_claude_worker.VERIFY_COMMANDS != EXPECTED_VERIFY_COMMANDS:
        failures.append("scripts/run_claude_worker.py: verification allowlist differs")
    if set(run_claude_worker.IMMUTABLE_VERIFICATION_PATHS) != EXPECTED_IMMUTABLE_VERIFICATION_PATHS:
        failures.append("scripts/run_claude_worker.py: immutable verification paths differ")
    if run_claude_worker.COMMAND_GUARD != "python3 scripts/guard_claude_worker_command.py":
        failures.append("scripts/run_claude_worker.py: command guard differs")
    if not (ROOT / "scripts" / "guard_claude_worker_command.py").is_file():
        failures.append("scripts/guard_claude_worker_command.py: missing command guard")
    if not (ROOT / "scripts" / "test_claude_worker.py").is_file():
        failures.append("scripts/test_claude_worker.py: missing worker boundary tests")
    if not (ROOT / "scripts" / "test_claude_worker_guard.py").is_file():
        failures.append("scripts/test_claude_worker_guard.py: missing guard boundary tests")
    probe = run_claude_worker.build_command("probe", "audit", (), (), (), 1)
    if probe[probe.index("--setting-sources") + 1] != "project,local":
        failures.append("scripts/run_claude_worker.py: project/local setting sources are required")
    tools = probe[probe.index("--tools") + 1 : probe.index("--allowedTools")]
    if "Skill" not in tools:
        failures.append("scripts/run_claude_worker.py: Skill tool is not exposed")
    game_build = run_claude_worker.VERIFY_COMMANDS["game-build"]
    verify_probe = run_claude_worker.build_command(
        "probe", "audit", (), (), (game_build,), 1
    )
    if verify_probe[verify_probe.index("--setting-sources") + 1] != "local":
        failures.append("scripts/run_claude_worker.py: verify worker must use local source")
    verify_tools = verify_probe[
        verify_probe.index("--tools") + 1 : verify_probe.index("--allowedTools")
    ]
    if set(verify_tools) != {"Read", "Grep", "Glob", "Bash"}:
        failures.append("scripts/run_claude_worker.py: verify worker tool boundary differs")
    verify_allowed = verify_probe[verify_probe.index("--allowedTools") + 1 :]
    if f"Bash({game_build})" not in verify_allowed:
        failures.append("scripts/run_claude_worker.py: exact game-build permission is missing")
    env = run_claude_worker.worker_environment(())
    for name in (
        "DISABLE_AUTOUPDATER",
        "CLAUDE_CODE_DISABLE_AUTO_MEMORY",
        "CLAUDE_CODE_SKIP_PROMPT_HISTORY",
    ):
        if env.get(name) != "1":
            failures.append(f"scripts/run_claude_worker.py: {name}=1 is required")
    return failures


def main() -> int:
    failures: list[str] = []
    for name, (max_lines, max_bytes) in LIMITS.items():
        path = ROOT / name
        if not path.is_file():
            failures.append(f"missing: {name}")
            continue
        raw = path.read_bytes()
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            failures.append(f"not UTF-8: {name}")
            continue
        lines = len(text.splitlines())
        if lines > max_lines:
            failures.append(f"{name}: {lines}>{max_lines} lines")
        if len(raw) > max_bytes:
            failures.append(f"{name}: {len(raw)}>{max_bytes} bytes")
        if name == ".hermes.md":
            failures.extend(validate_required_hermes_rules(text))

    checklist = ROOT / "HERMES_CHECKLIST.md"
    if checklist.is_file():
        open_items = checklist.read_text(encoding="utf-8").count("- [ ]")
        if open_items > MAX_OPEN_ITEMS:
            failures.append(f"HERMES_CHECKLIST.md: {open_items}>{MAX_OPEN_ITEMS} open items")

    failures.extend(f"skills: {error}" for error in validate_repository(ROOT))
    failures.extend(validate_claude_project_settings())
    if ROOT == REPOSITORY_ROOT:
        failures.extend(validate_claude_worker_contract())
        failures.extend(validate_claude_local_environment())

    if failures:
        for failure in failures:
            print(f"FAIL: {failure}")
        return 1
    print("PASS: control documents, Claude project settings, and project skill contract are valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
