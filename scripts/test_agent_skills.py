from __future__ import annotations

import builtins
import contextlib
import hashlib
import importlib.util
import io
import json
import os
import re
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

from scripts import check_hermes_control
from scripts.check_agent_skills import EXPECTED_SKILLS, sync_skills, validate_repository

REPO_ROOT = Path(__file__).resolve().parents[1]
NATIVE_SKILL = "native-rpg-pixel-sprites"
NATIVE_SKILL_ROOT = REPO_ROOT / ".agents" / "skills" / NATIVE_SKILL
NATIVE_SKILL_FILES = (
    "SKILL.md",
    "references/capability-matrix.md",
    "references/qa-contract.md",
    "references/reference-role-contract.md",
    "references/subtype-contracts.md",
    "scripts/analyze_native_pixel.py",
    "scripts/validate_asset.py",
)
# Only paths documented as task inputs by the authoritative PWH-006 source map.
DOCUMENTED_TASK_INPUT_PATHS = (
    "/mnt/c/Users/ONE/Desktop/각폴더별참조",
    "/mnt/c/Users/ONE/Documents/Pokemon_With_Codex/references/curated-images/Drafts",
)
MACHINE_PATH = re.compile(
    r"(?:/mnt/[^\s`'\"()\[\],]+|(?<![A-Za-z])[A-Za-z]:[\\/][^\s`'\"()\[\],]+|/home/[^\s`'\"()\[\],]+)"
)
# The one `.hermes.md` rule that must stay required.
INDEPENDENT_VERIFICATION_RULE = (
    "너의 2차 검증은 사용자가 직접 볼 수 없는 기본만: ① 실행 실재(세션·변경 파일) "
    "② 캡처가 현재 실행의 최신 결과이고 실제 그 장면인가 ③ 명백한 계약 위반."
)
# Clauses the native Claude project environment removes from `.hermes.md`.
SPLIT_RUN_RULE = "구현과 Bash 검증을 별도 run으로 분리한다."
READ_ONLY_REVIEWER_CLAUSE = "별도 read-only worker가 build를 확인"
RUNNER_MANDATE_CLAUSE = "제품 작업은 `python3 scripts/run_claude_worker.py`로 Claude에 위임"
FORBIDDEN_HERMES_CLAUSES = (
    SPLIT_RUN_RULE,
    READ_ONLY_REVIEWER_CLAUSE,
    RUNNER_MANDATE_CLAUSE,
)
# Each topic must be carried by a single required `.hermes.md` rule marker.
REQUIRED_HERMES_TOPICS = {
    "Claude Code entry points": ("Claude Code", "루트", "myPokemon_AJ"),
    "project Skill and rule loading": ("Skill", ".claude/rules"),
    "Claude verifies build/runtime/renderer itself": (
        "Claude",
        "build",
        "runtime",
        "renderer",
    ),
    "supervisor owns scope and independent verification": (
        "목표",
        "환경",
        "계약",
        "독립 검증",
        "제품 코드",
    ),
}

# Native Claude project environment: hooks stay on, Bash is not denied outright.
REQUIRED_PROJECT_FLAGS = {
    "autoMemoryEnabled": False,
    "disableAllHooks": False,
    "disableClaudeAiConnectors": True,
    "disableBundledSkills": False,
    "disableSkillShellExecution": True,
}
REQUIRED_DENY_RULES = frozenset({
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
})
RECALL_HOOK_SCRIPT = ".claude/hooks/recall-path-rules.sh"
RECALL_HOOK_COMMAND = f'"$CLAUDE_PROJECT_DIR"/{RECALL_HOOK_SCRIPT}'
PROJECT_HOOK_EVENT = "SessionStart"
PROJECT_HOOK_MATCHER = "compact"
FORBIDDEN_HOOK_EVENTS = ("Stop", "PreToolUse", "UserPromptSubmit")
# `.claude/settings.local.json` keeps the machine-local plugin/skill override policy.
LOCAL_PLUGIN_OVERRIDE = "frontend-design@claude-plugins-official"
EXPECTED_LOCAL_SKILL_OVERRIDES = frozenset({
    "algorithmic-art",
    "assignment-quality-review",
    "canvas-design",
    "git-workflow-guard",
    "image-prompt-crafter",
    "knowva-design-guard",
    "portfolio-readme-upgrader",
    "resume-polisher",
    "theme-factory",
    "web-artifacts-builder",
})


def recall_hook_config(
    event: str = PROJECT_HOOK_EVENT,
    matcher: str | None = PROJECT_HOOK_MATCHER,
    hooks: list[dict] | None = None,
) -> dict:
    """The single contracted project hook, or a deliberate deviation from it."""
    entry: dict = {}
    if matcher is not None:
        entry["matcher"] = matcher
    entry["hooks"] = (
        [{"type": "command", "command": RECALL_HOOK_COMMAND}] if hooks is None else hooks
    )
    return {event: [entry]}


def _load_pillow():
    try:
        from PIL import Image
    except ImportError:  # pragma: no cover - reported by test_pillow_is_available
        return None
    return Image


GOOD_SKILL = """---
name: sample-skill
description: Test project skill.
version: 1.0.0
platforms: [linux, windows]
---

# Sample

## When to Use
- Use for tests.

## Required Inputs
- `target`

## Procedure
1. Check the target.

## Cost Limits
- One target.

## Verification
- Record the result.

## Pitfalls
- Do not guess.
"""


