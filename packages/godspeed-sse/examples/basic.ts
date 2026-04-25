/**
 * basic.ts
 *
 * Basic Server-Sent Events usage example with Godspeed.
 */
import { GodspeedClient } from '@thraggs/godspeed';
import { sse } from '@thraggs/godspeed-sse';

const client = new GodspeedClient({
  baseURL: 'https://api.example.com',
});

client.use(sse());

const response = await client.get('/events');

console.log('Listening for events...');

for await (const event of response.parsedBody) {
  console.log('Event type:', event.event || 'message');
  console.log('Event ID:', event.id || 'none');
  console.log('Data:', event.data);
  
  if (event.retry) {
    console.log('Retry interval:', event.retry, 'ms');
  }
  
  console.log('---');
}
