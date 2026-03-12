const ITTY_CHANNEL_NAME = process.env.ITTY_CHANNEL_NAME!;
const ITTY_SEND_KEY = process.env.ITTY_SEND_KEY!;

/**
 * Notify all connected clients that data has changed.
 * Uses the Itty Sockets HTTP push API — no WebSocket connection needed server-side.
 */
export async function pushRefresh(): Promise<void> {
	await fetch(`https://itty.ws/push/${ITTY_CHANNEL_NAME}`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-send-key': ITTY_SEND_KEY
		},
		body: JSON.stringify({ type: 'refresh' })
	});
}
