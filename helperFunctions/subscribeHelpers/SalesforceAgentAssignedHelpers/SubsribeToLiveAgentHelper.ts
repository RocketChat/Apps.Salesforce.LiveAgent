import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatEventContext } from '@rocket.chat/apps-engine/definition/livechat';
import { RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { Logs } from '../../../enum/Logs';
import { retrievePersistentTokens } from '../../GeneralHelpers';
import { pullMessages } from '../../SalesforceAPIHelpers';
import { checkForEvent, messageFilter } from '../../SalesforceMessageHelpers';
import { HandleEndChatCallback } from './HandleEndChatCallback';

export class SubscribeToLiveAgent {
	constructor(
		private app: IApp,
		private read: IRead,
		private http: IHttp,
		private modify: IModify,
		private persistence: IPersistence,
		private data: ILivechatEventContext,
		private assoc: RocketChatAssociationRecord,
		private salesforceChatApiEndpoint: string,
		private rocketChatServerUrl: string,
		private LAChatEndedMessage: string,
		private technicalDifficultyMessage: string,
		private persisantAffinity: string,
		private persistantKey: string,
	) {}

	public async subscribeToLiveAgent() {
		const handleEndChatCallback = new HandleEndChatCallback(
			this.app,
			this.modify,
			this.data,
			this.read,
			this.persistence,
			this.http,
			this.LAChatEndedMessage,
			this.assoc,
			this.rocketChatServerUrl,
			this.technicalDifficultyMessage,
		);
		await pullMessages(this.http, this.salesforceChatApiEndpoint, this.persisantAffinity, this.persistantKey)
			.then(async (response) => {
				if (response.statusCode === 403) {
					console.log(Logs.ERROR_LIVEAGENT_SESSION_EXPIRED);
					await handleEndChatCallback.handleEndChat();
					return;
				} else if (response.statusCode === 204 || response.statusCode === 409) {
					const { persisantAffinity, persistantKey } = await retrievePersistentTokens(this.read, this.assoc);
					if (persisantAffinity !== null && persistantKey !== null) {
						await this.subscribeToLiveAgent();
					} else {
						console.log(Logs.ERROR_LIVEAGENT_SESSION_EXPIRED);
						await handleEndChatCallback.handleEndChat();
						return;
					}
				} else {
					console.log(Logs.SUCCESSFULLY_RECIEVED_LIVEAGENT_RESPONSE, response);
					const { content } = response;
					const contentParsed = JSON.parse(content || '{}');
					const messageArray = contentParsed.messages;
					const isEndChat = checkForEvent(messageArray, 'ChatEnded');

					if (isEndChat === true) {
						console.log(Logs.LIVEAGENT_SESSION_CLOSED);
						await handleEndChatCallback.handleEndChat();
					} else {
						await messageFilter(this.app, this.modify, this.read, this.data.room, this.data.agent, messageArray);
						const { persisantAffinity, persistantKey } = await retrievePersistentTokens(this.read, this.assoc);
						if (persisantAffinity !== null && persistantKey !== null) {
							await this.subscribeToLiveAgent();
						} else {
							console.log(Logs.ERROR_LIVEAGENT_SESSION_EXPIRED);
							await handleEndChatCallback.handleEndChat();
							return;
						}
					}
				}
			})
			.catch(async (error) => {
				console.log(Logs.ERROR_UNKNOWN_IN_CHECKING_AGENT_RESPONSE, error);
				await handleEndChatCallback.handleEndChat();
				return;
			});
	}
}
