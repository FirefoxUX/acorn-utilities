import type { AppMessages } from '@tools/app-messages'
import type { IconPrepMessages } from '@tools/icon-prep/messages'
import type { FilmstripsMessages } from '@tools/filmstrips/messages'

/**
 * Maps a plain function signature to a request/response message. Each tool
 * declares its messages with these two helpers in its own `messages.ts`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FunctionToMessage<T extends (...args: any[]) => any> = {
  data: Parameters<T>
  response: ReturnType<T>
}

/** A fire-and-forget message that expects no response. */
export type NotificationMessage<TData> = {
  data: TData
  response: void
}

/**
 * The full message contract, composed from one interface fragment per tool
 * plus the app-scoped messages. Keys are namespaced (`app:`, `icon:`,
 * `filmstrip:`); a duplicate key across fragments is a compile error, which
 * enforces the prefix discipline. Adding a tool = extend one more fragment.
 */
export interface MessageTypes
  extends AppMessages, IconPrepMessages, FilmstripsMessages {}

// Extract function message types (exclude notification-only messages)
export type FunctionMessageTypes = {
  [K in keyof MessageTypes]: MessageTypes[K] extends FunctionToMessage<infer T>
    ? T
    : never
}

type MessageType = keyof MessageTypes

interface BaseMessage {
  type: MessageType
  id?: string
  data?: unknown
  isResponse?: boolean
}

interface ResponseMessage extends BaseMessage {
  isResponse: true
  requestId: string
}

/**
 * Type-safe RPC bridge between the plugin (Figma sandbox) and the UI (iframe),
 * which can only talk over `postMessage`. A singleton because each context has
 * exactly one channel; the same class runs on both sides and picks its
 * transport from whether `figma` is defined.
 */
export class FigmaMessageHandler {
  private static instance: FigmaMessageHandler | null = null

  private isUI: boolean
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: unknown) => void
      reject: (reason?: unknown) => void
    }
  >()
  private messageListeners = new Map<
    MessageType,
    Array<(data: unknown) => unknown>
  >()
  private messageIdCounter = 0

  private constructor() {
    this.isUI = typeof figma === 'undefined'
    this.setupMessageListener()
  }

  static getInstance(): FigmaMessageHandler {
    if (!FigmaMessageHandler.instance) {
      FigmaMessageHandler.instance = new FigmaMessageHandler()
    }
    return FigmaMessageHandler.instance
  }

  private setupMessageListener() {
    if (this.isUI) {
      window.onmessage = (event) => {
        this.handleMessage(event.data.pluginMessage)
      }
    } else {
      figma.ui.onmessage = (message) => {
        this.handleMessage(message)
      }
    }
  }

  private handleMessage(message: BaseMessage) {
    if (message.isResponse) {
      const responseMsg = message as ResponseMessage
      const pending = this.pendingRequests.get(responseMsg.requestId)
      if (pending) {
        pending.resolve(responseMsg.data)
        this.pendingRequests.delete(responseMsg.requestId)
      }
    } else {
      this.notifyListeners(message.type, message.data, message.id)
    }
  }

  private notifyListeners(
    type: MessageType,
    data: unknown,
    requestId?: string,
  ) {
    const listeners = this.messageListeners.get(type) || []
    listeners.forEach((listener) => {
      let result: unknown
      if (requestId && Array.isArray(data)) {
        result = (listener as (...args: unknown[]) => unknown)(...data)
      } else {
        result = listener(data)
      }

      if (requestId && result !== undefined) {
        if (result instanceof Promise) {
          result
            .then((responseData) => {
              this.sendResponse(requestId, responseData)
            })
            .catch((error) => {
              const errorResponse = this.createErrorResponse(
                type,
                error.message,
              )
              this.sendResponse(requestId, errorResponse)
            })
        } else {
          this.sendResponse(requestId, result)
        }
      }
    })
  }

  private createErrorResponse<T extends MessageType>(
    _type: T,
    errorMessage: string,
  ): MessageTypes[T]['response'] {
    return { error: errorMessage } as MessageTypes[T]['response']
  }

  private sendResponse(requestId: string, data: unknown) {
    const responseMessage: ResponseMessage = {
      type: '' as MessageType,
      isResponse: true,
      requestId,
      data,
    }

    if (this.isUI) {
      parent.postMessage({ pluginMessage: responseMessage }, '*')
    } else {
      figma.ui.postMessage(responseMessage)
    }
  }

  private generateMessageId(): string {
    return `msg_${++this.messageIdCounter}_${Date.now()}`
  }

  /**
   * Send a request and await the other side's return value. Use this (not
   * `notify`) whenever the caller needs the result. Rejects after 2 minutes so
   * a dropped response can't leave the promise pending forever.
   */
  async request<T extends keyof FunctionMessageTypes>(
    type: T,
    ...args: Parameters<FunctionMessageTypes[T]>
  ): Promise<MessageTypes[T]['response']> {
    return new Promise<MessageTypes[T]['response']>((resolve, reject) => {
      const id = this.generateMessageId()

      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      })

      const message: BaseMessage = {
        type: type as MessageType,
        id,
        data: args,
      }

      if (this.isUI) {
        parent.postMessage({ pluginMessage: message }, '*')
      } else {
        figma.ui.postMessage(message)
      }

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error(`Request timeout for message type: ${String(type)}`))
        }
      }, 120000) // 2 minute timeout for long processing
    })
  }

  /**
   * Fire-and-forget message. Use for one-way updates where no response is
   * expected — unlike `request`, it registers no pending entry, so there is
   * nothing to leak or time out.
   */
  notify<T extends MessageType>(type: T, data: MessageTypes[T]['data']): void {
    const message: BaseMessage = {
      type,
      data,
    }

    if (this.isUI) {
      parent.postMessage({ pluginMessage: message }, '*')
    } else {
      figma.ui.postMessage(message)
    }
  }

  /**
   * Register a handler for a message type. Returns an unsubscribe function so a
   * tool can wire handlers in `register()` and tear them down on deactivate
   * without leaking listeners across tool switches.
   */
  on<T extends MessageType>(
    type: T,
    handler: MessageTypes[T] extends NotificationMessage<infer TData>
      ? (data: TData) => void
      : MessageTypes[T] extends FunctionToMessage<infer _TFunc>
        ? MessageTypes[T]['data'] extends readonly unknown[]
          ? (
              ...args: MessageTypes[T]['data']
            ) =>
              | MessageTypes[T]['response']
              | Promise<MessageTypes[T]['response']>
              | void
          : (
              data: MessageTypes[T]['data'],
            ) =>
              | MessageTypes[T]['response']
              | Promise<MessageTypes[T]['response']>
              | void
        : never,
  ): () => void {
    if (!this.messageListeners.has(type)) {
      this.messageListeners.set(type, [])
    }

    const listeners = this.messageListeners.get(type)!
    listeners.push(handler as (data: unknown) => unknown)

    return () => {
      const index = listeners.indexOf(handler as (data: unknown) => unknown)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  /** Drop every handler for a type at once (e.g. tearing down a whole tool). */
  off(type: MessageType): void {
    this.messageListeners.delete(type)
  }

  /** Which side this instance runs on — handy for code shared by both bundles. */
  getContext(): 'ui' | 'plugin' {
    return this.isUI ? 'ui' : 'plugin'
  }
}

export const messenger = FigmaMessageHandler.getInstance()
