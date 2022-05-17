import { IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { AppSettingId } from '../enum/AppSettingId';
import { ErrorLogs } from '../enum/ErrorLogs';
import { getAppSettingValue } from '../lib/Settings';
import { agentTypingListener, removeAgentTypingListener } from './AgentTypingHelper';
import { sendLCMessage } from './LivechatMessageHelpers';
import { updatePersistentData } from './PersistenceHelpers';

export async function messageFilter(app: IApp, modify: IModify, read: IRead, persistence: IPersistence, messageRoom: IRoom, LcAgent: IUser, assoc: RocketChatAssociationRecord, messageArray: any) {
	try {
		messageArray.forEach(async (i) => {
			const type = i.type;
			switch (type) {
				case 'ChatTransferred':
					const transferMessage = i.message;
					const salesforceAgentName = transferMessage.name;
					await updatePersistentData(read, persistence, assoc, { salesforceAgentName });
					break;

				case 'ChatMessage':
					const messageText = i.message.text;
					await sendLCMessage(read, modify, messageRoom, messageText, LcAgent);
					break;

				case 'AgentTyping':
					const salesforceBotUsername: string = await getAppSettingValue(read, AppSettingId.SALESFORCE_BOT_USERNAME);
					await agentTypingListener(messageRoom.id, modify.getNotifier().typing({ id: messageRoom.id, username: salesforceBotUsername }));
					break;

				case 'AgentNotTyping':
					await removeAgentTypingListener(messageRoom.id);
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

export function getForEvent(messageArray: any, eventToCheck: string) {
	try {
		if (messageArray && messageArray.length > 0) {
			for (let i = 0; i < messageArray.length; i++) {
				if (messageArray[i].type === eventToCheck) {
					return messageArray[i];
				}
			}
		}
		return false;
	} catch (error) {
		throw new Error(error);
	}
}

export function checkForPostChatUrl(messageArray: any) {
	if (messageArray && messageArray.length > 0) {
		for (let i = 0; i < messageArray.length; i++) {
			if (messageArray[i]?.message.postChatUrl) {
				return messageArray[i]?.message.postChatUrl;
			}
		}
	}
	return null;
}
