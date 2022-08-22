import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ILivechatRoom } from '@rocket.chat/apps-engine/definition/livechat/ILivechatRoom';
import { IJobContext, IProcessor } from '@rocket.chat/apps-engine/definition/scheduler';
import { EventName } from '../enum/Analytics';
import { ErrorLogs } from '../enum/ErrorLogs';
import { getRoomAssoc, retrievePersistentTokens } from '../helperFunctions/PersistenceHelpers';
import { updateRoomCustomFields } from '../helperFunctions/RoomCustomFieldsHelper';
import { getEventData } from '../lib/Analytics';

export class IdleSessionTimeoutProcessor implements IProcessor {
	public id: string;

	constructor(id: string) {
		this.id = id;
	}

	public async processor(jobContext: IJobContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
		const assoc = getRoomAssoc(jobContext.rid);
		const { persistentAffinity, persistentKey } = await retrievePersistentTokens(read, assoc);

		if (persistentAffinity !== null && persistentKey !== null) {
			const room = (await read.getRoomReader().getById(jobContext.rid)) as ILivechatRoom;
			if (!room) {
				throw new Error(`${ErrorLogs.INVALID_ROOM_ID} ${jobContext.rid}`);
			}
			if (!room.isOpen) {
				return;
			}
			await modify.getUpdater().getLivechatUpdater().closeRoom(room, 'Chat closed due to timeout');
			await updateRoomCustomFields(jobContext.rid, { customerIdleTimeout: true }, read, modify);
			modify.getAnalytics().sendEvent(getEventData(jobContext.rid, EventName.CHAT_CLOSED_BY_TIMEOUT));
		}
	}
}
