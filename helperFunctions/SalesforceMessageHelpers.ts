import { IModify, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { Logs } from '../enum/Logs';
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
					await sendDebugLCMessage(read, modify, messageRoom, Logs.LIVAGENT_CURRENTLY_TYPING, LcAgent);
					break;

				default:
					console.log(Logs.ERROR_UNCALCULATED_AGENT_EVENT_TYPE, type);
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

export async function checkForErrorEvents(
	app: IApp,
	read: IRead,
	modify: IModify,
	message: IMessage,
	messageArray: any,
	technicalDifficultyMessage: string,
	LcAgent: IUser,
) {
	try {
		switch (messageArray.messages[0].message.reason) {
			case 'Unavailable':
				console.log(Logs.ERROR_ALL_LIVEAGENTS_UNAVAILABLE);
				await sendLCMessage(modify, message.room, 'No agent available for chat.', LcAgent);
				break;

			case 'NoPost':
				console.log(Logs.ERROR_APP_CONFIGURATION_INVALID);
				await sendLCMessage(modify, message.room, technicalDifficultyMessage, LcAgent);
				await sendDebugLCMessage(read, modify, message.room, Logs.ERROR_APP_CONFIGURATION_INVALID, LcAgent);
				break;

			case 'InternalFailure':
				console.log(Logs.ERROR_SALESFORCE_INTERNAL_FAILURE);
				await sendLCMessage(modify, message.room, technicalDifficultyMessage, LcAgent);
				await sendDebugLCMessage(read, modify, message.room, Logs.ERROR_SALESFORCE_INTERNAL_FAILURE, LcAgent);
				break;

			default:
				console.log(Logs.ERROR_UNKNOWN_IN_CHECKING_AGENT_RESPONSE);
				await sendLCMessage(modify, message.room, technicalDifficultyMessage, LcAgent);
				await sendDebugLCMessage(read, modify, message.room, Logs.ERROR_UNKNOWN_IN_CHECKING_AGENT_RESPONSE, LcAgent);
				break;
		}
	} catch (error) {
		throw new Error(error);
	}
}
