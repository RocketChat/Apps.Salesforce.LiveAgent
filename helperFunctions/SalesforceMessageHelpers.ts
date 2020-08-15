import { IModify, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { AppSettingId } from '../enum/AppSettingId';
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
				console.log(ErrorLogs.ALL_LIVEAGENTS_UNAVAILABLE);
				const NoLiveagentAvailableMessage: string = (
					await read.getEnvironmentReader().getSettings().getById(AppSettingId.NO_LIVEAGENT_AGENT_AVAILABLE_MESSAGE)
				).value;
				await sendLCMessage(modify, message.room, NoLiveagentAvailableMessage, LcAgent);
				break;

			case 'NoPost':
				console.log(ErrorLogs.APP_CONFIGURATION_INVALID);
				await sendLCMessage(modify, message.room, technicalDifficultyMessage, LcAgent);
				await sendDebugLCMessage(read, modify, message.room, ErrorLogs.APP_CONFIGURATION_INVALID, LcAgent);
				break;

			case 'InternalFailure':
				console.log(ErrorLogs.SALESFORCE_INTERNAL_FAILURE);
				await sendLCMessage(modify, message.room, technicalDifficultyMessage, LcAgent);
				await sendDebugLCMessage(read, modify, message.room, ErrorLogs.SALESFORCE_INTERNAL_FAILURE, LcAgent);
				break;

			default:
				console.log(ErrorLogs.UNKNOWN_ERROR_IN_CHECKING_AGENT_RESPONSE);
				await sendLCMessage(modify, message.room, technicalDifficultyMessage, LcAgent);
				await sendDebugLCMessage(read, modify, message.room, ErrorLogs.UNKNOWN_ERROR_IN_CHECKING_AGENT_RESPONSE, LcAgent);
				break;
		}
	} catch (error) {
		throw new Error(error);
	}
}
