from langgraph.graph import END, StateGraph

from app.nodes.assemble import assemble_context
from app.nodes.ingest import ingest
from app.nodes.review import review
from app.nodes.verify import verify
from app.state import ReviewState

builder = StateGraph(ReviewState)
builder.add_node("ingest", ingest)
builder.add_node("assemble", assemble_context)
builder.add_node("review", review)
builder.add_node("verify", verify)
builder.set_entry_point("ingest")
builder.add_edge("ingest", "assemble")
builder.add_edge("assemble", "review")
builder.add_edge("review", "verify")
builder.add_edge("verify", END)

review_graph = builder.compile()
