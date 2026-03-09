import pytest
from unittest.mock import MagicMock
from branding_resolver.config import BrandingConfig
from branding_resolver.differ import ConflictHunk, FileConflict
from branding_resolver.confidence import ConfidenceLevel


@pytest.fixture
def mock_config():
    """Default BrandingConfig with all Davinci Sign branding."""
    return BrandingConfig()


@pytest.fixture
def sample_conflict_ts():
    """A TypeScript FileConflict with branding + functional changes."""
    return FileConflict(
        path="packages/lib/constants/app.ts",
        hunks=[
            ConflictHunk(
                ours='export const APP_NAME = "Davinci Sign";\nexport const APP_VERSION = "2.5.0";\n',
                theirs='export const APP_NAME = "Documenso";\nexport const APP_VERSION = "2.6.0";\n',
                context_before='// Application constants\n',
                context_after='\nexport const APP_URL = "https://app.davincisolutions.ai";\n',
                start_line=5,
                end_line=12,
            )
        ],
        full_ours='// Application constants\nexport const APP_NAME = "Davinci Sign";\nexport const APP_VERSION = "2.5.0";\nexport const APP_URL = "https://app.davincisolutions.ai";\n',
        full_theirs='// Application constants\nexport const APP_NAME = "Documenso";\nexport const APP_VERSION = "2.6.0";\nexport const APP_URL = "https://app.documenso.com";\n',
    )


@pytest.fixture
def sample_conflict_functional():
    """A pure functional FileConflict (migration, no branding)."""
    return FileConflict(
        path="packages/prisma/migrations/001_add_users/migration.sql",
        hunks=[
            ConflictHunk(
                ours='ALTER TABLE "User" ADD COLUMN "avatar" TEXT;\n',
                theirs='ALTER TABLE "User" ADD COLUMN "avatar" TEXT;\nALTER TABLE "User" ADD COLUMN "locale" TEXT DEFAULT \'en\';\n',
                context_before='-- Migration: add user fields\n',
                context_after='',
                start_line=3,
                end_line=8,
            )
        ],
        full_ours='-- Migration: add user fields\nALTER TABLE "User" ADD COLUMN "avatar" TEXT;\n',
        full_theirs='-- Migration: add user fields\nALTER TABLE "User" ADD COLUMN "avatar" TEXT;\nALTER TABLE "User" ADD COLUMN "locale" TEXT DEFAULT \'en\';\n',
    )


def make_openai_tool_call(name: str, arguments: dict) -> MagicMock:
    """Create a mock OpenAI tool call object."""
    import json
    tool_call = MagicMock()
    tool_call.function.name = name
    tool_call.function.arguments = json.dumps(arguments)
    return tool_call


def make_openai_response(tool_calls: list, prompt_tokens: int = 100, completion_tokens: int = 50) -> MagicMock:
    """Create a mock OpenAI chat completion response with tool calls."""
    response = MagicMock()
    response.choices = [MagicMock()]
    response.choices[0].message.tool_calls = tool_calls
    response.usage.prompt_tokens = prompt_tokens
    response.usage.completion_tokens = completion_tokens
    return response


def git_command_router(conflicted_files: list[str], file_contents: dict[str, str] | None = None):
    """Create a side_effect function for mocking subprocess.run.

    Args:
        conflicted_files: List of file paths to return for `git diff --name-only --diff-filter=U`
        file_contents: Optional dict mapping "ref:path" to content for `git show`
    """
    import subprocess

    def side_effect(cmd, **kwargs):
        cmd_str = " ".join(cmd) if isinstance(cmd, list) else cmd

        result = MagicMock(spec=subprocess.CompletedProcess)
        result.returncode = 0
        result.stderr = ""

        if "diff" in cmd_str and "--diff-filter=U" in cmd_str:
            result.stdout = "\n".join(conflicted_files) + "\n" if conflicted_files else ""
        elif "checkout" in cmd_str and ("--ours" in cmd_str or "--theirs" in cmd_str):
            result.stdout = ""
        elif "add" in cmd_str:
            result.stdout = ""
        elif "show" in cmd_str:
            # Extract ref:path from the command
            show_arg = [a for a in cmd if ":" in a and not a.startswith("-")]
            if show_arg and file_contents:
                key = show_arg[0]
                result.stdout = file_contents.get(key, "")
            else:
                result.stdout = ""
        else:
            result.stdout = ""

        return result

    return side_effect
