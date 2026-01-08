import { START, END, StateGraph, MemorySaver, Command, interrupt } from '@langchain/langgraph';
import { registry } from '@langchain/langgraph/zod';
import { openai_llm } from '@/model/openai';
import z from 'zod';

const EmailClassificationSchema = z.object({
  intent: z.enum(['question', 'bug', 'billing', 'feature', 'complex']),
  urgency: z.enum(['low', 'medium', 'high', 'critical']),
  topic: z.string(),
  summary: z.string(),
});

const EmailStateDefinition = z.object({
  emailContent: z.string(),
  senderEmail: z.string(),
  emailId: z.string(),
  classification: EmailClassificationSchema.optional(),
  ticketId: z.string().optional(),
  searchResult: z.array(z.string()).optional(),
  customeHistory: z.record(z.string(), z.any()).optional(),
  draftResponse: z.string().optional(),
});

type State = z.infer<typeof EmailStateDefinition>;

const memory = new MemorySaver();

function readEmail(state: State) {
  console.log('Process email from ', state.senderEmail);
  return {};
}

async function classifyEmail(state: State) {
  console.log('Classifing email intent and urgency: ');
  const outputStructure = openai_llm.withStructuredOutput(EmailClassificationSchema);
  const prompt = `
Analyze the customer email and classify it:
Email: ${state.emailContent}
From: ${state.senderEmail}

Provider classification, include intent, urgency, topic and summary.
  `;
  try {
    const classification = await outputStructure.invoke(prompt);
    console.log('Classification result: ', classification);
    return { classification };
  } catch (e) {
    console.error('Error during classification: ', e);
    return {
      classification: {
        intent: 'question',
        urgency: 'medium',
        topic: 'unknown',
        summary: 'Unable to classify email due to error.',
      }
    }
  }
}

function bugTracking(state: State) {
  console.log('Creating bug ticket ticket...');
  const ticketId = `BUG_${Date.now()}`;
  return { ticketId };
}

function searchDocs(state: State) {
  console.log('Searching documents...');
  const classification = state.classification ?? {
    intent: 'question',
    topic: 'general',
  }

  const searchResult = [
    `Documentation for ${classification.intent}: Base infomation about ${classification.topic}`,
    `FAQ Entry: Common questions related to ${classification.topic}`,
    `Knowledge base article: How to handle ${classification.intent} requests.`,
  ]
  console.log('Found search results: ', searchResult.length, ' items.');
  return {
    searchResult,
  }
}

async function writeResponse(state: State) {
  console.log('Writing response...');
  const classification = state.classification ?? {
    intent: 'question',
    topic: 'general',
    urgency: 'medium',
  }
  const contextSection = [];
  if (state.searchResult) {
    const formattedDocs = state.searchResult.map((doc) => `- ${doc}`).join('\n');
    contextSection.push(`Relevant documents:\n${formattedDocs}`);
  }

  if (state.customeHistory) {
    contextSection.push(
      `Customer tier: ${state.customeHistory.tier ?? 'standard'}\n`
    );
  }

  const draftPrompt = `
Draft a response to this customer email:
${state.emailContent}

Email intent: ${classification.intent}
Urgency level: ${classification.urgency}

${contextSection.join('\n\n')}


Guideelines:
- Be professional and helpful.
- Address their specific concern.
- Be brief
- Use the provider context when relevant.
  `

  let goto, draftResponse;
  try {
    const response = await openai_llm.invoke(draftPrompt);
    const needReview = 
      classification.urgency === 'critical' || 
      classification.urgency === 'high' ||
      classification.intent === 'complex';
  
    goto = needReview ? 'human_review' : 'send_reply';
    draftResponse = response.content;
  } catch (err) {
    draftResponse = 'Error generating response. Please try again.';
    goto = 'human_review';
  }

  return new Command({
    update: {
      draftResponse,
    },
    goto,
  })
}

function humanReview(state: State) {
  const classification = state.classification ?? {
    intent: 'question',
    topic: 'general',
  };
  const humanDecision = interrupt({
    ...state,
    action: 'Please review and approve/edit the response',
  });

  if (humanDecision.approve) {
    const editedResponse = humanDecision.editedResponse ?? state.draftResponse;
    return new Command({
      update: {
        draftResponse: editedResponse,
      },
      goto: 'send_reply',
    });
  }
  return new Command({
    update: {},
    goto: END,
  });
}

function sendReply(state: State) {
  const preview = state.draftResponse?.substring(0, 60) + '...';
  console.log('Sending reply: ', preview);
  return {};
}

export const emailAgent = new StateGraph(EmailStateDefinition)
  // add nodes
  .addNode('read_emal', readEmail)
  .addNode('classify_email', classifyEmail)
  .addNode('bug_tracking', bugTracking)
  .addNode('search_docs', searchDocs)
  .addNode('write_response', writeResponse, { ends: ['human_review', 'send_reply'] })
  .addNode('human_review', humanReview, { ends: ['send_reply', END] })
  .addNode('send_reply', sendReply)
  // add edges
  .addEdge(START, 'read_emal')
  .addEdge('read_emal', 'classify_email')
  .addEdge('classify_email', 'bug_tracking')
  .addEdge('classify_email', 'search_docs')
  .addEdge('bug_tracking', 'write_response')
  .addEdge('search_docs', 'write_response')
  .addEdge('send_reply', END)
  .compile({
    checkpointer: memory,
  })
