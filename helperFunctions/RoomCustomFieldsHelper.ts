import { IModify, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { AppSettingId } from '../enum/AppSettingId';
import { ErrorLogs } from '../enum/ErrorLogs';
import { getAppSettingValue } from '../lib/Settings';

export const updateRoomCustomFields = async (rid: string, data: any, read: IRead, modify: IModify): Promise<any> => {
	const room = await read.getRoomReader().getById(rid);
	if (!room) {
		throw new Error(`${ErrorLogs.INVALID_ROOM_ID} ${rid}`);
	}

	const salesforceBotUsername: string = await getAppSettingValue(read, AppSettingId.SALESFORCE_BOT_USERNAME);
	const user = await read.getUserReader().getByUsername(salesforceBotUsername);

	let { customFields = {} } = room;
	customFields = Object.assign(customFields, data);
	const roomBuilder = await modify.getUpdater().room(rid, user);
	roomBuilder.setCustomFields(customFields);

	try {
		await modify.getUpdater().finish(roomBuilder);
	} catch (error) {
		throw new Error(error);
	}
};
