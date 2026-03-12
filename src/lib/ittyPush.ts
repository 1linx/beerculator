/**
 * Notify all connected clients that data has changed.
 * Uses the Itty Sockets HTTP push API — no WebSocket connection needed server-side.
 */
export async function pushRefresh(): Promise<void> {
	const channel = process.env.ITTY_CHANNEL_NAME;
	const sendKey = process.env.ITTY_SEND_KEY;
	if (!channel || !sendKey) return;

	await fetch(`https://itty.ws/push/${channel}`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-send-key': sendKey
		},
		body: JSON.stringify({ type: 'refresh' })
	});
}
