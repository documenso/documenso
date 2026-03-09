"""Branding configuration for Davinci Sign upstream sync resolver."""

from pydantic import Field, ConfigDict, computed_field
from pydantic_settings import BaseSettings


class BrandingConfig(BaseSettings):
    """Immutable configuration encoding all Davinci Sign branding rules."""

    model_config = ConfigDict(
        frozen=True,
        env_prefix="BRANDING_",
        env_file=".env",
        env_file_encoding="utf-8",
        populate_by_name=True,
    )

    # Brand identity
    brand_name: str = Field(default="Davinci Sign", description="Product brand name")
    company_name: str = Field(default="Davinci AI Solutions", description="Company legal name")
    email_domain: str = Field(default="davincisolutions.ai", description="Primary email domain")
    support_email: str = Field(default="support@davincisolutions.ai", description="Support email address")
    noreply_email: str = Field(default="noreply@davincisolutions.ai", description="No-reply email address")

    # Colors
    primary_hex: str = Field(default="#1A98CF", description="Primary brand color hex")
    primary_hsl: str = Field(default="197 79% 46%", description="Primary brand color HSL")

    # Upstream identifiers
    upstream_brand_name: str = Field(default="Documenso", description="Upstream project brand name")
    upstream_primary_hex: str = Field(default="#7AC455", description="Upstream primary color hex")

    # Docker
    docker_image: str = Field(default="davinci/davinci-sign", description="Docker image name")
    docker_container_prefix: str = Field(default="davinci-sign", description="Docker container name prefix")

    # Certificates
    cert_path: str = Field(default="/opt/davinci-sign/cert.p12", description="Certificate file path")

    # Symbol renames (code identifiers that changed)
    symbol_renames: dict[str, str] = Field(default_factory=lambda: {
        "DOCUMENSO_INTERNAL_EMAIL": "DAVINCI_INTERNAL_EMAIL",
        "X-Documenso-Secret": "X-Davinci-Secret",
    }, description="Code symbol renames mapping")

    # Package scope preserved to avoid breaking imports
    preserved_package_prefix: str = Field(default="@documenso/", description="Preserved package scope prefix")

    # OpenRouter configuration (alias bypasses env_prefix)
    openrouter_api_key: str = Field(default="", description="OpenRouter API key", alias="OPENROUTER_API_KEY")
    openrouter_model: str = Field(default="google/gemini-3-flash-preview", description="OpenRouter model ID", alias="OPENROUTER_MODEL")

    # --- File path classifications ---

    pure_branding_paths: frozenset[str] = Field(default_factory=lambda: frozenset({
        # packages/assets/
        "packages/assets/logo.png",
        "packages/assets/logo_icon.png",
        "packages/assets/favicon.ico",
        "packages/assets/favicon-16x16.png",
        "packages/assets/favicon-32x32.png",
        "packages/assets/apple-touch-icon.png",
        "packages/assets/android-chrome-192x192.png",
        "packages/assets/android-chrome-512x512.png",
        "packages/assets/opengraph-image.jpg",
        "packages/assets/static/logo.png",
        # apps/remix/public/
        "apps/remix/public/favicon.ico",
        "apps/remix/public/favicon-16x16.png",
        "apps/remix/public/favicon-32x32.png",
        "apps/remix/public/apple-touch-icon.png",
        "apps/remix/public/android-chrome-192x192.png",
        "apps/remix/public/android-chrome-512x512.png",
        "apps/remix/public/opengraph-image.jpg",
        "apps/remix/public/static/logo.png",
        # apps/documentation/public/
        "apps/documentation/public/favicon-16x16.png",
        "apps/documentation/public/favicon-32x32.png",
        "apps/documentation/public/apple-touch-icon.png",
        # packages/email/static/
        "packages/email/static/logo.png",
    }), description="Paths containing only branding assets")

    mixed_branding_paths: frozenset[str] = Field(default_factory=lambda: frozenset({
        # Core constants
        "packages/lib/constants/email.ts",
        "packages/lib/constants/auth.ts",
        "packages/lib/constants/app.ts",
        # Meta / SEO
        "apps/remix/app/utils/meta.ts",
        # Documentation theme
        "apps/documentation/theme.config.tsx",
        # API documentation
        "packages/api/v1/openapi.ts",
        "packages/trpc/server/open-api.ts",
        # Email templates
        "packages/email/template-components/template-footer.tsx",
        "packages/email/template-components/template-confirmation-email.tsx",
        # Server-side references
        "packages/lib/server-only/2fa/setup-2fa.ts",
        "packages/lib/utils/authenticator.ts",
        "packages/lib/jobs/definitions/internal/execute-webhook.handler.ts",
        "packages/trpc/server/webhook-router/resend-webhook-call.ts",
        "apps/documentation/pages/developers/webhooks.mdx",
        # UI components
        "apps/remix/app/components/general/branding-logo.tsx",
        "apps/remix/app/routes/_unauthenticated+/verify-email.$token.tsx",
        # Config files
        ".env.example",
        ".devcontainer/devcontainer.json",
        "README.md",
        "docker/README.md",
        # Color configuration
        "packages/tailwind-config/index.cjs",
        "packages/ui/styles/theme.css",
        # Docker configuration
        "docker/production/compose.yml",
        "docker/build.sh",
        "docker/buildx.sh",
        "docker/buildx-and-push.sh",
        "docker/Dockerfile.chromium",
        "docker/development/compose.yml",
        "docker/testing/compose.yml",
        "docker/start.sh",
        # Certificate references
        "packages/lib/server-only/cert/cert-status.ts",
    }), description="Paths containing mixed branding and functional content")

    pure_functional_patterns: tuple[str, ...] = (
        "packages/prisma/**",
        "**/migrations/**",
        "**/*.test.*",
        "**/*.spec.*",
        "**/*.test-*",
        "**/test/**",
        "**/tests/**",
    )

    binary_extensions: frozenset[str] = Field(default_factory=lambda: frozenset({
        ".png", ".jpg", ".jpeg", ".ico", ".svg",
        ".woff", ".woff2", ".ttf", ".otf",
        ".pdf", ".p12",
    }), description="File extensions treated as binary")

    @property
    def substitution_pairs(self) -> list[tuple[str, str]]:
        """Return the branding substitution pairs from the module-level list."""
        return BRANDING_SUBSTITUTIONS

    @property
    def preservation_strings(self) -> list[str]:
        """Return the branding preservation strings from the module-level list."""
        return BRANDING_PRESERVATIONS


