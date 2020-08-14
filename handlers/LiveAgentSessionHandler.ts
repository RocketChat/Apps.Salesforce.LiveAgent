import { IHttp, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { Logs } from '../enum/Logs';
import { retrievePersistentTokens } from '../helperFunctions/PersistenceHelpers';
import { closeChat, sendMessages } from '../helperFunctions/SalesforceAPIHelpers';

export class LiveAgentSession {
	constructor(private app: IApp, private message: IMessage, private read: IRead, private http: IHttp, private persistence: IPersistence) {}

	public async exec() {
		try {
			const salesforceBotUsername: string = (await this.read.getEnvironmentReader().getSettings().getById('salesforce_bot_username')).value;
			if (this.message.sender.username === salesforceBotUsername || this.message.text === 'initiate_salesforce_session') {
				return;
			}

			let salesforceChatApiEndpoint: string = (await this.read.getEnvironmentReader().getSettings().getById('salesforce_chat_api_endpoint')).value;
			try {
				salesforceChatApiEndpoint = salesforceChatApiEndpoint.replace(/\/?$/, '/');
			} catch (error) {
				console.log(Logs.ERROR_SALESFORCE_CHAT_API_NOT_FOUND);
				return;
			}

			const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.ROOM, this.message.room.id);
			const { persisantAffinity, persistantKey } = await retrievePersistentTokens(this.read, assoc);

			if (this.message.text === 'Closed by visitor' && persisantAffinity !== null && persistantKey !== null) {
				await closeChat(this.http, salesforceChatApiEndpoint, persisantAffinity, persistantKey)
					.then(async () => {
						console.log(Logs.LIVEAGENT_SESSION_CLOSED);
						await this.persistence.removeByAssociation(assoc);
					})
					.catch((error) => {
						console.log(Logs.ERROR_CLOSING_LIVEAGENT_SESSION, error);
					});
			}

			if (this.message.text !== 'Closed by visitor' && persisantAffinity !== null && persistantKey !== null) {
				let messageText = '';
				if (this.message.text) {
					messageText = this.message.text;
				}
				await sendMessages(this.http, salesforceChatApiEndpoint, persisantAffinity, persistantKey, messageText)
					.then(() => {
						console.log(Logs.MESSAGE_SENT_TO_LIVEAGENT);
					})
					.catch((error) => {
						console.log(Logs.ERROR_SENDING_MESSAGE_TO_LIVEAGENT, error);
					});
			}
		} catch (error) {
			console.log(Logs.ERROR_IN_LIVEAGENT_SESSION_CLASS, error);
		}
	}
}
