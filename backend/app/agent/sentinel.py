import asyncio
import json
from collections.abc import AsyncGenerator
from typing import Any

import anthropic

from app.agent.tools import TOOLS, execute_tool

SYSTEM_PROMPT = """You are the Autonomic Sentinel, an AI agent specialized in detecting and healing software incidents.

Your job is to:
1. Analyze the incoming error/incident
2. Classify it using the classify_incident tool
3. Read the relevant code from the repository
4. Either fix it (create a PR) or generate an architectural report
5. Always be thorough but concise

Classification rules:
- quick_fix: Simple logic bugs, null pointer errors, off-by-one errors, missing validations
- edge_case: Unexpected input handling, missing test coverage for specific scenarios
- architectural: Design flaws, security vulnerabilities, performance issues affecting multiple components

For quick_fix and edge_case: read the relevant files, identify the bug, create a PR with the fix.
For architectural: analyze the code structure, identify the root cause, produce a detailed technical report.

Always explain your reasoning clearly as you work through the problem."""


async def run_agent_stream(
    incident_title: str,
    error_message: str,
    stack_trace: str,
    github_token: str,
    github_repo: str,
    target_path: str = "",
    api_key: str = "",
    model: str = "claude-sonnet-4-6",
) -> AsyncGenerator[dict[str, Any], None]:
    client = anthropic.AsyncAnthropic(api_key=api_key or None)

    target_hint = (
        f"\nFocus your code search starting from the path: `{target_path}`"
        if target_path
        else "\nStart by listing the root directory to understand the project structure."
    )

    user_message = f"""Incident: {incident_title}

Error: {error_message}

Stack trace:
{stack_trace or 'Not provided'}

Repository: {github_repo}{target_hint}

Analyze this incident, classify it, explore the repository to understand the context, and take the appropriate action (PR or architectural report)."""

    messages = [{"role": "user", "content": user_message}]
    classification = None
    pr_url = None
    report = None

    yield {"type": "status", "message": "Agent started. Analyzing incident..."}

    while True:
        async with client.messages.stream(
            model=model,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages,
        ) as stream:
            full_text = ""
            tool_uses = []
            current_tool = None

            async for event in stream:
                if event.type == "content_block_start":
                    if hasattr(event.content_block, "type"):
                        if event.content_block.type == "tool_use":
                            current_tool = {
                                "id": event.content_block.id,
                                "name": event.content_block.name,
                                "input": "",
                            }
                            yield {"type": "tool_start", "tool": event.content_block.name}

                elif event.type == "content_block_delta":
                    if hasattr(event.delta, "text"):
                        full_text += event.delta.text
                        yield {"type": "text_delta", "text": event.delta.text}
                    elif hasattr(event.delta, "partial_json") and current_tool:
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

        if final_message.stop_reason == "end_turn":
            break

        if not tool_uses:
            break

        tool_results = []
        for tool_use in tool_uses:
            yield {
                "type": "tool_executing",
                "tool": tool_use["name"],
                "input": tool_use["input"],
            }

            if tool_use["name"] == "create_pull_request" and not github_token:
                result = "Cannot create PR: GitHub token not configured in governance settings."
            else:
                result = await asyncio.to_thread(
                    execute_tool,
                    tool_use["name"],
                    tool_use["input"],
                    github_token,
                    github_repo,
                )

            if tool_use["name"] == "classify_incident":
                classification = tool_use["input"].get("incident_type", "unknown")
                yield {"type": "classification", "value": classification}

            if tool_use["name"] == "create_pull_request" and result.startswith("PR created:"):
                pr_url = result.split("PR created: ")[-1].strip()
                yield {"type": "pr_created", "url": pr_url}

            yield {"type": "tool_result", "tool": tool_use["name"], "result": result}

            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tool_use["id"],
                "content": result,
            })

        messages.append({"role": "user", "content": tool_results})

    if classification == "architectural":
        final_texts = [
            block.text for block in final_message.content if hasattr(block, "text")
        ]
        report = "\n".join(final_texts)

    yield {
        "type": "done",
        "classification": classification,
        "pr_url": pr_url,
        "report": report,
    }
