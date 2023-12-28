import { Telegraf, session } from 'telegraf'
import { initCommand, processTextToChat, INITIAL_SESSION } from './src/logic.js'
import { message } from 'telegraf/filters'
import { code } from 'telegraf/format'
import config from 'config'
import { ogg } from './src/ogg.js'
import { openai } from './src/openai.js'
import { removeFile } from './src/utils.js'

const bot = new Telegraf(config.get('TELEGRAM_BOT'))

bot.use(session())

bot.command('new', initCommand)
bot.command('start', initCommand)

bot.on(message('voice'), async (ctx) => {
  ctx.session ??= INITIAL_SESSION
  try {
    const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id)
    const userId = String(ctx.message.from.id)
    const oggPath = await ogg.create(link.href, userId)
    const mp3Path = await ogg.toMp3(oggPath, userId)
    removeFile(oggPath)
    const text = await openai.transcription(mp3Path)
		const messages = [{role: openai.roles.USER, content: text}]
    const response = await openai.chat(messages)
    await ctx.reply(response)
  } catch (e) {
    console.error(`Error while proccessing voice message`, e.message)
  }
})

bot.on(message('text'), async (ctx) => {
  ctx.session ??= INITIAL_SESSION
  try {
    await processTextToChat(ctx, ctx.message.text)
  } catch (e) {
    console.log(`Error while proccessing text message`, e.message)
  }
})

bot.launch();
