#!/usr/bin/env python3
"""Validate Pokemon_With Hermes reports before final delivery."""
from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

REPORT_RE = re.compile(r"<!-- HERMES_REPORT\s+(\{.*?\})\s+-->", re.DOTALL)
MEDIA_RE = re.compile(r"(?m)^MEDIA:(\S+)\s*$")
BLOCKED_PREFIX = "BLOCKED: HERMES_RESPONSE_GATE"
STATUSES = {"IN_PROGRESS", "PASS", "FAIL", "BLOCKED", "UNVERIFIED"}
EVIDENCE_TYPES = {"none", "visual"}
REQUIRED_REPORT_FIELDS = (
    "actor",
    "goal",
    "phase",
    "last_checkpoint",
    "next_gate",
    "status",
    "exit_status",
    "evidence",
    "worker_runs",
)
VISUAL_OBSERVED_FIELDS = (
    "scene",
    "state",
    "facing",
    "tile",
    "blocked",
    "ledge",
    "dialogue_semantics",
)
WORKER_CLAIM_RE = re.compile(
    r"(?i)\bclaude\b|\bworker\b|max(?:imum)?[ -]?turns|최대\s*턴|exit\s*[1-9]|종료\s*코드"
)
VISUAL_CLAIM_RE = re.compile(r"(?i)\bscreenshot\b|\brender(?:er|ed)?\b|\bcapture\b|캡처|렌더|화면\s*(?:확인|검증)")


