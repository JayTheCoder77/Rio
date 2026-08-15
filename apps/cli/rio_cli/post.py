import httpx
from rio_core.models import Finding

from rio_cli.config import get_ai_engine_url, get_api_key
from rio_cli.rio_config import load_rio_config
from rio_cli.utils import _fail


def _post_review(diff_text : str) -> list[Finding]:
    headers : dict = {}
    api_key = get_api_key()
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    
    rio_config = load_rio_config()
    ai_engine_url = get_ai_engine_url()
    try:
        response = httpx.post(
            f"{ai_engine_url}/v1/review",
            json={"diff" : diff_text , "config" : rio_config.model_dump()},
            headers=headers,
            timeout=120.0
        )
    except httpx.ConnectError:
        _fail(f"Error : could not connect to ai-engine at {ai_engine_url}.")
    
    except httpx.TimeoutException:
        _fail("Error: ai-engine request timed out.")
    
    if response.status_code != 200:
        _fail(f"Error: ai-engine returned {response.status_code}: {response.text}")
    
    data = response.json()
    return [Finding(**f) for f in data["findings"]]

