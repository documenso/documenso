"""Tests for the line-based preserved-context check in validator."""

from branding_resolver.config import BrandingConfig
from branding_resolver.validator import validate_resolved_file


def _errors(content: str, path: str = "README.md") -> list[str]:
    return validate_resolved_file(path, content, BrandingConfig())


def test_bare_brand_name_is_flagged():
    errs = _errors("Welcome to Documenso!")
    assert any("Documenso" in e for e in errs)


def test_brand_inside_package_scope_preserved():
    errs = _errors("import { sign } from '@documenso/pdf-sign';")
    assert not [e for e in errs if "Documenso" in e]


def test_brand_inside_github_credit_url_preserved():
    errs = _errors("See https://github.com/documenso/documenso for upstream.")
    assert not [e for e in errs if "Documenso" in e or "documenso/documenso" in e]


def test_mixed_line_with_credit_url_preserves_both():
    """The case the old 30-char window false-positived on.

    A bare ``Documenso`` text sits at the start of the link, and the URL
    sits at the end of the line. The new line-based check sees that the
    line contains a preservation substring (``github.com/documenso``)
    and treats every brand match on the line as preserved.
    """
    line = "> Based on [Documenso](https://github.com/documenso/documenso)."
    errs = _errors(line)
    assert not [e for e in errs if "Documenso" in e or "documenso/documenso" in e], errs


def test_brand_on_other_line_still_flagged():
    """A preservation on one line does not give other lines a free pass."""
    content = (
        "import { sign } from '@documenso/pdf-sign';\n"
        "console.log('Welcome to Documenso');\n"
    )
    errs = _errors(content, "app.ts")
    # Line 1 preserved; line 2 not preserved.
    assert any("line 2" in e and "Documenso" in e for e in errs), errs


def test_long_distance_brand_then_url_preserved():
    """Brand at start, URL far away on the same line — beyond the old 30-char window."""
    # 80+ chars between the brand and the URL.
    line = (
        "Documenso is super great and we built so many features and added all this stuff for github.com/documenso/documenso users."
    )
    errs = _errors(line)
    assert not [e for e in errs if "Documenso" in e]
