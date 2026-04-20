import axios from 'axios';

/**
 * WhatsApp Notification Channel
 * Uses the WhatsApp Cloud API to send text notifications.
 */
export class WhatsAppChannel {
  private baseUrl: string;

  constructor(private config: { accessToken: string; phoneNumberId: string }) {
    this.baseUrl = `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`;
  }

  async sendMessage(to: string, message: string): Promise<any> {
    try {
      const response = await axios.post(
        this.baseUrl,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: {
            preview_url: false,
            body: message,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (err: any) {
      console.error('[WhatsAppChannel] ❌ Failed to send message:', err.response?.data || err.message);
      throw new Error(`WhatsApp API Error: ${err.response?.data?.error?.message || err.message}`);
    }
  }

  /**
   * Send a template message (better for production to avoid 24h window issues)
   */
  async sendTemplate(to: string, templateName: string, languageCode: string = 'en_US', components: any[] = []): Promise<any> {
    try {
      const response = await axios.post(
        this.baseUrl,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: languageCode },
            components
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (err: any) {
      console.error('[WhatsAppChannel] ❌ Failed to send template:', err.response?.data || err.message);
      throw new Error(`WhatsApp API Error: ${err.response?.data?.error?.message || err.message}`);
    }
  }
}
