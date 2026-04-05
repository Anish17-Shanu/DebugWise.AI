import httpx
from ..core.config import settings


def _get_title(diagnostic: dict | object) -> str:
    if isinstance(diagnostic, dict):
        return str(diagnostic.get("title", "debugging"))
    return str(getattr(diagnostic, "title", "debugging"))


def build_query(language: str, source: str, diagnostics: list[dict] | list[object]) -> str:
    issue = _get_title(diagnostics[0]) if diagnostics else "debugging"
    mapped_issue = {
        "Undefined variable risk": {
            "python": "NameError variable used before assignment",
            "javascript": "ReferenceError variable is not defined",
            "typescript": "ReferenceError variable is not defined",
            "java": "cannot find symbol variable",
        },
        "Unused arithmetic expression": {
            "python": "statement has no effect arithmetic expression",
            "javascript": "statement has no effect arithmetic expression",
            "typescript": "statement has no effect arithmetic expression",
            "java": "statement has no effect arithmetic expression",
        },
        "Unused equality comparison": {
            "python": "comparison has no effect",
            "javascript": "comparison has no effect",
            "typescript": "comparison has no effect",
            "java": "comparison has no effect",
        },
    }
    query_issue = mapped_issue.get(issue, {}).get(language, issue)
    snippet = " ".join(source.strip().splitlines()[:2])[:80]
    return f"{language} {query_issue} {snippet}".strip()


async def fetch_stackexchange(query: str, language: str) -> list[dict]:
    params: dict[str, str | int] = {
        "order": "desc",
        "sort": "relevance",
        "site": "stackoverflow",
        "accepted": "True",
        "pagesize": 3,
        "q": query,
    }
    if language in {"python", "java", "javascript", "typescript"}:
        params["tagged"] = language
    if settings.stackexchange_key:
        params["key"] = settings.stackexchange_key

    async with httpx.AsyncClient(timeout=8.0) as client:
        response = await client.get("https://api.stackexchange.com/2.3/search/advanced", params=params)
        response.raise_for_status()
        data = response.json()
        return [
            {
                "title": item["title"],
                "source": "stackexchange",
                "url": item["link"],
                "summary": f"Stack Overflow score {item.get('score', 0)} with {item.get('answer_count', 0)} answers.",
            }
            for item in data.get("items", [])[:3]
        ]


async def fetch_github(query: str) -> list[dict]:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "DebugWise-AI",
    }
    if settings.github_token:
        headers["Authorization"] = f"Bearer {settings.github_token}"

    async with httpx.AsyncClient(timeout=8.0, headers=headers) as client:
        response = await client.get(
            "https://api.github.com/search/issues",
            params={"q": f"{query} state:open is:issue in:title", "per_page": 3},
        )
        response.raise_for_status()
        data = response.json()
        return [
            {
                "title": item["title"],
                "source": "github",
                "url": item["html_url"],
                "summary": f"GitHub issue in {item.get('repository_url', '').split('/')[-1] or 'repository'}.",
            }
            for item in data.get("items", [])
            if "pull_request" not in item
        ][:3]


async def collect_references(language: str, source: str, diagnostics: list[dict] | list[object]) -> list[dict]:
    if not settings.enable_online_research or not diagnostics:
        return []

    trivial_issues = {
        "Undefined variable risk",
        "Unused arithmetic expression",
        "Unused equality comparison",
        "Missing class declaration",
        "Python syntax error",
        "Unbalanced curly braces",
    }
    if _get_title(diagnostics[0]) in trivial_issues:
        return []

    query = build_query(language, source, diagnostics)
    results: list[dict] = []
    try:
        results.extend(await fetch_stackexchange(query, language))
    except Exception:
        pass

    if not results:
        try:
            results.extend(await fetch_github(query))
        except Exception:
            pass

    seen: set[str] = set()
    deduped: list[dict] = []
    for item in results:
        if item["url"] in seen:
            continue
        seen.add(item["url"])
        deduped.append(item)
    return deduped[:5]
