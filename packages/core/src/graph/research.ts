import { createDeepAgent } from "deepagents";
import { tool } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { TavilySearch } from "@langchain/tavily";
import { z } from "zod";
import { Provider } from "@/constant/provider";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
/** packages/core 包根目录（源码在 src/graph，构建后在 dist/graph） */
const PACKAGE_ROOT = join(__dirname, "..");
/** 研究内容写入的目录：packages/core/memory */
const MEMORY_DIR = join(PACKAGE_ROOT, "memory");

/**
 * 从任务描述生成安全的文件名片段（用于 md 文件名）
 */
function slugFromTask(taskDescription: string, maxLen = 15): string {
  const sanitized = taskDescription
    .replace(/[<>:"/\\|?*\s]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, maxLen);
  return sanitized || "research";
}

/**
 * 将研究内容写入 memory 目录下的 md 文件
 * @param taskDescription - 任务描述（用于生成文件名）
 * @param content - 研究报告内容
 * @returns 写入的文件路径
 */
async function writeResearchToMemory(
  taskDescription: string,
  content: string,
): Promise<string> {
  await mkdir(MEMORY_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const slug = slugFromTask(taskDescription);
  const filename = `${timestamp}_${slug}.md`;
  const filePath = join(MEMORY_DIR, filename);

  await writeFile(filePath, content, "utf-8");
  console.log(`[DeepResearch] 研究内容已写入: ${filePath}`);
  return filePath;
}

/**
 * 搜索次数限制
 */
const MAX_SEARCH_COUNT = 5;

/**
 * 当前搜索次数计数器（每个研究任务独立）
 */
let currentSearchCount = 0;

/**
 * 重置搜索计数器
 */
function resetSearchCount() {
  currentSearchCount = 0;
}

/**
 * 创建互联网搜索工具
 * 使用 TavilySearch 进行网络搜索
 * 限制：每次研究任务最多搜索 5 次
 */
const internetSearch = tool(
  async ({
    query,
    maxResults = 5,
    topic = "general",
    includeRawContent = false,
  }: {
    query: string;
    maxResults?: number;
    topic?: "general" | "news" | "finance";
    includeRawContent?: boolean;
  }) => {
    // 检查搜索次数限制
    if (currentSearchCount >= MAX_SEARCH_COUNT) {
      const errorMsg = `已达到最大搜索次数限制（${MAX_SEARCH_COUNT} 次）。请基于已有信息撰写研究报告。`;
      console.log(`\n[搜索] ⚠️ ${errorMsg}`);
      return {
        error: errorMsg,
        message: `已搜索 ${currentSearchCount} 次，已达到限制。请停止搜索，基于已有信息撰写报告。`,
      };
    }
    
    // 增加搜索计数
    currentSearchCount++;
    console.log(`\n[搜索] 查询: "${query}" (第 ${currentSearchCount}/${MAX_SEARCH_COUNT} 次)`);
    console.log(`[搜索] 参数: maxResults=${maxResults}, topic=${topic}, includeRawContent=${includeRawContent}`);
    
    const tavilySearch = new TavilySearch({
      maxResults,
      tavilyApiKey: process.env.TAVILY_API_KEY,
      includeRawContent,
      topic,
    });
    
    const searchResults = await tavilySearch._call({ query });
    
    // 解析并打印搜索到的网页地址
    try {
      let results: any[] = [];
      
      // 处理不同格式的返回结果
      if (Array.isArray(searchResults)) {
        results = searchResults;
      } else if (typeof searchResults === 'string') {
        try {
          const parsed = JSON.parse(searchResults);
          results = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          // 如果不是 JSON，尝试其他解析方式
          results = [];
        }
      } else if (searchResults && typeof searchResults === 'object') {
        // 如果返回的是对象，尝试提取 results 字段
        if ('results' in searchResults && Array.isArray(searchResults.results)) {
          results = searchResults.results;
        } else {
          results = [searchResults];
        }
      }
      
      if (results.length > 0) {
        console.log(`[搜索] 找到 ${results.length} 个结果:`);
        results.forEach((result: any, index: number) => {
          const url = result.url || result.link || result.href || '未知 URL';
          const title = result.title || result.name || '无标题';
          console.log(`  ${index + 1}. ${title}`);
          console.log(`     ${url}`);
        });
      } else {
        console.log(`[搜索] 未找到结果`);
      }
    } catch (error) {
      console.log(`[搜索] 解析结果时出错: ${error}`);
    }
    
    return searchResults;
  },
  {
    name: "internet_search",
    description: `运行网络搜索以获取信息。可以指定返回的最大结果数、主题类别以及是否包含原始内容。

⚠️ 重要限制：每次研究任务最多只能搜索 ${MAX_SEARCH_COUNT} 次。请谨慎使用，确保每次搜索都有明确的目标。`,
    schema: z.object({
      query: z.string().describe("搜索查询语句"),
      maxResults: z
        .number()
        .optional()
        .default(5)
        .describe("返回的最大结果数量"),
      topic: z
        .enum(["general", "news", "finance"])
        .optional()
        .default("general")
        .describe("搜索主题类别"),
      includeRawContent: z
        .boolean()
        .optional()
        .default(false)
        .describe("是否包含原始内容"),
    }),
  },
);

/**
 * 研究 agent 的系统提示
 * 指导 agent 进行深度研究并撰写报告
 */
const researchInstructions = `你是一位资深的研究专家。你的职责是进行深入的研究，然后撰写一份专业的研究报告。

## 重要提示

**你只能使用 \`internet_search\` 工具进行搜索，不要使用任何其他工具（包括计划工具、文件工具等）。**

## 你的能力

你拥有以下工具来帮助你完成研究任务：

### \`internet_search\`

使用此工具运行网络搜索。你可以：
- 指定搜索查询语句
- 设置返回的最大结果数量（默认5个）
- 选择搜索主题类别（general、news、finance）
- 选择是否包含原始内容

**这是你唯一可以使用的工具。**

## 工作流程

1. **理解任务**：仔细分析研究任务的要求和目标
2. **直接执行搜索**：使用 internet_search 工具从多个角度搜索相关信息
   - **重要**：不要使用任何计划工具（如 todo_list），直接开始搜索
   - **搜索次数限制**：每次研究任务最多只能搜索 ${MAX_SEARCH_COUNT} 次，请谨慎使用
   - 为每个研究维度生成不同的搜索查询，确保每次搜索都有明确目标
   - 确保搜索覆盖任务的不同侧面
   - 搜索 ${MAX_SEARCH_COUNT} 次后，必须停止搜索并开始撰写报告
   - 如果达到搜索次数限制，系统会自动阻止进一步搜索，请基于已有信息撰写报告
3. **整理信息**：将搜索到的信息整理和分类
4. **撰写报告**：基于收集到的信息，撰写一份详尽、专业的研究报告
   - 使用 Markdown 格式
   - 标注信息来源
   - 提供关键数据和事实
   - 如果信息不足或存在矛盾，请明确指出
   - **完成报告后立即停止，不要再进行额外的搜索或操作**

## 报告要求

- 结构清晰，使用 Markdown 格式
- 引用信息来源（URL）
- 客观、专业、全面
- 如果搜索结果中存在矛盾或不同观点，请指出并分析
- 总结主要发现和结论
`;


/**
 * 创建深度研究 agent
 * 使用 deepagents 框架，具备计划、文件系统和子 agent 能力
 * 使用字符串形式的 model 标识符以避免版本兼容性问题
 */
export const deepResearcher: ReturnType<typeof createDeepAgent> = createDeepAgent({
  model: new ChatOpenAI({
    model: Provider.DEEPSEEK_R1_250528,
    configuration: {
        baseURL: process.env.API_BASE_URL,
    }
  }) as any,
  tools: [internetSearch] as any,
  systemPrompt: researchInstructions,
});

/**
 * 执行深度研究任务
 * @param taskDescription - 来自 Planner 的任务描述
 * @returns 研究报告
 */
export async function runDeepResearch(taskDescription: string): Promise<string> {
  console.log(`[DeepResearch] 开始执行研究任务: ${taskDescription}`);
  
  // 重置搜索计数器
  resetSearchCount();
  
  try {
    const result = await deepResearcher.invoke(
      {
        messages: [
          {
            role: "user",
            content: `请对以下研究任务进行深入调研并撰写详细报告：\n\n${taskDescription}`,
          },
        ],
      },
      {
        recursionLimit: 100, // 增加递归限制以支持复杂的研究任务
      }
    );

    if (result && typeof result === 'object') {
      // 如果返回的是对象，尝试提取 messages
      if ('messages' in result && Array.isArray(result.messages)) {
        const messages = result.messages;
        const lastMessage = messages[messages.length - 1];
        
        if (lastMessage && typeof lastMessage === 'object' && 'content' in lastMessage) {
          const content = lastMessage.content;
          if (typeof content === 'string') {
            await writeResearchToMemory(taskDescription, content);
            return content;
          }
        }
        
        // 尝试合并所有消息内容
        const allContent = messages
          .map((msg: any) => {
            if (typeof msg === 'object' && 'content' in msg) {
              return typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
            }
            return typeof msg === 'string' ? msg : JSON.stringify(msg);
          })
          .filter(Boolean)
          .join('\n\n');
        
        if (allContent) {
          await writeResearchToMemory(taskDescription, allContent);
          return allContent;
        }
      }
      
      // 如果返回对象有 content 字段
      if ('content' in result && typeof result.content === 'string') {
        await writeResearchToMemory(taskDescription, result.content);
        return result.content;
      }
    }
    
    // 如果返回的是字符串
    if (typeof result === 'string') {
      await writeResearchToMemory(taskDescription, result);
      return result;
    }
    
    // 最后尝试转换为字符串
    const fallback = JSON.stringify(result) || '未能生成研究报告';
    await writeResearchToMemory(taskDescription, fallback);
    return fallback;
  } catch (error) {
    console.error('[DeepResearch] 执行失败:', error);
    throw error;
  }
}
