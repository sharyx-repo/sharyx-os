export interface ToolParam {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  required?: boolean;
  enum?: any[];
}

export interface SimpleTool {
  name: string;
  description: string;
  parameters: Record<string, ToolParam>;
  handler: (args: any) => Promise<any>;
}
