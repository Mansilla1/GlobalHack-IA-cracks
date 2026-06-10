import anthropic
from app.models.incident import Incident


async def generate_postmortem(incident: Incident) -> str:
    client = anthropic.AsyncAnthropic()

    prompt = f"""Generate a concise post-mortem report for the following incident.

Title: {incident.title}
Type: {incident.incident_type}
Status: {incident.status}
Error: {incident.error_message}
Stack trace: {incident.stack_trace or 'Not available'}
Agent analysis: {incident.agent_analysis or 'Not available'}
PR URL: {incident.github_pr_url or 'Not applicable'}

Write a professional post-mortem in markdown with these sections:
## Summary
## Root Cause
## Impact
## Resolution
## Lessons Learned
## Action Items

Be concise and technical."""

    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text
