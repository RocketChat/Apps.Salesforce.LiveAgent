import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatRoom } from '@rocket.chat/apps-engine/definition/livechat/ILivechatRoom';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { AppSettingId } from '../enum/AppSettingId';
import { ErrorLogs } from '../enum/ErrorLogs';
import { InfoLogs } from '../enum/InfoLogs';
import { LiveAgentSession } from '../handlers/LiveAgentSessionHandler';
import { retrievePersistentTokens } from '../helperFunctions/PersistenceHelpers';
import { updateRoomCustomFields } from '../helperFunctions/RoomCustomFieldsHelper';
import { closeChat, getSalesforceChatAPIEndpoint } from '../helperFunctions/SalesforceAPIHelpers';
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
		const { type, servedBy, isOpen } = livechatRoom;

		const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, `SFLAIA-${this.message.room.id}`);
		const { persisantAffinity, persistantKey } = await retrievePersistentTokens(this.read, assoc);
		const salesforceChatApiEndpoint = await getSalesforceChatAPIEndpoint(this.read);

		if ((text === 'Closed by visitor' || text === 'customer_idle_timeout' )
				&& persisantAffinity !== null && persistantKey !== null) {
					let reason = '';
					if (this.message.text === 'customer_idle_timeout' ) {
						reason = 'clientIdleTimeout';
						updateRoomCustomFields(this.message.room.id, {customerIdleTimeout: true}, this.read, this.modify);
					}
				 await closeChat(this.http, salesforceChatApiEndpoint, persisantAffinity, persistantKey, reason)
					.then(async () => {
						console.log(InfoLogs.LIVEAGENT_SESSION_CLOSED);
						await this.persistence.removeByAssociation(assoc);
					})
					.catch((error) => {
						console.error(ErrorLogs.CLOSING_LIVEAGENT_SESSION_ERROR, error);
					});
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

		if (this.message.sender.username === salesforceBotUsername) {
			return;
		}

		const liveAgentSession = new LiveAgentSession(this.app, this.message, this.read, this.modify, this.http, this.persistence);
		await liveAgentSession.exec();
	}
}
