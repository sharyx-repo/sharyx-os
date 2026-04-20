import { Client } from '@hubspot/api-client';
import { SimpleTool } from './types';

/**
 * HubSpot CRM Integration Tool
 * Required Environment Variables:
 * - HUBSPOT_ACCESS_TOKEN
 */
export const hubspotTools: SimpleTool[] = [
  {
    name: 'capture_lead',
    description: 'Save a new lead/contact into the HubSpot CRM.',
    parameters: {
      firstName: { type: 'string', description: 'First name of the person', required: true },
      lastName: { type: 'string', description: 'Last name of the person', required: true },
      email: { type: 'string', description: 'Email address', required: true },
      phone: { type: 'string', description: 'Phone number' },
      company: { type: 'string', description: 'Company name' }
    },
    handler: async ({ firstName, lastName, email, phone, company }) => {
      const hubspotClient = new Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });

      try {
        const contactResponse = await hubspotClient.crm.contacts.basicApi.create({
          properties: {
            firstname: firstName,
            lastname: lastName,
            email: email,
            phone: phone || '',
            company: company || ''
          }
        });

        return {
          success: true,
          contactId: contactResponse.id,
          portalId: contactResponse.properties.hs_object_id
        };
      } catch (err: any) {
        throw new Error(`HubSpot Error: ${err.message}`);
      }
    }
  }
];
