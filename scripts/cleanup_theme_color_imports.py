"""Remove unused THEME_COLOR imports after migrating classNames to accent-*."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1] / "src"
KEEP = {"theme.js", "tw.js", "ThemeContext.jsx"}


def main() -> None:
    for path in list(ROOT.rglob("*.js")) + list(ROOT.rglob("*.jsx")):
        if path.name in KEEP:
            continue
        text = path.read_text(encoding="utf-8")
        if "THEME_COLOR" not in text:
            continue
        # Still used as an identifier (shouldn't happen after migration)
        body = re.sub(r"import\s*\{[^}]+\}\s*from\s*['\"][^'\"]+['\"];?", "", text)
        if re.search(r"\bTHEME_COLOR\b", body):
            print(f"keep import (still used): {path.relative_to(ROOT.parent)}")
            continue

        new = re.sub(
            r"import\s*\{\s*THEME_COLOR\s*\}\s*from\s*['\"][^'\"]+['\"];?\r?\n",
            "",
            text,
        )
        new = re.sub(r"(\bimport\s*\{[^}]*)\bTHEME_COLOR\s*,\s*", r"\1", new)
        new = re.sub(r"(\bimport\s*\{[^}]*),\s*THEME_COLOR\b(\s*)", r"\1\2", new)
        if new != text:
            path.write_text(new, encoding="utf-8")
            print(f"cleaned {path.relative_to(ROOT.parent)}")


if __name__ == "__main__":
    main()
