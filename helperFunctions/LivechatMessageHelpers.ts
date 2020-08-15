import { IModify, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { AppSettingId } from '../enum/AppSettingId';

export async function sendLCMessage(modify: IModify, room: IRoom, messageText: string, sender: IUser) {
	try {
		const messageBuilder = modify.getNotifier().getMessageBuilder();
		messageBuilder.setRoom(room).setText(messageText).setSender(sender);
		await modify.getCreator().finish(messageBuilder);
	} catch (error) {
		throw new Error(error);
	}
}

export async function sendDebugLCMessage(read: IRead, modify: IModify, room: IRoom, messageText: string, sender: IUser) {
	try {
		const debugMode: boolean = (await read.getEnvironmentReader().getSettings().getById(AppSettingId.DEBUG_BUTTON)).value;
		if (debugMode !== true) {
			return;
		}

		const messageBuilder = modify.getNotifier().getMessageBuilder();
		messageBuilder.setRoom(room).setText(messageText).setSender(sender);
		await modify.getCreator().finish(messageBuilder);
	} catch (error) {
		throw new Error(error);
	}
}

export const getServerSettingValue = async (read: IRead, id: string) => {
	return id && (await read.getEnvironmentReader().getServerSettings().getValueById(id));
};
