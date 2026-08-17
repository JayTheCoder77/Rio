from mcp.server import MCPServer

from app.graph import review_graph
from app.state import ReviewState

mcp = MCPServer("Rio")

@mcp.tool()
def review_diff(diff : str) -> list[dict]:
    """ Review a unified diff and return a list of findings.
        Each finding has : file , line  , severity (critical / warning / info),
        message , and rationale.
        """

    state = ReviewState(diff=diff)
    result = review_graph.invoke(state)
    return [f.model_dump() for f in result["findings"]]

