/**
 * basic.ts
 *
 * Basic WebSocket usage example with Godspeed.
 */
import { GodspeedClient } from '@thraggs/godspeed';
import { websocket } from '@thraggs/godspeed-websocket';

const client = new GodspeedClient();
client.use(websocket());

const response = await client.get('wss://echo.websocket.org');
const { socket } = response.parsedBody;

console.log('Connected to WebSocket server');
socket.send('Hello, server!');

socket.addEventListener('message', (event) => {
  console.log('Received:', event.data);
  socket.close();
});

socket.addEventListener('close', () => {
  console.log('Connection closed');
  process.exit(0);
});

socket.addEventListener('error', (error) => {
  console.error('WebSocket error:', error);
  process.exit(1);
});