# --- Substitution rules (ordered by specificity, longest first) ---

BRANDING_SUBSTITUTIONS: list[tuple[str, str]] = [
    # Full company / legal name
    ("Documenso, Inc.", "Davinci AI Solutions"),
    # Email addresses (before bare domain)
    ("@documenso.com", "@davincisolutions.ai"),
    # Bare domain
    ("documenso.com", "davincisolutions.ai"),
    # Docker image (before generic brand name)
    ("documenso/documenso", "davinci/davinci-sign"),
    # Certificate path
    ("/opt/documenso/cert.p12", "/opt/davinci-sign/cert.p12"),
    # Container names
    ("documenso-development", "davinci-sign-development"),
    ("documenso-production", "davinci-sign-production"),
    ("documenso-test", "davinci-sign-test"),
    # Code symbols (before generic brand name)
    ("DOCUMENSO_INTERNAL_EMAIL", "DAVINCI_INTERNAL_EMAIL"),
    ("X-Documenso-Secret", "X-Davinci-Secret"),
    # 2FA issuer
    ("Documenso", "Davinci Sign"),
    # Color hex (upstream green -> Davinci blue)
    ("#7AC455", "#1A98CF"),
]

# --- Strings that must NEVER be replaced ---

BRANDING_PRESERVATIONS: list[str] = [
    # Package scope - internal imports must stay @documenso/*
    "@documenso/",
    # Upstream GitHub URLs - credit to original project
    "github.com/documenso/documenso",
    "github.com/documenso/",
    # Short URL credit
    "documen.so/",
]
