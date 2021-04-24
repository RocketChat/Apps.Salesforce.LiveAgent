import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatEventContext } from '@rocket.chat/apps-engine/definition/livechat';
import { RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata/RocketChatAssociations';
import { AppSettingId } from '../../../enum/AppSettingId';
import { ErrorLogs } from '../../../enum/ErrorLogs';
import { InfoLogs } from '../../../enum/InfoLogs';
import { SalesforceAgentAssigned } from '../../../handlers/SalesforceAgentAssignedHandler';
import { getAppSettingValue } from '../../../lib/Settings';
import { sendLCMessage } from '../../LivechatMessageHelpers';
import { retrievePersistentTokens } from '../../PersistenceHelpers';
import { pullMessages } from '../../SalesforceAPIHelpers';
import { checkForEvent } from '../../SalesforceMessageHelpers';
import { CheckAgentStatusCallback } from './CheckAgentStatusCallback';

export class CheckChatStatus {
	constructor(
		private app: IApp,
		private http: IHttp,
		private modify: IModify,
		private persistence: IPersistence,
		private data: ILivechatEventContext,
		private read: IRead,
		private salesforceChatApiEndpoint: string,
		private affinityToken: string,
		private key: string,
		private LANoQueueMessage: string,
		private LAQueuePositionMessage: string,
		private technicalDifficultyMessage: string,
		private assoc: RocketChatAssociationRecord,
	) { }

	public async checkCurrentChatStatus() {
		const checkAgentStatusDirectCallback = new CheckAgentStatusCallback(
			this.app,
			this.http,
			this.modify,
			this.persistence,
			this.data,
			this.read,
			this.technicalDifficultyMessage,
		);
		pullMessages(this.http, this.salesforceChatApiEndpoint, this.affinityToken, this.key)
			.then(async (response) => {
				console.log(response)
				if (response.statusCode === 403) {
					console.log(ErrorLogs.LIVEAGENT_SESSION_EXPIRED);
					await checkAgentStatusDirectCallback.checkAgentStatusCallbackError('Chat session expired.');
					return;
				} else if (response.statusCode === 204 || response.statusCode === 409) {
					// Empty Response from Liveagent
					const { persisantAffinity, persistantKey } = await retrievePersistentTokens(this.read, this.assoc);
					if (persisantAffinity !== null && persistantKey !== null) {
						await this.checkCurrentChatStatus();
					} else {
						await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(this.technicalDifficultyMessage);
						return;
					}
				} else {
					console.log(InfoLogs.SUCCESSFULLY_RECIEVED_LIVEAGENT_RESPONSE, response);
					const { content } = response;
					const contentParsed = JSON.parse(content || '{}');
					const messageArray = contentParsed.messages;

					const isQueueUpdate = checkForEvent(messageArray, 'QueueUpdate');
					if (isQueueUpdate === true) {
						const queueUpdateMessages = messageArray[0].message;
						const queueUpdatePosition = queueUpdateMessages.position;
						if (queueUpdatePosition === 0) {
							const noQueueMessage = this.LANoQueueMessage.replace(/%s/g, queueUpdatePosition);
							await sendLCMessage(this.modify, this.data.room, noQueueMessage, this.data.agent, true);
						} else if (queueUpdatePosition > 0) {
							const queuePosMessage = this.LAQueuePositionMessage.replace(/%s/g, queueUpdatePosition);
							await sendLCMessage(this.modify, this.data.room, queuePosMessage, this.data.agent, true);
						}
					}

					const isChatAccepted = checkForEvent(messageArray, 'ChatEstablished');
					if (isChatAccepted === true) {
						console.log(InfoLogs.LIVEAGENT_ACCEPTED_CHAT_REQUEST);
						const chatEstablishedMessage = messageArray[0].message;
						const chasitorIdleTimeout = chatEstablishedMessage.chasitorIdleTimeout || false;
						const sneakPeekEnabled = chatEstablishedMessage.sneakPeekEnabled;
						const { id, persisantAffinity, persistantKey } = await retrievePersistentTokens(this.read, this.assoc);
						const salesforceAgentName = chatEstablishedMessage.name;

						await this.persistence.updateByAssociation(this.assoc,
							{ id, affinityToken: persisantAffinity, key: persistantKey, chasitorIdleTimeout, sneakPeekEnabled, salesforceAgentName });

						const salesforceAgentAssigned = new SalesforceAgentAssigned(this.app, this.data, this.read, this.http, this.persistence, this.modify);
						await salesforceAgentAssigned.exec();
						return;
					} else if (isChatAccepted === false) {
						const isChatRequestFail = checkForEvent(messageArray, 'ChatRequestFail');
						const isChatEnded = checkForEvent(messageArray, 'ChatEnded');
						if (isChatRequestFail === true) {
							if (messageArray[0].message.reason === 'Unavailable') {
								const NoLiveagentAvailableMessage: string = await getAppSettingValue(this.read, AppSettingId.NO_LIVEAGENT_AGENT_AVAILABLE_MESSAGE);
								await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(NoLiveagentAvailableMessage);
								return;
							}
							await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(this.technicalDifficultyMessage);
							return;
						} else if (isChatEnded === true) {
							await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(this.technicalDifficultyMessage);
							return;
						} else {
							const { persisantAffinity, persistantKey } = await retrievePersistentTokens(this.read, this.assoc);
							if (persisantAffinity !== null && persistantKey !== null) {
								await this.checkCurrentChatStatus();
							} else {
								await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(this.technicalDifficultyMessage);
								return;
							}
						}
					} else {
						console.log(ErrorLogs.UNKNOWN_ERROR_IN_CHECKING_AGENT_RESPONSE, response);
						const { persisantAffinity, persistantKey } = await retrievePersistentTokens(this.read, this.assoc);
						if (persisantAffinity !== null && persistantKey !== null) {
							await this.checkCurrentChatStatus();
						} else {
							await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(this.technicalDifficultyMessage);
							return;
						}
					}
				}
			})
			.catch(async (error) => {
				console.log(ErrorLogs.UNKNOWN_ERROR_IN_CHECKING_AGENT_RESPONSE, error);
				await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(this.technicalDifficultyMessage);
				return;
			});
	}
}
