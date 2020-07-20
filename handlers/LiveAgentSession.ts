import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { retrievePersistentTokens } from '../helperFunctions/GeneralHelpers';
import { SalesforceHelpers } from '../helperFunctions/SalesforceHelpers';

export class LiveAgentSession {
	constructor(private message: IMessage, private read: IRead, private http: IHttp, private persistence: IPersistence, private modify: IModify) {}

	public async exec() {
		try {
			let salesforceChatApiEndpoint: string = (await this.read.getEnvironmentReader().getSettings().getById('salesforce_chat_api_endpoint')).value;
			salesforceChatApiEndpoint = salesforceChatApiEndpoint.replace(/\/?$/, '/');

			const salesforceBotUsername: string = (await this.read.getEnvironmentReader().getSettings().getById('salesforce_bot_username')).value;

			if (this.message.sender.username === salesforceBotUsername || this.message.text === 'initiate_salesforce_session') {
				return;
			}

			const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.ROOM, this.message.room.id);

			const { persisantAffinity, persistantKey } = await retrievePersistentTokens(this.read, assoc);

			const salesforceHelpers: SalesforceHelpers = new SalesforceHelpers();

			if (this.message.text === 'Closed by visitor' && persisantAffinity && persistantKey) {
				await salesforceHelpers
					.closeChat(this.http, salesforceChatApiEndpoint, persisantAffinity, persistantKey)
					.then(async (res) => {
						console.log('Closing Liveagent Chat, Response:', res);
						await this.persistence.removeByAssociation(assoc);
					})
					.catch((error) => {
						console.log('Closing Liveagent Chat, Error:', error);
					});
			}

			if (this.message.text !== 'Closed by visitor' && persisantAffinity && persistantKey) {
				let messageText = '';
				if (this.message.text) {
					messageText = this.message.text;
				}
				await salesforceHelpers
					.sendMessages(this.http, salesforceChatApiEndpoint, persisantAffinity, persistantKey, messageText)
					.then((res) => {
						console.log('Sending Message To Liveagent, Response:', res);
					})
					.catch((error) => {
						console.log('Sending Message To Liveagent, Error:', error);
					});
			}
		} catch (error) {
			console.log('Handling Live Agent Session, Error: ', error);
		}
	}
}
