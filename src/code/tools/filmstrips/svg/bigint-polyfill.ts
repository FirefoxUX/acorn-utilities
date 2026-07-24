// Figma's plugin sandbox does not expose the global BigInt constructor, though
// it supports bigint literals and arithmetic. @countertype/clipper2-ts calls
// BigInt() for exact 64-bit products during offsetting, so this installs a
// constructor built from bigint literals when the global is missing. The
// literals live inside the function body, so they are only evaluated if the
// constructor is actually called.

export function installBigIntPolyfill(): void {
  const g = globalThis as { BigInt?: unknown }
  if (typeof g.BigInt === 'function') return

  g.BigInt = function bigIntFromNumber(value: unknown): bigint {
    let n = Math.trunc(Number(value))
    if (!Number.isFinite(n) || n === 0) return 0n
    const negative = n < 0
    if (negative) n = -n
    const digits = [0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n]
    let result = 0n
    let place = 1n
    while (n > 0) {
      result += digits[n % 10] * place
      place *= 10n
      n = Math.floor(n / 10)
    }
    return negative ? -result : result
  }
}
