export interface ToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export const toolDefinitions: ToolDefinition[] = [
  {
    name: 'set_mission',
    description:
      'Set the active mission to ICESat-2 or GEDI. This changes which APIs and parameters are available. Setting the mission resets the selected API to the mission default.',
    inputSchema: {
      type: 'object',
      properties: {
        mission: {
          type: 'string',
          enum: ['ICESat-2', 'GEDI'],
          description: 'The mission to set. Must be exactly "ICESat-2" or "GEDI".'
        }
      },
      required: ['mission']
    }
  },
  {
    name: 'get_current_params',
    description:
      'Get the current request parameter state including mission, selected API, server URL, and key configuration values.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'reset_params',
    description:
      'Reset all request parameters to their default values. This is a destructive operation that requires user confirmation in the browser.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
]
