from langgraph.graph import END, StateGraph

from app.nodes import ingest, review
from app.state import ReviewState

builder = StateGraph(ReviewState)
builder.add_node("ingest", ingest)
builder.add_node("review", review)
builder.set_entry_point("ingest")
builder.add_edge("ingest", "review")
builder.add_edge("review", END)

review_graph = builder.compile()