class AgentSkillControlTests(unittest.TestCase):
    def make_repo(self) -> Path:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        root = Path(tmp.name)
        canonical = root / ".agents" / "skills" / "sample-skill"
        canonical.mkdir(parents=True)
        (canonical / "SKILL.md").write_text(GOOD_SKILL, encoding="utf-8")
        return root

    def test_validator_accepts_synced_skill_tree(self) -> None:
        root = self.make_repo()
        sync_skills(root, prune=True)
        self.assertEqual([], validate_repository(root, expected_skills={"sample-skill"}))

    def test_validator_rejects_stale_project_references(self) -> None:
        root = self.make_repo()
        skill = root / ".agents" / "skills" / "sample-skill" / "SKILL.md"
        skill.write_text(GOOD_SKILL + "\nUse http://localhost:5173 and HouseScene.\n", encoding="utf-8")
        sync_skills(root, prune=True)
        errors = validate_repository(root, expected_skills={"sample-skill"})
        self.assertTrue(any("5173" in error for error in errors))
        self.assertTrue(any("HouseScene" in error for error in errors))

    def test_sync_prunes_only_when_requested(self) -> None:
        root = self.make_repo()
        extra = root / ".claude" / "skills" / "legacy" / "SKILL.md"
        extra.parent.mkdir(parents=True)
        extra.write_text(GOOD_SKILL.replace("sample-skill", "legacy"), encoding="utf-8")

        sync_skills(root, prune=False)
        self.assertTrue(extra.exists())

        sync_skills(root, prune=True)
        self.assertFalse(extra.exists())

    def test_sync_rejects_symlink_targets(self) -> None:
        root = self.make_repo()
        outside = root / "outside.txt"
        outside.write_text("safe", encoding="utf-8")
        target = root / ".claude" / "skills" / "sample-skill" / "SKILL.md"
        target.parent.mkdir(parents=True)
        target.symlink_to(outside)

        with self.assertRaises(ValueError):
            sync_skills(root, prune=True)
        self.assertEqual("safe", outside.read_text(encoding="utf-8"))

    def test_validator_checks_support_files_and_exact_skill_set(self) -> None:
        root = self.make_repo()
        reference = root / ".agents" / "skills" / "sample-skill" / "references" / "source.md"
        reference.parent.mkdir(parents=True)
        reference.write_text("Use D:/Pokemon Another Red_PWT_250829/Graphics/", encoding="utf-8")
        sync_skills(root, prune=True)

        errors = validate_repository(root, expected_skills={"sample-skill", "missing-skill"})
        self.assertTrue(any("D:/Pokemon Another Red" in error for error in errors))
        self.assertTrue(any("missing-skill" in error for error in errors))


    def test_control_validator_requires_official_docs_and_immediate_images(self) -> None:
        failures = check_hermes_control.validate_required_hermes_rules("# incomplete\n")
        self.assertTrue(any("official documentation gate" in item for item in failures))
        self.assertTrue(any("immediate image checkpoint" in item for item in failures))
        self.assertTrue(any("no-response-gate contract" in item for item in failures))

        complete = "\n".join(check_hermes_control.REQUIRED_HERMES_RULE_MARKERS)
        self.assertEqual([], check_hermes_control.validate_required_hermes_rules(complete))


    def test_local_settings_cannot_disable_or_define_hooks(self) -> None:
        """Project hooks are active, so the local file may neither kill nor extend them."""
        merged = check_hermes_control.validate_local_settings_policy(
            {"hooks": {"PreToolUse": []}}
        )
        self.assertTrue(any("local hooks" in item for item in merged), merged)

        disabled = check_hermes_control.validate_local_settings_policy(
            {"disableAllHooks": True}
        )
        self.assertTrue(any("disableAllHooks" in item for item in disabled), disabled)

        self.assertEqual([], check_hermes_control.validate_local_settings_policy({}))

    def test_control_validator_includes_skill_contract(self) -> None:
        root = self.make_repo()
        for name in check_hermes_control.LIMITS:
            (root / name).write_text("# valid\n", encoding="utf-8")
        settings = root / ".claude" / "settings.json"
        settings.parent.mkdir(parents=True, exist_ok=True)
        settings.write_text(json.dumps({
            **REQUIRED_PROJECT_FLAGS,
            "permissions": {"deny": sorted(REQUIRED_DENY_RULES)},
            "hooks": recall_hook_config(),
        }), encoding="utf-8")
        sync_skills(root, prune=True)
        skill = root / ".agents" / "skills" / "sample-skill" / "SKILL.md"
        skill.write_text(GOOD_SKILL + "\nUse http://localhost:5173.\n", encoding="utf-8")
        sync_skills(root, prune=True)

        previous_root = check_hermes_control.ROOT
        check_hermes_control.ROOT = root
        try:
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                result = check_hermes_control.main()
        finally:
            check_hermes_control.ROOT = previous_root

        self.assertEqual(1, result)
        self.assertIn("stale reference", output.getvalue())
        self.assertNotIn("disableBundledSkills", output.getvalue())


