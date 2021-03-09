import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatRoom } from '@rocket.chat/apps-engine/definition/livechat/ILivechatRoom';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { AppSettingId } from '../enum/AppSettingId';
import { LiveAgentSession } from '../handlers/LiveAgentSessionHandler';
import { handleTimeout } from '../helperFunctions/TimeoutHelper';

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
		const salesforceBotUsername: string = (await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.SALESFORCE_BOT_USERNAME)).value;
		const { text, editedAt } = this.message;
		const livechatRoom = this.message.room as ILivechatRoom;
		const { id: rid, type, servedBy, isOpen, customFields } = livechatRoom;

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
		} else if (this.message.room.type !== 'l') {
			return;
		}

		const liveAgentSession = new LiveAgentSession(this.app, this.message, this.read, this.modify, this.http, this.persistence);
		await liveAgentSession.exec();
	}
}
