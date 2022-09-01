import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatRoom } from '@rocket.chat/apps-engine/definition/livechat/ILivechatRoom';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { AppSettingId } from '../enum/AppSettingId';
import { LiveAgentSession } from '../handlers/LiveAgentSessionHandler';
import { getRoomAssoc, retrievePersistentData } from '../helperFunctions/PersistenceHelpers';
import { updateRoomCustomFields } from '../helperFunctions/RoomCustomFieldsHelper';
import { handleTimeout } from '../helperFunctions/TimeoutHelper';
import { getAppSettingValue } from '../lib/Settings';

export class PostMessageClassInitiate {
	constructor(
		private app: IApp,
		private message: IMessage,
		private read: IRead,
		private http: IHttp,
		private persistence: IPersistence,
		private modify: IModify,
	) {}

	public async exec() {
		const salesforceBotUsername: string = await getAppSettingValue(this.read, AppSettingId.SALESFORCE_BOT_USERNAME);
		const { text, editedAt } = this.message;
		const livechatRoom = this.message.room as ILivechatRoom;
		const { type, servedBy, isOpen, customFields: roomCustomFields } = livechatRoom;

		const assoc = getRoomAssoc(this.message.room.id);

		if (text === 'customer_idle_timeout') {
			if (roomCustomFields && roomCustomFields.isHandedOverFromDialogFlow === true) {
				await this.modify.getUpdater().getLivechatUpdater().closeRoom(this.message.room, 'Chat closed due to timeout');
				await updateRoomCustomFields(this.message.room.id, { customerIdleTimeout: true }, this.read, this.modify);
			}
		}

		if (!type || type !== 'l') {
			return;
		}

		if (!isOpen || editedAt || !text) {
			return;
		}

		if (!servedBy || servedBy.username !== salesforceBotUsername) {
			return;
		}

		if (!text || (text && text.trim().length === 0)) {
			return;
		}

		handleTimeout(this.app, this.message, this.read, this.http, this.persistence, this.modify);

		if (this.message?.id) {
			const { salesforceAgentName } = await retrievePersistentData(this.read, assoc);
			const user = await this.read.getUserReader().getByUsername(salesforceBotUsername);
			const msgExtender = this.modify.getExtender().extendMessage(this.message.id, user);
			(await msgExtender).addCustomField('salesforceAgentName', salesforceAgentName);
			await this.modify.getExtender().finish(await msgExtender);
		}

		if (this.message.sender.username === salesforceBotUsername) {
			return;
		}

		const liveAgentSession = new LiveAgentSession(this.app, this.message, this.read, this.modify, this.http, this.persistence);
		await liveAgentSession.exec();
	}
}
