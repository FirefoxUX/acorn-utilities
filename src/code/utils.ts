// Observable state via a deep Proxy. Mutating any (possibly nested) property of
// the returned object schedules a single batched `onChange` on the next
// macrotask, so a burst of mutations across awaits collapses into one
// broadcast. Ported from acorn-annotations. Tools mutate their slice of
// AppState directly and the shell broadcasts the whole tree to the UI.

type ProxyableObject = Record<string | symbol, unknown>

export function createObservableState<T extends Record<string, unknown>>(
  initialState: T,
  onChange: (state: T) => void,
): T {
  const PROXY_SYMBOL = Symbol('observableProxy')

  // Type for the proxy symbol property
  type ProxiedObject = ProxyableObject & {
    [PROXY_SYMBOL]?: boolean
  }

  // Batching state
  let isChangeScheduled = false

  // Schedule onChange to run after the current task completes (including awaits)
  function scheduleChange() {
    if (isChangeScheduled) {
      return // Already scheduled
    }

    isChangeScheduled = true

    // Use setTimeout to schedule after the current event loop task completes
    // This ensures batching across awaits and other async operations
    setTimeout(() => {
      isChangeScheduled = false
      onChange(rootState)
    }, 0)
  }

  // Check if an object is a built-in that shouldn't be proxied
  function isBuiltInObject(obj: unknown): boolean {
    if (!obj || typeof obj !== 'object') return false

    const builtInConstructors = [
      Set,
      Map,
      WeakSet,
      WeakMap,
      Date,
      RegExp,
      ArrayBuffer,
      DataView,
      Promise,
      Error,
      Int8Array,
      Uint8Array,
      Uint8ClampedArray,
      Int16Array,
      Uint16Array,
      Int32Array,
      Uint32Array,
      Float32Array,
      Float64Array,
    ]

    return builtInConstructors.some((constructor) => obj instanceof constructor)
  }

  // Deep clone the initial state without JSON.parse/stringify
  function deepClone<K>(obj: K): K {
    if (obj === null || typeof obj !== 'object') {
      return obj
    }

    // Handle built-in objects
    if (obj instanceof Set) {
      return new Set(Array.from(obj).map(deepClone)) as K
    }
    if (obj instanceof Map) {
      return new Map(
        Array.from(obj.entries()).map(([k, v]) => [deepClone(k), deepClone(v)]),
      ) as K
    }
    if (obj instanceof Date) {
      return new Date(obj.getTime()) as K
    }
    if (obj instanceof RegExp) {
      return new RegExp(obj.source, obj.flags) as K
    }
    if (obj instanceof ArrayBuffer) {
      return obj.slice(0) as K
    }

    if (Array.isArray(obj)) {
      return obj.map(deepClone) as K
    }

    const cloned = {} as K
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = deepClone(obj[key])
      }
    }
    return cloned
  }

  // eslint-disable-next-line prefer-const
  let rootState: T

  function createProxy<K extends ProxyableObject>(
    target: K,
    path: string[] = [],
  ): K {
    if (target === null || typeof target !== 'object') {
      return target
    }

    // Don't proxy built-in objects like Set, Map, etc.
    if (isBuiltInObject(target)) {
      return target
    }

    // Return existing proxy
    if ((target as ProxiedObject)[PROXY_SYMBOL]) {
      return target
    }

    return new Proxy(target, {
      set(obj: K, prop: string | symbol, value: unknown): boolean {
        if (prop === PROXY_SYMBOL) {
          ;(obj as ProxyableObject)[prop] = value
          return true
        }

        const key = String(prop)
        const currentPath = [...path, key]
        const oldValue = (obj as ProxyableObject)[key]

        // Wrap new objects in proxies (but not built-ins)
        const newValue =
          value && typeof value === 'object' && !isBuiltInObject(value)
            ? createProxy(value as ProxyableObject, currentPath)
            : value

        ;(obj as ProxyableObject)[key] = newValue

        // Schedule change notification (batched) - skip if setting same value
        if (oldValue !== newValue) {
          scheduleChange()
        }

        return true
      },

      get(obj: K, prop: string | symbol): unknown {
        if (prop === PROXY_SYMBOL) {
          return true
        }

        const value = (obj as ProxyableObject)[prop]

        // Lazily wrap objects in proxies when accessed (but not built-ins)
        if (
          value &&
          typeof value === 'object' &&
          !isBuiltInObject(value) &&
          !(value as ProxiedObject)[PROXY_SYMBOL]
        ) {
          const key = String(prop)
          const proxiedValue = createProxy(value as ProxyableObject, [
            ...path,
            key,
          ])
          ;(obj as ProxyableObject)[key] = proxiedValue
          return proxiedValue
        }

        return value
      },
    })
  }

  const clonedState = deepClone(initialState)
  const proxiedState = createProxy(clonedState) as T
  rootState = proxiedState

  // Mark as proxy to prevent double-wrapping
  ;(proxiedState as ProxiedObject)[PROXY_SYMBOL] = true

  return proxiedState
}
