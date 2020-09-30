import { IModify, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { ErrorLogs } from '../enum/ErrorLogs';
import { InfoLogs } from '../enum/InfoLogs';
import { sendDebugLCMessage, sendLCMessage } from './LivechatMessageHelpers';

export async function messageFilter(app: IApp, modify: IModify, read: IRead, messageRoom: IRoom, LcAgent: IUser, messageArray: any) {
	try {
		messageArray.forEach(async (i) => {
			const type = i.type;
			switch (type) {
				case 'ChatMessage':
					const messageText = i.message.text;
					await sendLCMessage(modify, messageRoom, messageText, LcAgent);
					break;

				case 'AgentTyping':
					await sendDebugLCMessage(read, modify, messageRoom, InfoLogs.LIVAGENT_CURRENTLY_TYPING, LcAgent);
					break;

				default:
					console.log(ErrorLogs.UNCALCULATED_AGENT_EVENT_TYPE, type);
					break;
			}
		});
	} catch (error) {
		throw new Error(error);
	}
}

export function checkForEvent(messageArray: any, eventToCheck: string) {
	try {
		if (messageArray && messageArray.length > 0) {
			for (let i = 0; i < messageArray.length; i++) {
				if (messageArray[i].type === eventToCheck) {
					return true;
				}
			}
		}
		return false;
	} catch (error) {
		throw new Error(error);
	}
}
