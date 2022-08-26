import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatEventContext } from '@rocket.chat/apps-engine/definition/livechat';
import { RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata/RocketChatAssociations';
import { EventName } from '../../../enum/Analytics';
import { AppSettingId } from '../../../enum/AppSettingId';
import { ErrorLogs } from '../../../enum/ErrorLogs';
import { InfoLogs } from '../../../enum/InfoLogs';
import { SalesforceAgentAssigned } from '../../../handlers/SalesforceAgentAssignedHandler';
import { getEventData } from '../../../lib/Analytics';
import { getAppSettingValue } from '../../../lib/Settings';
import { sendLCMessage } from '../../LivechatMessageHelpers';
import { getError } from '../../Log';
import { retrievePersistentTokens } from '../../PersistenceHelpers';
import { updateRoomCustomFields } from '../../RoomCustomFieldsHelper';
import { pullMessages } from '../../SalesforceAPIHelpers';
import { checkForEvent, getForEvent } from '../../SalesforceMessageHelpers';
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
	) {}

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
				if (response.statusCode === 403) {
					console.error('pullMessages: Chat session is expired.', getError(response));
					console.log(ErrorLogs.LIVEAGENT_SESSION_EXPIRED);
					await checkAgentStatusDirectCallback.checkAgentStatusCallbackError('Chat session is expired.');
					return;
				} else if (response.statusCode === 204 || response.statusCode === 409) {
					// Empty Response from Liveagent
					const { persistentAffinity, persistentKey } = await retrievePersistentTokens(this.read, this.assoc);
					if (persistentAffinity !== null && persistentKey !== null) {
						await this.checkCurrentChatStatus();
					} else {
						await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(this.technicalDifficultyMessage);
						return;
					}
				} else {
					console.log(InfoLogs.SUCCESSFULLY_RECEIVED_LIVEAGENT_RESPONSE, response);
					const { content } = response;
					const contentParsed = JSON.parse(content || '{}');
					const messageArray = contentParsed.messages;

					const isQueueUpdate = checkForEvent(messageArray, 'QueueUpdate');
					if (isQueueUpdate === true) {
						const queueUpdateMessages = messageArray[0].message;
						const queueUpdatePosition = queueUpdateMessages.position;
						if (queueUpdatePosition === 0) {
							const noQueueMessage = this.LANoQueueMessage.replace(/%s/g, queueUpdatePosition);
							await sendLCMessage(this.read, this.modify, this.data.room, noQueueMessage, this.data.agent, true);
						} else if (queueUpdatePosition > 0) {
							const queuePosMessage = this.LAQueuePositionMessage.replace(/%s/g, queueUpdatePosition);
							await sendLCMessage(this.read, this.modify, this.data.room, queuePosMessage, this.data.agent, true);
						}
					}

					const isChatAccepted = checkForEvent(messageArray, 'ChatEstablished');
					if (isChatAccepted === true) {
						//TODO: Add queue_time to analytics
						this.modify.getAnalytics().sendEvent(getEventData(this.data.room.id, EventName.ESCALATION_SUCCESSFUL, { queue_time: '' }));
						console.log(InfoLogs.LIVEAGENT_ACCEPTED_CHAT_REQUEST);
						const chatEstablishedMessage = messageArray[0].message;
						const chasitorIdleTimeout = chatEstablishedMessage.chasitorIdleTimeout || false;
						const sneakPeekEnabled = chatEstablishedMessage.sneakPeekEnabled;
						const { id, persistentAffinity, persistentKey } = await retrievePersistentTokens(this.read, this.assoc);
						const salesforceAgentName = chatEstablishedMessage.name;

						await this.persistence.updateByAssociation(
							this.assoc,
							{
								id,
								affinityToken: persistentAffinity,
								key: persistentKey,
								chasitorIdleTimeout,
								sneakPeekEnabled,
								salesforceAgentName,
							},
							true,
						);

						const salesforceAgentAssigned = new SalesforceAgentAssigned(
							this.app,
							this.data,
							this.read,
							this.http,
							this.persistence,
							this.modify,
						);
						await salesforceAgentAssigned.exec();
						return;
					} else if (isChatAccepted === false) {
						const isChatRequestFail = checkForEvent(messageArray, 'ChatRequestFail');
						const isChatEnded = checkForEvent(messageArray, 'ChatEnded');
						console.error(JSON.stringify(messageArray));
						if (isChatRequestFail === true) {
							console.error(getError(contentParsed));
							if (messageArray[0].message.reason === 'Unavailable') {
								const NoLiveagentAvailableMessage: string = await getAppSettingValue(
									this.read,
									AppSettingId.NO_LIVEAGENT_AGENT_AVAILABLE_MESSAGE,
								);
								this.modify
									.getAnalytics()
									.sendEvent(getEventData(this.data.room.id, EventName.ESCALATION_FAILED_DUE_TO_NO_LIVEAGENT_AVAILABLE));
								await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(NoLiveagentAvailableMessage);
								return;
							}
							await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(this.technicalDifficultyMessage);
							return;
						} else if (isChatEnded === true) {
							const {
								message: { reason: chatEndedReason },
							} = getForEvent(messageArray, 'ChatEnded');
							if (chatEndedReason === 'agent') {
								await updateRoomCustomFields(this.data.room.id, { agentEndedChat: true }, this.read, this.modify);
								this.modify.getAnalytics().sendEvent(getEventData(this.data.room.id, EventName.CHAT_CLOSED_BY_AGENT));
							}
							await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(this.technicalDifficultyMessage);
							return;
						} else {
							const { persistentAffinity, persistentKey } = await retrievePersistentTokens(this.read, this.assoc);
							if (persistentAffinity !== null && persistentKey !== null) {
								await this.checkCurrentChatStatus();
							} else {
								await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(this.technicalDifficultyMessage);
								return;
							}
						}
					} else {
						console.error(ErrorLogs.UNKNOWN_ERROR_IN_CHECKING_AGENT_RESPONSE, response);
						const { persistentAffinity, persistentKey } = await retrievePersistentTokens(this.read, this.assoc);
						if (persistentAffinity !== null && persistentKey !== null) {
							await this.checkCurrentChatStatus();
						} else {
							await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(this.technicalDifficultyMessage);
							return;
						}
					}
				}
			})
			.catch(async (error) => {
				console.error(ErrorLogs.UNKNOWN_ERROR_IN_CHECKING_AGENT_RESPONSE, error);
				await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(this.technicalDifficultyMessage);
				return;
			});
	}
}
