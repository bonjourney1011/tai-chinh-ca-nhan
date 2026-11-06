"""Convert a money amount into whole board lots."""

from __future__ import annotations

from taichinh.engine.types import LotAllocation


def money_to_lots(
    amount: float, prices: dict[str, float], weights: dict[str, float], lot_size: dict[str, float]
) -> LotAllocation:
    """Floor each target to lot multiples, then greedily spend leftover on the most underweight
    asset whose lot is still affordable. Assets without a price are skipped (cash stays)."""
    ids = [a for a, w in weights.items() if w > 0 and prices.get(a, 0) > 0]
    unit = {a: float(lot_size.get(a, 1) or 1) for a in ids}
    units = {a: 0.0 for a in ids}
    cost = {a: 0.0 for a in ids}
    for a in ids:
        lot_cost = unit[a] * prices[a]
        n = int((weights[a] * amount) // lot_cost)
        units[a], cost[a] = n * unit[a], n * lot_cost
    left = amount - sum(cost.values())
    while True:
        cand = [a for a in ids if unit[a] * prices[a] <= left + 1e-9]
        if not cand:
            break
        a = max(cand, key=lambda x: weights[x] * amount - cost[x])
        units[a] += unit[a]
        cost[a] += unit[a] * prices[a]
        left -= unit[a] * prices[a]
    tot = sum(cost.values())
    real = {a: (cost[a] / tot if tot > 0 else 0.0) for a in ids}
    return LotAllocation(units, cost, max(left, 0.0), real)


def drift_after_lots(target_w: dict[str, float], realised_w: dict[str, float]) -> dict[str, float]:
    keys = set(target_w) | set(realised_w)
    return {k: realised_w.get(k, 0.0) - target_w.get(k, 0.0) for k in keys}
