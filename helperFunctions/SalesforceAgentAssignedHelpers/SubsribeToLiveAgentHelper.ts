import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ILivechatEventContext } from '@rocket.chat/apps-engine/definition/livechat';
import { RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { retrievePersistentTokens } from '../GeneralHelpers';
import { pullMessages } from '../SalesforceAPIHelpers';
import { checkForEvent, messageFilter } from '../SalesforceMessageHelpers';
import { handleEndChatCallback } from './HandleEndChatCallback';

export async function subscribeToLiveAgent(
	read: IRead,
	http: IHttp,
	modify: IModify,
	persistence: IPersistence,
	data: ILivechatEventContext,
	assoc: RocketChatAssociationRecord,
	salesforceChatApiEndpoint: string,
	rocketChatServerUrl: string,
	LAChatEndedMessage: string,
	technicalDifficultyMessage: string,
) {
	const persistantData = await retrievePersistentTokens(read, assoc);
	let persisantAffinity = persistantData.persisantAffinity;
	let persistantKey = persistantData.persistantKey;

	await pullMessages(http, salesforceChatApiEndpoint, persisantAffinity, persistantKey)
		.then(async (response) => {
			if (response.statusCode === 403) {
				console.log('Pulling Messages using Subscribe Function, Session Expired.');
				handleEndChatCallback(modify, data, read, persistence, http, LAChatEndedMessage, assoc, rocketChatServerUrl, technicalDifficultyMessage);
				return;
			} else if (response.statusCode === 204 || response.statusCode === 409) {
				console.log('Pulling Messages using Subscribe Function, Empty Response.', response);

				persisantAffinity = persistantData.persisantAffinity;
				persistantKey = persistantData.persistantKey;

				if (persisantAffinity && persistantKey) {
					await subscribeToLiveAgent(
						read,
						http,
						modify,
						persistence,
						data,
						assoc,
						salesforceChatApiEndpoint,
						rocketChatServerUrl,
						LAChatEndedMessage,
						technicalDifficultyMessage,
					);
				} else {
					console.log('Pulling Messages using Subscribe Function, Session Expired.');
					handleEndChatCallback(modify, data, read, persistence, http, LAChatEndedMessage, assoc, rocketChatServerUrl, technicalDifficultyMessage);
					return;
				}
			} else {
				console.log('Pulling Messages using Subscribe Function, response here:', response);

				const { content } = response;
				const contentParsed = JSON.parse(content || '{}');

				const messageArray = contentParsed.messages;
				const isEndChat = checkForEvent(messageArray, 'ChatEnded');
				console.log('Chat ended by Agent: ', isEndChat);

				if (isEndChat === true) {
					console.log('Pulling Messages using Subscribe Function, Chat Ended By Live Agent.');
					handleEndChatCallback(modify, data, read, persistence, http, LAChatEndedMessage, assoc, rocketChatServerUrl, technicalDifficultyMessage);
				} else {
					await messageFilter(modify, read, data.room, data.agent, messageArray);
					persisantAffinity = persistantData.persisantAffinity;
					persistantKey = persistantData.persistantKey;

					if (persisantAffinity && persistantKey) {
						await subscribeToLiveAgent(
							read,
							http,
							modify,
							persistence,
							data,
							assoc,
							salesforceChatApiEndpoint,
							rocketChatServerUrl,
							LAChatEndedMessage,
							technicalDifficultyMessage,
						);
					} else {
						console.log('Pulling Messages using Subscribe Function, Session Expired.');
						handleEndChatCallback(
							modify,
							data,
							read,
							persistence,
							http,
							LAChatEndedMessage,
							assoc,
							rocketChatServerUrl,
							technicalDifficultyMessage,
						);
						return;
					}
				}
			}
		})
		.catch(async (error) => {
			console.log('Pulling Messages using Subscribe Function, error here:', error);
			persisantAffinity = persistantData.persisantAffinity;
			persistantKey = persistantData.persistantKey;

			if (persisantAffinity && persistantKey) {
				await subscribeToLiveAgent(
					read,
					http,
					modify,
					persistence,
					data,
					assoc,
					salesforceChatApiEndpoint,
					rocketChatServerUrl,
					LAChatEndedMessage,
					technicalDifficultyMessage,
				);
			} else {
				console.log('Pulling Messages using Subscribe Function, Session Expired.');
				handleEndChatCallback(modify, data, read, persistence, http, LAChatEndedMessage, assoc, rocketChatServerUrl, technicalDifficultyMessage);
				return;
			}
		});
}
