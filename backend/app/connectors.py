"""Role connectors — each pairs a specialist agent (persona) with a domain toolset.

Surfaced in the Connectors hub; "Open in Chat" switches the general chat to that
specialist. Everything is local/offline.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Connector:
    key: str
    name: str
    icon: str
    description: str
    persona: str            # persona key the chat switches to
    plugins: list[str]      # tool plugin slugs this role relies on
    examples: list[str] = field(default_factory=list)


CONNECTORS: list[Connector] = [
    Connector("pa", "Personal Assistant", "🗂",
              "Calendar, tasks, reminders, contacts, and email drafts — offline.",
              "pa", ["calendar", "tasks", "contacts", "email", "translate"],
              ["Schedule a dentist appointment next Tuesday 3pm",
               "Add a task to submit the report Friday, high priority"]),
    Connector("researcher", "Researcher", "🔬",
              "Synthesize sources, extract findings, compare, and cite.",
              "researcher", ["files", "pdf", "charts", "council", "data"],
              ["Summarize my sources into a literature review",
               "Where do my sources disagree?"]),
    Connector("dev", "Developer", "💻",
              "Write & run code and manage git repositories.",
              "coder", ["git", "python", "files", "shell", "database"],
              ["Review my staged diff", "Write a commit message for these changes"]),
    Connector("student", "Student", "🎓",
              "Learn interactively, get quizzed, and review with spaced repetition.",
              "study_partner", ["charts"],
              ["Quiz me on the water cycle", "Explain gradient descent simply"]),
    Connector("product", "Product Builder", "📦",
              "Turn ideas into PRDs, user stories, and prioritized roadmaps.",
              "product", ["product", "slides", "files"],
              ["Draft a PRD for a habit tracker", "RICE-score these three features"]),
    Connector("manager", "Business Manager", "📊",
              "OKRs, SWOT, action plans, memos, and decks.",
              "manager", ["business", "slides", "sheets", "data"],
              ["Draft Q3 OKRs for a small team", "SWOT for my coffee shop"]),
    Connector("advisor", "Financial Advisor", "💰",
              "Budgets, loans, savings and retirement planning.",
              "advisor", ["finance", "charts"],
              ["Monthly payment on a $20k loan at 6% for 5 years",
               "Will $500/month reach $1M in 30 years at 7%?"]),
    Connector("smb", "Small Business", "🏪",
              "Pricing, margins, break-even, and invoicing.",
              "smb", ["business", "finance", "pdf", "sheets"],
              ["Break-even at $12 price, $4 cost, $8k fixed",
               "Make an invoice for Acme Co"]),
    Connector("investor", "Investor", "📈",
              "Returns, valuation, and portfolio math.",
              "investor", ["invest", "finance", "charts", "data"],
              ["CAGR from $10k to $18k over 4 years",
               "Suggest an allocation for age 35, high risk"]),
]


def all() -> list[Connector]:
    return CONNECTORS


def get(key: str) -> Connector | None:
    return next((c for c in CONNECTORS if c.key == key), None)
