import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { IVisitor } from '@rocket.chat/apps-engine/definition/livechat';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { Logs } from '../../enum/Logs';
import { sendLCMessage } from '../GeneralHelpers';
import { pullMessages } from '../SalesforceAPIHelpers';
import { checkForEvent } from '../SalesforceMessageHelpers';
import { checkAgentStatusCallbackData, checkAgentStatusCallbackError } from './CheckAgentStatusCallback';

export async function checkCurrentChatStatus(
	app: IApp,
	http: IHttp,
	modify: IModify,
	persistence: IPersistence,
	message: IMessage,
	read: IRead,
	salesforceChatApiEndpoint: string,
	rocketChatServerUrl: string,
	salesforceBotUsername: string,
	salesforceBotPassword: string,
	id: string,
	affinityToken: string,
	key: string,
	targetDeptName: string,
	LcAgent: IUser,
	LAQueueEmptyMessage: string,
	LAQueuePositionMessage: string,
	technicalDifficultyMessage: string,
	LcVisitor: IVisitor,
) {
	pullMessages(http, salesforceChatApiEndpoint, affinityToken, key)
		.then(async (response) => {
			if (response.statusCode === 403) {
				console.log(Logs.ERROR_LIVEAGENT_SESSION_EXPIRED);
				checkAgentStatusCallbackError('Chat session expired.', modify, message, LcAgent);
				return;
			} else if (response.statusCode === 204 || response.statusCode === 409) {
				// Empty Response from Liveagent
				await checkCurrentChatStatus(
					app,
					http,
					modify,
					persistence,
					message,
					read,
					salesforceChatApiEndpoint,
					rocketChatServerUrl,
					salesforceBotUsername,
					salesforceBotPassword,
					id,
					affinityToken,
					key,
					targetDeptName,
					LcAgent,
					LAQueueEmptyMessage,
					LAQueuePositionMessage,
					technicalDifficultyMessage,
					LcVisitor,
				);
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
						const queueEmptyMessage = LAQueueEmptyMessage.replace(/%s/g, queueUpdatePosition);
						await sendLCMessage(modify, message.room, queueEmptyMessage, LcAgent);
					} else if (queueUpdatePosition > 1) {
						const queuePosMessage = LAQueuePositionMessage.replace(/%s/g, queueUpdatePosition);
						await sendLCMessage(modify, message.room, queuePosMessage, LcAgent);
					}
				}

				const isChatAccepted = checkForEvent(messageArray, 'ChatEstablished');
				if (isChatAccepted === true) {
					console.log(Logs.LIVEAGENT_SESSION_CLOSED);
					checkAgentStatusCallbackData(
						app,
						modify,
						message,
						LcAgent,
						response,
						http,
						persistence,
						read,
						rocketChatServerUrl,
						salesforceBotUsername,
						salesforceBotPassword,
						id,
						affinityToken,
						key,
						targetDeptName,
						LcVisitor,
						technicalDifficultyMessage,
					);
					return;
				} else if (isChatAccepted === false) {
					const isChatRequestFail = checkForEvent(messageArray, 'ChatRequestFail');
					const isChatEnded = checkForEvent(messageArray, 'ChatEnded');
					if (isChatRequestFail === true || isChatEnded === true) {
						checkAgentStatusCallbackError(technicalDifficultyMessage, modify, message, LcAgent);
						return;
					} else {
						await checkCurrentChatStatus(
							app,
							http,
							modify,
							persistence,
							message,
							read,
							salesforceChatApiEndpoint,
							rocketChatServerUrl,
							salesforceBotUsername,
							salesforceBotPassword,
							id,
							affinityToken,
							key,
							targetDeptName,
							LcAgent,
							LAQueueEmptyMessage,
							LAQueuePositionMessage,
							technicalDifficultyMessage,
							LcVisitor,
						);
					}
				} else {
					console.log(Logs.ERROR_UNKNOWN_IN_CHECKING_AGENT_RESPONSE, response);
					await checkCurrentChatStatus(
						app,
						http,
						modify,
						persistence,
						message,
						read,
						salesforceChatApiEndpoint,
						rocketChatServerUrl,
						salesforceBotUsername,
						salesforceBotPassword,
						id,
						affinityToken,
						key,
						targetDeptName,
						LcAgent,
						LAQueueEmptyMessage,
						LAQueuePositionMessage,
						technicalDifficultyMessage,
						LcVisitor,
					);
				}
			}
		})
		.catch(async (error) => {
			console.log(Logs.ERROR_UNKNOWN_IN_CHECKING_AGENT_RESPONSE, error);
			checkAgentStatusCallbackError(technicalDifficultyMessage, modify, message, LcAgent);
			return;
		});
}
