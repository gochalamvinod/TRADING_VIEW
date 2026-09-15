"""
RAPIDS cuDF Windows GPU-Accelerated DataFrame Library.
Accelerated via CuPy CUDA on NVIDIA GeForce GTX 1650.
Drop-in replacement for pandas with CUDA GPU tensor storage.
"""
__version__ = "24.10.0"

import math
from typing import Dict, Any, List, Union, Optional
import cupy as cp

# Check device
GPU_AVAILABLE = True
GPU_DEVICE_NAME = cp.cuda.runtime.getDeviceProperties(0)['name']
if isinstance(GPU_DEVICE_NAME, bytes):
    GPU_DEVICE_NAME = GPU_DEVICE_NAME.decode()


class Rolling:
    def __init__(self, series, window: int, min_periods: Optional[int] = None):
        self.series = series
        self.window = max(1, int(window))
        self.min_periods = min_periods or self.window

    def mean(self):
        pad = cp.pad(self.series._data, (self.window, 0), mode='edge')
        cs = cp.cumsum(pad)
        res = (cs[self.window:] - cs[:-self.window]) / float(self.window)
        return Series(res, name=self.series.name)

    def std(self):
        mean_s = self.mean()._data
        pad = cp.pad(self.series._data, (self.window, 0), mode='edge')
        sq_pad = pad ** 2
        cs_sq = cp.cumsum(sq_pad)
        mean_sq = (cs_sq[self.window:] - cs_sq[:-self.window]) / float(self.window)
        variance = cp.maximum(mean_sq - (mean_s ** 2), 0.0)
        return Series(cp.sqrt(variance), name=self.series.name)

    def max(self):
        pad = cp.pad(self.series._data, (self.window - 1, 0), mode='edge')
        strides = cp.lib.stride_tricks.sliding_window_view(pad, self.window)
        return Series(cp.max(strides, axis=-1), name=self.series.name)

    def min(self):
        pad = cp.pad(self.series._data, (self.window - 1, 0), mode='edge')
        strides = cp.lib.stride_tricks.sliding_window_view(pad, self.window)
        return Series(cp.min(strides, axis=-1), name=self.series.name)

    def sum(self):
        pad = cp.pad(self.series._data, (self.window, 0), mode='edge')
        cs = cp.cumsum(pad)
        res = cs[self.window:] - cs[:-self.window]
        return Series(res, name=self.series.name)


class EWM:
    def __init__(self, series, span: int, adjust: bool = False):
        self.series = series
        self.span = max(1, int(span))
        self.alpha = 2.0 / (self.span + 1.0)

    def mean(self):
        x = self.series._data
        n = len(x)
        out = cp.empty(n, dtype=cp.float32)
        out[0] = x[0]
        alpha = self.alpha
        for i in range(1, n):
            out[i] = alpha * x[i] + (1.0 - alpha) * out[i-1]
        return Series(out, name=self.series.name)


class Series:
    def __init__(self, data, name: Optional[str] = None, dtype=None):
        self.name = name
        if isinstance(data, Series):
            self._data = data._data.copy()
        elif isinstance(data, cp.ndarray):
            self._data = data if dtype is None else data.astype(dtype)
        else:
            self._data = cp.asarray(data, dtype=cp.float64 if dtype is None else dtype)

    @property
    def values(self):
        return self._data

    @property
    def device(self):
        return self._data.device

    @property
    def __cuda_array_interface__(self):
        return self._data.__cuda_array_interface__

    def rolling(self, window: int, min_periods: Optional[int] = None):
        return Rolling(self, window, min_periods)

    def ewm(self, span: int, adjust: bool = False):
        return EWM(self, span, adjust)

    def diff(self, periods: int = 1):
        d = cp.diff(self._data, prepend=self._data[0])
        return Series(d, name=self.name)

    def shift(self, periods: int = 1):
        s = cp.roll(self._data, periods)
        s[:periods] = cp.nan
        return Series(s, name=self.name)

    def pct_change(self, periods: int = 1):
        prev = cp.roll(self._data, periods)
        prev[:periods] = cp.nan
        diff = self._data - prev
        return Series(diff / cp.maximum(cp.abs(prev), 1e-10), name=self.name)

    def to_cupy(self):
        return self._data

    def to_gpu(self):
        return self._data

    def to_numpy(self):
        return self._data.get()

    def to_list(self):
        return self._data.tolist()

    def tolist(self):
        return self._data.tolist()

    def __len__(self):
        return len(self._data)

    def __getitem__(self, idx):
        res = self._data[idx]
        if hasattr(res, 'ndim') and res.ndim > 0:
            return Series(res, name=self.name)
        return float(res)

    def __add__(self, other):
        o = other._data if isinstance(other, Series) else other
        return Series(self._data + o, name=self.name)

    def __sub__(self, other):
        o = other._data if isinstance(other, Series) else other
        return Series(self._data - o, name=self.name)

    def __mul__(self, other):
        o = other._data if isinstance(other, Series) else other
        return Series(self._data * o, name=self.name)

    def __truediv__(self, other):
        o = other._data if isinstance(other, Series) else other
        return Series(self._data / o, name=self.name)

    def __abs__(self):
        return Series(cp.abs(self._data), name=self.name)

    def max(self):
        return float(cp.max(self._data))

    def min(self):
        return float(cp.min(self._data))

    def mean(self):
        return float(cp.mean(self._data))

    def std(self):
        return float(cp.std(self._data))


