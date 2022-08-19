import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatEventContext } from '@rocket.chat/apps-engine/definition/livechat';
import { RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { ErrorLogs } from '../../../enum/ErrorLogs';
import { InfoLogs } from '../../../enum/InfoLogs';
import { retrievePersistentTokens } from '../../PersistenceHelpers';
import { updateRoomCustomFields } from '../../RoomCustomFieldsHelper';
import { pullMessages } from '../../SalesforceAPIHelpers';
import { checkForEvent, messageFilter, getForEvent } from '../../SalesforceMessageHelpers';
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
		private LAChatEndedMessage: string,
		private technicalDifficultyMessage: string,
		private persistentAffinity: string,
		private persistentKey: string,
	) {}

	public async subscribeToLiveAgent() {
		const handleEndChatCallback = new HandleEndChatCallback(
			this.app,
			this.modify,
			this.data,
			this.read,
			this.persistence,
			this.LAChatEndedMessage,
			this.assoc,
			this.technicalDifficultyMessage,
		);
		await pullMessages(this.http, this.salesforceChatApiEndpoint, this.persistentAffinity, this.persistentKey)
			.then(async (response) => {
				if (response.statusCode === 403) {
					console.log(ErrorLogs.LIVEAGENT_SESSION_EXPIRED);
					await handleEndChatCallback.handleEndChat();
					return;
				} else if (response.statusCode === 204 || response.statusCode === 409) {
					const { persistentAffinity, persistentKey } = await retrievePersistentTokens(this.read, this.assoc);
					if (persistentAffinity !== null && persistentKey !== null) {
						await this.subscribeToLiveAgent();
					} else {
						console.log(ErrorLogs.LIVEAGENT_SESSION_EXPIRED);
						await handleEndChatCallback.handleEndChat();
						return;
					}
				} else {
					console.log(InfoLogs.SUCCESSFULLY_RECEIVED_LIVEAGENT_RESPONSE, response);
					const { content } = response;
					const contentParsed = JSON.parse(content || '{}');
					const messageArray = contentParsed.messages;
					const isEndChat = checkForEvent(messageArray, 'ChatEnded');

					if (isEndChat === true) {
						console.log(InfoLogs.LIVEAGENT_SESSION_CLOSED);
						const {
							message: { reason: chatEndedReason },
						} = getForEvent(messageArray, 'ChatEnded');
						if (chatEndedReason === 'agent') {
							await updateRoomCustomFields(this.data.room.id, { agentEndedChat: true }, this.read, this.modify);
						}
						await handleEndChatCallback.handleEndChat();
					} else {
						await messageFilter(this.modify, this.read, this.persistence, this.data.room, this.data.agent, this.assoc, messageArray);
						const { persistentAffinity, persistentKey } = await retrievePersistentTokens(this.read, this.assoc);
						if (persistentAffinity !== null && persistentKey !== null) {
							await this.subscribeToLiveAgent();
						} else {
							console.log(ErrorLogs.LIVEAGENT_SESSION_EXPIRED);
							await handleEndChatCallback.handleEndChat();
							return;
						}
					}
				}
			})
			.catch(async (error) => {
				console.error(ErrorLogs.UNKNOWN_ERROR_IN_CHECKING_AGENT_RESPONSE, error);
				await handleEndChatCallback.handleEndChat();
				return;
			});
	}
}
