import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { AppSettingId } from '../../../enum/AppSettingId';
import { ErrorLogs } from '../../../enum/ErrorLogs';
import { InfoLogs } from '../../../enum/InfoLogs';
import { sendLCMessage } from '../../LivechatMessageHelpers';
import { retrievePersistentTokens } from '../../PersistenceHelpers';
import { pullMessages } from '../../SalesforceAPIHelpers';
import { checkForEvent } from '../../SalesforceMessageHelpers';
import { checkAgentStatusCallbackData, checkAgentStatusCallbackError } from './CheckAgentStatusCallback';

export class CheckChatStatus {
	constructor(
		private app: IApp,
		private http: IHttp,
		private modify: IModify,
		private persistence: IPersistence,
		private message: IMessage,
		private read: IRead,
		private salesforceChatApiEndpoint: string,
		private rocketChatServerUrl: string,
		private salesforceBotUsername: string,
		private salesforceBotPassword: string,
		private affinityToken: string,
		private key: string,
		private targetDeptName: string,
		private LcAgent: IUser,
		private LAQueueEmptyMessage: string,
		private LAQueuePositionMessage: string,
		private technicalDifficultyMessage: string,
		private assoc: RocketChatAssociationRecord,
	) {}

	public async checkCurrentChatStatus() {
		pullMessages(this.http, this.salesforceChatApiEndpoint, this.affinityToken, this.key)
			.then(async (response) => {
				if (response.statusCode === 403) {
					console.log(ErrorLogs.LIVEAGENT_SESSION_EXPIRED);
					await checkAgentStatusCallbackError('Chat session expired.', this.modify, this.persistence, this.message, this.LcAgent, this.assoc);
					return;
				} else if (response.statusCode === 204 || response.statusCode === 409) {
					// Empty Response from Liveagent
					const { persisantAffinity, persistantKey } = await retrievePersistentTokens(this.read, this.assoc);
					if (persisantAffinity !== null && persistantKey !== null) {
						await this.checkCurrentChatStatus();
					} else {
						await checkAgentStatusCallbackError(this.technicalDifficultyMessage, this.modify, this.persistence, this.message, this.LcAgent, this.assoc);
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
						if (queueUpdatePosition === 1) {
							const queueEmptyMessage = this.LAQueueEmptyMessage.replace(/%s/g, queueUpdatePosition);
							await sendLCMessage(this.modify, this.message.room, queueEmptyMessage, this.LcAgent);
						} else if (queueUpdatePosition > 1) {
							const queuePosMessage = this.LAQueuePositionMessage.replace(/%s/g, queueUpdatePosition);
							await sendLCMessage(this.modify, this.message.room, queuePosMessage, this.LcAgent);
						}
					}

					const isChatAccepted = checkForEvent(messageArray, 'ChatEstablished');
					if (isChatAccepted === true) {
						console.log(InfoLogs.LIVEAGENT_SESSION_CLOSED);
						await checkAgentStatusCallbackData(
							this.app,
							this.modify,
							this.persistence,
							this.message,
							this.LcAgent,
							response,
							this.http,
							this.read,
							this.rocketChatServerUrl,
							this.salesforceBotUsername,
							this.salesforceBotPassword,
							this.targetDeptName,
							this.technicalDifficultyMessage,
							this.assoc,
						);
						return;
					} else if (isChatAccepted === false) {
						const isChatRequestFail = checkForEvent(messageArray, 'ChatRequestFail');
						const isChatEnded = checkForEvent(messageArray, 'ChatEnded');
						if (isChatRequestFail === true) {
							if (messageArray[0].message.reason === 'Unavailable') {
								const NoLiveagentAvailableMessage: string = (
									await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.NO_LIVEAGENT_AGENT_AVAILABLE_MESSAGE)
								).value;
								await checkAgentStatusCallbackError(NoLiveagentAvailableMessage, this.modify, this.persistence, this.message, this.LcAgent, this.assoc);
								return;
							}
							await checkAgentStatusCallbackError(this.technicalDifficultyMessage, this.modify, this.persistence, this.message, this.LcAgent, this.assoc);
							return;
						} else if (isChatEnded === true) {
							await checkAgentStatusCallbackError(this.technicalDifficultyMessage, this.modify, this.persistence, this.message, this.LcAgent, this.assoc);
							return;
						} else {
							const { persisantAffinity, persistantKey } = await retrievePersistentTokens(this.read, this.assoc);
							if (persisantAffinity !== null && persistantKey !== null) {
								await this.checkCurrentChatStatus();
							} else {
								await checkAgentStatusCallbackError(this.technicalDifficultyMessage, this.modify, this.persistence, this.message, this.LcAgent, this.assoc);
								return;
							}
						}
					} else {
						console.log(ErrorLogs.UNKNOWN_ERROR_IN_CHECKING_AGENT_RESPONSE, response);
						const { persisantAffinity, persistantKey } = await retrievePersistentTokens(this.read, this.assoc);
						if (persisantAffinity !== null && persistantKey !== null) {
							await this.checkCurrentChatStatus();
						} else {
							await checkAgentStatusCallbackError(this.technicalDifficultyMessage, this.modify, this.persistence, this.message, this.LcAgent, this.assoc);
							return;
						}
					}
				}
			})
			.catch(async (error) => {
				console.log(ErrorLogs.UNKNOWN_ERROR_IN_CHECKING_AGENT_RESPONSE, error);
				await checkAgentStatusCallbackError(this.technicalDifficultyMessage, this.modify, this.persistence, this.message, this.LcAgent, this.assoc);
				return;
			});
	}
}
