import { Telegraf, session } from 'telegraf'
import { initCommand, processTextToChat, INITIAL_SESSION } from './src/logic.js'
import { message } from 'telegraf/filters'
import config from 'config'
import { ogg } from './src/ogg.js'
import { openai } from './src/openai.js'
import { removeFile } from './src/utils.js'

const allowedUsers = config.get('ALLOWED_USERS');
const mediaGroups = {};

const bot = new Telegraf(config.get('TELEGRAM_BOT'))

bot.use(session())

bot.use((ctx, next) => {
  const userId = ctx.message.from.id;
  if (allowedUsers.includes(userId)) {
    return next();
  } else {
    ctx.reply('Извините, у вас нет доступа к этому боту.');
  }
});

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
    await processTextToChat(ctx, text)

    removeFile(mp3Path) 
  } catch (e) {
    console.error(`Error while processing voice message`, e.message)
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

bot.on(message('photo'), async (ctx) => {
  const mediaGroupId = ctx.message.media_group_id || 'single';
  const photo = ctx.message.photo.pop();
  const link = await ctx.telegram.getFileLink(photo.file_id);

  if (!mediaGroups[mediaGroupId]) {
    mediaGroups[mediaGroupId] = {
      links: [],
      caption: ctx.message.caption,
      timer: null,
    };
  }

  mediaGroups[mediaGroupId].links.push(link);

  // Очищаем предыдущий таймер, если он был установлен
  clearTimeout(mediaGroups[mediaGroupId].timer);

  // Устанавливаем таймер для отправки запроса
  mediaGroups[mediaGroupId].timer = setTimeout(async () => {
    const group = mediaGroups[mediaGroupId];
    const response = await openai.analyzeImages(group.links, group.caption || "Что изображено на этих фото?");
    await ctx.reply(response);
    delete mediaGroups[mediaGroupId];
  }, 1000); // Задержка в 1000 мс (1 секунда)
});

bot.launch();
