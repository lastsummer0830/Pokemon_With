#!/usr/bin/env python3
"""Deterministic native-pixel measurement for Pokemon_With asset work.

Measures only what the caller explicitly asks for and prints stable-key JSON to
stdout. It never guesses subtype, frame count, logical scale, baseline, anchor,
or approval state, never writes a file, and never modifies the analyzed image.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import sys
from collections import Counter, deque
from pathlib import Path

SCHEMA = "native-pixel-analysis/1"
PROGRAM = "analyze_native_pixel"


class AnalysisError(ValueError):
    """Invalid input file or inconsistent explicit parameter."""


def _load(path: Path):
    if not path.is_file():
        raise AnalysisError(f"image not found: {path}")
    raw = path.read_bytes()
    try:
        from PIL import Image, UnidentifiedImageError
    except ImportError as exc:  # pragma: no cover - environment contract
        raise AnalysisError(f"Pillow is required to read images: {exc}") from exc
    try:
        with Image.open(io.BytesIO(raw)) as image:
            image.load()
            mode = image.mode
            has_alpha = "A" in image.getbands() or "transparency" in image.info
            rgba = image.convert("RGBA")
            width, height = rgba.size
            raw_rgba = rgba.tobytes()
        pixels = [tuple(raw_rgba[at:at + 4]) for at in range(0, len(raw_rgba), 4)]
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise AnalysisError(f"cannot read image: {path}: {exc}") from exc
    return {
        "width": width,
        "height": height,
        "mode": mode,
        "has_alpha": bool(has_alpha),
        "pixels": pixels,
        "sha256": hashlib.sha256(raw).hexdigest(),
        "bytes": len(raw),
    }


def _histogram(counter: Counter) -> list[list[int]]:
    return [[key, counter[key]] for key in sorted(counter)]


def _alpha_section(pixels) -> dict:
    alphas = Counter(pixel[3] for pixel in pixels)
    values = set(alphas)
    if values <= {255}:
        family = "opaque"
    elif values <= {0, 255}:
        family = "binary"
    else:
        family = "soft"
    return {
        "family": family,
        "distinct_values": len(values),
        "transparent_pixels": alphas.get(0, 0),
        "partial_pixels": sum(count for value, count in alphas.items() if 0 < value < 255),
        "opaque_pixels": alphas.get(255, 0),
    }


def _visible_section(width: int, height: int, pixels) -> dict:
    left = top = None
    right = bottom = -1
    count = 0
    for y in range(height):
        row = y * width
        for x in range(width):
            if pixels[row + x][3] == 0:
                continue
            count += 1
            if left is None or x < left:
                left = x
            if x > right:
                right = x
            if top is None:
                top = y
            bottom = y
    if count == 0:
        return {"bbox_inclusive": None, "width": 0, "height": 0, "pixels": 0}
    return {
        "bbox_inclusive": [left, top, right, bottom],
        "width": right - left + 1,
        "height": bottom - top + 1,
        "pixels": count,
    }


def _colors_section(pixels) -> dict:
    return {
        "opaque_color_count": len({pixel[:3] for pixel in pixels if pixel[3] == 255}),
        "visible_color_count": len({pixel for pixel in pixels if pixel[3] > 0}),
    }


def _grid_entry(width: int, height: int, pixels, block: int) -> dict:
    columns = width // block
    rows = height // block
    full = columns * rows
    uniform = 0
    for by in range(rows):
        for bx in range(columns):
            first = pixels[(by * block) * width + bx * block]
            same = True
            for dy in range(block):
                row = (by * block + dy) * width + bx * block
                if any(pixels[row + dx] != first for dx in range(block)):
                    same = False
                    break
            if same:
                uniform += 1
    return {
        "block_size": block,
        "aligned": width % block == 0 and height % block == 0,
        "full_blocks": full,
        "uniform_blocks": uniform,
        "uniform_ratio": round(uniform / full, 6) if full else 0.0,
        "remainder_columns": width % block,
        "remainder_rows": height % block,
    }


def _runs_section(width: int, height: int, pixels) -> dict:
    horizontal: Counter = Counter()
    vertical: Counter = Counter()

    for y in range(height):
        row = y * width
        current = None
        length = 0
        for x in range(width):
            pixel = pixels[row + x]
            if pixel[3] == 0:
                if length:
                    horizontal[length] += 1
                current, length = None, 0
            elif pixel == current:
                length += 1
            else:
                if length:
                    horizontal[length] += 1
                current, length = pixel, 1
        if length:
            horizontal[length] += 1

    for x in range(width):
        current = None
        length = 0
        for y in range(height):
            pixel = pixels[y * width + x]
            if pixel[3] == 0:
                if length:
                    vertical[length] += 1
                current, length = None, 0
            elif pixel == current:
                length += 1
            else:
                if length:
                    vertical[length] += 1
                current, length = pixel, 1
        if length:
            vertical[length] += 1

    return {"horizontal": _histogram(horizontal), "vertical": _histogram(vertical)}


def _components(width: int, height: int, pixels, same_color: bool) -> Counter:
    """4-connected component sizes over visible pixels."""
    seen = bytearray(width * height)
    sizes: Counter = Counter()
    for start in range(width * height):
        if seen[start] or pixels[start][3] == 0:
            continue
        color = pixels[start]
        queue = deque([start])
        seen[start] = 1
        size = 0
        while queue:
            index = queue.popleft()
            size += 1
            x, y = index % width, index // width
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if not (0 <= nx < width and 0 <= ny < height):
                    continue
                neighbour = ny * width + nx
                if seen[neighbour]:
                    continue
                pixel = pixels[neighbour]
                if pixel[3] == 0:
                    continue
                if same_color and pixel != color:
                    continue
                seen[neighbour] = 1
                queue.append(neighbour)
        sizes[size] += 1
    return sizes


def _clusters_section(width: int, height: int, pixels) -> dict:
    sizes = _components(width, height, pixels, same_color=True)
    return {
        "count": sum(sizes.values()),
        "size_histogram": _histogram(sizes),
        "largest_size": max(sizes) if sizes else 0,
        "singleton_count": sizes.get(1, 0),
    }


def _edge_runs(values: list[int | None]) -> list[list[int]]:
    runs: Counter = Counter()
    current = None
    length = 0
    for value in values:
        if value is None:
            if length:
                runs[length] += 1
            current, length = None, 0
        elif value == current:
            length += 1
        else:
            if length:
                runs[length] += 1
            current, length = value, 1
    if length:
        runs[length] += 1
    return _histogram(runs)


CONTOUR_SEMANTICS = "all-alpha-boundary-edges"
CONTOUR_FACINGS = ("up", "down", "left", "right")


def _straight_runs(edges: set[tuple[int, int]]) -> Counter:
    """Maximal straight runs of same-facing boundary edges, keyed line then position."""
    runs: Counter = Counter()
    previous = None
    length = 0
    for line, position in sorted(edges):
        if previous is not None and previous == (line, position - 1):
            length += 1
        else:
            if length:
                runs[length] += 1
            length = 1
        previous = (line, position)
    if length:
        runs[length] += 1
    return runs


def _boundary_edges(width: int, height: int, pixels) -> dict[str, set[tuple[int, int]]]:
    """Every unit edge between a visible pixel and a transparent or off-canvas neighbour.

    Holes, concavities, and detached components are all included: the test is purely
    local, so no outline is traced and no component is treated as the outer one.
    """
    edges: dict[str, set[tuple[int, int]]] = {facing: set() for facing in CONTOUR_FACINGS}
    for y in range(height):
        row = y * width
        for x in range(width):
            if pixels[row + x][3] == 0:
                continue
            # runs of horizontal facings are grouped by row, vertical facings by column
            if y == 0 or pixels[row - width + x][3] == 0:
                edges["up"].add((y, x))
            if y == height - 1 or pixels[row + width + x][3] == 0:
                edges["down"].add((y, x))
            if x == 0 or pixels[row + x - 1][3] == 0:
                edges["left"].add((x, y))
            if x == width - 1 or pixels[row + x + 1][3] == 0:
                edges["right"].add((x, y))
    return edges


def _hole_count(width: int, height: int, pixels) -> int:
    """4-connected transparent regions that never reach the canvas border."""
    seen = bytearray(width * height)
    holes = 0
    for start in range(width * height):
        if seen[start] or pixels[start][3] != 0:
            continue
        queue = deque([start])
        seen[start] = 1
        enclosed = True
        while queue:
            index = queue.popleft()
            x, y = index % width, index // width
            if x in (0, width - 1) or y in (0, height - 1):
                enclosed = False
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if not (0 <= nx < width and 0 <= ny < height):
                    continue
                neighbour = ny * width + nx
                if seen[neighbour] or pixels[neighbour][3] != 0:
                    continue
                seen[neighbour] = 1
                queue.append(neighbour)
        holes += 1 if enclosed else 0
    return holes


def _envelope_section(width: int, height: int, pixels) -> dict:
    left_edges: list[int | None] = []
    right_edges: list[int | None] = []
    for y in range(height):
        row = y * width
        first = last = None
        for x in range(width):
            if pixels[row + x][3] == 0:
                continue
            if first is None:
                first = x
            last = x
        left_edges.append(first)
        right_edges.append(last)

    top_edges: list[int | None] = []
    bottom_edges: list[int | None] = []
    for x in range(width):
        first = last = None
        for y in range(height):
            if pixels[y * width + x][3] == 0:
                continue
            if first is None:
                first = y
            last = y
        top_edges.append(first)
        bottom_edges.append(last)

    return {
        "left_edge_runs": _edge_runs(left_edges),
        "right_edge_runs": _edge_runs(right_edges),
        "top_edge_runs": _edge_runs(top_edges),
        "bottom_edge_runs": _edge_runs(bottom_edges),
    }


def _contour_section(width: int, height: int, pixels) -> dict:
    """Stair/run summary over every alpha boundary, not just the outer silhouette."""
    edges = _boundary_edges(width, height, pixels)
    runs = {facing: _straight_runs(edges[facing]) for facing in CONTOUR_FACINGS}
    boundary_pixels = {(x, y) for y, x in edges["up"] | edges["down"]}
    boundary_pixels |= {(x, y) for x, y in edges["left"] | edges["right"]}
    run_count = {facing: sum(runs[facing].values()) for facing in CONTOUR_FACINGS}
    run_count["total"] = sum(run_count[facing] for facing in CONTOUR_FACINGS)
    longest = max((max(runs[facing], default=0) for facing in CONTOUR_FACINGS), default=0)
    return {
        "semantics": CONTOUR_SEMANTICS,
        "boundary_pixels": len(boundary_pixels),
        "boundary_edges": sum(len(edges[facing]) for facing in CONTOUR_FACINGS),
        "edge_runs": {facing: _histogram(runs[facing]) for facing in CONTOUR_FACINGS},
        "run_count": run_count,
        "longest_run": longest,
        "visible_component_count": sum(
            _components(width, height, pixels, same_color=False).values()
        ),
        "hole_count": _hole_count(width, height, pixels),
        "row_column_envelope": _envelope_section(width, height, pixels),
    }


def _fragments_section(width: int, height: int, pixels, max_size: int) -> dict:
    sizes = _components(width, height, pixels, same_color=False)
    fragments = sorted(size for size in sizes.elements() if size <= max_size)
    return {
        "max_size": max_size,
        "component_count": sum(sizes.values()),
        "fragment_count": len(fragments),
        "fragment_sizes": fragments,
        "largest_component_size": max(sizes) if sizes else 0,
    }


def _frames_section(width: int, height: int, pixels, columns: int, rows: int) -> dict:
    if width % columns or height % rows:
        raise AnalysisError(
            f"frame grid {columns}x{rows} does not divide canvas {width}x{height}"
        )
    slice_width = width // columns
    slice_height = height // rows
    slices = []
    for row in range(rows):
        for column in range(columns):
            x0, y0 = column * slice_width, row * slice_height
            x1, y1 = x0 + slice_width, y0 + slice_height
            left = top = None
            right = bottom = -1
            count = 0
            opaque_colors = set()
            for y in range(y0, y1):
                base = y * width
                for x in range(x0, x1):
                    pixel = pixels[base + x]
                    if pixel[3] == 0:
                        continue
                    count += 1
                    if pixel[3] == 255:
                        opaque_colors.add(pixel[:3])
                    if left is None or x < left:
                        left = x
                    if x > right:
                        right = x
                    if top is None:
                        top = y
                    bottom = y
            has_visible = count > 0
            slices.append({
                "index": len(slices),
                "column": column,
                "row": row,
                "x_range": [x0, x1],
                "y_range": [y0, y1],
                "visible_pixels": count,
                "opaque_color_count": len(opaque_colors),
                "bbox_inclusive": [left, top, right, bottom] if has_visible else None,
                "bbox_local": (
                    [left - x0, top - y0, right - x0, bottom - y0] if has_visible else None
                ),
            })
    return {
        "count": columns * rows,
        "columns": columns,
        "rows": rows,
        "slice_width": slice_width,
        "slice_height": slice_height,
        "slices": slices,
    }


def _baseline_section(width: int, height: int, pixels, row: int) -> dict:
    if not 0 <= row < height:
        raise AnalysisError(f"baseline row {row} is outside canvas height {height}")
    base = row * width
    xs = [x for x in range(width) if pixels[base + x][3] > 0]
    lowest = None
    below = 0
    for y in range(height):
        line = y * width
        if any(pixels[line + x][3] > 0 for x in range(width)):
            lowest = y
            if y > row:
                below += 1
    return {
        "row": row,
        "visible_pixels": len(xs),
        "left": xs[0] if xs else None,
        "right": xs[-1] if xs else None,
        "lowest_visible_row": lowest,
        "offset_from_lowest_visible": None if lowest is None else lowest - row,
        "rows_below_with_visible": below,
    }


def _anchor_section(width: int, height: int, pixels, anchor, bbox) -> dict:
    x, y = anchor
    if not 0 <= x < width:
        raise AnalysisError(f"anchor x {x} is outside canvas width {width}")
    if not 0 <= y < height:
        raise AnalysisError(f"anchor y {y} is outside canvas height {height}")
    alpha = pixels[y * width + x][3]
    offset_bbox = None
    if bbox is not None:
        left, top, right, bottom = bbox
        offset_bbox = {
            "left": x - left,
            "top": y - top,
            "right": right - x,
            "bottom": bottom - y,
        }
    return {
        "x": x,
        "y": y,
        "alpha": alpha,
        "visible": alpha > 0,
        "offset_from_visible_bbox": offset_bbox,
        "offset_from_canvas": {
            "left": x,
            "top": y,
            "right": width - 1 - x,
            "bottom": height - 1 - y,
        },
    }


def resolve_frame_grid(frames: int | None, frame_grid) -> tuple[int, int] | None:
    if frames is None and frame_grid is None:
        return None
    if frame_grid is None:
        return (frames, 1)
    columns, rows = frame_grid
    if columns < 1 or rows < 1:
        raise AnalysisError(f"frame grid {columns}x{rows} must use positive columns and rows")
    if frames is not None and frames != columns * rows:
        raise AnalysisError(
            f"frame count {frames} is inconsistent with frame grid {columns}x{rows}"
        )
    return (columns, rows)


def analyze(
    image_path: Path,
    *,
    block_sizes=(),
    frames: int | None = None,
    frame_grid=None,
    fragment_max_size: int | None = None,
    baseline_row: int | None = None,
    anchor=None,
) -> dict:
    """Measure `image_path`. Optional sections are measured only when requested."""
    for block in block_sizes:
        if block < 1:
            raise AnalysisError(f"block size must be 1 or greater; got {block}")
    if fragment_max_size is not None and fragment_max_size < 1:
        raise AnalysisError(f"fragment max size must be 1 or greater; got {fragment_max_size}")
    if frames is not None and frames < 1:
        raise AnalysisError(f"frame count must be 1 or greater; got {frames}")
    grid = resolve_frame_grid(frames, frame_grid)

    source = _load(image_path)
    width, height, pixels = source["width"], source["height"], source["pixels"]
    visible = _visible_section(width, height, pixels)

    return {
        "schema": SCHEMA,
        "source": {
            "path": str(image_path),
            "sha256": source["sha256"],
            "bytes": source["bytes"],
        },
        "canvas": {
            "width": width,
            "height": height,
            "source_mode": source["mode"],
            "has_alpha_channel": source["has_alpha"],
        },
        "alpha": _alpha_section(pixels),
        "visible": visible,
        "colors": _colors_section(pixels),
        "logical_grid": [_grid_entry(width, height, pixels, block) for block in block_sizes],
        "runs": _runs_section(width, height, pixels),
        "clusters": _clusters_section(width, height, pixels),
        "contour": _contour_section(width, height, pixels),
        "fragments": (
            None
            if fragment_max_size is None
            else _fragments_section(width, height, pixels, fragment_max_size)
        ),
        "frames": (
            None if grid is None else _frames_section(width, height, pixels, grid[0], grid[1])
        ),
        "baseline": (
            None
            if baseline_row is None
            else _baseline_section(width, height, pixels, baseline_row)
        ),
        "anchor": (
            None
            if anchor is None
            else _anchor_section(width, height, pixels, anchor, visible["bbox_inclusive"])
        ),
    }


def _anchor_argument(text: str) -> tuple[int, int]:
    match = re.fullmatch(r"\s*(-?\d+)\s*,\s*(-?\d+)\s*", text)
    if not match:
        raise argparse.ArgumentTypeError(f"anchor must be given as X,Y integers; got {text!r}")
    return (int(match.group(1)), int(match.group(2)))


def _grid_argument(text: str) -> tuple[int, int]:
    match = re.fullmatch(r"\s*(\d+)\s*[xX]\s*(\d+)\s*", text)
    if not match:
        raise argparse.ArgumentTypeError(
            f"frame grid must be given as COLUMNSxROWS; got {text!r}"
        )
    return (int(match.group(1)), int(match.group(2)))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog=PROGRAM,
        description="Measure a pixel image; only requested sections are measured.",
    )
    parser.add_argument("image", help="image file to measure")
    parser.add_argument(
        "--block-size",
        type=int,
        action="append",
        metavar="N",
        help="measure logical-grid uniformity for this block size (repeatable)",
    )
    parser.add_argument("--frames", type=int, metavar="N", help="explicit frame count (N columns x 1 row)")
    parser.add_argument(
        "--frame-grid",
        type=_grid_argument,
        metavar="COLUMNSxROWS",
        help="explicit frame grid",
    )
    parser.add_argument(
        "--fragment-max-size",
        type=int,
        metavar="N",
        help="count isolated visible components of this size or smaller",
    )
    parser.add_argument("--baseline-row", type=int, metavar="Y", help="explicit baseline row")
    parser.add_argument("--anchor", type=_anchor_argument, metavar="X,Y", help="explicit anchor point")
    return parser


def main(argv=None) -> int:
    parser = build_parser()
    try:
        args = parser.parse_args(argv)
    except SystemExit as exc:  # argparse already printed an actionable message
        return int(exc.code or 2)
    try:
        result = analyze(
            Path(args.image),
            block_sizes=tuple(args.block_size or ()),
            frames=args.frames,
            frame_grid=args.frame_grid,
            fragment_max_size=args.fragment_max_size,
            baseline_row=args.baseline_row,
            anchor=args.anchor,
        )
    except AnalysisError as exc:
        print(f"{PROGRAM}: error: {exc}", file=sys.stderr)
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
