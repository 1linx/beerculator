<script lang="ts">
	import type { PageData } from './$types';
	import type { User, BeerDebt } from '$lib/supabase';
	import { invalidateAll } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { connect } from 'itty-sockets';

	export let data: PageData;

	let users: User[] = data.users;
	let debts: BeerDebt[] = data.debts;

	$: users = data.users;
	$: debts = data.debts;

	// Live updates via Itty Sockets
	let channel: ReturnType<typeof connect> | null = null;

	onMount(() => {
		channel = connect(data.ittyChannel, { joinKey: data.ittyJoinKey });
		channel.on('refresh', () => invalidateAll());
	});

	onDestroy(() => {
		channel?.close();
	});

	// Drag state
	let draggedUserId: string | null = null;
	let hoveredUserId: string | null = null;
	let selectedUserId: string | null = null;
	let toast: string | null = null;
	let toastTimer: ReturnType<typeof setTimeout>;

	function showToast(msg: string) {
		toast = msg;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = null), 2500);
	}

	function onDragStart(userId: string) {
		draggedUserId = userId;
	}

	function onDragOver(e: DragEvent, userId: string) {
		if (draggedUserId && draggedUserId !== userId) {
			e.preventDefault();
			hoveredUserId = userId;
		}
	}

	function onDragLeave() {
		hoveredUserId = null;
	}

	function onDragEnd() {
		draggedUserId = null;
		hoveredUserId = null;
	}

	async function onDrop(recipientId: string) {
		if (!draggedUserId || draggedUserId === recipientId) return;

		const buyer = users.find((u) => u.id === draggedUserId);
		const recipient = users.find((u) => u.id === recipientId);
		if (!buyer || !recipient) return;

		draggedUserId = null;
		hoveredUserId = null;

		const res = await fetch('/api/transaction', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ buyer_id: buyer.id, recipient_id: recipient.id })
		});

		if (res.ok) {
			showToast(`🍺 ${buyer.name} bought ${recipient.name} a beer`);
			await invalidateAll();
		} else {
			showToast('Something went wrong');
		}
	}

	function toggleSelected(userId: string) {
		selectedUserId = selectedUserId === userId ? null : userId;
	}

	function getDebtsFor(userId: string): { user: User; owes: number; owed: number }[] {
		return users
			.filter((u) => u.id !== userId)
			.map((u) => {
				const owes = debts.find((d) => d.debtor_id === userId && d.creditor_id === u.id)?.amount ?? 0;
				const owed = debts.find((d) => d.debtor_id === u.id && d.creditor_id === userId)?.amount ?? 0;
				return { user: u, owes, owed };
			})
			.filter((x) => x.owes > 0 || x.owed > 0);
	}

	function totalOwed(userId: string): number {
		return debts.filter((d) => d.debtor_id === userId).reduce((s, d) => s + d.amount, 0);
	}

	function totalOwing(userId: string): number {
		return debts.filter((d) => d.creditor_id === userId).reduce((s, d) => s + d.amount, 0);
	}
</script>

<svelte:head>
	<title>Beerculator2000</title>
</svelte:head>

<header>
	<h1>🍺 Beerculator2000</h1>
	<a href="/admin" class="admin-link">Admin</a>
</header>

