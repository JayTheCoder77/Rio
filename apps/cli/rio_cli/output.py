from collections import defaultdict

from rich.console import Console
from rich.panel import Panel
from rio_core.models import Finding

console = Console()

SEVERITY_ORDER = ["critical", "warning", "info"]
SEVERITY_COLOR = {
    "critical": "red",
    "warning": "yellow",
    "info": "cyan",
}

def render_findings(findings : list[Finding]) -> None:
    if not findings:
        console.print("[green]No findings - looks clean.[/green]")
        return
    
    grouped : dict[str, list[Finding]] = defaultdict(list)

    for f in findings:
        grouped[f.severity].append(f)

    for severity in SEVERITY_ORDER:
        group = grouped.get(severity)
        if not group:
            continue

        color = SEVERITY_COLOR[severity]
        console.print(f"\n[bold {color}]{severity.upper()} ({len(group)})[/bold {color}]")

        for f in group:
            console.print(Panel(
               f"{f.message}\n\n[dim]{f.rationale}[/dim]",
                            title=f"{f.file}:{f.line}",
                            border_style=color,
            ))