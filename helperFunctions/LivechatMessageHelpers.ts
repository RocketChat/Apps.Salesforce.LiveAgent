import { IModify, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { AppSettingId } from '../enum/AppSettingId';
import { ErrorLogs } from '../enum/ErrorLogs';
import { getAppSettingValue } from '../lib/Settings';
import { getRoomAssoc, retrievePersistentData } from './PersistenceHelpers';

export async function sendLCMessage(read: IRead, modify: IModify, room: IRoom, messageText: string, sender: IUser, disableInput?: boolean) {
	try {
		const messageBuilder = modify.getCreator().startMessage();
		const message: IMessage = {
			room,
			text: messageText,
			sender,
		};

		const livechatRoom = await read.getRoomReader().getById(room.id);
		if (!livechatRoom) {
			throw new Error(ErrorLogs.INVALID_ROOM_ID);
		}
        
        const assoc = getRoomAssoc(room.id);
        const { salesforceAgentName } = await retrievePersistentData(read, assoc);

        message.customFields = {
            salesforceAgentName,
        }

		if (livechatRoom.customFields?.postChatUrl) {
			message.customFields = {
                ...message?.customFields,
				postChatUrl: livechatRoom.customFields?.postChatUrl,
			};
		}
		if (disableInput) {
			message.customFields = {
				...message?.customFields,
				disableInput: true,
				disableInputMessage: 'Please wait',
				displayTyping: false,
			};
		}
		messageBuilder.setData(message);
        console.log('sending message');
		await modify.getCreator().finish(messageBuilder);
	} catch (error) {
		throw new Error(error);
	}
}

export async function sendDebugLCMessage(read: IRead, modify: IModify, room: IRoom, messageText: string, sender: IUser) {
	try {
		const debugMode: boolean = await getAppSettingValue(read, AppSettingId.DEBUG_BUTTON);
		if (debugMode !== true) {
			return;
		}

		const messageBuilder = modify.getCreator().startMessage();
		messageBuilder.setRoom(room).setText(messageText).setSender(sender);
		await modify.getCreator().finish(messageBuilder);
	} catch (error) {
		throw new Error(error);
	}
}
