const rooms = {};

export async function agentTypingListener(rid, callback) {
	if (rooms[rid]) {
		return;
	}
	rooms[rid] = callback;
}

export async function removeAgentTypingListener(rid) {
	if (rooms[rid]) {
		(await rooms[rid])();
		delete rooms[rid];
	}
}
