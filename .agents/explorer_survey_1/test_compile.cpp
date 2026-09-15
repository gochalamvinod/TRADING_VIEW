#include <immintrin.h>

extern "C" __declspec(dllexport) double test_add(double a, double b) {
    __m256d va = _mm256_set1_pd(a);
    __m256d vb = _mm256_set1_pd(b);
    __m256d vc = _mm256_add_pd(va, vb);
    double res[4];
    _mm256_storeu_pd(res, vc);
    return res[0];
}
