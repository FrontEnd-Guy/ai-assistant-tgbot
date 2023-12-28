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
        model: "gpt-3.5-turbo",
      });

      return response.choices && response.choices[0].message.content
        ? response.choices[0].message.content
        : "No response";
    } catch (e) {
      console.error('Error while GPT chat:', e.message);
    }
  }

  async transcription(filepath) {
    try {
      const stream = createReadStream(filepath);
      const response = await this.openai.audio.transcriptions.create({
        file: stream,
        model: 'whisper-1',
      });
      stream.close();
      return response.text
    } catch (e) {
      console.error('Error while transcription:', e.message);
      stream && stream.close();
    }
  }
}

export const openai = new OpenAIWrapper(config.get('OPENAI_KEY'));