def _inside(path: Path, root: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except (OSError, ValueError):
        return False


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _parse_timestamp(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return None
    return parsed.astimezone(timezone.utc)


def _load_report(response_text: str) -> tuple[dict | None, list[str], str]:
    matches = REPORT_RE.findall(response_text)
    if len(matches) != 1:
        return None, [f"exactly one HERMES_REPORT marker is required; found {len(matches)}"], response_text
    try:
        report = json.loads(matches[0])
    except json.JSONDecodeError as exc:
        return None, [f"HERMES_REPORT is not valid JSON: {exc.msg}"], REPORT_RE.sub("", response_text)
    if not isinstance(report, dict):
        return None, ["HERMES_REPORT must be a JSON object"], REPORT_RE.sub("", response_text)
    return report, [], REPORT_RE.sub("", response_text)


def _validate_worker_runs(report: dict, visible: str, root: Path) -> list[str]:
    errors: list[str] = []
    runs = report.get("worker_runs")
    if not isinstance(runs, list):
        return ["worker_runs must be a list"]
    if WORKER_CLAIM_RE.search(visible) and not runs:
        errors.append("worker_runs must record every claimed worker outcome")
    for index, run in enumerate(runs):
        prefix = f"worker_runs[{index}]"
        if not isinstance(run, dict):
            errors.append(f"{prefix} must be an object")
            continue
        for key in ("actor", "exit_code", "outcome", "command_scope", "log_path"):
            if key not in run:
                errors.append(f"{prefix}.{key} is required")
        code = run.get("exit_code")
        outcome = run.get("outcome")
        if not isinstance(code, int):
            errors.append(f"{prefix}.exit_code must be an integer")
        if outcome not in {"pass", "fail", "max_turns", "blocked", "interrupted"}:
            errors.append(f"{prefix}.outcome is invalid")
        if outcome == "pass" and code != 0:
            errors.append(f"{prefix}: pass requires exit_code 0")
        if outcome in {"fail", "max_turns", "blocked"} and code == 0:
            errors.append(f"{prefix}: {outcome} requires a non-zero exit_code")
        log_raw = run.get("log_path")
        if isinstance(log_raw, str):
            log = Path(log_raw).expanduser()
            if not log.is_absolute() or not _inside(log, root) or not log.is_file():
                errors.append(f"{prefix}.log_path must be an existing repository file")
    return errors


def _validate_visual(
    report: dict,
    response_text: str,
    root: Path,
    now: datetime,
    max_age_seconds: int,
    seen_hashes: set[str],
) -> list[str]:
    errors: list[str] = []
    raw_manifest = report.get("visual_manifest")
    if not isinstance(raw_manifest, str) or not raw_manifest:
        return ["visual_manifest is required when evidence is visual"]
    manifest_path = Path(raw_manifest).expanduser()
    if not manifest_path.is_absolute() or not _inside(manifest_path, root) or not manifest_path.is_file():
        return ["visual manifest must be an existing repository file"]
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        return [f"visual manifest cannot be parsed: {exc}"]
    if not isinstance(manifest, dict):
        return ["visual manifest must be a JSON object"]

    for key in ("task_id", "debug_item", "captured_at", "image_path", "sha256", "expected", "observed", "readability", "verdict"):
        if key not in manifest:
            errors.append(f"visual manifest missing {key}")
    captured = _parse_timestamp(manifest.get("captured_at"))
    if captured is None:
        errors.append("visual captured_at must be timezone-aware ISO-8601")
    else:
        age = (now - captured).total_seconds()
        if age < -60 or age > max_age_seconds:
            errors.append("visual evidence is stale or future-dated")

    raw_image = manifest.get("image_path")
    image = Path(raw_image).expanduser() if isinstance(raw_image, str) else None
    if image is None or not image.is_absolute() or not _inside(image, root) or not image.is_file():
        errors.append("visual image_path must be an existing repository file")
    else:
        actual_hash = _sha256(image)
        declared_hash = manifest.get("sha256")
        if declared_hash != actual_hash:
            errors.append("visual sha256 does not match image bytes")
        if actual_hash in seen_hashes:
            errors.append("visual sha256 is a duplicate from an earlier accepted report")
        media = MEDIA_RE.findall(response_text)
        if media != [str(image)]:
            errors.append("exactly one MEDIA attachment matching visual image_path is required")

    expected = manifest.get("expected")
    observed = manifest.get("observed")
    if not isinstance(expected, dict):
        errors.append("visual expected must be an object")
        expected = {}
    if not isinstance(observed, dict):
        errors.append("visual observed must be an object")
        observed = {}
    for key in VISUAL_OBSERVED_FIELDS:
        if key not in observed:
            errors.append(f"visual observed.{key} is required")
    for key in ("scene", "facing", "tile"):
        if key not in expected:
            errors.append(f"visual expected.{key} is required")
        elif observed.get(key) != expected.get(key):
            errors.append(f"visual observed.{key} does not match expected.{key}")
    tile = observed.get("tile")
    if not isinstance(tile, list) or len(tile) != 2 or not all(isinstance(item, int) for item in tile):
        errors.append("visual observed.tile must be two integers")
    if not isinstance(observed.get("blocked"), bool):
        errors.append("visual observed.blocked must be boolean")
    if not str(observed.get("dialogue_semantics") or "").strip():
        errors.append("visual dialogue_semantics must state the semantic acceptance")
    readability = manifest.get("readability")
    if not isinstance(readability, dict) or len(readability) < 2 or not all(value is True for value in readability.values()):
        errors.append("visual readability must prove both sides are readable")
    if manifest.get("verdict") not in {"PASS", "FAIL"}:
        errors.append("visual verdict must be PASS or FAIL")
    return errors


def validate_response(
    response_text: str,
    *,
    root: Path | str,
    now: datetime | None = None,
    max_age_seconds: int = 900,
    seen_hashes: Iterable[str] = (),
) -> list[str]:
    """Return all contract errors. An empty list means the exact text may be sent."""
    root_path = Path(root).resolve()
    report, errors, visible = _load_report(response_text)
    if report is None:
        return errors
    missing = [field for field in REQUIRED_REPORT_FIELDS if field not in report]
    errors.extend(f"HERMES_REPORT.{field} is required" for field in missing)

    if report.get("actor") not in {"Hermes", "Hermes supervisor"}:
        errors.append("actor must identify Hermes as the current actor")
    for field in ("goal", "last_checkpoint", "next_gate"):
        value = report.get(field)
        if not isinstance(value, str) or len(value.strip()) < 6:
            errors.append(f"{field} is missing or vague")
    phase = report.get("phase")
    if not isinstance(phase, str) or len(phase.strip()) < 3 or phase.strip().lower() in {"work", "task", "작업"}:
        errors.append("phase is missing or vague")
    if report.get("status") not in STATUSES:
        errors.append("status must be IN_PROGRESS, PASS, FAIL, BLOCKED, or UNVERIFIED")
    exit_status = report.get("exit_status")
    if not isinstance(exit_status, str) or not re.fullmatch(r"not-run|running|exit -?\d+|mixed: .+", exit_status):
        errors.append("exit_status must be not-run, running, exit N, or a structured mixed value")
    evidence = report.get("evidence")
    if evidence not in EVIDENCE_TYPES:
        errors.append("evidence must be none or visual")
    if VISUAL_CLAIM_RE.search(visible) and evidence != "visual":
        errors.append("visual claims require evidence=visual")
    media = MEDIA_RE.findall(response_text)
    if evidence != "visual" and media:
        errors.append("MEDIA attachments require evidence=visual")

    errors.extend(_validate_worker_runs(report, visible, root_path))
    if evidence == "visual":
        errors.extend(
            _validate_visual(
                report,
                response_text,
                root_path,
                now or datetime.now(timezone.utc),
                max_age_seconds,
                set(seen_hashes),
            )
        )
    return errors


def gate_response(
    response_text: str,
    *,
    root: Path | str,
    seen_hashes: Iterable[str] = (),
) -> str:
    """Return exact valid text, otherwise replace it with a fail-closed report."""
    errors = validate_response(response_text, root=root, seen_hashes=seen_hashes)
    if not errors:
        return response_text
    detail = "\n".join(f"- {item}" for item in errors)
    blocked_report = {
        "actor": "Hermes",
        "goal": "Restore compliant user reporting before continuing work",
        "phase": "response gate",
        "last_checkpoint": "The drafted response failed deterministic validation",
        "next_gate": "Correct the report metadata or evidence and retry",
        "status": "BLOCKED",
        "exit_status": "not-run",
        "evidence": "none",
        "worker_runs": [],
    }
    marker = "<!-- HERMES_REPORT " + json.dumps(blocked_report, ensure_ascii=False) + " -->"
    return f"{BLOCKED_PREFIX}\n{marker}\n응답 전송이 차단되었습니다.\n{detail}"


if __name__ == "__main__":
    raise SystemExit("Import validate_response() or gate_response(); no standalone mutation is performed.")