class NativeClaudeProjectEnvironmentTests(unittest.TestCase):
    """Claude Code runs natively in this repository: hooks on, Bash allowed, Hermes out of product code."""

    def temp_root(self) -> Path:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        return Path(tmp.name)

    @staticmethod
    def baseline_settings(**overrides) -> dict:
        deny = set(REQUIRED_DENY_RULES) | (
            set(check_hermes_control.REQUIRED_SENSITIVE_DENY) - {"Bash"}
        )
        settings = {
            **REQUIRED_PROJECT_FLAGS,
            "permissions": {"deny": sorted(deny)},
            "hooks": recall_hook_config(),
        }
        settings.update(overrides)
        return settings

    def run_settings_validator(self, settings: dict) -> list[str]:
        root = self.temp_root()
        path = root / ".claude" / "settings.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(settings), encoding="utf-8")
        script = root / RECALL_HOOK_SCRIPT
        script.parent.mkdir(parents=True, exist_ok=True)
        script.write_text("#!/usr/bin/env bash\nexit 0\n", encoding="utf-8")

        previous_root = check_hermes_control.ROOT
        check_hermes_control.ROOT = root
        try:
            return check_hermes_control.validate_claude_project_settings()
        finally:
            check_hermes_control.ROOT = previous_root

    @staticmethod
    def repo_json(relative: str) -> dict:
        return json.loads((REPO_ROOT / relative).read_text(encoding="utf-8"))

    @staticmethod
    def hermes_text() -> str:
        return (REPO_ROOT / ".hermes.md").read_text(encoding="utf-8")

    # --- .claude/settings.json ------------------------------------------------

    def test_project_settings_keep_native_flags_with_hooks_enabled(self) -> None:
        settings = self.repo_json(".claude/settings.json")
        for key, expected in REQUIRED_PROJECT_FLAGS.items():
            with self.subTest(key=key):
                self.assertIs(expected, settings.get(key))

    def test_project_settings_deny_keeps_sensitive_rules_without_bare_bash(self) -> None:
        deny = self.repo_json(".claude/settings.json")["permissions"]["deny"]
        self.assertNotIn("Bash", deny, "a bare Bash deny blocks native Claude verification")
        self.assertEqual(set(), REQUIRED_DENY_RULES - set(deny))

    def test_project_settings_declare_exactly_the_recall_path_rules_hook(self) -> None:
        hooks = self.repo_json(".claude/settings.json").get("hooks")
        self.assertEqual([PROJECT_HOOK_EVENT], sorted(hooks or {}))
        entries = hooks[PROJECT_HOOK_EVENT]
        self.assertEqual(1, len(entries), entries)
        entry = entries[0]
        self.assertEqual(PROJECT_HOOK_MATCHER, entry.get("matcher"))
        self.assertEqual(1, len(entry["hooks"]), entry["hooks"])
        hook = entry["hooks"][0]
        self.assertEqual("command", hook.get("type"))
        self.assertIn(RECALL_HOOK_SCRIPT, hook.get("command", ""))
        self.assertTrue((REPO_ROOT / RECALL_HOOK_SCRIPT).is_file())

    # --- .claude/settings.local.json ------------------------------------------

    def test_local_settings_neither_disable_nor_define_hooks(self) -> None:
        local = self.repo_json(".claude/settings.local.json")
        self.assertIsNot(True, local.get("disableAllHooks"))
        self.assertFalse(local.get("hooks"))
        self.assertFalse((local.get("permissions") or {}).get("allow"))
        self.assertEqual(
            [], check_hermes_control.validate_local_settings_policy(local)
        )

    def test_local_settings_keep_the_plugin_and_skill_override_policy(self) -> None:
        local = self.repo_json(".claude/settings.local.json")
        self.assertIs(False, local.get("enabledPlugins", {}).get(LOCAL_PLUGIN_OVERRIDE))
        overrides = local.get("skillOverrides", {})
        self.assertEqual(
            set(), EXPECTED_LOCAL_SKILL_OVERRIDES - set(overrides),
        )
        for name in EXPECTED_LOCAL_SKILL_OVERRIDES:
            self.assertEqual("off", overrides[name], name)

    # --- check_hermes_control contract ---------------------------------------

    def test_control_contract_requires_hooks_to_stay_enabled(self) -> None:
        self.assertEqual(
            REQUIRED_PROJECT_FLAGS, dict(check_hermes_control.REQUIRED_PROJECT_SETTINGS)
        )

    def test_control_deny_contract_drops_bare_bash_and_keeps_sensitive_rules(self) -> None:
        required = set(check_hermes_control.REQUIRED_SENSITIVE_DENY)
        self.assertNotIn("Bash", required)
        self.assertEqual(set(), REQUIRED_DENY_RULES - required)

    def test_control_validator_accepts_the_recall_path_rules_hook(self) -> None:
        self.assertEqual([], self.run_settings_validator(self.baseline_settings()))

    def test_control_validator_rejects_missing_project_hooks(self) -> None:
        for hooks in ({}, None):
            with self.subTest(hooks=hooks):
                failures = self.run_settings_validator(self.baseline_settings(hooks=hooks))
                self.assertTrue(
                    any(PROJECT_HOOK_EVENT in item for item in failures), failures
                )

    def test_control_validator_rejects_extra_hook_events(self) -> None:
        for event in FORBIDDEN_HOOK_EVENTS:
            with self.subTest(event=event):
                hooks = {**recall_hook_config(), **recall_hook_config(event=event)}
                failures = self.run_settings_validator(self.baseline_settings(hooks=hooks))
                self.assertTrue(any(event in item for item in failures), failures)

    def test_control_validator_rejects_a_second_session_start_entry(self) -> None:
        hooks = recall_hook_config()
        hooks[PROJECT_HOOK_EVENT] = hooks[PROJECT_HOOK_EVENT] * 2
        failures = self.run_settings_validator(self.baseline_settings(hooks=hooks))
        self.assertTrue(any(PROJECT_HOOK_EVENT in item for item in failures), failures)

    def test_control_validator_rejects_a_wrong_or_missing_matcher(self) -> None:
        for matcher in ("startup", None):
            with self.subTest(matcher=matcher):
                failures = self.run_settings_validator(
                    self.baseline_settings(hooks=recall_hook_config(matcher=matcher))
                )
                self.assertTrue(any("matcher" in item for item in failures), failures)

    def test_control_validator_rejects_any_other_command_hook(self) -> None:
        cases = (
            [{"type": "command", "command": "true"}],
            [
                {"type": "command", "command": RECALL_HOOK_COMMAND},
                {"type": "command", "command": "true"},
            ],
        )
        for hooks in cases:
            with self.subTest(hooks=hooks):
                failures = self.run_settings_validator(
                    self.baseline_settings(hooks=recall_hook_config(hooks=hooks))
                )
                self.assertTrue(
                    any(RECALL_HOOK_SCRIPT in item for item in failures), failures
                )

    def test_control_validator_rejects_disabled_hooks(self) -> None:
        failures = self.run_settings_validator(
            self.baseline_settings(disableAllHooks=True)
        )
        self.assertIn(".claude/settings.json: disableAllHooks must be False", failures)

    def test_control_validator_rejects_a_bare_bash_deny(self) -> None:
        settings = self.baseline_settings()
        settings["permissions"]["deny"] = sorted(set(settings["permissions"]["deny"]) | {"Bash"})
        failures = self.run_settings_validator(settings)
        self.assertTrue(any("Bash" in item for item in failures), failures)

    # --- .hermes.md -----------------------------------------------------------

    def test_hermes_document_drops_split_runs_and_the_single_runner_mandate(self) -> None:
        text = self.hermes_text()
        for clause in FORBIDDEN_HERMES_CLAUSES:
            with self.subTest(clause=clause):
                self.assertNotIn(clause, text)

    def test_required_hermes_markers_drop_split_runs_and_the_runner_mandate(self) -> None:
        markers = check_hermes_control.REQUIRED_HERMES_RULE_MARKERS
        self.assertNotIn(SPLIT_RUN_RULE, markers)
        for marker in markers:
            with self.subTest(marker=marker):
                self.assertNotIn("run_claude_worker.py", marker)
                for clause in FORBIDDEN_HERMES_CLAUSES:
                    self.assertNotIn(clause, marker)

    def test_required_hermes_markers_cover_the_native_claude_contract(self) -> None:
        markers = check_hermes_control.REQUIRED_HERMES_RULE_MARKERS
        for topic, tokens in REQUIRED_HERMES_TOPICS.items():
            with self.subTest(topic=topic):
                self.assertTrue(
                    any(all(token in marker for token in tokens) for marker in markers),
                    f"no required rule marker covers {topic}",
                )

    def test_every_required_marker_is_enforced_and_present_in_the_document(self) -> None:
        text = self.hermes_text()
        self.assertEqual([], check_hermes_control.validate_required_hermes_rules(text))
        for marker in check_hermes_control.REQUIRED_HERMES_RULE_MARKERS:
            with self.subTest(marker=marker):
                self.assertIn(marker, text)
                self.assertTrue(
                    check_hermes_control.validate_required_hermes_rules(
                        text.replace(marker, "")
                    ),
                    f"required marker is not enforced: {marker}",
                )

    def test_hermes_document_keeps_independent_verification(self) -> None:
        self.assertIn(INDEPENDENT_VERIFICATION_RULE, self.hermes_text())


