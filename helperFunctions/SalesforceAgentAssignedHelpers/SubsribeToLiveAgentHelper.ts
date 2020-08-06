import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatEventContext } from '@rocket.chat/apps-engine/definition/livechat';
import { RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { Logs } from '../../enum/Logs';
import { retrievePersistentTokens } from '../GeneralHelpers';
import { pullMessages } from '../SalesforceAPIHelpers';
import { checkForEvent, messageFilter } from '../SalesforceMessageHelpers';
import { handleEndChatCallback } from './HandleEndChatCallback';

export async function subscribeToLiveAgent(
	app: IApp,
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
	persisantAffinity: string,
	persistantKey: string,
) {
	await pullMessages(http, salesforceChatApiEndpoint, persisantAffinity, persistantKey)
		.then(async (response) => {
			if (response.statusCode === 403) {
				console.log(Logs.ERROR_LIVEAGENT_SESSION_EXPIRED);
				await handleEndChatCallback(
					app,
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
			} else if (response.statusCode === 204 || response.statusCode === 409) {
				const persistantData = await retrievePersistentTokens(read, assoc);
				persisantAffinity = persistantData.persisantAffinity;
				persistantKey = persistantData.persistantKey;
				if (persisantAffinity && persistantKey) {
					await subscribeToLiveAgent(
						app,
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
						persisantAffinity,
						persistantKey,
					);
				} else {
					console.log(Logs.ERROR_LIVEAGENT_SESSION_EXPIRED);
					handleEndChatCallback(
						app,
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
			} else {
				console.log(Logs.SUCCESSFULLY_RECIEVED_LIVEAGENT_RESPONSE, response);
				const { content } = response;
				const contentParsed = JSON.parse(content || '{}');
				const messageArray = contentParsed.messages;
				const isEndChat = checkForEvent(messageArray, 'ChatEnded');

				if (isEndChat === true) {
					console.log(Logs.LIVEAGENT_SESSION_CLOSED);
					await handleEndChatCallback(
						app,
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
				} else {
					await messageFilter(app, modify, read, data.room, data.agent, messageArray);
					const persistantData = await retrievePersistentTokens(read, assoc);
					persisantAffinity = persistantData.persisantAffinity;
					persistantKey = persistantData.persistantKey;
					if (persisantAffinity && persistantKey) {
						await subscribeToLiveAgent(
							app,
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
							persisantAffinity,
							persistantKey,
						);
					} else {
						console.log(Logs.ERROR_LIVEAGENT_SESSION_EXPIRED);
						handleEndChatCallback(
							app,
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
			console.log(Logs.ERROR_UNKNOWN_IN_CHECKING_AGENT_RESPONSE, error);
			await handleEndChatCallback(app, modify, data, read, persistence, http, LAChatEndedMessage, assoc, rocketChatServerUrl, technicalDifficultyMessage);
			return;
		});
}
