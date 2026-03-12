<script lang="ts">
	import type { PageData } from './$types';
	import type { User, BeerDebt, BeerLog } from '$lib/supabase';
	import { invalidateAll } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { connect } from 'itty-sockets';

	export let data: PageData;

	let isAdmin: boolean = data.isAdmin;
	let users: User[] = data.users;
	let debts: BeerDebt[] = data.debts;

	$: isAdmin = data.isAdmin;
	$: users = data.users;
	$: debts = data.debts;

	// Login form
	let loginUsername = '';
	let loginPassword = '';
	let loginError = '';
	let loginLoading = false;

	// New user form
	let newUserName = '';
	let newUserError = '';

	// Manual debt form
	let debtDebtorId = '';
	let debtCreditorId = '';
	let debtAmount = '0';
	let debtError = '';

	let toast: string | null = null;
	let toastTimer: ReturnType<typeof setTimeout>;

	function showToast(msg: string) {
		toast = msg;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = null), 2500);
	}

	async function login() {
		loginError = '';
		loginLoading = true;
		const res = await fetch('/api/admin/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: loginUsername, password: loginPassword })
		});
		loginLoading = false;
		if (res.ok) {
			await invalidateAll();
		} else {
			loginError = 'Invalid credentials';
		}
	}

	async function logout() {
		await fetch('/api/admin/login', { method: 'DELETE' });
		await invalidateAll();
	}

	async function addUser() {
		newUserError = '';
		if (!newUserName.trim()) { newUserError = 'Name required'; return; }
		const res = await fetch('/api/admin/users', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: newUserName.trim() })
		});
		if (res.ok) {
			newUserName = '';
			showToast('User added');
			await invalidateAll();
		} else {
			const err = await res.json().catch(() => ({}));
			newUserError = err.message ?? 'Failed to add user';
		}
	}

	async function deleteUser(id: string, name: string) {
		if (!confirm(`Delete ${name}? This will also remove all their beer debts.`)) return;
		const res = await fetch('/api/admin/users', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id })
		});
		if (res.ok) {
			showToast(`${name} removed`);
			await invalidateAll();
		}
	}

	async function setDebt() {
		debtError = '';
		if (!debtDebtorId || !debtCreditorId) { debtError = 'Select both users'; return; }
		if (debtDebtorId === debtCreditorId) { debtError = 'Users must be different'; return; }
		const res = await fetch('/api/admin/debt', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ debtor_id: debtDebtorId, creditor_id: debtCreditorId, amount: debtAmount })
		});
		if (res.ok) {
			showToast('Debt updated');
			debtAmount = '0';
			await invalidateAll();
		} else {
			const err = await res.json().catch(() => ({}));
			debtError = err.message ?? 'Failed';
		}
	}

	function getDebt(debtorId: string, creditorId: string): number {
		return debts.find((d) => d.debtor_id === debtorId && d.creditor_id === creditorId)?.amount ?? 0;
	}

	function userName(id: string): string {
		return users.find((u) => u.id === id)?.name ?? id;
	}

	// Activity log
	let logEntries: BeerLog[] = [];
	let logPage = 1;
	let logTotalPages = 1;
	let logLoading = false;

	const eventLabels: Record<BeerLog['event_type'], string> = {
		transaction: '🍺',
		cancellation: '↩️',
		rationalization: '🔗',
		manual_debt: '⚙️'
	};

	async function loadLog(page: number) {
		logLoading = true;
		const res = await fetch(`/api/admin/logs?page=${page}`);
		if (res.ok) {
			const data = await res.json();
			logEntries = data.entries;
			logPage = data.page;
			logTotalPages = data.totalPages;
		}
		logLoading = false;
	}

	$: if (isAdmin) loadLog(1);

	// Live updates via Itty Sockets
	let channel: ReturnType<typeof connect> | null = null;

	onMount(() => {
		channel = connect(data.ittyChannel, { joinKey: data.ittyJoinKey });
		channel.on('refresh', () => {
			invalidateAll();
			if (isAdmin) loadLog(logPage);
		});
	});

	onDestroy(() => {
		channel?.close();
	});

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleString(undefined, {
			day: '2-digit', month: 'short', year: 'numeric',
			hour: '2-digit', minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>Admin — Beerculator 2000</title>
</svelte:head>

<header>
	<a href="/" class="back-link">← Back</a>
	<h1>🍺 Admin</h1>
	{#if isAdmin}
		<button on:click={logout} class="logout-btn">Log out</button>
	{:else}
		<span></span>
	{/if}
</header>

<main>
	{#if !isAdmin}
		<section class="login-box">
			<h2>Log in</h2>
			<form on:submit|preventDefault={login}>
				<input
					type="text"
					placeholder="Username"
					bind:value={loginUsername}
					autocomplete="username"
				/>
				<input
					type="password"
					placeholder="Password"
					bind:value={loginPassword}
					autocomplete="current-password"
				/>
				{#if loginError}
					<p class="error">{loginError}</p>
				{/if}
				<button type="submit" disabled={loginLoading}>
					{loginLoading ? 'Logging in…' : 'Log in'}
				</button>
			</form>
		</section>
	{:else}
		<div class="admin-grid">
			<!-- Add User -->
			<section class="panel">
				<h2>Add User</h2>
				<form on:submit|preventDefault={addUser}>
					<div class="row">
						<input
							type="text"
							placeholder="Name"
							bind:value={newUserName}
						/>
						<button type="submit">Add</button>
					</div>
					{#if newUserError}<p class="error">{newUserError}</p>{/if}
				</form>

				<h3>Current Users</h3>
				<ul class="user-list">
					{#each users as user}
						<li>
							<span>{user.name}</span>
							<button class="delete-btn" on:click={() => deleteUser(user.id, user.name)}>✕</button>
						</li>
					{:else}
						<li class="empty">No users yet.</li>
					{/each}
				</ul>
			</section>

			<!-- Manual Debt -->
			<section class="panel">
				<h2>Manual Debt</h2>
				<p class="hint">Set exactly how many beers one person owes another.</p>
				<form on:submit|preventDefault={setDebt}>
					<div class="field">
						<label for="debt-debtor">Debtor (owes beers)</label>
						<select id="debt-debtor" bind:value={debtDebtorId}>
							<option value="">— select —</option>
							{#each users as u}
								<option value={u.id}>{u.name}</option>
							{/each}
						</select>
					</div>
					<div class="field">
						<label for="debt-creditor">Creditor (is owed beers)</label>
						<select id="debt-creditor" bind:value={debtCreditorId}>
							<option value="">— select —</option>
							{#each users as u}
								<option value={u.id}>{u.name}</option>
							{/each}
						</select>
					</div>
					<div class="field">
						<label for="debt-amount">Amount</label>
						<input id="debt-amount" type="number" min="0" bind:value={debtAmount} />
					</div>
					{#if debtDebtorId && debtCreditorId && debtDebtorId !== debtCreditorId}
						<p class="current-hint">
							Current: {userName(debtDebtorId)} owes {userName(debtCreditorId)}
							{getDebt(debtDebtorId, debtCreditorId)} 🍺
						</p>
					{/if}
					{#if debtError}<p class="error">{debtError}</p>{/if}
					<button type="submit">Set Debt</button>
				</form>
			</section>

			<!-- Debt Overview -->
			<section class="panel full-width">
				<h2>All Debts</h2>
				{#if debts.length === 0}
					<p class="empty">No debts — everyone's square 🎉</p>
				{:else}
					<table>
						<thead>
							<tr>
								<th>Owes</th>
								<th></th>
								<th>To</th>
								<th>Beers</th>
							</tr>
						</thead>
						<tbody>
							{#each debts as debt}
								<tr>
									<td>{userName(debt.debtor_id)}</td>
									<td class="arrow">→</td>
									<td>{userName(debt.creditor_id)}</td>
									<td>🍺 × {debt.amount}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</section>

			<!-- Activity Log -->
			<section class="panel full-width">
				<div class="log-header">
					<h2>Activity Log</h2>
					<button class="refresh-btn" on:click={() => loadLog(logPage)} disabled={logLoading}>
						{logLoading ? '…' : '↻ Refresh'}
					</button>
				</div>

				{#if logLoading && logEntries.length === 0}
					<p class="empty">Loading…</p>
				{:else if logEntries.length === 0}
					<p class="empty">No activity yet.</p>
				{:else}
					<table>
						<thead>
							<tr>
								<th>When</th>
								<th>Type</th>
								<th>Description</th>
							</tr>
						</thead>
						<tbody>
							{#each logEntries as entry}
								<tr>
									<td class="log-time">{formatDate(entry.created_at)}</td>
									<td class="log-type">
										<span class="log-badge log-badge--{entry.event_type}">
											{eventLabels[entry.event_type]} {entry.event_type.replace('_', ' ')}
										</span>
									</td>
									<td>{entry.description}</td>
								</tr>
							{/each}
						</tbody>
					</table>

					{#if logTotalPages > 1}
						<div class="pagination">
							<button
								class="page-btn"
								disabled={logPage <= 1}
								on:click={() => loadLog(logPage - 1)}
							>← Prev</button>
							<span class="page-info">Page {logPage} of {logTotalPages}</span>
							<button
								class="page-btn"
								disabled={logPage >= logTotalPages}
								on:click={() => loadLog(logPage + 1)}
							>Next →</button>
						</div>
					{/if}
				{/if}
			</section>
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
		font-family: 'devandra', sans-serif;
		font-size: 1.8rem;
		color: #f5a623;
	}

	.back-link, .logout-btn {
		color: #f5a623;
		text-decoration: none;
		font-size: 0.9rem;
		border: 1px solid #f5a623;
		padding: 0.4rem 0.9rem;
		border-radius: 4px;
		background: transparent;
		cursor: pointer;
		transition: background 0.15s;
	}

	.back-link:hover, .logout-btn:hover {
		background: #f5a62322;
	}

	main {
		padding: 2rem;
		max-width: 900px;
		margin: 0 auto;
	}

	.login-box {
		max-width: 360px;
		margin: 4rem auto;
		background: #2d1400;
		border: 2px solid #5c3300;
		border-radius: 12px;
		padding: 2rem;
	}

	.login-box h2 {
		color: #f5a623;
		margin-bottom: 1.2rem;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}

	input, select {
		background: #1a0a00;
		border: 1px solid #5c3300;
		color: #f5e6c8;
		padding: 0.6rem 0.8rem;
		border-radius: 6px;
		font-size: 1rem;
		width: 100%;
	}

	input:focus, select:focus {
		outline: none;
		border-color: #f5a623;
	}

	button[type='submit'], button:not(.delete-btn):not(.logout-btn):not(.back-link) {
		background: #f5a623;
		color: #1a0a00;
		border: none;
		padding: 0.6rem 1.2rem;
		border-radius: 6px;
		font-size: 1rem;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.15s;
		white-space: nowrap;
	}

	button[type='submit']:hover {
		background: #e09000;
	}

	button[type='submit']:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.admin-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
	}

	.full-width {
		grid-column: 1 / -1;
	}

	.panel {
		background: #2d1400;
		border: 2px solid #5c3300;
		border-radius: 12px;
		padding: 1.5rem;
	}

	.panel h2 {
		color: #f5a623;
		margin-bottom: 1rem;
	}

	.panel h3 {
		color: #c8a07a;
		margin-top: 1.2rem;
		margin-bottom: 0.6rem;
		font-size: 0.9rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.hint {
		color: #c8a07a;
		font-size: 0.88rem;
		margin-bottom: 1rem;
	}

	.row {
		display: flex;
		gap: 0.6rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin-bottom: 0.6rem;
	}

	.field label {
		font-size: 0.85rem;
		color: #c8a07a;
	}

	.current-hint {
		font-size: 0.85rem;
		color: #c8a07a;
		margin-bottom: 0.4rem;
	}

	.user-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.user-list li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.7rem;
		background: #1a0a00;
		border-radius: 6px;
		border: 1px solid #3a1a00;
	}

	.user-list li.empty {
		color: #c8a07a;
		font-size: 0.9rem;
		justify-content: center;
	}

	.delete-btn {
		background: transparent;
		border: none;
		color: #c0392b;
		cursor: pointer;
		font-size: 1rem;
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
		transition: background 0.1s;
	}

	.delete-btn:hover {
		background: #c0392b22;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th {
		text-align: left;
		color: #c8a07a;
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.5rem 0.8rem;
		border-bottom: 1px solid #5c3300;
	}

	td {
		padding: 0.6rem 0.8rem;
		border-bottom: 1px solid #3a1a0044;
	}

	.arrow {
		color: #f5a623;
		font-weight: 700;
	}

	.empty {
		color: #c8a07a;
		font-size: 0.9rem;
	}

	.log-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
	}

	.log-header h2 {
		margin-bottom: 0;
	}

	.refresh-btn {
		background: transparent !important;
		border: 1px solid #5c3300 !important;
		color: #c8a07a !important;
		font-size: 0.85rem !important;
		padding: 0.3rem 0.8rem !important;
		font-weight: 400 !important;
	}

	.refresh-btn:hover {
		border-color: #f5a623 !important;
		color: #f5a623 !important;
		background: transparent !important;
	}

	.log-time {
		color: #c8a07a;
		font-size: 0.82rem;
		white-space: nowrap;
	}

	.log-type {
		white-space: nowrap;
	}

	.log-badge {
		display: inline-block;
		font-size: 0.75rem;
		padding: 0.2rem 0.5rem;
		border-radius: 20px;
		text-transform: capitalize;
	}

	.log-badge--transaction {
		background: #f5a62322;
		color: #f5a623;
		border: 1px solid #f5a62366;
	}

	.log-badge--cancellation {
		background: #27ae6022;
		color: #55efc4;
		border: 1px solid #27ae6066;
	}

	.log-badge--rationalization {
		background: #8e44ad22;
		color: #c39bd3;
		border: 1px solid #8e44ad66;
	}

	.log-badge--manual_debt {
		background: #2980b922;
		color: #7fb3d3;
		border: 1px solid #2980b966;
	}

	.pagination {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-top: 1rem;
		justify-content: center;
	}

	.page-btn {
		background: transparent !important;
		border: 1px solid #5c3300 !important;
		color: #c8a07a !important;
		font-size: 0.85rem !important;
		padding: 0.3rem 0.9rem !important;
		font-weight: 400 !important;
		cursor: pointer;
	}

	.page-btn:disabled {
		opacity: 0.3 !important;
		cursor: not-allowed !important;
	}

	.page-btn:not(:disabled):hover {
		border-color: #f5a623 !important;
		color: #f5a623 !important;
	}

	.page-info {
		color: #c8a07a;
		font-size: 0.85rem;
	}

	.error {
		color: #ff7675;
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

	@media (max-width: 600px) {
		.admin-grid {
			grid-template-columns: 1fr;
		}
		.full-width {
			grid-column: 1;
		}
	}
</style>
