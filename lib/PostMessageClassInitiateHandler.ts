import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatMessage, ILivechatRoom } from '@rocket.chat/apps-engine/definition/livechat';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { AppSettingId } from '../enum/AppSettingId';
import { InitiateSalesforceSession } from '../handlers/InitiateSalesforceSessionHandler';
import { LiveAgentSession } from '../handlers/LiveAgentSessionHandler';

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
		if (this.message.sender.username === salesforceBotUsername) {
			return;
		} else if (this.message.room.type !== 'l') {
			return;
		}

		const lmessage: ILivechatMessage = this.message;
		const lroom: ILivechatRoom = lmessage.room as ILivechatRoom;
		const LcAgent: IUser = lroom.servedBy ? lroom.servedBy : this.message.sender;

		if (this.message.text === 'initiate_salesforce_session') {
			const initiateSalesforceSession = new InitiateSalesforceSession(this.app, this.message, this.read, this.http, this.persistence, this.modify);
			await initiateSalesforceSession.exec();
		}

		if (LcAgent.username === salesforceBotUsername) {
			const liveAgentSession = new LiveAgentSession(this.app, this.message, this.read, this.http, this.persistence);
			await liveAgentSession.exec();
		}
	}
}
