import { IModify, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { sendDebugLCMessage, sendLCMessage } from './GeneralHelpers';

export async function messageFilter(modify: IModify, read: IRead, messageRoom: IRoom, LcAgent: IUser, messageArray: any) {
	try {
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
	} catch (error) {
		throw new Error(error);
	}
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

export async function checkForErrorEvents(
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
				await sendLCMessage(modify, message.room, 'No agent available for chat.', LcAgent);
				console.log('Check whether agent accepted request, Error: No agent available for chat.');
				break;

			case 'NoPost':
				console.log('Check whether agent accepted request, Error: Invalid App configuration.');
				await sendLCMessage(modify, message.room, technicalDifficultyMessage, LcAgent);
				await sendDebugLCMessage(read, modify, message.room, `App configuration error. Please double check your provided Salesforce Id's`, LcAgent);
				break;

			case 'InternalFailure':
				console.log('Check whether agent accepted request, Error: Salesforce internal failure.');
				await sendLCMessage(modify, message.room, technicalDifficultyMessage, LcAgent);
				await sendDebugLCMessage(
					read,
					modify,
					message.room,
					'Salesforce internal failure. Please check your Salesforce Org for potential issues.',
					LcAgent,
				);
				break;

			default:
				console.log('Check whether agent accepted request, Error: Unknown error occured.');
				await sendLCMessage(modify, message.room, technicalDifficultyMessage, LcAgent);
				await sendDebugLCMessage(read, modify, message.room, 'Unknown error occured.', LcAgent);
				break;
		}
	} catch (error) {
		throw new Error(error);
	}
}
