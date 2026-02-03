import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { getTenantAccessToken } from '@/utils/lark';

export async function getLarkClient() {
  const tenantAccessToken = await getTenantAccessToken();
  if (!tenantAccessToken) {
    throw new Error('Failed to get tenant access token');
  }
  return new MultiServerMCPClient({
    lark: {
      transport: 'http',
      url: 'https://mcp.feishu.cn/mcp',
      headers: {
        'Content-Type': 'application/json',
        'X-Lark-MCP-TAT': tenantAccessToken,
        'X-Lark-MCP-Allowed-Tools': 'create-doc,search-doc,fetch-doc,update-doc,list-docs',
      },
    },
  });
}
