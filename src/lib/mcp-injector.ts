export const mcpInjector = {
  connect: async () => {},
  disconnect: () => {},
  getGeminiTools: (_enabledTools?: string[]): any[] => [],
  executeTool: async (_name: string, _args: unknown): Promise<{ text: string }> => ({
    text: "",
  }),
};