def _import_skill_module(relative: str, name: str, writes: list[str] | None = None):
    """Import a canonical skill script without leaving bytecode or other writes."""
    path = NATIVE_SKILL_ROOT / relative
    previous_bytecode_flag = sys.dont_write_bytecode
    sys.dont_write_bytecode = True
    patches: list[tuple[object, str, object]] = []
    if writes is not None:
        real_open = builtins.open

        def guarded_open(file, mode="r", *args, **kwargs):
            if any(flag in str(mode) for flag in "wax+"):
                writes.append(f"open({file!r}, {mode!r})")
            return real_open(file, mode, *args, **kwargs)

        def blocker(label: str):
            def _blocked(*args, **kwargs):
                writes.append(label)
                raise AssertionError(f"import performed {label}")

            return _blocked

        patches = [
            (builtins, "open", guarded_open),
            (Path, "write_text", blocker("Path.write_text")),
            (Path, "write_bytes", blocker("Path.write_bytes")),
            (Path, "mkdir", blocker("Path.mkdir")),
            (Path, "touch", blocker("Path.touch")),
            (Path, "unlink", blocker("Path.unlink")),
            (os, "makedirs", blocker("os.makedirs")),
            (os, "remove", blocker("os.remove")),
            (os, "rename", blocker("os.rename")),
            (os, "replace", blocker("os.replace")),
            (shutil, "copyfile", blocker("shutil.copyfile")),
            (shutil, "copytree", blocker("shutil.copytree")),
            (shutil, "move", blocker("shutil.move")),
            (shutil, "rmtree", blocker("shutil.rmtree")),
        ]
    originals = [(obj, attr, getattr(obj, attr)) for obj, attr, _ in patches]
    for obj, attr, value in patches:
        setattr(obj, attr, value)
    try:
        spec = importlib.util.spec_from_file_location(name, path)
        if spec is None or spec.loader is None:
            raise ImportError(f"cannot load canonical skill module: {path}")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    finally:
        for obj, attr, value in originals:
            setattr(obj, attr, value)
        sys.dont_write_bytecode = previous_bytecode_flag
    return module


def _run_main(module, argv: list[str]) -> tuple[int, str, str]:
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        code = module.main(argv)
    return code, out.getvalue(), err.getvalue()


def _tree_hashes(root: Path) -> dict[str, str]:
    return {
        path.relative_to(root).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(root.rglob("*"))
        if path.is_file()
    }


class NativePixelSkillTreeTests(unittest.TestCase):
    """Canonical `native-rpg-pixel-sprites` project skill contract."""

    def temp_repo_with_skill(self) -> Path:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        root = Path(tmp.name)
        target = root / ".agents" / "skills" / NATIVE_SKILL
        target.parent.mkdir(parents=True)
        shutil.copytree(NATIVE_SKILL_ROOT, target)
        return root

    def test_skill_is_registered_in_the_expected_project_skill_set(self) -> None:
        self.assertIn(NATIVE_SKILL, EXPECTED_SKILLS)

    def test_canonical_tree_is_exactly_the_seven_contracted_files(self) -> None:
        actual = sorted(
            path.relative_to(NATIVE_SKILL_ROOT).as_posix()
            for path in NATIVE_SKILL_ROOT.rglob("*")
            if path.is_file()
        )
        self.assertEqual(sorted(NATIVE_SKILL_FILES), actual)

    def test_skill_frontmatter_and_required_sections_validate(self) -> None:
        root = self.temp_repo_with_skill()
        sync_skills(root, prune=True)
        self.assertEqual([], validate_repository(root, expected_skills={NATIVE_SKILL}))

    def test_skill_links_every_reference_and_script(self) -> None:
        text = (NATIVE_SKILL_ROOT / "SKILL.md").read_text(encoding="utf-8")
        for relative in NATIVE_SKILL_FILES:
            if relative == "SKILL.md":
                continue
            self.assertIn(relative, text, f"SKILL.md does not link {relative}")

    def test_canonical_and_mirror_are_byte_identical_after_sync(self) -> None:
        root = self.temp_repo_with_skill()
        sync_skills(root, prune=True)
        canonical = root / ".agents" / "skills"
        mirror = root / ".claude" / "skills"
        self.assertEqual(_tree_hashes(canonical), _tree_hashes(mirror))
        self.assertEqual([], sync_skills(root, prune=True))

    def test_skill_prose_uses_no_undocumented_machine_local_path(self) -> None:
        offenders: list[str] = []
        for path in sorted(NATIVE_SKILL_ROOT.rglob("*")):
            if not path.is_file():
                continue
            for match in MACHINE_PATH.finditer(path.read_text(encoding="utf-8")):
                found = match.group(0)
                if not any(found.startswith(allowed) for allowed in DOCUMENTED_TASK_INPUT_PATHS):
                    offenders.append(f"{path.relative_to(NATIVE_SKILL_ROOT).as_posix()}: {found}")
        self.assertEqual([], offenders)

    def test_skill_preserves_the_full_capability_and_separation_contract(self) -> None:
        corpus = "\n".join(
            (NATIVE_SKILL_ROOT / relative).read_text(encoding="utf-8")
            for relative in NATIVE_SKILL_FILES
            if relative.endswith(".md")
        )
        required = (
            "Character 4x4",
            "Trainer front",
            "Trainer back",
            "Item",
            "VS Bar",
            "portrait-left",
            "portrait-right",
            "VS composition",
            "background removal",
            "format conversion",
            "DESIGN",
            "STYLE",
            "TECHNICAL",
            "UNAPPROVED_DRAFT",
            "GAME_READY_UNAPPROVED_DRAFT",
            "APPROVED_ASSET",
            "RUNTIME_VERIFIED",
        )
        for token in required:
            self.assertIn(token, corpus, f"missing preserved contract token: {token}")

    def test_skill_forbids_gender_mapping_and_identity_leakage(self) -> None:
        corpus = "\n".join(
            (NATIVE_SKILL_ROOT / relative).read_text(encoding="utf-8")
            for relative in NATIVE_SKILL_FILES
            if relative.endswith(".md")
        )
        for token in ("Leaf", "Red", "identity leakage", "subtype", "style family"):
            self.assertIn(token, corpus, f"missing rule token: {token}")

    def test_analyzer_and_validator_import_without_writing_files(self) -> None:
        for relative, name in (
            ("scripts/analyze_native_pixel.py", "pwh_import_probe_analyze"),
            ("scripts/validate_asset.py", "pwh_import_probe_validate"),
        ):
            with self.subTest(module=relative):
                writes: list[str] = []
                before = _tree_hashes(NATIVE_SKILL_ROOT)
                module = _import_skill_module(relative, name, writes=writes)
                self.assertEqual([], writes)
                self.assertTrue(callable(module.main))
                self.assertEqual(before, _tree_hashes(NATIVE_SKILL_ROOT))

    def test_pillow_is_available(self) -> None:
        self.assertIsNotNone(_load_pillow(), "Pillow is required for native pixel analysis")


