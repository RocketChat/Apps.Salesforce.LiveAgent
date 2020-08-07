import { IModify, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { IUser } from '@rocket.chat/apps-engine/definition/users';

export async function sendLCMessage(modify: IModify, room: IRoom, messageText: string, sender: IUser) {
	const messageBuilder = modify.getNotifier().getMessageBuilder();
	messageBuilder.setRoom(room).setText(messageText).setSender(sender);
	modify.getCreator().finish(messageBuilder);
}

export async function sendDebugLCMessage(read: IRead, modify: IModify, room: IRoom, messageText: string, sender: IUser) {
	const debugMode: boolean = (await read.getEnvironmentReader().getSettings().getById('debug_button')).value;
	if (debugMode !== true) {
		return;
	}

	const messageBuilder = modify.getNotifier().getMessageBuilder();
	messageBuilder.setRoom(room).setText(messageText).setSender(sender);
	modify.getCreator().finish(messageBuilder);
}

export const getServerSettingValue = async (read: IRead, id: string) => {
	return id && (await read.getEnvironmentReader().getServerSettings().getValueById(id));
};

export async function retrievePersistentTokens(read: IRead, assoc: RocketChatAssociationRecord) {
	const awayDatas = await read.getPersistenceReader().readByAssociation(assoc);
	if (awayDatas[0]) {
		const contentStringified = JSON.stringify(awayDatas[0]);
		const contentParsed = JSON.parse(contentStringified);

		return {
			persisantAffinity: contentParsed.affinityToken as string,
			persistantKey: contentParsed.key as string,
		};
	}

	return {
		persisantAffinity: null,
		persistantKey: null,
	};
}
