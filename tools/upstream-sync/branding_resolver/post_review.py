"""Generate a markdown review comment from flagged_reviews.json."""

import json
import sys
from pathlib import Path


def main() -> None:
    input_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("sync-output/flagged_reviews.json")
    output_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("sync-output/review_comment.md")

    if not input_path.exists():
        print(f"No flagged reviews file at {input_path}")
        sys.exit(0)

    flagged = json.loads(input_path.read_text())
    if not flagged:
        print("No flagged files.")
        sys.exit(0)

    lines = ["## Files Flagged for Manual Review\n"]
    for r in flagged:
        lines.append(f"### `{r['path']}`")
        lines.append(r["body"])
        lines.append(f"> See conflict markers starting at line {r['line']}")
        lines.append("")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"Review comment written to {output_path}")


if __name__ == "__main__":
    main()
