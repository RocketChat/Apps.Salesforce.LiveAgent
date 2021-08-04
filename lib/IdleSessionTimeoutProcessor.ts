import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IJobContext, IProcessor } from '@rocket.chat/apps-engine/definition/scheduler';
import { ErrorLogs } from '../enum/ErrorLogs';
import { LiveAgentSession } from '../handlers/LiveAgentSessionHandler';
import { retrievePersistentTokens } from '../helperFunctions/PersistenceHelpers';
import { updateRoomCustomFields } from '../helperFunctions/RoomCustomFieldsHelper';

export class IdleSessionTimeoutProcessor implements IProcessor {
	public id: string;
	public app: IApp;
	public message: IMessage;

	constructor(id: string, app?: IApp, message?: IMessage) {
		this.id = id;
		if (app && message) {
			this.app = app;
			this.message = message;
		}
	}

	public async processor(jobContext: IJobContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {

		const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, `SFLAIA-${jobContext.rid}`);
		const { persisantAffinity, persistantKey } = await retrievePersistentTokens(read, assoc);

		if (persisantAffinity !== null && persistantKey !== null) {
			const room = await read.getRoomReader().getById(jobContext.rid);
			if (!room) {
				throw new Error(`${ErrorLogs.INVALID_ROOM_ID} ${jobContext.rid}`);
			}
			await modify.getUpdater().getLivechatUpdater().closeRoom(room, 'Chat closed due to timeout');
			updateRoomCustomFields(jobContext.rid , {customerIdleTimeout: true}, read, modify);
		}

		const liveAgentSession = new LiveAgentSession(this.app, jobContext.message, read, modify, http, persis);
		await liveAgentSession.exec();

		return;
	}
}