class NativePixelFixtureTestCase(unittest.TestCase):
    """Synthetic temporary PNG fixtures; nothing is written into the repository."""

    module_relative = "scripts/analyze_native_pixel.py"

    @classmethod
    def setUpClass(cls) -> None:
        cls.image = _load_pillow()
        cls.analyzer = _import_skill_module(cls.module_relative, "pwh_analyze_native_pixel")

    def setUp(self) -> None:
        if self.image is None:
            self.fail("Pillow is required for native pixel analysis")
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.tmp = Path(tmp.name)

    def rect_pixels(self, width, height, rects):
        pixels = []
        for y in range(height):
            for x in range(width):
                color = (0, 0, 0, 0)
                for left, top, right, bottom, fill in rects:
                    if left <= x <= right and top <= y <= bottom:
                        color = fill
                        break
                pixels.append(color)
        return pixels

    def write_png(self, name, width, height, pixels) -> Path:
        image = self.image.new("RGBA", (width, height), (0, 0, 0, 0))
        image.putdata(pixels)
        path = self.tmp / name
        image.save(path)
        return path

    def block_sprite(self, name="block.png") -> Path:
        """8x8 canvas, binary alpha, one 4x4 red square at (2,2)-(5,5)."""
        pixels = self.rect_pixels(8, 8, [(2, 2, 5, 5, (200, 40, 40, 255))])
        return self.write_png(name, 8, 8, pixels)

    def analyze(self, argv) -> dict:
        code, out, err = _run_main(self.analyzer, argv)
        self.assertEqual(0, code, err)
        self.assertEqual("", err)
        return json.loads(out)


