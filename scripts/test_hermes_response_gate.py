from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable, cast

from scripts.hermes_response_gate import BLOCKED_PREFIX, gate_response, validate_response


class HermesResponseGateTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)

    def report(self, **overrides: object) -> dict:
        report = {
            "actor": "Hermes",
            "goal": "P0 response compliance recovery",
            "phase": "RED",
            "last_checkpoint": "inventory complete",
            "next_gate": "GREEN implementation",
            "status": "IN_PROGRESS",
            "exit_status": "not-run",
            "evidence": "none",
            "worker_runs": [],
        }
        report.update(overrides)
        return report

    @staticmethod
    def response(report: dict, body: str = "진행 중입니다.", media: str | None = None) -> str:
        marker = "<!-- HERMES_REPORT " + json.dumps(report, ensure_ascii=False) + " -->"
        suffix = f"\nMEDIA:{media}" if media else ""
        return f"{marker}\n{body}{suffix}"

    def visual_fixture(self, *, age_minutes: int = 0, observed: dict | None = None) -> tuple[Path, Path, dict]:
        image = self.root / "capture.png"
        image.write_bytes(b"fresh-render")
        digest = hashlib.sha256(image.read_bytes()).hexdigest()
        observed_data = {
            "scene": "WorldScene",
            "state": "ILLA_EV10",
            "facing": "down",
            "tile": [23, 38],
            "blocked": False,
            "ledge": "none",
            "dialogue_semantics": "ILLA:??? visible; narration has no speaker",
        }
        if observed:
            observed_data.update(observed)
        manifest = {
            "task_id": "PWH-004-A",
            "debug_item": "stage1-facing",
            "captured_at": (datetime.now(timezone.utc) - timedelta(minutes=age_minutes)).isoformat(),
            "image_path": str(image),
            "sha256": digest,
            "expected": {
                "scene": "WorldScene",
                "facing": "down",
                "tile": [23, 38],
            },
            "observed": observed_data,
            "readability": {"player": True, "npc": True},
            "verdict": "PASS",
        }
        path = self.root / "manifest.json"
        path.write_text(json.dumps(manifest), encoding="utf-8")
        return image, path, manifest

    def test_accepts_structured_progress_report(self) -> None:
        self.assertEqual([], validate_response(self.response(self.report()), root=self.root))

    def test_rejects_missing_or_vague_status_fields(self) -> None:
        self.assertTrue(validate_response("진행 중입니다.", root=self.root))
        vague = self.report(goal="작업", next_gate="다음")
        errors = validate_response(self.response(vague), root=self.root)
        self.assertTrue(any("goal" in item or "next_gate" in item for item in errors), errors)

    def test_visual_report_rejects_missing_manifest_or_media_attachment(self) -> None:
        missing = self.report(evidence="visual", visual_manifest=str(self.root / "missing.json"))
        self.assertTrue(any("manifest" in item for item in validate_response(self.response(missing), root=self.root)))

        image, manifest, _ = self.visual_fixture()
        report = self.report(evidence="visual", visual_manifest=str(manifest))
        errors = validate_response(self.response(report), root=self.root)
        self.assertTrue(any("MEDIA" in item for item in errors), errors)
        self.assertEqual([], validate_response(self.response(report, media=str(image)), root=self.root))

    def test_visual_report_rejects_wrong_scene_facing_or_tile(self) -> None:
        for field, value in (("scene", "BattleScene"), ("facing", "up"), ("tile", [22, 38])):
            with self.subTest(field=field):
                image, manifest, _ = self.visual_fixture(observed={field: value})
                report = self.report(evidence="visual", visual_manifest=str(manifest))
                errors = validate_response(self.response(report, media=str(image)), root=self.root)
                self.assertTrue(any(field in item for item in errors), errors)

    def test_visual_report_rejects_stale_or_duplicate_hash(self) -> None:
        image, manifest, data = self.visual_fixture(age_minutes=30)
        report = self.report(evidence="visual", visual_manifest=str(manifest))
        stale = validate_response(self.response(report, media=str(image)), root=self.root, max_age_seconds=900)
        self.assertTrue(any("stale" in item for item in stale), stale)

        data["captured_at"] = datetime.now(timezone.utc).isoformat()
        manifest.write_text(json.dumps(data), encoding="utf-8")
        duplicate = validate_response(
            self.response(report, media=str(image)), root=self.root, seen_hashes={data["sha256"]}
        )
        self.assertTrue(any("duplicate" in item for item in duplicate), duplicate)

    def test_worker_failure_requires_exit_status_and_preserved_log(self) -> None:
        text = self.response(self.report(), body="Claude worker reached maximum turns.")
        errors = validate_response(text, root=self.root)
        self.assertTrue(any("worker_runs" in item for item in errors), errors)

        log = self.root / "worker.log"
        log.write_text("error_max_turns", encoding="utf-8")
        run = {
            "actor": "Claude Code Opus 5",
            "exit_code": 1,
            "outcome": "max_turns",
            "command_scope": "PWH-004 final verification",
            "log_path": str(log),
        }
        report = self.report(exit_status="exit 1", worker_runs=[run])
        self.assertEqual([], validate_response(self.response(report, "Claude worker reached maximum turns."), root=self.root))

    def test_gate_replaces_invalid_response_and_preserves_valid_exact_text(self) -> None:
        invalid = gate_response("완료했습니다.", root=self.root)
        self.assertTrue(invalid.startswith(BLOCKED_PREFIX), invalid)
        valid = self.response(self.report())
        self.assertEqual(valid, gate_response(valid, root=self.root))


class HermesResponsePluginTests(unittest.TestCase):
    def test_plugin_registers_preflight_and_final_transform_hooks(self) -> None:
        import importlib.util
        import os

        plugin_path = Path(__file__).resolve().parents[1] / ".hermes/plugins/pokemonwith-response-gate/__init__.py"
        spec = importlib.util.spec_from_file_location("pokemonwith_response_plugin_test", plugin_path)
        if spec is None or spec.loader is None:
            self.fail("cannot load response gate plugin")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        hooks: dict[str, Callable[..., object]] = {}

        class Context:
            def register_hook(self, name: str, callback: Callable[..., object]) -> None:
                hooks[name] = callback

        module.register(Context())
        self.assertEqual({"pre_llm_call", "transform_llm_output"}, set(hooks))

        root = Path(__file__).resolve().parents[1]
        previous = Path.cwd()
        os.chdir(root)
        try:
            injected = cast(dict[str, str], hooks["pre_llm_call"]())
            self.assertIn("HERMES_REPORT", injected["context"])
            blocked = cast(str, hooks["transform_llm_output"]("완료했습니다."))
        finally:
            os.chdir(previous)
        self.assertTrue(blocked.startswith(BLOCKED_PREFIX), blocked)


if __name__ == "__main__":
    unittest.main()
