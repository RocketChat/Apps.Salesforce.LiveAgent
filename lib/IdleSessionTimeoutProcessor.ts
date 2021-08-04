import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ILivechatRoom } from '@rocket.chat/apps-engine/definition/livechat/ILivechatRoom';
import { IJobContext, IProcessor } from '@rocket.chat/apps-engine/definition/scheduler';
import { ErrorLogs } from '../enum/ErrorLogs';
import { retrievePersistentTokens, RoomAssoc } from '../helperFunctions/PersistenceHelpers';
import { updateRoomCustomFields } from '../helperFunctions/RoomCustomFieldsHelper';

export class IdleSessionTimeoutProcessor implements IProcessor {
	public id: string;

	constructor(id: string) {
		this.id = id;
	}

	public async processor(jobContext: IJobContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {

		const assoc = RoomAssoc(jobContext.rid);
		const { persisantAffinity, persistantKey } = await retrievePersistentTokens(read, assoc);

		if (persisantAffinity !== null && persistantKey !== null) {
			const room = await read.getRoomReader().getById(jobContext.rid) as ILivechatRoom;
			if (!room) {
				throw new Error(`${ErrorLogs.INVALID_ROOM_ID} ${jobContext.rid}`);
			}
			if (!room.isOpen) {
				return;
			}
			await modify.getUpdater().getLivechatUpdater().closeRoom(room, 'Chat closed due to timeout');
			await updateRoomCustomFields(jobContext.rid , {customerIdleTimeout: true}, read, modify);
		}
	}
}
