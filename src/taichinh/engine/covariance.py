"""Covariance estimation helpers."""

from __future__ import annotations

import numpy as np


def sample_cov(returns: np.ndarray) -> np.ndarray:
    """Sample covariance (ddof=1) of returns[obs, asset]."""
    return np.atleast_2d(np.cov(returns, rowvar=False, ddof=1))


def ledoit_wolf_cov(returns: np.ndarray) -> tuple[np.ndarray, float]:
    """Ledoit-Wolf (2004, well-conditioned estimator) shrinkage toward mu*I, mu = tr(S)/p.

    Computed with the ML (ddof=0) covariance as in the paper, then rescaled by n/(n-1)
    so the result is comparable with `sample_cov`. Returns (cov, shrinkage in [0, 1]).
    """
    x = np.asarray(returns, dtype=float)
    n, p = x.shape
    xc = x - x.mean(axis=0)
    s = xc.T @ xc / n
    mu = np.trace(s) / p
    d2 = np.sum((s - mu * np.eye(p)) ** 2) / p
    if d2 <= 1e-300:
        return s * n / (n - 1), 0.0
    b2_bar = sum(np.sum((np.outer(r, r) - s) ** 2) for r in xc) / (n * n * p)
    shrink = float(np.clip(min(b2_bar, d2) / d2, 0.0, 1.0))
    cov = shrink * mu * np.eye(p) + (1.0 - shrink) * s
    return cov * n / (n - 1), shrink


def corr_from_cov(cov: np.ndarray) -> np.ndarray:
    sd = np.sqrt(np.diag(cov))
    return cov / np.outer(sd, sd)


def cov_from_corr(corr: np.ndarray, sigmas: np.ndarray) -> np.ndarray:
    return corr * np.outer(sigmas, sigmas)


def nearest_psd(m: np.ndarray, jitter: float = 1e-10) -> np.ndarray:
    """Clip negative eigenvalues to zero and add a tiny jitter so the result is PD."""
    sym = (m + m.T) / 2.0
    vals, vecs = np.linalg.eigh(sym)
    out = (vecs * np.clip(vals, 0.0, None)) @ vecs.T
    out = (out + out.T) / 2.0
    return out + jitter * max(1.0, float(np.trace(out)) / len(out)) * np.eye(len(out))
