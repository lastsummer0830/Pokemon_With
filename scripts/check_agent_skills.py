#!/usr/bin/env python3
"""Validate and synchronize Pokemon_With project skills.

`.agents/skills` is canonical. `.claude/skills` is a generated mirror for
Claude Code. The default command validates only; `--sync` copies canonical
files, and `--prune` removes mirror entries that are not canonical.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

EXPECTED_SKILLS = frozenset(
    {
        "ar-compare",
        "build-run-debug",
        "field-event-pipeline",
        "game-ui-hud-polish",
        "home-bonus-system",
        "native-rpg-pixel-sprites",
        "phaser-scene-builder",
        "pokemon-asset-pipeline",
        "save-state-system",
        "tiled-map-grid-movement",
        "turn-battle-system",
        "webapp-testing",
    }
)
REQUIRED_FIELDS = ("name", "description", "version", "platforms")
REQUIRED_SECTIONS = (
    "When to Use",
    "Required Inputs",
    "Procedure",
    "Cost Limits",
    "Verification",
    "Pitfalls",
)
FORBIDDEN_TEXT = (
    "localhost:5173",
    "HouseScene",
    "/mnt/d",
    "D:\\Pokemon Another Red",
    "D:/Pokemon Another Red",
    "public/assets/audio/` 현재 비움",
)
TEXT_SUFFIXES = frozenset({".md", ".txt", ".json", ".yaml", ".yml", ".py", ".sh", ".mjs", ".ts"})


def _frontmatter(text: str) -> dict[str, str]:
    if not text.startswith("---\n"):
        return {}
    end = text.find("\n---\n", 4)
    if end < 0:
        return {}
    values: dict[str, str] = {}
    for line in text[4:end].splitlines():
        match = re.match(r"^([A-Za-z][A-Za-z0-9_-]*):\s*(.+?)\s*$", line)
        if match:
            values[match.group(1)] = match.group(2).strip('"\'')
    return values


def _symlinks(root: Path) -> list[Path]:
    if root.is_symlink():
        return [root]
    if not root.exists():
        return []
    return [path for path in root.rglob("*") if path.is_symlink()]


def _files(root: Path) -> dict[str, bytes]:
    if not root.exists():
        return {}
    return {
        path.relative_to(root).as_posix(): path.read_bytes()
        for path in root.rglob("*")
        if path.is_file()
    }


def sync_skills(repo_root: Path, prune: bool = False) -> list[str]:
    canonical = repo_root / ".agents" / "skills"
    mirror = repo_root / ".claude" / "skills"
    if not canonical.is_dir():
        raise FileNotFoundError(f"canonical skill directory missing: {canonical}")
    mirror.mkdir(parents=True, exist_ok=True)
    links = _symlinks(canonical) + _symlinks(mirror)
    if links:
        joined = ", ".join(str(path) for path in links)
        raise ValueError(f"skill trees must not contain symlinks: {joined}")

    copied: list[str] = []
    source_files = _files(canonical)
    for rel, content in source_files.items():
        target = mirror / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists() or target.read_bytes() != content:
            target.write_bytes(content)
            copied.append(rel)

    if prune:
        for rel in sorted(set(_files(mirror)) - set(source_files), reverse=True):
            (mirror / rel).unlink()
        for directory in sorted(
            (path for path in mirror.rglob("*") if path.is_dir()),
            key=lambda path: len(path.parts),
            reverse=True,
        ):
            try:
                directory.rmdir()
            except OSError:
                pass
    return copied


def validate_repository(
    repo_root: Path,
    expected_skills: frozenset[str] | set[str] = EXPECTED_SKILLS,
) -> list[str]:
    canonical = repo_root / ".agents" / "skills"
    mirror = repo_root / ".claude" / "skills"
    errors: list[str] = []

    links = _symlinks(canonical) + _symlinks(mirror)
    if links:
        return [
            f"{path.relative_to(repo_root).as_posix()}: symlinks are not allowed in skill trees"
            for path in links
        ]

    skill_dirs = sorted(path for path in canonical.iterdir() if path.is_dir()) if canonical.is_dir() else []
    if not skill_dirs:
        return ["no canonical skills found under .agents/skills"]

    actual_skills = {path.name for path in skill_dirs}
    for missing in sorted(set(expected_skills) - actual_skills):
        errors.append(f".agents/skills/{missing}: expected project skill missing")
    for extra in sorted(actual_skills - set(expected_skills)):
        errors.append(f".agents/skills/{extra}: unexpected project skill")

    for skill_dir in skill_dirs:
        entry = skill_dir / "SKILL.md"
        rel = entry.relative_to(repo_root).as_posix()
        if not entry.is_file():
            errors.append(f"{rel}: missing")
            continue
        text = entry.read_text(encoding="utf-8-sig")
        frontmatter = _frontmatter(text)
        for field in REQUIRED_FIELDS:
            if not frontmatter.get(field):
                errors.append(f"{rel}: missing frontmatter field {field}")
        if "\t" in text.split("\n---\n", 1)[0]:
            errors.append(f"{rel}: tabs are not allowed in frontmatter")
        name = frontmatter.get("name", "")
        if name != skill_dir.name:
            errors.append(f"{rel}: name must match directory {skill_dir.name}")
        if name and not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", name):
            errors.append(f"{rel}: invalid skill name {name}")
        version = frontmatter.get("version", "")
        if version and not re.fullmatch(r"\d+\.\d+\.\d+", version):
            errors.append(f"{rel}: version must use semantic x.y.z form")
        platforms = frontmatter.get("platforms", "")
        if platforms and not re.fullmatch(r"\[(?:linux|windows)(?:,\s*(?:linux|windows))*\]", platforms):
            errors.append(f"{rel}: unsupported platforms format {platforms}")
        description = frontmatter.get("description", "")
        if len(description) > 1536:
            errors.append(f"{rel}: description is {len(description)} chars; maximum is 1536")
        for section in REQUIRED_SECTIONS:
            if f"## {section}" not in text:
                errors.append(f"{rel}: missing section {section}")

    canonical_files = _files(canonical)
    for file_rel, content in canonical_files.items():
        if Path(file_rel).suffix.lower() not in TEXT_SUFFIXES:
            continue
        display = f".agents/skills/{file_rel}"
        try:
            support_text = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            errors.append(f"{display}: text support file is not UTF-8")
            continue
        for forbidden in FORBIDDEN_TEXT:
            if forbidden in support_text:
                errors.append(f"{display}: stale reference {forbidden}")

    mirror_files = _files(mirror)
    for rel in sorted(set(canonical_files) - set(mirror_files)):
        errors.append(f".claude/skills/{rel}: mirror file missing")
    for rel in sorted(set(mirror_files) - set(canonical_files)):
        errors.append(f".claude/skills/{rel}: extra mirror file")
    for rel in sorted(set(canonical_files) & set(mirror_files)):
        if canonical_files[rel] != mirror_files[rel]:
            errors.append(f".claude/skills/{rel}: differs from canonical")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sync", action="store_true", help="copy canonical skills to Claude mirror")
    parser.add_argument("--prune", action="store_true", help="remove non-canonical mirror entries")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    if args.prune and not args.sync:
        parser.error("--prune requires --sync")
    if args.sync:
        copied = sync_skills(repo_root, prune=args.prune)
        print(f"SYNC: {len(copied)} file(s) updated")

    errors = validate_repository(repo_root)
    if errors:
        print("FAIL: agent skill control")
        for error in errors:
            print(f"- {error}")
        return 1
    print("PASS: expected project skill set, support text, and Claude mirror are valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
