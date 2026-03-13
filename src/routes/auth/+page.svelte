<script lang="ts">
	import { goto } from '$app/navigation';
	import { onDestroy } from 'svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	function shuffle<T>(arr: T[]): T[] {
		const a = [...arr];
		for (let i = a.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[a[i], a[j]] = [a[j], a[i]];
		}
		return a;
	}

	const colours = shuffle([
		{ id: 'red', hex: '#e74c3c' },
		{ id: 'blue', hex: '#3498db' },
		{ id: 'green', hex: '#27ae60' },
		{ id: 'yellow', hex: '#f1c40f' },
		{ id: 'orange', hex: '#e67e22' },
		{ id: 'purple', hex: '#9b59b6' },
		{ id: 'pink', hex: '#e91e63' },
		{ id: 'teal', hex: '#1abc9c' },
		{ id: 'sky', hex: '#87ceeb' },
		{ id: 'lime', hex: '#a8e063' },
		{ id: 'crimson', hex: '#c0392b' },
		{ id: 'black', hex: '#000000' }
	]);

	const animals = shuffle([
		{ id: 'cat', emoji: '🐱' },
		{ id: 'dog', emoji: '🐶' },
		{ id: 'bird', emoji: '🐦' },
		{ id: 'fish', emoji: '🐟' },
		{ id: 'rabbit', emoji: '🐰' },
		{ id: 'fox', emoji: '🦊' },
		{ id: 'bear', emoji: '🐻' },
		{ id: 'owl', emoji: '🦉' },
		{ id: 'horse', emoji: '🐴' },
		{ id: 'frog', emoji: '🐸' },
		{ id: 'mouse', emoji: '🐭' },
		{ id: 'cow', emoji: '🐮' }
	]);

	let phase = 1;
	let locked = data.locked;
	let secondsRemaining = data.secondsRemaining;
	let countdownTimer: ReturnType<typeof setInterval> | null = null;

	if (locked) startCountdown();

	function startCountdown() {
		if (countdownTimer) clearInterval(countdownTimer);
		countdownTimer = setInterval(() => {
			secondsRemaining -= 1;
			if (secondsRemaining <= 0) {
				locked = false;
				clearInterval(countdownTimer!);
				countdownTimer = null;
			}
		}, 1000);
	}

	onDestroy(() => {
		if (countdownTimer) clearInterval(countdownTimer);
	});

	function formatTime(s: number): string {
		const m = Math.floor(s / 60);
		const sec = s % 60;
		return `${m}:${sec.toString().padStart(2, '0')}`;
	}

	async function pickColour(value: string) {
		if (locked) return;
		const res = await fetch('/api/auth', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ phase: 1, value })
		});
		const result = await res.json();
		if (result.locked) {
			locked = true;
			secondsRemaining = result.secondsRemaining;
			startCountdown();
		} else if (result.next) {
			phase = 2;
		}
	}

	async function pickAnimal(value: string) {
		if (locked) return;
		const res = await fetch('/api/auth', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ phase: 2, value })
		});
		const result = await res.json();
		if (result.locked) {
			locked = true;
			secondsRemaining = result.secondsRemaining;
			startCountdown();
		} else if (result.done) {
			goto('/');
		}
	}
</script>

<svelte:head>
	<title>Beerculator2000</title>
</svelte:head>

<div class="page">
	{#if locked}
		<div class="lockout">
			<span class="lock-icon">🔒</span>
			<p class="lock-time">{formatTime(secondsRemaining)}</p>
		</div>
	{:else}
		<div class="grid">
			{#if phase === 1}
				{#each colours as colour}
					<button
						class="colour-tile"
						style="background: {colour.hex};"
						on:click={() => pickColour(colour.id)}
						aria-label={colour.id}
					></button>
				{/each}
			{:else}
				{#each animals as animal}
					<button
						class="animal-tile"
						on:click={() => pickAnimal(animal.id)}
						aria-label={animal.id}
					>
						{animal.emoji}
					</button>
				{/each}
			{/if}
		</div>
	{/if}
</div>

<style>
	:global(*) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}

	:global(body) {
		font-family: 'Segoe UI', system-ui, sans-serif;
		background: #1a0a00;
		color: #f5e6c8;
		min-height: 100vh;
	}

	.page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.75rem;
	}

	.colour-tile {
		width: 80px;
		height: 80px;
		border-radius: 10px;
		border: 2px solid #3a1800;
		cursor: pointer;
		transition: transform 0.1s, border-color 0.15s, box-shadow 0.15s;
	}

	.colour-tile:hover {
		transform: scale(1.08);
		border-color: #f5a623;
		box-shadow: 0 0 12px #f5a62344;
	}

	.animal-tile {
		width: 80px;
		height: 80px;
		border-radius: 10px;
		border: 2px solid #3a1800;
		background: #2d1400;
		font-size: 2.4rem;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: transform 0.1s, border-color 0.15s, box-shadow 0.15s;
		line-height: 1;
	}

	.animal-tile:hover {
		transform: scale(1.08);
		border-color: #f5a623;
		box-shadow: 0 0 12px #f5a62344;
	}

	.lockout {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.lock-icon {
		font-size: 3rem;
	}

	.lock-time {
		font-size: 2.5rem;
		font-variant-numeric: tabular-nums;
		color: #f5a623;
		letter-spacing: 0.05em;
	}
</style>
