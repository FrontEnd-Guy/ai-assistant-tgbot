import { openai } from './openai.js'
const MAX_CONTEXT_MESSAGES = 10;
export const INITIAL_SESSION = {
  messages: [],
}
export async function initCommand(ctx) {
  ctx.session = { messages: [], userId: ctx.message.from.id }
  await ctx.reply('Жду вашего голосового или текстового сообщения')
}

export async function processTextToChat(ctx, content) {
  try {
    ctx.session.messages.push({ role: openai.roles.USER, content });
    if (ctx.session.messages.length > MAX_CONTEXT_MESSAGES) {
      ctx.session.messages.shift();
    }
    const response = await openai.chat(ctx.session.messages)
    ctx.session.messages.push({
      role: openai.roles.ASSISTANT,
      content: response,
    })
    await ctx.reply(response)
  } catch (e) {
    console.log('Error while proccesing text to gpt', e.message)
  }
}