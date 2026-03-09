"""Factory functions for creating mock OpenAI API responses."""

import json
from unittest.mock import MagicMock


def resolve_conflict_response(file_path: str, content: str, confidence: str = "high", explanation: str = "Merged upstream changes with Davinci Sign branding."):
    """Create a mock response with a resolve_conflict tool call."""
    from tests.conftest import make_openai_tool_call, make_openai_response

    tool_call = make_openai_tool_call("resolve_conflict", {
        "file_path": file_path,
        "resolved_content": content,
        "explanation": explanation,
        "confidence": confidence,
    })
    return make_openai_response([tool_call])


def keep_ours_response(file_path: str, explanation: str = "Pure branding file — kept our version."):
    """Create a mock response with a keep_ours tool call."""
    from tests.conftest import make_openai_tool_call, make_openai_response

    tool_call = make_openai_tool_call("keep_ours", {
        "file_path": file_path,
        "explanation": explanation,
    })
    return make_openai_response([tool_call])


def accept_theirs_response(file_path: str, explanation: str = "No branding relevance — accepted upstream."):
    """Create a mock response with an accept_theirs tool call."""
    from tests.conftest import make_openai_tool_call, make_openai_response

    tool_call = make_openai_tool_call("accept_theirs", {
        "file_path": file_path,
        "explanation": explanation,
    })
    return make_openai_response([tool_call])


def flag_for_review_response(file_path: str, reason: str = "Complex conflict requires human review."):
    """Create a mock response with a flag_for_review tool call."""
    from tests.conftest import make_openai_tool_call, make_openai_response

    tool_call = make_openai_tool_call("flag_for_review", {
        "file_path": file_path,
        "reason": reason,
        "suggested_resolution": "Manual review recommended.",
        "ours_snippet": "our code here",
        "theirs_snippet": "their code here",
    })
    return make_openai_response([tool_call])


def multi_file_response(calls: list[tuple[str, dict]]):
    """Create a mock response with multiple tool calls.

    Args:
        calls: List of (tool_name, arguments_dict) tuples.
    """
    from tests.conftest import make_openai_tool_call, make_openai_response

    tool_calls = [make_openai_tool_call(name, args) for name, args in calls]
    return make_openai_response(tool_calls)
