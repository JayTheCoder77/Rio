from langgraph.graph import END, StateGraph

from app.nodes import enrich, ingest, review, verify
from app.state import ReviewState

builder = StateGraph(ReviewState)
builder.add_node("ingest", ingest)
builder.add_node("enrich", enrich)
builder.add_node("review", review)
builder.add_node("verify", verify)
builder.set_entry_point("ingest")
builder.add_edge("ingest", "enrich")
builder.add_edge("enrich", "review")
builder.add_edge("review", "verify")
builder.add_edge("verify", END)

review_graph = builder.compile()
