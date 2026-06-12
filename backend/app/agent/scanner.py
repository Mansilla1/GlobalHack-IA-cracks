import asyncio
import json
from collections.abc import AsyncGenerator
from typing import Any

import anthropic

from app.agent.tools import execute_tool

SCAN_TOOLS = [
    {
        "name": "read_file",
        "description": "Read the content of a file from the GitHub repository",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"}
            },
            "required": ["path"],
        },
    },
    {
        "name": "list_files",
        "description": "List files and directories at a given path in the repository",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"}
            },
            "required": ["path"],
        },
    },
    {
        "name": "report_bugs",
        "description": "Submit the list of bugs found. Call this once after analyzing the codebase.",
        "input_schema": {
            "type": "object",
            "properties": {
                "bugs": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title":         {"type": "string", "description": "Short bug title"},
                            "error_message": {"type": "string", "description": "Specific error or problem description"},
                            "stack_trace":   {"type": "string", "description": "File path and relevant code snippet showing the bug"},
                            "incident_type": {
                                "type": "string",
                                "enum": ["quick_fix", "edge_case", "architectural"],
                            },
                        },
                        "required": ["title", "error_message", "stack_trace", "incident_type"],
                    },
                }
            },
            "required": ["bugs"],
        },
    },
]

SCAN_SYSTEM_PROMPT = """You are a code bug scanner. Your job is to explore a repository and find real bugs.

Steps:
1. List the root directory to understand the project structure
2. Identify the main source directories (backend, src, app, etc.)
3. Read the key source files — routes, controllers, models, services
4. Look for concrete bugs: missing validations, division by zero, SQL injection, null pointer risks,
   negative value handling, missing error handling, security vulnerabilities
5. Call report_bugs with your findings (max 6 bugs, prioritize by severity)

Classification rules:
- quick_fix: simple logic bugs, missing null checks, off-by-one, missing validation
- edge_case: unhandled inputs, missing test coverage for specific scenarios
- architectural: security vulnerabilities, design flaws, performance issues

For stack_trace: include the actual file path and the buggy code lines.
Focus on real, exploitable bugs — not style or naming issues."""


async def scan_repository(
    github_token: str,
    github_repo: str,
    target_path: str = "",
    api_key: str = "",
    model: str = "claude-sonnet-4-6",
) -> AsyncGenerator[dict[str, Any], None]:
    client = anthropic.AsyncAnthropic(api_key=api_key or None)

    start_hint = (
        f"Start exploring from the path: `{target_path}`"
        if target_path
        else "Start by listing the root directory."
    )

    messages = [{"role": "user", "content": (
        f"Scan the repository `{github_repo}` for bugs. {start_hint}\n"
        "Read the main source files and call report_bugs with all findings."
    )}]

    bugs: list[dict] = []

    yield {"type": "status", "message": "Scanner started. Exploring repository..."}

    while True:
        async with client.messages.stream(
            model=model,
            max_tokens=4096,
            system=SCAN_SYSTEM_PROMPT,
            tools=SCAN_TOOLS,
            messages=messages,
        ) as stream:
            tool_uses = []
            current_tool = None

            async for event in stream:
                if event.type == "content_block_start":
                    if hasattr(event.content_block, "type") and event.content_block.type == "tool_use":
                        current_tool = {
                            "id": event.content_block.id,
                            "name": event.content_block.name,
                            "input": "",
                        }
                        if event.content_block.name != "report_bugs":
                            yield {"type": "tool_start", "tool": event.content_block.name}

                elif event.type == "content_block_delta":
                    if hasattr(event.delta, "partial_json") and current_tool:
                        current_tool["input"] += event.delta.partial_json

                elif event.type == "content_block_stop":
                    if current_tool:
                        try:
                            current_tool["input"] = json.loads(current_tool["input"])
                        except Exception:
                            current_tool["input"] = {}
                        tool_uses.append(current_tool)
                        current_tool = None

            final_message = await stream.get_final_message()

        messages.append({"role": "assistant", "content": final_message.content})

        if final_message.stop_reason == "end_turn" or not tool_uses:
            break

        tool_results = []
        for tool_use in tool_uses:
            if tool_use["name"] == "report_bugs":
                bugs = tool_use["input"].get("bugs", [])
                yield {"type": "bugs_found", "count": len(bugs)}
                result = f"Reported {len(bugs)} bugs."
            else:
                yield {"type": "tool_executing", "tool": tool_use["name"]}
                result = await asyncio.to_thread(
                    execute_tool,
                    tool_use["name"],
                    tool_use["input"],
                    github_token,
                    github_repo,
                )

            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tool_use["id"],
                "content": result,
            })

        messages.append({"role": "user", "content": tool_results})

        if bugs:
            break

    yield {"type": "done", "bugs": bugs}
