import { IModify, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { AppSettingId } from '../enum/AppSettingId';
import { ErrorLogs } from '../enum/ErrorLogs';

export const updateRoomCustomFields = async (rid: string, data: any, read: IRead, modify: IModify): Promise<any> => {
	const room = await read.getRoomReader().getById(rid);
	if (!room) {
		throw new Error(`${ErrorLogs.INVALID_ROOM_ID} ${rid}`);
	}

	const salesforceBotUsername: string = (await read.getEnvironmentReader().getSettings().getById(AppSettingId.SALESFORCE_BOT_USERNAME)).value;
	const user = await read.getUserReader().getByUsername(salesforceBotUsername);

	let { customFields = {} } = room;
	customFields = Object.assign(customFields, data);
	const roomBuilder = await modify.getUpdater().room(rid, user);
	roomBuilder.setCustomFields(customFields);

	try {
		modify.getUpdater().finish(roomBuilder);
	} catch (error) {
		throw new Error(error);
	}
};
