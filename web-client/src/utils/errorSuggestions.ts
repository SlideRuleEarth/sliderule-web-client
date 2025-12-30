export type ErrorCode =
  | 'SLIDERULE'
  | 'RATE_LIMITED'
  | 'HTTP_ERROR'
  | 'CORS'
  | 'NETWORK'
  | 'OFFLINE'
  | 'WEBWORKER'
  | 'NO_DATA'
  | 'TIMEOUT'
  | 'SERVER_UNREACHABLE'

export interface ErrorSuggestion {
  title: string
  suggestions: string[]
}

export const ERROR_SUGGESTIONS: Record<ErrorCode, ErrorSuggestion> = {
  SLIDERULE: {
    title: 'SlideRule Server Error',
    suggestions: [
      'Check server logs for details',
      'Verify your request parameters',
      'Contact support if issue persists'
    ]
  },
  RATE_LIMITED: {
    title: 'Rate Limited',
    suggestions: [
      'Wait for the retry period to expire',
      'Consider using a private cluster for higher limits',
      'Contact support@mail.slideruleearth.io for assistance'
    ]
  },
  HTTP_ERROR: {
    title: 'Server Error',
    suggestions: [
      'Check if the SlideRule server is running',
      'Verify your authentication credentials',
      'Check the server status page'
    ]
  },
  CORS: {
    title: 'Connection Error',
    suggestions: [
      'Check if the server is accessible from this domain',
      'Try refreshing the page',
      'Contact the administrator if issue persists'
    ]
  },
  NETWORK: {
    title: 'Network Error',
    suggestions: [
      'The server may have encountered an internal error',
      'Try a smaller region or simpler request',
      'Try again in a few moments'
    ]
  },
  OFFLINE: {
    title: 'Offline',
    suggestions: [
      'Restore your internet connection',
      'Check your network settings',
      'Try again when online'
    ]
  },
  WEBWORKER: {
    title: 'Internal Error',
    suggestions: [
      'Refresh the page and try again',
      'Clear browser cache if issue persists',
      'Contact support if problem continues'
    ]
  },
  NO_DATA: {
    title: 'No Data Returned',
    suggestions: [
      'Try a different region or time range',
      'Check if the server is responding',
      'Verify the request parameters are valid'
    ]
  },
  TIMEOUT: {
    title: 'Request Timeout',
    suggestions: [
      'The server may be overloaded - try again later',
      'Try a smaller region or fewer parameters',
      'Check if the server is responding'
    ]
  },
  SERVER_UNREACHABLE: {
    title: 'Server Unreachable',
    suggestions: [
      'The server appears to be down or unreachable',
      'Check the server status page',
      'Try again in a few minutes'
    ]
  }
}

export function getErrorSuggestions(code: string): ErrorSuggestion {
  return (
    ERROR_SUGGESTIONS[code as ErrorCode] || {
      title: 'Error',
      suggestions: ['Try again', 'Refresh the page', 'Contact support if issue persists']
    }
  )
}

export function formatNetworkErrorMessage(
  func: string | undefined,
  code: string,
  message: string
): string {
  const suggestions = getErrorSuggestions(code)

  let formattedMsg = ''

  if (func) {
    formattedMsg += `Operation: ${func}\n\n`
  }

  formattedMsg += `${message}\n\n`

  formattedMsg += 'Suggestions:\n'
  suggestions.suggestions.forEach((suggestion) => {
    formattedMsg += `  - ${suggestion}\n`
  })

  return formattedMsg.trim()
}

export function formatNetworkErrorTitle(code: string): string {
  const suggestions = getErrorSuggestions(code)
  return `${suggestions.title} [${code}]`
}
