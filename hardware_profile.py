"""
hardware_profile.py — Adaptive Hardware Profiler & Auto-Tuning Engine
Dynamically probes host CPU, RAM, and GPU at runtime across any device (Windows, Linux, macOS)
and auto-tunes execution thresholds, thread pools, and memory buffer allocations.
"""

import os
import sys
import platform
import subprocess
import ctypes
from dataclasses import dataclass, asdict
from typing import Optional, Dict, Any


@dataclass
class DeviceProfile:
    # CPU
    cpu_model: str
    cpu_arch: str
    cpu_cores: int
    optimal_threads: int

    # RAM (GB)
    ram_total_gb: float
    ram_avail_gb: float

    # GPU
    gpu_available: bool
    gpu_name: str
    gpu_vram_total_gb: float
    gpu_vram_free_gb: float
    gpu_compute_capability: str

    # Auto-Tuned Thresholds
    optimal_tick_buffer_size: int
    optimal_resample_chunk_size: int
    prefer_gpu_threshold: int
    use_cpp_simd: bool
    platform_name: str


def _get_ram_info() -> tuple[float, float]:
    """Fetch total and available physical RAM in GB cross-platform."""
    total_gb = 8.0
    avail_gb = 4.0

    if platform.system() == "Windows":
        try:
            class MEMORYSTATUSEX(ctypes.Structure):
                _fields_ = [
                    ('dwLength', ctypes.c_uint32),
                    ('dwMemoryLoad', ctypes.c_uint32),
                    ('ullTotalPhys', ctypes.c_uint64),
                    ('ullAvailPhys', ctypes.c_uint64),
                    ('ullTotalPageFile', ctypes.c_uint64),
                    ('ullAvailPageFile', ctypes.c_uint64),
                    ('ullTotalVirtual', ctypes.c_uint64),
                    ('ullAvailVirtual', ctypes.c_uint64),
                    ('ullAvailExtendedVirtual', ctypes.c_uint64),
                ]
            stat = MEMORYSTATUSEX()
            stat.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat))
            total_gb = stat.ullTotalPhys / (1024 ** 3)
            avail_gb = stat.ullAvailPhys / (1024 ** 3)
            return round(total_gb, 2), round(avail_gb, 2)
        except Exception:
            pass
    elif platform.system() == "Linux":
        try:
            with open("/proc/meminfo", "r") as f:
                lines = f.readlines()
            mem = {}
            for line in lines:
                parts = line.split(":")
                if len(parts) == 2:
                    mem[parts[0].strip()] = int(parts[1].split()[0])
            total_gb = mem.get("MemTotal", 8 * 1024 * 1024) / (1024 * 1024)
            avail_gb = mem.get("MemAvailable", mem.get("MemFree", 4 * 1024 * 1024)) / (1024 * 1024)
            return round(total_gb, 2), round(avail_gb, 2)
        except Exception:
            pass

    return round(total_gb, 2), round(avail_gb, 2)


def _get_cpu_info() -> tuple[str, str, int, int]:
    """Fetch CPU model, architecture, core counts."""
    cores = os.cpu_count() or 4
    arch = platform.machine()
    model = platform.processor() or "Generic x86_64"

    # Try Windows WMIC or PowerShell for clean CPU model name
    if platform.system() == "Windows":
        try:
            cmd = 'powershell -NoProfile -Command "(Get-CimInstance Win32_Processor).Name"'
            out = subprocess.check_output(cmd, shell=True, text=True, timeout=2).strip()
            if out:
                model = out.split("\n")[0].strip()
        except Exception:
            pass

    optimal_threads = max(1, min(cores, 64))
    return model, arch, cores, optimal_threads


def _get_gpu_info() -> tuple[bool, str, float, float, str]:
    """Probe GPU device via CuPy, PyCUDA, or nvidia-smi."""
    try:
        import cupy as cp
        props = cp.cuda.runtime.getDeviceProperties(0)
        name = props['name'].decode() if isinstance(props['name'], bytes) else props['name']
        total_vram = props['totalGlobalMem'] / (1024 ** 3)
        free_mem, _ = cp.cuda.runtime.memGetInfo()
        free_vram = free_mem / (1024 ** 3)
        major = props.get('major', 7)
        minor = props.get('minor', 5)
        cc = f"{major}.{minor}"
        return True, name, round(total_vram, 2), round(free_vram, 2), cc
    except Exception:
        pass

    # Fallback to nvidia-smi query if cupy not initialized
    try:
        cmd = "nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader,nounits"
        out = subprocess.check_output(cmd, shell=True, text=True, timeout=2).strip()
        if out:
            parts = [p.strip() for p in out.split(",")]
            name = parts[0]
            total_vram = float(parts[1]) / 1024.0
            free_vram = float(parts[2]) / 1024.0
            return True, name, round(total_vram, 2), round(free_vram, 2), "CUDA"
    except Exception:
        pass

    return False, "No Discrete GPU Detected (CPU Fallback Active)", 0.0, 0.0, "N/A"