class NativePixelAnalyzerTests(NativePixelFixtureTestCase):
    def test_reports_canvas_alpha_visible_box_and_colors(self) -> None:
        result = self.analyze([str(self.block_sprite())])
        self.assertEqual({"width": 8, "height": 8}, {
            "width": result["canvas"]["width"],
            "height": result["canvas"]["height"],
        })
        self.assertEqual("binary", result["alpha"]["family"])
        self.assertEqual(48, result["alpha"]["transparent_pixels"])
        self.assertEqual(16, result["alpha"]["opaque_pixels"])
        self.assertEqual(0, result["alpha"]["partial_pixels"])
        self.assertEqual([2, 2, 5, 5], result["visible"]["bbox_inclusive"])
        self.assertEqual(4, result["visible"]["width"])
        self.assertEqual(4, result["visible"]["height"])
        self.assertEqual(16, result["visible"]["pixels"])
        self.assertEqual(1, result["colors"]["opaque_color_count"])
        self.assertEqual(1, result["colors"]["visible_color_count"])

    def test_measures_only_requested_logical_block_sizes(self) -> None:
        result = self.analyze([str(self.block_sprite()), "--block-size", "2", "--block-size", "3"])
        self.assertEqual([2, 3], [entry["block_size"] for entry in result["logical_grid"]])
        two, three = result["logical_grid"]
        self.assertTrue(two["aligned"])
        self.assertEqual(16, two["full_blocks"])
        self.assertEqual(16, two["uniform_blocks"])
        self.assertEqual(1.0, two["uniform_ratio"])
        self.assertFalse(three["aligned"])
        self.assertEqual(4, three["full_blocks"])
        self.assertEqual(1, three["uniform_blocks"])
        self.assertEqual(0.25, three["uniform_ratio"])

    def test_no_logical_grid_is_measured_without_an_explicit_block_size(self) -> None:
        result = self.analyze([str(self.block_sprite())])
        self.assertEqual([], result["logical_grid"])

    def test_run_length_and_cluster_histograms(self) -> None:
        result = self.analyze([str(self.block_sprite())])
        self.assertEqual([[4, 4]], result["runs"]["horizontal"])
        self.assertEqual([[4, 4]], result["runs"]["vertical"])
        clusters = result["clusters"]
        self.assertEqual(1, clusters["count"])
        self.assertEqual([[16, 1]], clusters["size_histogram"])
        self.assertEqual(16, clusters["largest_size"])
        self.assertEqual(0, clusters["singleton_count"])

    def test_contour_stair_summary_at_alpha_boundary(self) -> None:
        contour = self.analyze([str(self.block_sprite())])["contour"]
        self.assertEqual("all-alpha-boundary-edges", contour["semantics"])
        self.assertEqual(12, contour["boundary_pixels"])
        self.assertEqual(16, contour["boundary_edges"])
        for facing in ("up", "down", "left", "right"):
            self.assertEqual([[4, 1]], contour["edge_runs"][facing])
        self.assertEqual(
            {"up": 1, "down": 1, "left": 1, "right": 1, "total": 4}, contour["run_count"]
        )
        self.assertEqual(4, contour["longest_run"])
        self.assertEqual(1, contour["visible_component_count"])
        self.assertEqual(0, contour["hole_count"])
        self.assertEqual([[4, 1]], contour["row_column_envelope"]["left_edge_runs"])

    def test_contour_covers_holes_not_only_the_outer_envelope(self) -> None:
        """A ring: the 2x2 hole boundary must be measured, not just the outer square."""
        fill = (200, 40, 40, 255)
        pixels = self.rect_pixels(8, 8, [(2, 2, 3, 3, (0, 0, 0, 0)), (1, 1, 4, 4, fill)])
        contour = self.analyze([str(self.write_png("ring.png", 8, 8, pixels))])["contour"]
        self.assertEqual(12, contour["boundary_pixels"])
        self.assertEqual(24, contour["boundary_edges"])
        for facing in ("up", "down", "left", "right"):
            self.assertEqual([[2, 1], [4, 1]], contour["edge_runs"][facing], facing)
        self.assertEqual(8, contour["run_count"]["total"])
        self.assertEqual(1, contour["visible_component_count"])
        self.assertEqual(1, contour["hole_count"])
        # The row/column envelope alone cannot see the hole; it stays a separate key.
        self.assertEqual([[4, 1]], contour["row_column_envelope"]["left_edge_runs"])

    def test_contour_reports_concave_stair_runs_across_components(self) -> None:
        """A staircase triangle plus a detached square: every component is summarised."""
        fill = (40, 200, 40, 255)
        pixels = self.rect_pixels(
            8,
            8,
            [
                (1, 1, 1, 1, fill),
                (1, 2, 2, 2, fill),
                (1, 3, 3, 3, fill),
                (6, 6, 7, 7, (40, 40, 200, 255)),
            ],
        )
        contour = self.analyze([str(self.write_png("stair.png", 8, 8, pixels))])["contour"]
        self.assertEqual(10, contour["boundary_pixels"])
        self.assertEqual(2, contour["visible_component_count"])
        self.assertEqual(0, contour["hole_count"])
        # triangle: three 1px treads up, three 1px risers right, one flat run each way;
        # the detached 2x2 square adds one run of 2 to every facing.
        self.assertEqual([[1, 3], [2, 1]], contour["edge_runs"]["up"])
        self.assertEqual([[1, 3], [2, 1]], contour["edge_runs"]["right"])
        self.assertEqual([[2, 1], [3, 1]], contour["edge_runs"]["down"])
        self.assertEqual([[2, 1], [3, 1]], contour["edge_runs"]["left"])
        self.assertEqual(
            {"up": 4, "down": 2, "left": 2, "right": 4, "total": 12}, contour["run_count"]
        )
        self.assertEqual(3, contour["longest_run"])
        self.assertEqual(20, contour["boundary_edges"])

    def test_isolated_fragments_only_under_an_explicit_threshold(self) -> None:
        pixels = self.rect_pixels(
            8,
            8,
            [
                (2, 2, 5, 5, (200, 40, 40, 255)),
                (7, 0, 7, 0, (10, 10, 200, 255)),
                (0, 7, 1, 7, (10, 200, 10, 255)),
            ],
        )
        path = self.write_png("fragments.png", 8, 8, pixels)
        self.assertIsNone(self.analyze([str(path)])["fragments"])
        result = self.analyze([str(path), "--fragment-max-size", "3"])
        self.assertEqual(3, result["fragments"]["max_size"])
        self.assertEqual(3, result["fragments"]["component_count"])
        self.assertEqual(2, result["fragments"]["fragment_count"])
        self.assertEqual([1, 2], result["fragments"]["fragment_sizes"])
        self.assertEqual(16, result["fragments"]["largest_component_size"])

    def test_explicit_frame_slices(self) -> None:
        pixels = self.rect_pixels(
            16,
            8,
            [(2, 2, 5, 5, (200, 40, 40, 255)), (10, 3, 11, 4, (40, 40, 200, 255))],
        )
        path = self.write_png("frames.png", 16, 8, pixels)
        self.assertIsNone(self.analyze([str(path)])["frames"])
        result = self.analyze([str(path), "--frames", "2"])["frames"]
        self.assertEqual({"count": 2, "columns": 2, "rows": 1}, {
            "count": result["count"],
            "columns": result["columns"],
            "rows": result["rows"],
        })
        self.assertEqual(8, result["slice_width"])
        self.assertEqual(8, result["slice_height"])
        first, second = result["slices"]
        self.assertEqual([0, 8], first["x_range"])
        self.assertEqual(16, first["visible_pixels"])
        self.assertEqual([2, 2, 5, 5], first["bbox_inclusive"])
        self.assertEqual([8, 16], second["x_range"])
        self.assertEqual(4, second["visible_pixels"])
        self.assertEqual([10, 3, 11, 4], second["bbox_inclusive"])
        self.assertEqual([2, 3, 3, 4], second["bbox_local"])

    def test_explicit_frame_grid(self) -> None:
        pixels = self.rect_pixels(16, 8, [(2, 2, 5, 5, (200, 40, 40, 255))])
        path = self.write_png("grid.png", 16, 8, pixels)
        result = self.analyze([str(path), "--frame-grid", "2x2"])["frames"]
        self.assertEqual(4, result["count"])
        self.assertEqual(8, result["slice_width"])
        self.assertEqual(4, result["slice_height"])
        self.assertEqual([0, 0, 8, 8], [
            result["slices"][0]["column"],
            result["slices"][0]["row"],
            result["slices"][1]["x_range"][0],
            result["slices"][2]["visible_pixels"],
        ])

    def test_baseline_and_anchor_measured_only_when_supplied(self) -> None:
        path = self.block_sprite()
        bare = self.analyze([str(path)])
        self.assertIsNone(bare["baseline"])
        self.assertIsNone(bare["anchor"])

        result = self.analyze([str(path), "--baseline-row", "3", "--anchor", "3,5"])
        baseline = result["baseline"]
        self.assertEqual(3, baseline["row"])
        self.assertEqual(4, baseline["visible_pixels"])
        self.assertEqual(2, baseline["left"])
        self.assertEqual(5, baseline["right"])
        self.assertEqual(5, baseline["lowest_visible_row"])
        self.assertEqual(2, baseline["offset_from_lowest_visible"])
        self.assertEqual(2, baseline["rows_below_with_visible"])

        anchor = result["anchor"]
        self.assertEqual(3, anchor["x"])
        self.assertEqual(5, anchor["y"])
        self.assertEqual(255, anchor["alpha"])
        self.assertTrue(anchor["visible"])
        self.assertEqual(
            {"left": 1, "top": 3, "right": 2, "bottom": 0},
            anchor["offset_from_visible_bbox"],
        )
        self.assertEqual(
            {"left": 3, "top": 5, "right": 4, "bottom": 2},
            anchor["offset_from_canvas"],
        )

    def test_soft_alpha_family_is_reported_not_normalized(self) -> None:
        pixels = self.rect_pixels(4, 4, [(1, 1, 2, 2, (10, 20, 30, 128))])
        path = self.write_png("soft.png", 4, 4, pixels)
        result = self.analyze([str(path)])
        self.assertEqual("soft", result["alpha"]["family"])
        self.assertEqual(4, result["alpha"]["partial_pixels"])
        self.assertEqual(0, result["colors"]["opaque_color_count"])
        self.assertEqual(1, result["colors"]["visible_color_count"])

    def test_invalid_inputs_exit_nonzero_with_actionable_stderr(self) -> None:
        path = self.block_sprite()
        cases = (
            ([str(self.tmp / "absent.png")], "not found"),
            ([str(path), "--frames", "3"], "does not divide"),
            ([str(path), "--frame-grid", "3x1"], "does not divide"),
            ([str(path), "--frames", "3", "--frame-grid", "2x2"], "inconsistent"),
            ([str(path), "--block-size", "0"], "block size"),
            ([str(path), "--fragment-max-size", "0"], "fragment"),
            ([str(path), "--baseline-row", "8"], "baseline row"),
            ([str(path), "--anchor", "9,0"], "anchor"),
            ([str(path), "--anchor", "3"], "anchor"),
        )
        for argv, needle in cases:
            with self.subTest(argv=argv):
                code, out, err = _run_main(self.analyzer, argv)
                self.assertNotEqual(0, code)
                self.assertEqual("", out)
                self.assertIn(needle, err)

    def test_non_image_input_exits_nonzero(self) -> None:
        broken = self.tmp / "broken.png"
        broken.write_bytes(b"not a png")
        code, out, err = _run_main(self.analyzer, [str(broken)])
        self.assertNotEqual(0, code)
        self.assertEqual("", out)
        self.assertIn("cannot read image", err)

    def test_output_is_deterministic_and_leaves_the_image_untouched(self) -> None:
        path = self.block_sprite()
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        argv = [str(path), "--block-size", "2", "--fragment-max-size", "2"]
        first = _run_main(self.analyzer, argv)
        second = _run_main(self.analyzer, argv)
        self.assertEqual(first, second)
        self.assertEqual(digest, hashlib.sha256(path.read_bytes()).hexdigest())
        payload = json.loads(first[1])
        self.assertEqual(sorted(payload), list(payload))
        self.assertEqual("native-pixel-analysis/1", payload["schema"])

    def test_analyzer_never_guesses_subtype_or_approval(self) -> None:
        payload = self.analyze([str(self.block_sprite())])
        for guessed in ("subtype", "approval", "state", "logical_scale", "style_family"):
            self.assertNotIn(guessed, payload)


