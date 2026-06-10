import base64
from github import Github, GithubException

TOOLS = [
    {
        "name": "read_file",
        "description": "Read the content of a file from the GitHub repository",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "File path in the repository (e.g. 'src/main.py')"}
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
                "path": {"type": "string", "description": "Directory path (use '' for root)"}
            },
            "required": ["path"],
        },
    },
    {
        "name": "search_code",
        "description": "Search for a string or pattern across all files in the repository",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query string"}
            },
            "required": ["query"],
        },
    },
    {
        "name": "create_pull_request",
        "description": "Create a GitHub Pull Request with code fixes. Provide the files to change, the new content, and a description.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "PR title"},
                "body": {"type": "string", "description": "PR description with explanation of the fix"},
                "branch_name": {"type": "string", "description": "New branch name (e.g. 'fix/null-pointer-handler')"},
                "files": {
                    "type": "array",
                    "description": "List of files to create or modify",
                    "items": {
                        "type": "object",
                        "properties": {
                            "path": {"type": "string"},
                            "content": {"type": "string"},
                        },
                        "required": ["path", "content"],
                    },
                },
            },
            "required": ["title", "body", "branch_name", "files"],
        },
    },
    {
        "name": "classify_incident",
        "description": "Classify the incident type after analyzing the error",
        "input_schema": {
            "type": "object",
            "properties": {
                "incident_type": {
                    "type": "string",
                    "enum": ["quick_fix", "edge_case", "architectural", "unknown"],
                    "description": "Type of incident",
                },
                "reasoning": {"type": "string", "description": "Explanation of why this classification was chosen"},
                "confidence": {"type": "number", "description": "Confidence score between 0 and 1"},
            },
            "required": ["incident_type", "reasoning", "confidence"],
        },
    },
]


def execute_tool(tool_name: str, tool_input: dict, github_token: str, github_repo: str) -> str:
    try:
        g = Github(github_token)
        repo = g.get_repo(github_repo)

        if tool_name == "read_file":
            file = repo.get_contents(tool_input["path"])
            content = base64.b64decode(file.content).decode("utf-8")
            return f"File: {tool_input['path']}\n\n{content}"

        elif tool_name == "list_files":
            contents = repo.get_contents(tool_input["path"])
            if not isinstance(contents, list):
                contents = [contents]
            items = [f"{'[DIR]' if c.type == 'dir' else '[FILE]'} {c.path}" for c in contents]
            return "\n".join(items)

        elif tool_name == "search_code":
            results = g.search_code(f"{tool_input['query']} repo:{github_repo}")
            items = []
            for item in list(results)[:10]:
                items.append(f"- {item.path}")
            return "\n".join(items) if items else "No results found"

        elif tool_name == "create_pull_request":
            default_branch = repo.default_branch
            source = repo.get_branch(default_branch)
            repo.create_git_ref(
                ref=f"refs/heads/{tool_input['branch_name']}",
                sha=source.commit.sha,
            )
            for file_change in tool_input["files"]:
                try:
                    existing = repo.get_contents(file_change["path"], ref=tool_input["branch_name"])
                    repo.update_file(
                        path=file_change["path"],
                        message=f"fix: {tool_input['title']}",
                        content=file_change["content"],
                        sha=existing.sha,
                        branch=tool_input["branch_name"],
                    )
                except GithubException:
                    repo.create_file(
                        path=file_change["path"],
                        message=f"fix: {tool_input['title']}",
                        content=file_change["content"],
                        branch=tool_input["branch_name"],
                    )
            pr = repo.create_pull(
                title=tool_input["title"],
                body=tool_input["body"],
                head=tool_input["branch_name"],
                base=default_branch,
            )
            return f"PR created: {pr.html_url}"

        elif tool_name == "classify_incident":
            return f"Classified as: {tool_input['incident_type']} (confidence: {tool_input['confidence']:.0%}). {tool_input['reasoning']}"

        return "Unknown tool"
    except Exception as e:
        return f"Tool error: {str(e)}"
