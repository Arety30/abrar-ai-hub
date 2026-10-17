"""Finance, investing & business tools — deterministic, offline math.

Powers the Financial Advisor, Investor, Small-Business and Product connectors.
All pure calculation (no network), so results are exact and testable.
"""
from __future__ import annotations

import json

from ..registry import registry
from ..safety import workspace_out


def _money(x: float) -> str:
    return f"${x:,.2f}"


# ---------------------------------------------------------------- finance ---
@registry.tool(
    "compound_interest",
    "Project savings growth with compound interest and optional monthly contributions.",
    {
        "principal": {"type": "number", "description": "Starting amount"},
        "annual_rate_pct": {"type": "number", "description": "Annual interest rate, %"},
        "years": {"type": "number", "description": "Number of years"},
        "monthly_contribution": {"type": "number", "description": "Added each month", "_optional": True},
    },
    plugin="finance",
)
def compound_interest(principal: float, annual_rate_pct: float, years: float,
                      monthly_contribution: float = 0) -> str:
    r = annual_rate_pct / 100 / 12
    n = int(years * 12)
    bal = float(principal)
    contributed = float(principal)
    for _ in range(n):
        bal = bal * (1 + r) + monthly_contribution
        contributed += monthly_contribution
    interest = bal - contributed
    return (f"Future value after {years} yrs: {_money(bal)}\n"
            f"Total contributed: {_money(contributed)}\n"
            f"Interest earned: {_money(interest)}")


@registry.tool(
    "loan_payment",
    "Compute the monthly payment and total interest on an amortizing loan.",
    {
        "principal": {"type": "number", "description": "Loan amount"},
        "annual_rate_pct": {"type": "number", "description": "Annual interest rate, %"},
        "years": {"type": "number", "description": "Term in years"},
    },
    plugin="finance",
)
def loan_payment(principal: float, annual_rate_pct: float, years: float) -> str:
    r = annual_rate_pct / 100 / 12
    n = int(years * 12)
    if r == 0:
        pay = principal / n
    else:
        pay = principal * r / (1 - (1 + r) ** -n)
    total = pay * n
    return (f"Monthly payment: {_money(pay)}\n"
            f"Total paid: {_money(total)}\n"
            f"Total interest: {_money(total - principal)}")


@registry.tool(
    "retirement_projection",
    "Project a retirement balance from current savings + monthly contributions.",
    {
        "current_savings": {"type": "number", "description": "Current balance"},
        "monthly_contribution": {"type": "number", "description": "Saved each month"},
        "annual_return_pct": {"type": "number", "description": "Expected annual return, %"},
        "years": {"type": "number", "description": "Years until retirement"},
    },
    plugin="finance",
)
def retirement_projection(current_savings: float, monthly_contribution: float,
                          annual_return_pct: float, years: float) -> str:
    return compound_interest(current_savings, annual_return_pct, years, monthly_contribution)


# --------------------------------------------------------------- investing ---
@registry.tool(
    "roi_cagr",
    "Compute total ROI and annualized CAGR for an investment.",
    {
        "initial": {"type": "number", "description": "Amount invested"},
        "final": {"type": "number", "description": "Ending value"},
        "years": {"type": "number", "description": "Holding period in years"},
    },
    plugin="invest",
)
def roi_cagr(initial: float, final: float, years: float) -> str:
    if initial <= 0 or years <= 0:
        return "initial and years must be positive."
    roi = (final - initial) / initial * 100
    cagr = ((final / initial) ** (1 / years) - 1) * 100
    return f"Total ROI: {roi:.2f}%\nCAGR: {cagr:.2f}% per year\nGain: {_money(final - initial)}"


@registry.tool(
    "dcf_value",
    "Net present value of future cash flows via discounted cash flow.",
    {
        "cashflows_json": {"type": "string", "description": "JSON list of yearly cash flows"},
        "discount_rate_pct": {"type": "number", "description": "Discount rate, %"},
    },
    plugin="invest",
)
def dcf_value(cashflows_json: str, discount_rate_pct: float) -> str:
    try:
        flows = [float(x) for x in json.loads(cashflows_json)]
    except Exception as e:
        return f"cashflows_json must be a JSON list of numbers: {e}"
    d = discount_rate_pct / 100
    npv = sum(cf / (1 + d) ** (i + 1) for i, cf in enumerate(flows))
    return f"NPV @ {discount_rate_pct}%: {_money(npv)}\nUndiscounted sum: {_money(sum(flows))}"


@registry.tool(
    "portfolio_allocation",
    "Suggest a simple stock/bond/cash split from age and risk tolerance.",
    {
        "age": {"type": "number", "description": "Investor age"},
        "risk": {"type": "string", "description": "low | medium | high", "_optional": True},
    },
    plugin="invest",
)
def portfolio_allocation(age: float, risk: str = "medium") -> str:
    stocks = max(20, min(90, 110 - age))
    adj = {"low": -15, "medium": 0, "high": 15}.get(risk.lower(), 0)
    stocks = max(10, min(95, stocks + adj))
    bonds = max(5, (100 - stocks) * 0.7)
    cash = max(0, 100 - stocks - bonds)
    return (f"Suggested allocation (age {age:.0f}, {risk} risk):\n"
            f"  Stocks: {stocks:.0f}%\n  Bonds: {bonds:.0f}%\n  Cash: {cash:.0f}%\n"
            "Rule-of-thumb only — not investment advice.")


