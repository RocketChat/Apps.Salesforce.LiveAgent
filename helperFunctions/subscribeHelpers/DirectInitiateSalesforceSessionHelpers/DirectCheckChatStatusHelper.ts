import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatEventContext } from '@rocket.chat/apps-engine/definition/livechat';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata/RocketChatAssociations';
import { ErrorLogs } from '../../../enum/ErrorLogs';
import { InfoLogs } from '../../../enum/InfoLogs';
import { SalesforceAgentAssigned } from '../../../handlers/SalesforceAgentAssignedHandler';
import { sendLCMessage } from '../../LivechatMessageHelpers';
import { pullMessages } from '../../SalesforceAPIHelpers';
import { checkForEvent } from '../../SalesforceMessageHelpers';
import { CheckAgentStatusDirectCallback } from './DirectCheckAgentStatusCallback';

export class CheckChatStatusDirect {
	constructor(
		private app: IApp,
		private http: IHttp,
		private modify: IModify,
		private persistence: IPersistence,
		private data: ILivechatEventContext,
		private read: IRead,
		private salesforceChatApiEndpoint: string,
		private id: string,
		private affinityToken: string,
		private key: string,
		private LAQueueEmptyMessage: string,
		private LAQueuePositionMessage: string,
		private technicalDifficultyMessage: string,
	) {}

	public async checkCurrentChatStatus() {
		const checkAgentStatusDirectCallback = new CheckAgentStatusDirectCallback(
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
					console.log(ErrorLogs.LIVEAGENT_SESSION_EXPIRED);
					await checkAgentStatusDirectCallback.checkAgentStatusCallbackError('Chat session expired.');
					return;
				} else if (response.statusCode === 204 || response.statusCode === 409) {
					// Empty Response from Liveagent
					await this.checkCurrentChatStatus();
				} else {
					console.log(InfoLogs.SUCCESSFULLY_RECIEVED_LIVEAGENT_RESPONSE, response);
					const { content } = response;
					const contentParsed = JSON.parse(content || '{}');
					const messageArray = contentParsed.messages;

					const isQueueUpdate = checkForEvent(messageArray, 'QueueUpdate');
					if (isQueueUpdate === true) {
						const queueUpdateMessages = messageArray[0].message;
						const queueUpdatePosition = queueUpdateMessages.position;
						if (queueUpdatePosition === 1) {
							const queueEmptyMessage = this.LAQueueEmptyMessage.replace(/%s/g, queueUpdatePosition);
							await sendLCMessage(this.modify, this.data.room, queueEmptyMessage, this.data.agent);
						} else if (queueUpdatePosition > 1) {
							const queuePosMessage = this.LAQueuePositionMessage.replace(/%s/g, queueUpdatePosition);
							await sendLCMessage(this.modify, this.data.room, queuePosMessage, this.data.agent);
						}
					}

					const isChatAccepted = checkForEvent(messageArray, 'ChatEstablished');
					if (isChatAccepted === true) {
						console.log(InfoLogs.LIVEAGENT_ACCEPTED_CHAT_REQUEST);

						const sessionTokens = { id: this.id, affinityToken: this.affinityToken, key: this.key };
						const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.ROOM, this.data.room.id);
						await this.persistence.createWithAssociation(sessionTokens, assoc);

						const salesforceAgentAssigned = new SalesforceAgentAssigned(this.app, this.data, this.read, this.http, this.persistence, this.modify);
						await salesforceAgentAssigned.exec();
						return;
					} else if (isChatAccepted === false) {
						const isChatRequestFail = checkForEvent(messageArray, 'ChatRequestFail');
						const isChatEnded = checkForEvent(messageArray, 'ChatEnded');
						if (isChatRequestFail === true) {
							if (messageArray[0].message.reason === 'Unavailable') {
								const NoLiveagentAvailableMessage: string = (
									await this.read.getEnvironmentReader().getSettings().getById('la_no_liveagent_available')
								).value;
								await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(NoLiveagentAvailableMessage);
								return;
							}
							await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(this.technicalDifficultyMessage);
							return;
						} else if (isChatEnded === true) {
							await checkAgentStatusDirectCallback.checkAgentStatusCallbackError(this.technicalDifficultyMessage);
							return;
						} else {
							await this.checkCurrentChatStatus();
						}
					} else {
						console.log(ErrorLogs.UNKNOWN_ERROR_IN_CHECKING_AGENT_RESPONSE, response);
						await this.checkCurrentChatStatus();
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
