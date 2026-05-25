"""Tests for the deterministic branding substitution pass."""

from branding_resolver.deterministic import apply_substitutions


def test_replaces_bare_brand_name():
    assert apply_substitutions("Welcome to Documenso!") == "Welcome to Davinci Sign!"


def test_replaces_multiple_occurrences():
    src = "# Documenso\n\nWelcome to Documenso, a great tool. Documenso rocks."
    out = apply_substitutions(src)
    assert "Documenso" not in out
    assert out.count("Davinci Sign") == 3


def test_preserves_package_scope():
    src = "import { sign } from '@documenso/pdf-sign';"
    assert apply_substitutions(src) == src


def test_preserves_github_credit_url():
    src = "See https://github.com/documenso/documenso for upstream."
    assert apply_substitutions(src) == src


def test_replaces_brand_but_preserves_credit_url_on_same_line():
    """The mixed case that broke the LLM: bare Documenso + URL on one line."""
    src = "> Based on [Documenso](https://github.com/documenso/documenso)."
    out = apply_substitutions(src)
    # Bare brand name (the link text) is replaced.
    assert "[Davinci Sign]" in out
    # The URL is preserved.
    assert "github.com/documenso/documenso" in out


def test_longest_match_wins_for_company_name():
    # "Documenso, Inc." is longer and should hit before "Documenso".
    src = "Copyright Documenso, Inc. 2024"
    assert apply_substitutions(src) == "Copyright Davinci AI Solutions 2024"


def test_email_substitution():
    src = "Contact noreply@documenso.com for help."
    out = apply_substitutions(src)
    assert "@documenso.com" not in out
    assert "noreply@davincisolutions.ai" in out


def test_docker_image_substitution_outside_credit_url():
    # "documenso/documenso" is the docker image name; replace when not in a URL.
    src = "FROM documenso/documenso:latest"
    out = apply_substitutions(src)
    assert "davinci/davinci-sign:latest" in out


def test_docker_image_preserved_inside_github_url():
    src = "Mirror of github.com/documenso/documenso on Docker Hub."
    out = apply_substitutions(src)
    # The URL is preserved entirely.
    assert "github.com/documenso/documenso" in out


def test_color_hex_substitution():
    src = "background: #7AC455;"
    assert apply_substitutions(src) == "background: #1A98CF;"


def test_idempotent():
    src = "Documenso and Documenso."
    once = apply_substitutions(src)
    twice = apply_substitutions(once)
    assert once == twice


def test_empty_content():
    assert apply_substitutions("") == ""


def test_no_brand_strings():
    src = "Just some plain text with no branding."
    assert apply_substitutions(src) == src


def test_full_readme_excerpt():
    """The shape of the README conflict the resolver was failing on."""
    src = (
        "# Documenso\n"
        "\n"
        "> The Open Source DocuSign Alternative.\n"
        "\n"
        "Documenso is a digital signature platform. Welcome to Documenso!\n"
        "\n"
        "Built on top of [@documenso/pdf-sign](https://github.com/documenso/documenso).\n"
        "\n"
        "Visit documenso.com for the hosted version.\n"
    )
    out = apply_substitutions(src)
    # Heading and prose: replaced.
    assert out.startswith("# Davinci Sign\n")
    assert "Davinci Sign is a digital signature platform. Welcome to Davinci Sign!" in out
    # Package scope: preserved.
    assert "@documenso/pdf-sign" in out
    # GitHub URL: preserved.
    assert "github.com/documenso/documenso" in out
    # Bare domain: replaced.
    assert "documenso.com" not in out
    assert "davincisolutions.ai" in out
