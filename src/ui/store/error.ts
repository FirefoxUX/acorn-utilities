import { writable } from 'svelte/store'
import {
  messenger,
  type MessageTypes,
  type FunctionMessageTypes,
} from '@src/message-handler'

export interface ErrorState {
  error: string | null
  isVisible: boolean
}

type DialogCallback = (options: {
  heading: string
  children: string
}) => Promise<void>

const initialState: ErrorState = {
  error: null,
  isVisible: false,
}

function createErrorStore() {
  const { subscribe, set, update } = writable<ErrorState>(initialState)

  let dialogCallback: DialogCallback | null = null

  return {
    subscribe,
    /**
     * Register the Dialog opener from App.svelte. Must be called once the
     * Dialog component has mounted and bound its `openDialog` function.
     */
    setDialogCallback: (callback: DialogCallback) => {
      dialogCallback = callback
    },
    showError: async (error: string) => {
      update(() => ({
        error,
        isVisible: true,
      }))

      if (dialogCallback) {
        await dialogCallback({
          heading: 'Error',
          children: error,
        })
        set(initialState)
      }
    },
    clearError: () => {
      set(initialState)
    },
    /**
     * Send a plugin message and surface any error via the Dialog.
     * Detects errors through two paths:
     *   1. The promise rejects (network/runtime error).
     *   2. The response is an object with a truthy `error` field (plugin-side
     *      validation failure returned as a structured response).
     * Returns null on error so callers don't need to handle thrown exceptions.
     */
    safeRequest: async <T extends keyof MessageTypes>(
      type: T,
      ...args: Parameters<FunctionMessageTypes[T]>
    ): Promise<MessageTypes[T]['response'] | null> => {
      try {
        const response = await messenger.request(type, ...args)

        if (
          typeof response === 'object' &&
          response !== null &&
          'error' in response &&
          response.error
        ) {
          console.error(`Error in request ${type}:`, response.error)
          const errorMessage = response.error as string

          update(() => ({
            error: errorMessage,
            isVisible: true,
          }))

          if (dialogCallback) {
            dialogCallback({
              heading: 'Error',
              children: errorMessage,
            }).then(() => {
              set(initialState)
            })
          }

          return null
        }

        return response
      } catch (error) {
        console.error(`Error in request ${type}:`, error)
        const errorMessage =
          error instanceof Error ? error.message : String(error)

        update(() => ({
          error: errorMessage,
          isVisible: true,
        }))

        if (dialogCallback) {
          dialogCallback({
            heading: 'Error',
            children: errorMessage,
          }).then(() => {
            set(initialState)
          })
        }

        return null
      }
    },
  }
}

export const errorStore = createErrorStore()
export const safeRequest = errorStore.safeRequest
