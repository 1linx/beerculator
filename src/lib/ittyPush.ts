import { ITTY_CHANNEL_NAME, ITTY_SEND_KEY } from '$env/static/private';

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
