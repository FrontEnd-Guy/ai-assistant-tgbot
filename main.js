import { Telegraf, session } from 'telegraf'
import { message } from 'telegraf/filters'
import axios from 'axios'

import config from 'config'

import { initCommand, processTextToChat, INITIAL_SESSION, MAX_CONTEXT_MESSAGES } from './src/logic.js'
import { ogg } from './src/ogg.js'
import { parsePdf, parseDocx, parseExcel } from './src/fileParser.js';
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
  try {
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
      ctx.session ??= INITIAL_SESSION;
      const group = mediaGroups[mediaGroupId];
      const caption = group.caption || "Что изображено на фото?"

      ctx.session.messages.push({
        role: openai.roles.USER,
        content: caption
      });
      if (ctx.session.messages.length > MAX_CONTEXT_MESSAGES) {
        ctx.session.messages.shift();
      }

      const response = await openai.analyzeImages(group.links, caption);
      
      ctx.session.messages.push({
        role: openai.roles.ASSISTANT,
        content: response,
      })
      await ctx.reply(response)

      delete mediaGroups[mediaGroupId];
    }, 1000); // Задержка в 1000 мс (1 секунда)
  } catch (e) {
    console.log(`Error while processing photo message`, e.message);
    ctx.reply("Произошла ошибка при обработке фотографии.");
  }
});

bot.on(message('document'), async (ctx) => {
  try {
    const fileId = ctx.message.document.file_id;
    const link = await ctx.telegram.getFileLink(fileId);
    const response = await axios.get(link.href, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary');

    let parsedText;

    switch (ctx.message.document.mime_type) {
      case 'application/pdf':
        parsedText = await parsePdf(buffer);
        break;
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        parsedText = await parseDocx(buffer);
        break;
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        parsedText = await parseExcel(buffer);
        break;
      default:
        ctx.reply("Извините, я могу обрабатывать только PDF, DOCX и Excel файлы.");
        return;
    }

    ctx.session ??= INITIAL_SESSION;

    await processTextToChat(ctx, `${ctx.message.caption ? ctx.message.caption + '\n\n' : 'Какие выводы можно сделать из следующей информации?\n\n'}${parsedText}`);

  } catch (error) {
    console.error('Ошибка при обработке файла:', error);
    ctx.reply("Произошла ошибка при обработке файла.");
  }
});

bot.launch();