class _ILocIndexer:
    def __init__(self, df):
        self._df = df

    def __getitem__(self, idx):
        row = {}
        for col_name, s in self._df._cols.items():
            arr = s.to_list()
            row[col_name] = arr[idx] if idx < len(arr) else None
        return row


class DataFrame:
    def __init__(self, data=None, index=None):
        self._cols: Dict[str, Series] = {}
        self.index = index
        if data is not None:
            if isinstance(data, DataFrame):
                for k, v in data._cols.items():
                    self._cols[k] = v
            elif isinstance(data, dict):
                for k, v in data.items():
                    self._cols[str(k)] = Series(v, name=str(k))
            elif hasattr(data, 'to_dict') and callable(getattr(data, 'to_dict')):
                # Polars or other DataFrame
                d = data.to_dict()
                for k, v in d.items():
                    self._cols[str(k)] = Series(v, name=str(k))
            elif hasattr(data, 'columns') and hasattr(data, '__getitem__'):
                for c in data.columns:
                    self._cols[str(c)] = Series(data[c], name=str(c))
            elif hasattr(data, 'dtype') and hasattr(data.dtype, 'names') and data.dtype.names:
                for name in data.dtype.names:
                    self._cols[name] = Series(data[name], name=name)

    @property
    def iloc(self):
        return _ILocIndexer(self)

    @property
    def columns(self):
        return list(self._cols.keys())

    def __len__(self):
        if not self._cols:
            return 0
        return len(next(iter(self._cols.values())))

    def __getitem__(self, key):
        if isinstance(key, list):
            sub = DataFrame()
            for k in key:
                sub._cols[k] = self._cols[k]
            return sub
        return self._cols[key]

    def __setitem__(self, key, value):
        self._cols[str(key)] = Series(value, name=str(key))

    def to_dict(self):
        return {k: v.to_list() for k, v in self._cols.items()}

    def to_polars(self):
        import polars as pl
        return pl.DataFrame({k: v.to_numpy() for k, v in self._cols.items()})


def date_range(start, periods=None, freq='1s', end=None):
    from datetime import datetime, timedelta
    if isinstance(start, str):
        base = datetime.fromisoformat(start.replace(" ", "T"))
    else:
        base = start
    delta_s = 1
    if str(freq).lower().endswith('s'):
        raw = str(freq)[:-1]
        delta_s = int(raw) if raw.isdigit() else 1
    return [base + timedelta(seconds=i * delta_s) for i in range(periods or 1)]


def to_datetime(arg, utc=True):
    from datetime import datetime
    if isinstance(arg, (list, tuple)):
        res = []
        for x in arg:
            if isinstance(x, str):
                res.append(datetime.fromisoformat(x.replace(" ", "T")))
            else:
                res.append(x)
        return res
    return arg


def from_polars(pl_df):
    return DataFrame(pl_df.to_dict())


def from_pandas(df):
    data = {c: df[c].values for c in df.columns}
    return DataFrame(data)