<main>
	{#if users.length === 0}
		<p class="empty">No users yet. <a href="/admin">Add some in admin.</a></p>
	{:else}
		<p class="hint">Drag your name onto someone else's to record that you bought them a beer.</p>

		<div class="user-grid">
			{#each users as user}
				<div
					class="user-card"
					class:dragging={draggedUserId === user.id}
					class:drop-target={hoveredUserId === user.id && draggedUserId !== user.id}
					class:selected={selectedUserId === user.id}
					class:in-debt={totalOwed(user.id) > 0}
					draggable="true"
					on:dragstart={() => onDragStart(user.id)}
					on:dragover={(e) => onDragOver(e, user.id)}
					on:dragleave={onDragLeave}
					on:drop={() => onDrop(user.id)}
					on:dragend={onDragEnd}
					on:click={() => toggleSelected(user.id)}
					role="button"
					tabindex="0"
					on:keydown={(e) => e.key === 'Enter' && toggleSelected(user.id)}
				>
					<span class="user-name">{user.name}</span>
					{#if totalOwed(user.id) > 0 || totalOwing(user.id) > 0}
						<div class="debt-summary">
							{#if totalOwed(user.id) > 0}
								<span class="owes-badge">owes {totalOwed(user.id)}</span>
							{/if}
							{#if totalOwing(user.id) > 0}
								<span class="owed-badge">owed {totalOwing(user.id)}</span>
							{/if}
						</div>
					{/if}

					{#if selectedUserId === user.id}
						<div class="debt-detail" role="presentation" on:click|stopPropagation on:keydown|stopPropagation>
							{#each getDebtsFor(user.id) as { user: other, owes, owed }}
								<div class="debt-row">
									{#if owes > 0}
										<span class="debt-owes">owes {other.name} {owes} 🍺{owes > 1 ? 's' : ''}</span>
									{/if}
									{#if owed > 0}
										<span class="debt-owed">{other.name} owes {owes > 0 ? 'also ' : ''}{owed} 🍺{owed > 1 ? 's' : ''}</span>
									{/if}
								</div>
							{:else}
								<p class="all-clear">All square! 🎉</p>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</main>

{#if toast}
	<div class="toast">{toast}</div>
{/if}

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

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.5rem 2rem;
		background: #2d1400;
		border-bottom: 2px solid #f5a623;
	}

	h1 {
		font-family: 'Paranoid Orange', sans-serif;
		font-size: 2rem;
		color: #f5a623;
		letter-spacing: 0.05em;
	}

	.admin-link {
		color: #f5a623;
		text-decoration: none;
		font-size: 0.9rem;
		border: 1px solid #f5a623;
		padding: 0.4rem 0.9rem;
		border-radius: 4px;
		transition: background 0.15s;
	}

	.admin-link:hover {
		background: #f5a62322;
	}

	main {
		padding: 2rem;
		max-width: 900px;
		margin: 0 auto;
	}

	.hint {
		text-align: center;
		color: #c8a07a;
		margin-bottom: 2rem;
		font-size: 0.95rem;
	}

	.empty {
		text-align: center;
		color: #c8a07a;
		margin-top: 4rem;
	}

	.empty a {
		color: #f5a623;
	}

	.user-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 1.2rem;
	}

	.user-card {
		background: #2d1400;
		border: 2px solid #5c3300;
		border-radius: 12px;
		padding: 1.2rem;
		cursor: grab;
		transition: border-color 0.15s, transform 0.1s, box-shadow 0.15s;
		user-select: none;
		position: relative;
	}

	.user-card:hover {
		border-color: #f5a623;
		box-shadow: 0 0 12px #f5a62344;
	}

	.user-card.dragging {
		opacity: 0.5;
		cursor: grabbing;
	}

	.user-card.drop-target {
		border-color: #4caf50;
		background: #1a3300;
		box-shadow: 0 0 20px #4caf5066;
		transform: scale(1.04);
	}

	.user-card.selected {
		border-color: #f5a623;
		box-shadow: 0 0 16px #f5a62366;
	}

	.user-card.in-debt {
		border-color: #c0392b44;
	}

	.user-name {
		font-size: 1.3rem;
		font-weight: 700;
		display: block;
		margin-bottom: 0.4rem;
	}

	.debt-summary {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
		margin-top: 0.3rem;
	}

	.owes-badge {
		background: #c0392b33;
		color: #ff7675;
		font-size: 0.75rem;
		padding: 0.2rem 0.5rem;
		border-radius: 20px;
		border: 1px solid #c0392b66;
	}

	.owed-badge {
		background: #27ae6033;
		color: #55efc4;
		font-size: 0.75rem;
		padding: 0.2rem 0.5rem;
		border-radius: 20px;
		border: 1px solid #27ae6066;
	}

	.debt-detail {
		margin-top: 0.8rem;
		padding-top: 0.8rem;
		border-top: 1px solid #5c3300;
		font-size: 0.85rem;
	}

	.debt-row {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		margin-bottom: 0.3rem;
	}

	.debt-owes {
		color: #ff7675;
	}

	.debt-owed {
		color: #55efc4;
	}

	.all-clear {
		color: #55efc4;
		font-size: 0.85rem;
	}

	.toast {
		position: fixed;
		bottom: 2rem;
		left: 50%;
		transform: translateX(-50%);
		background: #2d1400;
		border: 2px solid #f5a623;
		color: #f5e6c8;
		padding: 0.8rem 1.6rem;
		border-radius: 8px;
		font-size: 1rem;
		box-shadow: 0 4px 20px #0008;
		z-index: 100;
		animation: fadein 0.2s ease;
	}

	@keyframes fadein {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}
</style>
