"""Replace static THEME_COLOR Tailwind interpolations with runtime accent-* utilities."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src"
TOKEN = "${THEME_COLOR}"
SKIP_PARTS = {"node_modules", "dist", "dev-dist"}


def main() -> None:
    files_changed = 0
    replacements = 0
    for path in ROOT.rglob("*"):
        if not path.is_file() or path.suffix not in {".js", ".jsx", ".ts", ".tsx"}:
            continue
        if any(part in SKIP_PARTS for part in path.parts):
            continue
        text = path.read_text(encoding="utf-8")
        if TOKEN not in text:
            continue
        count = text.count(TOKEN)
        new_text = text.replace(TOKEN, "accent")
        path.write_text(new_text, encoding="utf-8")
        files_changed += 1
        replacements += count
        print(f"{path.relative_to(ROOT.parent)}: {count}")
    print(f"done files={files_changed} replacements={replacements}")


if __name__ == "__main__":
    main()
