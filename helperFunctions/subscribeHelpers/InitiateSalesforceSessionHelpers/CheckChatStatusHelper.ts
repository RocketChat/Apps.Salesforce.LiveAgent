import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { Logs } from '../../../enum/Logs';
import { sendLCMessage } from '../../LivechatMessageHelpers';
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
		private id: string,
		private affinityToken: string,
		private key: string,
		private targetDeptName: string,
		private LcAgent: IUser,
		private LAQueueEmptyMessage: string,
		private LAQueuePositionMessage: string,
		private technicalDifficultyMessage: string,
	) {}

	public async checkCurrentChatStatus() {
		pullMessages(this.http, this.salesforceChatApiEndpoint, this.affinityToken, this.key)
			.then(async (response) => {
				if (response.statusCode === 403) {
					console.log(Logs.ERROR_LIVEAGENT_SESSION_EXPIRED);
					await checkAgentStatusCallbackError('Chat session expired.', this.modify, this.message, this.LcAgent);
					return;
				} else if (response.statusCode === 204 || response.statusCode === 409) {
					// Empty Response from Liveagent
					await this.checkCurrentChatStatus();
				} else {
					console.log(Logs.SUCCESSFULLY_RECIEVED_LIVEAGENT_RESPONSE, response);
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
						console.log(Logs.LIVEAGENT_SESSION_CLOSED);
						await checkAgentStatusCallbackData(
							this.app,
							this.modify,
							this.message,
							this.LcAgent,
							response,
							this.http,
							this.persistence,
							this.read,
							this.rocketChatServerUrl,
							this.salesforceBotUsername,
							this.salesforceBotPassword,
							this.id,
							this.affinityToken,
							this.key,
							this.targetDeptName,
							this.technicalDifficultyMessage,
						);
						return;
					} else if (isChatAccepted === false) {
						const isChatRequestFail = checkForEvent(messageArray, 'ChatRequestFail');
						const isChatEnded = checkForEvent(messageArray, 'ChatEnded');
						if (isChatRequestFail === true || isChatEnded === true) {
							await checkAgentStatusCallbackError(this.technicalDifficultyMessage, this.modify, this.message, this.LcAgent);
							return;
						} else {
							await this.checkCurrentChatStatus();
						}
					} else {
						console.log(Logs.ERROR_UNKNOWN_IN_CHECKING_AGENT_RESPONSE, response);
						await this.checkCurrentChatStatus();
					}
				}
			})
			.catch(async (error) => {
				console.log(Logs.ERROR_UNKNOWN_IN_CHECKING_AGENT_RESPONSE, error);
				await checkAgentStatusCallbackError(this.technicalDifficultyMessage, this.modify, this.message, this.LcAgent);
				return;
			});
	}
}