class NativeAssetValidatorTests(NativePixelFixtureTestCase):
    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        cls.validator = _import_skill_module("scripts/validate_asset.py", "pwh_validate_asset")

    def analysis_file(self, argv, name="analysis.json") -> Path:
        payload = self.analyze(argv)
        path = self.tmp / name
        path.write_text(json.dumps(payload), encoding="utf-8")
        return path

    def contract_file(self, contract, name="contract.json") -> Path:
        path = self.tmp / name
        path.write_text(json.dumps(contract), encoding="utf-8")
        return path

    def full_analysis(self) -> Path:
        return self.analysis_file([
            str(self.block_sprite()),
            "--block-size", "2",
            "--frames", "1",
            "--fragment-max-size", "3",
            "--baseline-row", "5",
            "--anchor", "3,5",
        ])

    @staticmethod
    def full_contract() -> dict:
        return {
            "schema": "native-pixel-technical-contract/1",
            "canvas": {"width": 8, "height": 8},
            "alpha": {"family": "binary"},
            "visible_bbox": {"left": 2, "top": 2, "right": 5, "bottom": 5},
            "frames": {
                "count": 1,
                "columns": 1,
                "rows": 1,
                "slice_width": 8,
                "slice_height": 8,
                "min_visible_pixels_per_frame": 1,
            },
            "logical_grid": {"block_size": 2, "min_uniform_ratio": 1.0},
            "baseline": {"row": 5, "max_offset_from_lowest_visible": 0},
            "anchor": {"x": 3, "y": 5, "must_be_visible": True},
            "preview_scaling": {"factor": 4, "filter": "nearest", "width": 32, "height": 32},
            "fragments": {"max_size": 3, "max_count": 0},
        }

    def validate(self, analysis: Path, contract: dict, name="contract.json"):
        return _run_main(
            self.validator,
            ["--analysis", str(analysis), "--contract", str(self.contract_file(contract, name))],
        )

    def test_full_technical_contract_passes_with_separated_states(self) -> None:
        code, out, err = self.validate(self.full_analysis(), self.full_contract())
        self.assertEqual(0, code, err)
        payload = json.loads(out)
        self.assertEqual("PASS", payload["technical_status"])
        self.assertEqual(
            {
                "alpha.family": "PASS",
                "anchor.position": "PASS",
                "baseline.row": "PASS",
                "canvas.height": "PASS",
                "canvas.width": "PASS",
                "design_identity_locks": "UNVERIFIED",
                "fragments.count": "PASS",
                "frames.count": "PASS",
                "frames.slices": "PASS",
                "logical_grid.uniform_ratio": "PASS",
                "preview_scaling.dimensions": "PASS",
                "preview_scaling.factor": "PASS",
                "preview_scaling.filter": "PASS",
                "runtime_verification": "UNVERIFIED",
                "style_identity_leakage": "UNVERIFIED",
                "user_adoption": "UNVERIFIED",
                "visible_bbox": "PASS",
                "visual_similarity": "UNVERIFIED",
            },
            {finding["metric"]: finding["status"] for finding in payload["findings"]},
        )
        self.assertEqual({"PASS": 13, "FAIL": 0, "UNVERIFIED": 5}, payload["counts"])

    def test_technical_failures_are_reported_and_exit_nonzero(self) -> None:
        contract = self.full_contract()
        contract["canvas"]["width"] = 160
        contract["alpha"]["family"] = "soft"
        contract["visible_bbox"]["right"] = 6
        code, out, err = self.validate(self.full_analysis(), contract)
        self.assertEqual(1, code)
        self.assertEqual("", err)
        payload = json.loads(out)
        self.assertEqual("FAIL", payload["technical_status"])
        statuses = {finding["metric"]: finding["status"] for finding in payload["findings"]}
        self.assertEqual("FAIL", statuses["canvas.width"])
        self.assertEqual("FAIL", statuses["alpha.family"])
        self.assertEqual("FAIL", statuses["visible_bbox"])
        self.assertEqual("PASS", statuses["canvas.height"])
        self.assertEqual(3, payload["counts"]["FAIL"])

    def test_uncontracted_metrics_are_unverified_never_pass(self) -> None:
        analysis = self.full_analysis()
        code, out, err = self.validate(analysis, {"canvas": {"width": 8, "height": 8}})
        self.assertEqual(0, code, err)
        payload = json.loads(out)
        statuses = {finding["metric"]: finding["status"] for finding in payload["findings"]}
        self.assertEqual("PASS", statuses["canvas.width"])
        for metric in ("visible_bbox", "alpha.family", "logical_grid.uniform_ratio", "frames.count"):
            self.assertEqual("UNVERIFIED", statuses[metric])
        self.assertEqual({"PASS": 2, "FAIL": 0, "UNVERIFIED": 16}, payload["counts"])

    def test_visual_identity_adoption_and_runtime_are_never_pass(self) -> None:
        code, out, _ = self.validate(self.full_analysis(), self.full_contract())
        self.assertEqual(0, code)
        payload = json.loads(out)
        statuses = {finding["metric"]: finding["status"] for finding in payload["findings"]}
        for metric in self.validator.NEVER_VERIFIED:
            self.assertEqual("UNVERIFIED", statuses[metric])
        self.assertNotIn("visual_status", payload)
        self.assertNotIn("approved", payload)

    def test_contracted_metric_without_measurement_is_a_usage_error(self) -> None:
        analysis = self.analysis_file([str(self.block_sprite())])
        for contract, needle in (
            ({"logical_grid": {"block_size": 2, "min_uniform_ratio": 1.0}}, "block size 2"),
            ({"frames": {"count": 1}}, "frame"),
            ({"baseline": {"row": 5}}, "baseline"),
            ({"anchor": {"x": 3, "y": 5}}, "anchor"),
            ({"fragments": {"max_size": 3, "max_count": 0}}, "fragment"),
        ):
            with self.subTest(contract=contract):
                code, out, err = self.validate(analysis, contract, name="partial.json")
                self.assertEqual(2, code)
                self.assertEqual("", out)
                self.assertIn(needle, err)

    def test_empty_or_unknown_contract_is_a_usage_error(self) -> None:
        analysis = self.full_analysis()
        code, out, err = self.validate(analysis, {"schema": "native-pixel-technical-contract/1"})
        self.assertEqual(2, code)
        self.assertEqual("", out)
        self.assertIn("no metric", err)

        code, out, err = self.validate(analysis, {"canvas": {"width": 8}, "sparkle": {}}, name="odd.json")
        self.assertEqual(2, code)
        self.assertEqual("", out)
        self.assertIn("sparkle", err)

    def test_known_section_without_a_judgeable_metric_is_a_usage_error(self) -> None:
        """A named section must carry something to judge; PASS is never inferred from shape."""
        analysis = self.full_analysis()
        for contract, needle in (
            ({"canvas": {}}, "canvas"),
            ({"logical_grid": {"block_size": 2}}, "min_uniform_ratio"),
            ({"baseline": {"row": 5}}, "max_offset_from_lowest_visible"),
            ({"anchor": {"x": 3, "y": 5}}, "must_be_visible"),
        ):
            with self.subTest(contract=contract):
                code, out, err = self.validate(analysis, contract, name="hollow.json")
                self.assertEqual(2, code)
                self.assertEqual("", out)
                self.assertIn("at least one", err)
                self.assertIn(needle, err)

    def test_every_accepted_section_produces_at_least_one_judged_finding(self) -> None:
        analysis = self.full_analysis()
        full = self.full_contract()
        for section in self.validator.CONTRACT_SECTIONS:
            with self.subTest(section=section):
                code, out, err = self.validate(
                    analysis, {section: full[section]}, name=f"{section}.json"
                )
                self.assertEqual(0, code, err)
                payload = json.loads(out)
                judged = [
                    finding for finding in payload["findings"]
                    if finding["status"] in ("PASS", "FAIL")
                ]
                self.assertTrue(judged, f"{section} judged nothing yet reported a status")
                self.assertEqual("PASS", payload["technical_status"])

    def test_validate_refuses_to_report_pass_without_a_judged_metric(self) -> None:
        """Last-resort invariant: a report is emitted only when something was judged."""
        analysis = json.loads(self.full_analysis().read_text(encoding="utf-8"))
        original = self.validator.REQUIRED_ANY_SUBKEYS
        self.validator.REQUIRED_ANY_SUBKEYS = {}
        self.addCleanup(setattr, self.validator, "REQUIRED_ANY_SUBKEYS", original)
        with self.assertRaises(self.validator.ContractError) as caught:
            self.validator.validate(analysis, {"canvas": {}})
        self.assertIn("judge", str(caught.exception))

    def test_preview_scaling_metadata_must_be_nearest_and_integer(self) -> None:
        analysis = self.full_analysis()
        good = {"preview_scaling": {"factor": 4, "filter": "nearest", "width": 32, "height": 32}}
        code, out, err = self.validate(analysis, good, name="preview-good.json")
        self.assertEqual(0, code, err)
        statuses = {f["metric"]: f["status"] for f in json.loads(out)["findings"]}
        self.assertEqual("PASS", statuses["preview_scaling.factor"])
        self.assertEqual("PASS", statuses["preview_scaling.filter"])
        self.assertEqual("PASS", statuses["preview_scaling.dimensions"])

        bad_filter = {"preview_scaling": {"factor": 4, "filter": "bilinear", "width": 32, "height": 32}}
        code, out, _ = self.validate(analysis, bad_filter, name="preview-filter.json")
        self.assertEqual(1, code)
        self.assertEqual("FAIL", {f["metric"]: f["status"] for f in json.loads(out)["findings"]}["preview_scaling.filter"])

        bad_size = {"preview_scaling": {"factor": 4, "filter": "nearest", "width": 30, "height": 32}}
        code, out, _ = self.validate(analysis, bad_size, name="preview-size.json")
        self.assertEqual(1, code)
        self.assertEqual("FAIL", {f["metric"]: f["status"] for f in json.loads(out)["findings"]}["preview_scaling.dimensions"])

        bad_factor = {"preview_scaling": {"factor": 1.5, "filter": "nearest"}}
        code, out, _ = self.validate(analysis, bad_factor, name="preview-factor.json")
        self.assertEqual(1, code)
        statuses = {f["metric"]: f["status"] for f in json.loads(out)["findings"]}
        self.assertEqual("FAIL", statuses["preview_scaling.factor"])
        self.assertEqual("UNVERIFIED", statuses["preview_scaling.dimensions"])

    def test_validator_reads_no_image_and_writes_nothing(self) -> None:
        source = (NATIVE_SKILL_ROOT / "scripts" / "validate_asset.py").read_text(encoding="utf-8")
        self.assertNotIn("PIL", source)
        self.assertNotIn("Image.open", source)
        self.full_analysis()
        before = _tree_hashes(self.tmp)
        code, _, err = self.validate(self.tmp / "analysis.json", self.full_contract(), name="stable.json")
        self.assertEqual(0, code, err)
        after = _tree_hashes(self.tmp)
        self.assertEqual(before, {key: value for key, value in after.items() if key in before})

    def test_validator_output_is_deterministic(self) -> None:
        analysis = self.full_analysis()
        first = self.validate(analysis, self.full_contract(), name="a.json")
        second = self.validate(analysis, self.full_contract(), name="b.json")
        self.assertEqual(first, second)
        payload = json.loads(first[1])
        self.assertEqual(sorted(payload), list(payload))
        self.assertEqual(
            sorted(finding["metric"] for finding in payload["findings"]),
            [finding["metric"] for finding in payload["findings"]],
        )

    def test_analysis_schema_mismatch_is_a_usage_error(self) -> None:
        bogus = self.tmp / "bogus.json"
        bogus.write_text(json.dumps({"schema": "other/9", "canvas": {"width": 8}}), encoding="utf-8")
        code, out, err = self.validate(bogus, {"canvas": {"width": 8}}, name="schema.json")
        self.assertEqual(2, code)
        self.assertEqual("", out)
        self.assertIn("schema", err)


if __name__ == "__main__":
    unittest.main()
