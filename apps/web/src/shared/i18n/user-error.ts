import { DataClientError } from '@ake/data-client'

export type UserErrorMessageKey =
  | 'errors.networkUnavailable'
  | 'errors.serviceUnavailable'
  | 'errors.accessDenied'
  | 'errors.resourceMissing'
  | 'errors.invalidData'
  | 'errors.notReady'
  | 'errors.requestCancelled'
  | 'errors.requestFailed'
  | 'errors.unexpected'

export function userErrorMessageKey(error: unknown): UserErrorMessageKey {
  if (!(error instanceof DataClientError)) return 'errors.unexpected'

  switch (error.code) {
    case 'NETWORK':
      return 'errors.networkUnavailable'
    case 'NOT_FOUND':
      return 'errors.resourceMissing'
    case 'PARSE':
      return 'errors.invalidData'
    case 'NOT_READY':
      return 'errors.notReady'
    case 'ABORTED':
      return 'errors.requestCancelled'
    case 'HTTP':
      if (error.status === 401 || error.status === 403) return 'errors.accessDenied'
      if (error.status === 429 || (error.status !== undefined && error.status >= 500)) {
        return 'errors.serviceUnavailable'
      }
      return 'errors.requestFailed'
  }

  return 'errors.unexpected'
}
