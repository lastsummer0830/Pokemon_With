#!/usr/bin/env python3
"""Deterministic technical validation for Pokemon_With native pixel assets.

Reads an analyzer JSON document plus an explicit technical contract and emits
stable JSON findings. It judges only contracted metrics, marks everything else
`UNVERIFIED`, and never claims visual similarity, identity preservation, user
adoption, or runtime verification. It reads no image and writes no file.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

SCHEMA = "native-pixel-validation/1"
ANALYSIS_SCHEMA = "native-pixel-analysis/1"
CONTRACT_SCHEMA = "native-pixel-technical-contract/1"
PROGRAM = "validate_asset"

KNOWN_METRICS = (
    "alpha.family",
    "anchor.position",
    "baseline.row",
    "canvas.height",
    "canvas.width",
    "fragments.count",
    "frames.count",
    "frames.slices",
    "logical_grid.uniform_ratio",
    "preview_scaling.dimensions",
    "preview_scaling.factor",
    "preview_scaling.filter",
    "visible_bbox",
)
NEVER_VERIFIED = (
    "design_identity_locks",
    "runtime_verification",
    "style_identity_leakage",
    "user_adoption",
    "visual_similarity",
)
OUTSIDE_AUTHORITY = (
    "outside this validator; needs 1x visual review, user adoption, or runtime evidence"
)
CONTRACT_SECTIONS = {
    "canvas": {"width", "height"},
    "alpha": {"family"},
    "visible_bbox": {"left", "top", "right", "bottom"},
    "frames": {"count", "columns", "rows", "slice_width", "slice_height", "min_visible_pixels_per_frame"},
    "logical_grid": {"block_size", "min_uniform_ratio"},
    "baseline": {"row", "max_offset_from_lowest_visible"},
    "anchor": {"x", "y", "must_be_visible", "offset_from_visible_bbox"},
    "preview_scaling": {"factor", "filter", "width", "height"},
    "fragments": {"max_size", "max_count"},
}
REQUIRED_SUBKEYS = {
    "alpha": ("family",),
    "visible_bbox": ("left", "top", "right", "bottom"),
    "frames": ("count",),
    "logical_grid": ("block_size",),
    "baseline": ("row",),
    "anchor": ("x", "y"),
    "preview_scaling": ("factor", "filter"),
    "fragments": ("max_size", "max_count"),
}
# Sections whose required subkeys only say *what* to measure; at least one of
# these carries the value a finding can actually be judged against.
REQUIRED_ANY_SUBKEYS = {
    "canvas": ("width", "height"),
    "logical_grid": ("min_uniform_ratio",),
    "baseline": ("max_offset_from_lowest_visible",),
    "anchor": ("must_be_visible", "offset_from_visible_bbox"),
}


class ContractError(ValueError):
    """Unusable analysis document or technical contract."""


def _finding(metric, status, expected=None, actual=None, detail="") -> dict:
    return {
        "metric": metric,
        "status": status,
        "expected": expected,
        "actual": actual,
        "detail": detail,
    }


def _judge(metric, expected, actual, detail="") -> dict:
    return _finding(metric, "PASS" if expected == actual else "FAIL", expected, actual, detail)


def _check_contract_shape(contract: dict) -> None:
    if not isinstance(contract, dict):
        raise ContractError("technical contract must be a JSON object")
    schema = contract.get("schema")
    if schema is not None and schema != CONTRACT_SCHEMA:
        raise ContractError(f"contract schema must be {CONTRACT_SCHEMA}; got {schema!r}")
    for key, value in contract.items():
        if key == "schema":
            continue
        if key not in CONTRACT_SECTIONS:
            raise ContractError(f"unknown contract key: {key}")
        if not isinstance(value, dict):
            raise ContractError(f"contract section {key} must be a JSON object")
        for subkey in value:
            if subkey not in CONTRACT_SECTIONS[key]:
                raise ContractError(f"unknown contract key: {key}.{subkey}")
        for required in REQUIRED_SUBKEYS.get(key, ()):
            if required not in value:
                raise ContractError(f"contract section {key} requires {required}")
        judgeable = REQUIRED_ANY_SUBKEYS.get(key, ())
        if judgeable and not any(subkey in value for subkey in judgeable):
            raise ContractError(
                f"contract section {key} needs at least one of: {', '.join(judgeable)}"
            )
    if not set(contract) - {"schema"}:
        raise ContractError("technical contract specifies no metric to validate")


def _check_analysis_shape(analysis: dict) -> None:
    if not isinstance(analysis, dict):
        raise ContractError("analysis document must be a JSON object")
    schema = analysis.get("schema")
    if schema != ANALYSIS_SCHEMA:
        raise ContractError(f"analysis schema must be {ANALYSIS_SCHEMA}; got {schema!r}")
    for key in ("canvas", "alpha", "visible", "colors"):
        if key not in analysis:
            raise ContractError(f"analysis document is missing the {key} section")


def _canvas_findings(section, analysis, results) -> None:
    canvas = analysis["canvas"]
    for axis in ("width", "height"):
        if axis in section:
            results[f"canvas.{axis}"] = _judge(f"canvas.{axis}", section[axis], canvas[axis])


def _bbox_findings(section, analysis, results) -> None:
    expected = [section["left"], section["top"], section["right"], section["bottom"]]
    results["visible_bbox"] = _judge(
        "visible_bbox", expected, analysis["visible"]["bbox_inclusive"], "inclusive left,top,right,bottom"
    )


def _frames_findings(section, analysis, results) -> None:
    frames = analysis.get("frames")
    if frames is None:
        raise ContractError(
            "frames are contracted but no frame slices were measured; "
            "rerun the analyzer with --frames or --frame-grid"
        )
    counted = {key: section[key] for key in ("count", "columns", "rows") if key in section}
    results["frames.count"] = _judge(
        "frames.count", counted, {key: frames[key] for key in counted}
    )

    expected: dict = {}
    actual: dict = {}
    for key in ("slice_width", "slice_height"):
        if key in section:
            expected[key] = section[key]
            actual[key] = frames[key]
    if "min_visible_pixels_per_frame" in section:
        limit = section["min_visible_pixels_per_frame"]
        lowest = min((entry["visible_pixels"] for entry in frames["slices"]), default=0)
        expected["min_visible_pixels_per_frame"] = f">={limit}"
        actual["min_visible_pixels_per_frame"] = f">={limit}" if lowest >= limit else lowest
    if expected:
        results["frames.slices"] = _judge("frames.slices", expected, actual)


def _grid_findings(section, analysis, results) -> None:
    block = section["block_size"]
    entry = next(
        (item for item in analysis.get("logical_grid", []) if item["block_size"] == block), None
    )
    if entry is None:
        raise ContractError(
            f"logical grid block size {block} was not measured; "
            f"rerun the analyzer with --block-size {block}"
        )
    if "min_uniform_ratio" not in section:
        return
    minimum = section["min_uniform_ratio"]
    ratio = entry["uniform_ratio"]
    results["logical_grid.uniform_ratio"] = _finding(
        "logical_grid.uniform_ratio",
        "PASS" if ratio >= minimum else "FAIL",
        f">={minimum}",
        ratio,
        f"block size {block}",
    )


def _baseline_findings(section, analysis, results) -> None:
    baseline = analysis.get("baseline")
    if baseline is None:
        raise ContractError(
            "baseline is contracted but was not measured; rerun the analyzer with --baseline-row"
        )
    if baseline["row"] != section["row"]:
        raise ContractError(
            f"baseline row {section['row']} was not measured; "
            f"the analyzer measured row {baseline['row']}"
        )
    if "max_offset_from_lowest_visible" not in section:
        return
    limit = section["max_offset_from_lowest_visible"]
    offset = baseline["offset_from_lowest_visible"]
    passed = offset is not None and abs(offset) <= limit
    results["baseline.row"] = _finding(
        "baseline.row",
        "PASS" if passed else "FAIL",
        f"|offset_from_lowest_visible|<={limit}",
        offset,
        f"baseline row {section['row']}",
    )


def _anchor_findings(section, analysis, results) -> None:
    anchor = analysis.get("anchor")
    if anchor is None:
        raise ContractError(
            "anchor is contracted but was not measured; rerun the analyzer with --anchor X,Y"
        )
    if (anchor["x"], anchor["y"]) != (section["x"], section["y"]):
        raise ContractError(
            f"anchor {section['x']},{section['y']} was not measured; "
            f"the analyzer measured {anchor['x']},{anchor['y']}"
        )
    expected: dict = {}
    actual: dict = {}
    if "must_be_visible" in section:
        expected["visible"] = section["must_be_visible"]
        actual["visible"] = anchor["visible"]
    if "offset_from_visible_bbox" in section:
        wanted = section["offset_from_visible_bbox"]
        measured = anchor["offset_from_visible_bbox"] or {}
        expected["offset_from_visible_bbox"] = wanted
        actual["offset_from_visible_bbox"] = {key: measured.get(key) for key in wanted}
    if expected:
        results["anchor.position"] = _judge(
            "anchor.position", expected, actual, f"anchor {section['x']},{section['y']}"
        )


def _preview_findings(section, analysis, results) -> None:
    factor = section["factor"]
    integer_factor = isinstance(factor, int) and not isinstance(factor, bool) and factor >= 1
    results["preview_scaling.factor"] = _finding(
        "preview_scaling.factor",
        "PASS" if integer_factor else "FAIL",
        "integer >= 1",
        factor,
        "preview scaling must be an integer multiple",
    )
    results["preview_scaling.filter"] = _judge(
        "preview_scaling.filter", "nearest", section["filter"], "previews must use nearest neighbour"
    )
    has_size = "width" in section and "height" in section
    if not has_size:
        return
    if not integer_factor:
        results["preview_scaling.dimensions"] = _finding(
            "preview_scaling.dimensions",
            "UNVERIFIED",
            None,
            [section["width"], section["height"]],
            "preview factor is not a positive integer, so dimensions cannot be derived",
        )
        return
    canvas = analysis["canvas"]
    results["preview_scaling.dimensions"] = _judge(
        "preview_scaling.dimensions",
        [canvas["width"] * factor, canvas["height"] * factor],
        [section["width"], section["height"]],
        "uniform X and Y integer scaling",
    )


def _fragment_findings(section, analysis, results) -> None:
    fragments = analysis.get("fragments")
    if fragments is None:
        raise ContractError(
            "fragments are contracted but were not measured; "
            f"rerun the analyzer with --fragment-max-size {section['max_size']}"
        )
    if fragments["max_size"] != section["max_size"]:
        raise ContractError(
            f"fragment max size {section['max_size']} was not measured; "
            f"the analyzer used {fragments['max_size']}"
        )
    limit = section["max_count"]
    count = fragments["fragment_count"]
    results["fragments.count"] = _finding(
        "fragments.count",
        "PASS" if count <= limit else "FAIL",
        f"<={limit}",
        count,
        f"isolated components of size <= {section['max_size']}",
    )


def validate(analysis: dict, contract: dict) -> dict:
    """Judge only contracted technical metrics. Raises ContractError on unusable input."""
    _check_analysis_shape(analysis)
    _check_contract_shape(contract)

    results = {
        metric: _finding(metric, "UNVERIFIED", detail="not present in the technical contract")
        for metric in KNOWN_METRICS
    }
    results.update({
        metric: _finding(metric, "UNVERIFIED", detail=OUTSIDE_AUTHORITY)
        for metric in NEVER_VERIFIED
    })

    handlers = {
        "canvas": _canvas_findings,
        "visible_bbox": _bbox_findings,
        "frames": _frames_findings,
        "logical_grid": _grid_findings,
        "baseline": _baseline_findings,
        "anchor": _anchor_findings,
        "preview_scaling": _preview_findings,
        "fragments": _fragment_findings,
    }
    if "alpha" in contract:
        results["alpha.family"] = _judge(
            "alpha.family", contract["alpha"]["family"], analysis["alpha"]["family"]
        )
    for key, handler in handlers.items():
        if key in contract:
            handler(contract[key], analysis, results)

    findings = [results[metric] for metric in sorted(results)]
    counts = {
        status: sum(1 for finding in findings if finding["status"] == status)
        for status in ("PASS", "FAIL", "UNVERIFIED")
    }
    if not counts["PASS"] and not counts["FAIL"]:
        raise ContractError(
            "technical contract judged no metric; a technical status is never reported "
            "when nothing was judged"
        )
    return {
        "schema": SCHEMA,
        "technical_status": "FAIL" if counts["FAIL"] else "PASS",
        "counts": counts,
        "findings": findings,
        "source": analysis.get("source"),
        "authority": (
            "technical measurements only; visual PASS, identity preservation, "
            "user adoption, and runtime verification are separate states decided elsewhere"
        ),
    }


def _read_json(location: str, label: str) -> dict:
    try:
        raw = sys.stdin.read() if location == "-" else Path(location).read_text(encoding="utf-8")
    except OSError as exc:
        raise ContractError(f"cannot read {label}: {exc}") from exc
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ContractError(f"{label} is not valid JSON: {exc}") from exc


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog=PROGRAM,
        description="Judge analyzer output against an explicit technical contract.",
    )
    parser.add_argument("--analysis", required=True, metavar="PATH", help="analyzer JSON, or - for stdin")
    parser.add_argument("--contract", required=True, metavar="PATH", help="technical contract JSON")
    return parser


def main(argv=None) -> int:
    parser = build_parser()
    try:
        args = parser.parse_args(argv)
    except SystemExit as exc:  # argparse already printed an actionable message
        return int(exc.code or 2)
    try:
        analysis = _read_json(args.analysis, "analysis document")
        contract = _read_json(args.contract, "technical contract")
        report = validate(analysis, contract)
    except ContractError as exc:
        print(f"{PROGRAM}: error: {exc}", file=sys.stderr)
        return 2
    report["contract"] = {
        "sha256": hashlib.sha256(
            json.dumps(contract, ensure_ascii=False, sort_keys=True).encode("utf-8")
        ).hexdigest()
    }
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    return 1 if report["technical_status"] == "FAIL" else 0


if __name__ == "__main__":
    raise SystemExit(main())
