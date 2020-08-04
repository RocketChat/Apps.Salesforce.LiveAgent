import { IModify, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { sendDebugLCMessage, sendLCMessage } from './GeneralHelpers';

export async function messageFilter(modify: IModify, read: IRead, messageRoom: IRoom, LcAgent: IUser, messageArray: any) {
	messageArray.forEach(async (i) => {
		const type = i.type;
		switch (type) {
			case 'ChatMessage':
				const messageText = i.message.text;
				await sendLCMessage(modify, messageRoom, messageText, LcAgent);
				break;

			case 'AgentTyping':
				await sendDebugLCMessage(read, modify, messageRoom, 'Agent Typing', LcAgent);
				break;

			default:
				console.log('Pulling Messages from Liveagent, Default messageType:', type);
				break;
		}
	});
}

export function checkForEvent(messageArray: any, eventToCheck: string) {
	if (messageArray && messageArray.length > 0) {
		for (let i = 0; i < messageArray.length; i++) {
			if (messageArray[i].type === eventToCheck) {
				return true;
			}
		}
	}
	return false;
}
