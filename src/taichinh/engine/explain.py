"""Plain Vietnamese explanations (subject-verb-object). Numbers are formatted, never computed."""

from __future__ import annotations

from taichinh.engine.types import BudgetDiagnosis, EquityCaps, Mix

ASSET_VI = {
    "deposit_12m": "tiền gửi 12 tháng", "bond_fund": "quỹ trái phiếu", "etf_vn30": "ETF VN30",
    "gold_sjc": "vàng SJC", "us_etf": "ETF Mỹ", "btc": "Bitcoin",
}

_BINDING_VI = {
    "horizon": "thời hạn mục tiêu còn ngắn",
    "drawdown": "mức sụt giảm tối đa anh chấp nhận",
    "var": "mức lỗ tối đa trong một năm xấu",
    "tolerance": "khẩu vị rủi ro của anh",
    "capacity": "khả năng tài chính hiện tại",
}
_VERDICT_VI = {
    "on_track": "Kế hoạch này nằm trong khả năng của bạn.",
    "stretch": "Kế hoạch này đòi hỏi anh tiết kiệm sát giới hạn.",
    "income_first": "Anh cần tăng thu nhập hoặc giảm chi tiêu trước khi đầu tư.",
    "build_emergency": "Anh cần lập quỹ khẩn cấp ít nhất ba tháng chi tiêu trước.",
    "infeasible": "Với ngân sách hiện tại anh không đạt mục tiêu này đúng hạn.",
}


def trieu(x: float) -> str:
    """6_200_000 -> '6,2 triệu'."""
    digits = 2 if abs(x) < 10e6 else 1
    return f"{x / 1e6:,.{digits}f}".replace(",", "_").replace(".", ",").replace("_", ".") + " triệu"


def pct(x: float) -> str:
    return f"{x * 100:.0f}%"


def explain_caps(caps: EquityCaps) -> str:
    why = _BINDING_VI.get(caps.binding, caps.binding)
    return f"Anh giữ tối đa {pct(caps.w_eq)} vào tài sản rủi ro vì {why}."


def explain_mix(mix: Mix, p_success: float, pmt: float) -> str:
    top = sorted(mix.weights.items(), key=lambda kv: kv[1], reverse=True)[:3]
    names = ", ".join(f"{ASSET_VI.get(k, k)} {pct(v)}" for k, v in top if v > 0.005)
    return (
        f"Danh mục {mix.name} gồm {names}. "
        f"Anh gửi {trieu(pmt)} mỗi tháng và đạt mục tiêu với xác suất {pct(p_success)}."
    )


def explain_verdict(diag: BudgetDiagnosis) -> list[str]:
    m = diag.metrics
    out = [
        _VERDICT_VI[diag.verdict],
        f"Anh tiết kiệm được {pct(m.savings_rate)} thu nhập và có quỹ khẩn cấp "
        f"{m.emergency_months:.1f} tháng chi tiêu thiết yếu.",
    ]
    if diag.levers:
        top = diag.levers[0]
        out.append(top.description_vi)
    if diag.debt_avalanche and diag.debt_snowball:
        a, s = diag.debt_avalanche, diag.debt_snowball
        out.append(
            f"Anh trả nợ theo lãi suất cao trước sẽ tốn {trieu(a.total_interest)} tiền lãi, "
            f"rẻ hơn cách trả nợ nhỏ trước ({trieu(s.total_interest)})."
        )
    return out
