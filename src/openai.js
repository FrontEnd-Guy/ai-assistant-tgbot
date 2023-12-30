import { OpenAI as OpenAIAPI } from 'openai';
import config from 'config';
import { createReadStream } from 'fs';

class OpenAIWrapper {
  roles = {
    ASSISTANT: 'assistant',
    USER: 'user',
    SYSTEM: 'system',
  };

  constructor(apiKey) {
    this.openai = new OpenAIAPI({ apiKey });
  }

  async chat(messages) {
    try {
      const response = await this.openai.chat.completions.create({
        messages: messages,
        model: "gpt-3.5-turbo-1106",
      });

      return response.choices && response.choices[0].message.content
        ? response.choices[0].message.content
        : "No response";
    } catch (e) {
      console.error('Error while GPT chat:', e.message);
    }
  }

  async transcription(filepath) {
    let stream;
    try {
      stream = createReadStream(filepath);
      const response = await this.openai.audio.transcriptions.create({
        file: stream,
        model: 'whisper-1',
      });
      stream.close();
      return response.text
    } catch (e) {
      console.error('Error while transcription:', e.message);
      if (stream) {
        stream.close();
      }
    }
  }

  async analyzeImages(imageLinks, caption) {
    try {
      const content = imageLinks.map(link => ({ type: "image_url", image_url: { "url": link }}));
      content.unshift({ type: "text", text: caption });
  
      const response = await this.openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: content,
          },
        ],
      });
  
      return response.choices && response.choices[0].message.content
        ? response.choices[0].message.content
        : "No response";
    } catch (e) {
      console.error('Error while analyzing images:', e.message);
    }
  }

}

export const openai = new OpenAIWrapper(config.get('OPENAI_KEY'));
