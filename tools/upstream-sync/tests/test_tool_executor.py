"""Tests for the exploration tool executor."""

from __future__ import annotations

import subprocess
from pathlib import Path
from unittest.mock import patch

import pytest

from branding_resolver.tool_executor import (
    _MAX_READ_LINES,
    _MAX_SEARCH_CHARS,
    execute_read_file,
    execute_search_codebase,
    execute_tool_call,
)


@pytest.fixture()
def repo_path(tmp_path: Path) -> Path:
    return tmp_path


# ---------------------------------------------------------------------------
# search_codebase
# ---------------------------------------------------------------------------


class TestSearchCodebase:
    def test_basic_search(self, repo_path: Path) -> None:
        mock_output = (
            "packages/lib/constants.ts:42:export const DOCUMENT_DISTRIBUTION_METHODS = {\n"
            "packages/lib/types.ts:10:  method: DOCUMENT_DISTRIBUTION_METHODS;\n"
        )
        with patch("branding_resolver.tool_executor.subprocess.run") as mock_run:
            mock_run.return_value = subprocess.CompletedProcess(
                args=[], returncode=0, stdout=mock_output, stderr=""
            )
            result = execute_search_codebase("DOCUMENT_DISTRIBUTION_METHODS", "", repo_path)

        assert "packages/lib/constants.ts:42" in result
        assert "DOCUMENT_DISTRIBUTION_METHODS" in result

    def test_with_file_glob(self, repo_path: Path) -> None:
        with patch("branding_resolver.tool_executor.subprocess.run") as mock_run:
            mock_run.return_value = subprocess.CompletedProcess(
                args=[], returncode=0, stdout="match\n", stderr=""
            )
            execute_search_codebase("pattern", "*.ts", repo_path)

            cmd = mock_run.call_args[0][0]
            assert "--" in cmd
            assert "*.ts" in cmd

    def test_no_results(self, repo_path: Path) -> None:
        with patch("branding_resolver.tool_executor.subprocess.run") as mock_run:
            mock_run.return_value = subprocess.CompletedProcess(
                args=[], returncode=1, stdout="", stderr=""
            )
            result = execute_search_codebase("nonexistent_symbol", "", repo_path)

        assert "No results found" in result

    def test_truncation(self, repo_path: Path) -> None:
        long_output = "x" * (_MAX_SEARCH_CHARS + 1000)
        with patch("branding_resolver.tool_executor.subprocess.run") as mock_run:
            mock_run.return_value = subprocess.CompletedProcess(
                args=[], returncode=0, stdout=long_output, stderr=""
            )
            result = execute_search_codebase("pattern", "", repo_path)

        assert len(result) < len(long_output)
        assert "truncated" in result

    def test_empty_pattern(self, repo_path: Path) -> None:
        result = execute_search_codebase("", "", repo_path)
        assert "Error" in result

    def test_timeout(self, repo_path: Path) -> None:
        with patch("branding_resolver.tool_executor.subprocess.run") as mock_run:
            mock_run.side_effect = subprocess.TimeoutExpired(cmd="git", timeout=30)
            result = execute_search_codebase("pattern", "", repo_path)

        assert "timed out" in result


# ---------------------------------------------------------------------------
# read_file
# ---------------------------------------------------------------------------


class TestReadFile:
    def test_basic_read(self, repo_path: Path) -> None:
        file_content = "line 1\nline 2\nline 3\nline 4\nline 5\n"
        with patch("branding_resolver.tool_executor.subprocess.run") as mock_run:
            mock_run.return_value = subprocess.CompletedProcess(
                args=[], returncode=0, stdout=file_content, stderr=""
            )
            result = execute_read_file("src/file.ts", 1, 5, repo_path)

        assert "1: line 1" in result
        assert "5: line 5" in result

    def test_line_range(self, repo_path: Path) -> None:
        lines = "\n".join(f"line {i}" for i in range(1, 51))
        with patch("branding_resolver.tool_executor.subprocess.run") as mock_run:
            mock_run.return_value = subprocess.CompletedProcess(
                args=[], returncode=0, stdout=lines, stderr=""
            )
            result = execute_read_file("src/file.ts", 10, 20, repo_path)

        assert "10: line 10" in result
        assert "20: line 20" in result
        assert "9: line 9" not in result
        assert "21: line 21" not in result

    def test_file_not_found(self, repo_path: Path) -> None:
        with patch("branding_resolver.tool_executor.subprocess.run") as mock_run:
            mock_run.return_value = subprocess.CompletedProcess(
                args=[], returncode=128, stdout="", stderr="fatal: not found"
            )
            result = execute_read_file("nonexistent.ts", 1, 10, repo_path)

        assert "File not found" in result

    def test_max_lines_clamped(self, repo_path: Path) -> None:
        lines = "\n".join(f"line {i}" for i in range(1, 1001))
        with patch("branding_resolver.tool_executor.subprocess.run") as mock_run:
            mock_run.return_value = subprocess.CompletedProcess(
                args=[], returncode=0, stdout=lines, stderr=""
            )
            result = execute_read_file("big.ts", 1, 500, repo_path)

        # Should be clamped to _MAX_READ_LINES
        result_lines = result.strip().split("\n")
        assert len(result_lines) == _MAX_READ_LINES

    def test_empty_path(self, repo_path: Path) -> None:
        result = execute_read_file("", 1, 10, repo_path)
        assert "Error" in result


# ---------------------------------------------------------------------------
# execute_tool_call router
# ---------------------------------------------------------------------------


class TestExecuteToolCall:
    def test_routes_search(self, repo_path: Path) -> None:
        with patch("branding_resolver.tool_executor.subprocess.run") as mock_run:
            mock_run.return_value = subprocess.CompletedProcess(
                args=[], returncode=0, stdout="result\n", stderr=""
            )
            result = execute_tool_call(
                "search_codebase",
                {"pattern": "test"},
                repo_path,
            )
        assert "result" in result

    def test_routes_read(self, repo_path: Path) -> None:
        with patch("branding_resolver.tool_executor.subprocess.run") as mock_run:
            mock_run.return_value = subprocess.CompletedProcess(
                args=[], returncode=0, stdout="content\n", stderr=""
            )
            result = execute_tool_call(
                "read_file",
                {"file_path": "test.ts"},
                repo_path,
            )
        assert "content" in result

    def test_unknown_tool(self, repo_path: Path) -> None:
        result = execute_tool_call("unknown_tool", {}, repo_path)
        assert "Unknown tool" in result
