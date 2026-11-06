"""Primal active-set QP: min 0.5 w'Qw s.t. A w = b, w >= 0 (port of the TS solver)."""

from __future__ import annotations

import numpy as np

STEP_TOL = 1e-11
MULT_TOL = 1e-11
COND_LIMIT = 1e13


def _solve_linear(a: np.ndarray, b: np.ndarray) -> np.ndarray | None:
    try:
        x = np.linalg.solve(a, b)
        if not np.all(np.isfinite(x)) or np.linalg.cond(a) > COND_LIMIT:
            return None
    except np.linalg.LinAlgError:
        return None
    return x


def solve_nonneg_qp(
    q: np.ndarray, a_eq: np.ndarray, b_eq: np.ndarray, start: np.ndarray
) -> np.ndarray:
    """`start` must satisfy a_eq @ start = b_eq and start >= 0 (b_eq is implied by `start`)."""
    n = len(start)
    a = np.atleast_2d(np.asarray(a_eq, dtype=float))
    m = a.shape[0]
    ridge = 1e-10 * (np.trace(q) / n or 1.0)
    qr = np.asarray(q, dtype=float) + ridge * np.eye(n)

    w = np.maximum(np.asarray(start, dtype=float), 0.0)
    at_zero: set[int] = set()

    for _ in range(100 * n + 100):
        free = [i for i in range(n) if i not in at_zero]
        f = len(free)
        g = qr @ w
        kkt = np.zeros((f + m, f + m))
        kkt[:f, :f] = qr[np.ix_(free, free)]
        kkt[:f, f:] = a[:, free].T
        kkt[f:, :f] = a[:, free]
        sol = _solve_linear(kkt, np.concatenate([-g[free], np.zeros(m)]))
        if sol is None:
            break
        step, nu = sol[:f], sol[f:]
        step_size = float(np.max(np.abs(step))) if f else 0.0

        if step_size < STEP_TOL * (1.0 + w.max()):
            release, worst = -1, -MULT_TOL
            for i in sorted(at_zero):
                mult = g[i] + a[:, i] @ nu
                if mult < worst:
                    worst, release = mult, i
            if release < 0:
                return w
            at_zero.discard(release)
            continue

        alpha, blocking = 1.0, -1
        for k, p in enumerate(step):
            if p < 0:
                ratio = -w[free[k]] / p
                if ratio < alpha:
                    alpha, blocking = ratio, free[k]
        w[free] += alpha * step
        if blocking >= 0:
            w[blocking] = 0.0
            at_zero.add(blocking)
    return w
