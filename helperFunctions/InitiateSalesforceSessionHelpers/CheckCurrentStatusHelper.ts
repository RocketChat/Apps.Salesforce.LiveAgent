import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IVisitor } from '@rocket.chat/apps-engine/definition/livechat';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { sendLCMessage } from '../GeneralHelpers';
import { pullMessages } from '../SalesforceAPIHelpers';
import { checkForEvent } from '../SalesforceMessageHelpers';
import { checkAgentStatusCallbackData, checkAgentStatusCallbackError } from './CheckAgentStatusCallback';

export async function checkCurrentChatStatus(
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
				console.log('Check whether agent accepted request, Session Expired. ', response);
				checkAgentStatusCallbackError('Chat session expired.', modify, message, LcAgent);
				return;
			} else if (response.statusCode === 204 || response.statusCode === 409) {
				console.log('Check whether agent accepted request, Empty Response.', response);
				await checkCurrentChatStatus(
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
				console.log('Check whether agent accepted request, response here:', response);

				const { content } = response;
				const contentParsed = JSON.parse(content || '{}');
				const messageArray = contentParsed.messages;

				const isQueueUpdate = checkForEvent(messageArray, 'QueueUpdate');
				if (isQueueUpdate === true) {
					console.log('isQueueUpdate: ', isQueueUpdate);
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
					console.log('Chat accepted by agent: ', isChatAccepted);
					console.log('Check whether agent accepted request, Chat ended by Live Agent.');
					checkAgentStatusCallbackData(
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
					console.log('Chat accepted by agent: ', isChatAccepted);

					const isChatRequestFail = checkForEvent(messageArray, 'ChatRequestFail');
					if (isChatRequestFail === true) {
						console.log('Chat request fail: ', isChatRequestFail);
						checkAgentStatusCallbackError(technicalDifficultyMessage, modify, message, LcAgent);
						return;
					} else {
						await checkCurrentChatStatus(
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
					console.log('Check whether agent accepted request, Unresolved Response:', response);
					await checkCurrentChatStatus(
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
			console.log('Check whether agent accepted request, Error: ', error);
			await checkCurrentChatStatus(
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
		});
}