# ---------------------------------------------------------------- business ---
@registry.tool(
    "break_even",
    "Break-even analysis: units and revenue needed to cover costs.",
    {
        "fixed_costs": {"type": "number", "description": "Total fixed costs"},
        "price_per_unit": {"type": "number", "description": "Selling price per unit"},
        "variable_cost_per_unit": {"type": "number", "description": "Variable cost per unit"},
    },
    plugin="business",
)
def break_even(fixed_costs: float, price_per_unit: float, variable_cost_per_unit: float) -> str:
    margin = price_per_unit - variable_cost_per_unit
    if margin <= 0:
        return "Price must exceed variable cost to ever break even."
    units = fixed_costs / margin
    return (f"Contribution margin/unit: {_money(margin)}\n"
            f"Break-even: {units:,.0f} units\n"
            f"Break-even revenue: {_money(units * price_per_unit)}")


@registry.tool(
    "pricing_margin",
    "Compute a selling price from cost and target margin (or markup).",
    {
        "cost": {"type": "number", "description": "Unit cost"},
        "margin_pct": {"type": "number", "description": "Target gross margin, %"},
    },
    plugin="business",
)
def pricing_margin(cost: float, margin_pct: float) -> str:
    if margin_pct >= 100:
        return "margin_pct must be < 100."
    price = cost / (1 - margin_pct / 100)
    return (f"Price: {_money(price)} for {margin_pct:.0f}% margin\n"
            f"Profit/unit: {_money(price - cost)}\n"
            f"Markup: {(price - cost) / cost * 100:.0f}%")


@registry.tool(
    "make_invoice",
    "Generate a PDF invoice offline. items_json is a list of {desc, qty, unit_price}.",
    {
        "filename": {"type": "string", "description": "Output PDF, e.g. invoice_001.pdf"},
        "client": {"type": "string", "description": "Client / bill-to name"},
        "items_json": {"type": "string", "description": "JSON list of {desc,qty,unit_price}"},
        "tax_pct": {"type": "number", "description": "Tax percent", "_optional": True},
    },
    danger=True, plugin="business",
)
def make_invoice(filename: str, client: str, items_json: str, tax_pct: float = 0) -> str:
    from fpdf import FPDF
    try:
        items = json.loads(items_json)
    except Exception as e:
        return f"items_json must be a JSON list: {e}"
    if not filename.lower().endswith(".pdf"):
        filename += ".pdf"
    out = workspace_out(filename)

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 22)
    pdf.cell(0, 12, "INVOICE", ln=1)
    pdf.set_font("Helvetica", "", 12)
    pdf.cell(0, 8, f"Bill to: {client}", ln=1)
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(90, 8, "Description", border=1)
    pdf.cell(25, 8, "Qty", border=1)
    pdf.cell(35, 8, "Unit", border=1)
    pdf.cell(35, 8, "Amount", border=1, ln=1)
    pdf.set_font("Helvetica", "", 11)
    subtotal = 0.0
    for it in items:
        qty = float(it.get("qty", 1)); unit = float(it.get("unit_price", 0))
        amt = qty * unit; subtotal += amt
        pdf.cell(90, 8, str(it.get("desc", ""))[:45], border=1)
        pdf.cell(25, 8, f"{qty:g}", border=1)
        pdf.cell(35, 8, f"{unit:,.2f}", border=1)
        pdf.cell(35, 8, f"{amt:,.2f}", border=1, ln=1)
    tax = subtotal * tax_pct / 100
    total = subtotal + tax
    pdf.ln(2)
    pdf.cell(150, 8, "Subtotal", align="R")
    pdf.cell(35, 8, f"{subtotal:,.2f}", ln=1, align="R")
    pdf.cell(150, 8, f"Tax ({tax_pct:g}%)", align="R")
    pdf.cell(35, 8, f"{tax:,.2f}", ln=1, align="R")
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(150, 9, "TOTAL", align="R")
    pdf.cell(35, 9, f"{total:,.2f}", ln=1, align="R")
    pdf.output(str(out))
    return f"Invoice for {client} ({_money(total)}) saved: {out}"


# ---------------------------------------------------------------- product ---
@registry.tool(
    "rice_score",
    "RICE prioritization score = Reach × Impact × Confidence / Effort.",
    {
        "reach": {"type": "number", "description": "People affected per period"},
        "impact": {"type": "number", "description": "Impact 0.25–3"},
        "confidence_pct": {"type": "number", "description": "Confidence, %"},
        "effort": {"type": "number", "description": "Person-months of effort"},
    },
    plugin="product",
)
def rice_score(reach: float, impact: float, confidence_pct: float, effort: float) -> str:
    if effort <= 0:
        return "effort must be > 0."
    score = reach * impact * (confidence_pct / 100) / effort
    return f"RICE score: {score:.1f}  (higher = prioritize sooner)"