def auto_compile_native_engine() -> bool:
    """
    Auto-detects available C++ compiler on ANY machine and builds fast_engine.dll / .so
    without user intervention.
    """
    root_dir = os.path.dirname(os.path.abspath(__file__))
    src_file = os.path.join(root_dir, "fast_engine.cpp")
    ext = ".dll" if platform.system() == "Windows" else ".so"
    out_file = os.path.join(root_dir, f"fast_engine{ext}")

    if not os.path.exists(src_file):
        return False

    if os.path.exists(out_file):
        return True

    print(f"[ADAPTIVE PROFILER] Compiling native C++ engine on {platform.system()}...")

    # Compilers to test in order of preference
    compiler_cmds = [
        ["python", "-m", "ziglang", "c++", "-shared", "-O3", "-mavx2", "-w", src_file, "-o", out_file],
        ["clang++", "-shared", "-O3", "-mavx2", "-w", src_file, "-o", out_file],
        ["g++", "-shared", "-O3", "-mavx2", "-fPIC", "-w", src_file, "-o", out_file],
    ]

    for cmd in compiler_cmds:
        try:
            res = subprocess.run(cmd, cwd=root_dir, capture_output=True, timeout=30)
            if res.returncode == 0 and os.path.exists(out_file):
                print(f"[ADAPTIVE PROFILER] Successfully compiled {out_file} using {' '.join(cmd[:4])}!")
                return True
        except Exception:
            continue

    return False


def get_device_profile() -> DeviceProfile:
    """
    Generates a calibrated DeviceProfile tuned to the host machine's exact CPU, RAM, and GPU.
    """
    ram_total, ram_avail = _get_ram_info()
    cpu_model, cpu_arch, cpu_cores, optimal_threads = _get_cpu_info()
    gpu_avail, gpu_name, gpu_total, gpu_free, gpu_cc = _get_gpu_info()

    # Adapt buffer sizes based on available physical memory
    if ram_avail < 1.0:
        optimal_tick_buf = 50_000
        optimal_chunk = 10_000
    elif ram_avail < 3.0:
        optimal_tick_buf = 150_000
        optimal_chunk = 50_000
    elif ram_avail < 8.0:
        optimal_tick_buf = 300_000
        optimal_chunk = 100_000
    else:
        optimal_tick_buf = 1_000_000
        optimal_chunk = 250_000

    # Auto-compile native engine if missing
    native_built = auto_compile_native_engine()

    # Prefer GPU when available and dataset >= 5,000 items
    prefer_gpu_threshold = 5_000 if (gpu_avail and gpu_free > 0.1) else 1_000_000_000

    return DeviceProfile(
        cpu_model=cpu_model,
        cpu_arch=cpu_arch,
        cpu_cores=cpu_cores,
        optimal_threads=optimal_threads,
        ram_total_gb=ram_total,
        ram_avail_gb=ram_avail,
        gpu_available=gpu_avail,
        gpu_name=gpu_name,
        gpu_vram_total_gb=gpu_total,
        gpu_vram_free_gb=gpu_free,
        gpu_compute_capability=gpu_cc,
        optimal_tick_buffer_size=optimal_tick_buf,
        optimal_resample_chunk_size=optimal_chunk,
        prefer_gpu_threshold=prefer_gpu_threshold,
        use_cpp_simd=native_built,
        platform_name=f"{platform.system()} {platform.release()}"
    )


# Cached singleton profile
_cached_profile: Optional[DeviceProfile] = None

def current_profile() -> DeviceProfile:
    global _cached_profile
    if _cached_profile is None:
        _cached_profile = get_device_profile()
    return _cached_profile


def print_cli_summary():
    prof = current_profile()
    print("=" * 70)
    print(">>> HARDWARE ADAPTIVE SYSTEM PROFILE (AUTONOMOUS DEVICE TUNING)")
    print("=" * 70)
    print(f"  OS / Platform:          {prof.platform_name} ({prof.cpu_arch})")
    print(f"  CPU Model:              {prof.cpu_model}")
    print(f"  CPU Cores / Threads:    {prof.cpu_cores} cores -> {prof.optimal_threads} worker threads")
    print(f"  System RAM:             {prof.ram_total_gb:.2f} GB Total | {prof.ram_avail_gb:.2f} GB Available")
    print(f"  GPU Hardware:           {prof.gpu_name}")
    print(f"  GPU Acceleration:       {'ACTIVE' if prof.gpu_available else 'DISABLED (CPU Fallback)'}")
    if prof.gpu_available:
        print(f"  GPU VRAM:               {prof.gpu_vram_total_gb:.2f} GB Total | {prof.gpu_vram_free_gb:.2f} GB Free (CC {prof.gpu_compute_capability})")
    print("-" * 70)
    print("[*] CALIBRATED RUNTIME PARAMETERS:")
    print(f"  Native C++ Engine:      {'ENABLED (AVX2 SIMD Compiled)' if prof.use_cpp_simd else 'DISABLED (Polars/CuPy Mode)'}")
    print(f"  Tick Buffer Size:       {prof.optimal_tick_buffer_size:,} ticks (calibrated to RAM)")
    print(f"  Resampling Chunk Size:  {prof.optimal_resample_chunk_size:,} ticks")
    print(f"  GPU Dispatch Cutoff:    >= {prof.prefer_gpu_threshold:,} items (CUDA preferred)")
    print("=" * 70)


if __name__ == "__main__":
    print_cli_summary()
