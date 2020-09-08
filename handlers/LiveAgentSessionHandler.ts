import { IHttp, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatRoom } from '@rocket.chat/apps-engine/definition/livechat/ILivechatRoom';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { AppSettingId } from '../enum/AppSettingId';
import { ErrorLogs } from '../enum/ErrorLogs';
import { InfoLogs } from '../enum/InfoLogs';
import { retrievePersistentTokens } from '../helperFunctions/PersistenceHelpers';
import { closeChat, sendMessages } from '../helperFunctions/SalesforceAPIHelpers';

export class LiveAgentSession {
	constructor(private app: IApp, private message: IMessage, private read: IRead, private http: IHttp, private persistence: IPersistence) {}

	public async exec() {
		try {
			const salesforceBotUsername: string = (await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.SALESFORCE_BOT_USERNAME)).value;
			if (this.message.sender.username === salesforceBotUsername || this.message.text === 'initiate_salesforce_session') {
				return;
			}

			let salesforceChatApiEndpoint: string = (await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.SALESFORCE_CHAT_API_ENDPOINT))
				.value;
			try {
				salesforceChatApiEndpoint = salesforceChatApiEndpoint.replace(/\/?$/, '/');
			} catch (error) {
				console.log(ErrorLogs.SALESFORCE_CHAT_API_NOT_FOUND);
				return;
			}

			const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, `SFLAIA-${this.message.room.id}`);
			const { persisantAffinity, persistantKey } = await retrievePersistentTokens(this.read, assoc);

			if (this.message.text === 'Closed by visitor' && persisantAffinity !== null && persistantKey !== null) {
				await closeChat(this.http, salesforceChatApiEndpoint, persisantAffinity, persistantKey)
					.then(async () => {
						console.log(InfoLogs.LIVEAGENT_SESSION_CLOSED);
						await this.persistence.removeByAssociation(assoc);
					})
					.catch((error) => {
						console.log(ErrorLogs.CLOSING_LIVEAGENT_SESSION_ERROR, error);
					});
			}

			if (this.message.text !== 'Closed by visitor' && persisantAffinity !== null && persistantKey !== null) {
				const lroom: ILivechatRoom = this.message.room as ILivechatRoom;
				const LcAgent: IUser = lroom.servedBy ? lroom.servedBy : this.message.sender;

				if (LcAgent.username !== salesforceBotUsername) {
					return;
				}

				let messageText = '';
				if (this.message.text) {
					messageText = this.message.text;
				}
				await sendMessages(this.http, salesforceChatApiEndpoint, persisantAffinity, persistantKey, messageText)
					.then(() => {
						console.log(InfoLogs.MESSAGE_SENT_TO_LIVEAGENT);
					})
					.catch((error) => {
						console.log(ErrorLogs.SENDING_MESSAGE_TO_LIVEAGENT_ERROR, error);
					});
			}
		} catch (error) {
			console.log(ErrorLogs.LIVEAGENT_SESSION_CLASS_FAILED, error);
		}
	}
}
