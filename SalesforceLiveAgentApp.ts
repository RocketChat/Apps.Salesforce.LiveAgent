import {
	IAppAccessors,
	IConfigurationExtend,
	IEnvironmentRead,
	IHttp,
	IHttpRequest,
	ILogger,
	IModify,
	IPersistence,
	IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import { App } from '@rocket.chat/apps-engine/definition/App';
import {
	IDepartment,
	ILivechatEventContext,
	ILivechatMessage,
	ILivechatRoom,
	ILivechatTransferData,
	IPostLivechatAgentAssigned,
} from '@rocket.chat/apps-engine/definition/livechat';
import { IMessage, IPostMessageSent } from '@rocket.chat/apps-engine/definition/messages';
import { IAppInfo, RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { AppSettings } from './config/AppSettings';
import { InitiateSalesforceSession } from './handlers/InitiateSalesforceSession';
import { LiveAgentSession } from './handlers/LiveAgentSession';
import { getServerSettingValue, retrievePersistentTokens, sendDebugLCMessage, sendLCMessage } from './helperFunctions/GeneralHelpers';
import { checkForEvent, messageFilter, pullMessages } from './helperFunctions/SalesforceHelpers';

export class SalesforcePluginApp extends App implements IPostMessageSent, IPostLivechatAgentAssigned {
	constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
		super(info, logger, accessors);
	}

	public async initialize(configurationExtend: IConfigurationExtend, environmentRead: IEnvironmentRead): Promise<void> {
		await this.extendConfiguration(configurationExtend);
		this.getLogger().log('App Initialized');
	}

	public async executePostLivechatAgentAssigned(data: ILivechatEventContext, read: IRead, http: IHttp, persistence: IPersistence, modify: IModify) {
		console.log('executeLivechatAssignAgentHandler', { data });

		const salesforceBotUsername: string = (await read.getEnvironmentReader().getSettings().getById('salesforce_bot_username')).value;
		if (data.agent.username !== salesforceBotUsername) {
			return;
		}

		const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.ROOM, data.room.id);
		const persitedData = await retrievePersistentTokens(read, assoc);
		let { persisantAffinity, persistantKey } = persitedData;
		const technicalDifficultyMessage: string = (await read.getEnvironmentReader().getSettings().getById('technical_difficulty_message')).value;

		let rocketChatServerUrl: string = await getServerSettingValue(read, 'Site_Url');
		try {
			rocketChatServerUrl = rocketChatServerUrl.replace(/\/?$/, '/');
		} catch (error) {
			await sendLCMessage(modify, data.room, technicalDifficultyMessage, data.agent);
			await sendDebugLCMessage(read, modify, data.room, 'Rocket Chat server url not found.', data.agent);
			console.log('Rocket Chat server url not found.');
			return;
		}

		const handleEndChatCallback = async (endChatdata) => {
			await persistence.removeByAssociation(assoc);
			await sendLCMessage(modify, data.room, endChatdata, data.agent);

			const chatBotUsername: string = (await read.getEnvironmentReader().getSettings().getById('chat_bot_username')).value;
			const chatBotPassword: string = (await read.getEnvironmentReader().getSettings().getById('chat_bot_password')).value;
			const CBHandoverDepartmentName: string = (await read.getEnvironmentReader().getSettings().getById('chat_handover_department_name')).value;

			const authHttpRequest: IHttpRequest = {
				headers: {
					'Content-Type': 'application/json',
				},
				data: {
					user: chatBotUsername,
					password: chatBotPassword,
				},
			};

			http.post(`${rocketChatServerUrl}api/v1/login`, authHttpRequest)
				.then((loginResponse) => {
					const loginResponseJSON = JSON.parse(loginResponse.content || '{}');
					console.log('Performing Dialogflow bot login, Response:', loginResponse);

					const setStatusHttpRequest: IHttpRequest = {
						headers: {
							'X-Auth-Token': loginResponseJSON.data.authToken,
							'X-User-Id': loginResponseJSON.data.userId,
						},
						data: {
							message: 'online',
							status: 'online',
						},
					};

					http.post(`${rocketChatServerUrl}api/v1/users.setStatus`, setStatusHttpRequest)
						.then(async (statusResponse) => {
							console.log('Setting Dialogflow bot status, Response:', statusResponse);

							const roomId = data.room.id;
							const room: ILivechatRoom = (await read.getRoomReader().getById(roomId)) as ILivechatRoom;
							const targetDepartment: IDepartment = (await read
								.getLivechatReader()
								.getLivechatDepartmentByIdOrName(CBHandoverDepartmentName)) as IDepartment;
							const transferData: ILivechatTransferData = {
								currentRoom: room,
								targetDepartment: targetDepartment.id,
							};
							await modify.getUpdater().getLivechatUpdater().transferVisitor(data.room.visitor, transferData);
						})
						.catch(async (loginErr) => {
							console.log('Setting Chat bot status , Error:', loginErr);
							await sendLCMessage(modify, data.room, technicalDifficultyMessage, data.agent);
							await sendDebugLCMessage(read, modify, data.room, `Error Setting Chat bot status, ${loginErr}`, data.agent);
						});
				})
				.catch(async (loginErr) => {
					console.log('Performing Chat bot login, Error:', loginErr);
					await sendLCMessage(modify, data.room, technicalDifficultyMessage, data.agent);
					await sendDebugLCMessage(read, modify, data.room, `Error Performing Chat bot login, ${loginErr}`, data.agent);
				});
		};

		let salesforceChatApiEndpoint: string = (await read.getEnvironmentReader().getSettings().getById('salesforce_chat_api_endpoint')).value;
		try {
			salesforceChatApiEndpoint = salesforceChatApiEndpoint.replace(/\/?$/, '/');
		} catch (error) {
			await sendLCMessage(modify, data.room, technicalDifficultyMessage, data.agent);
			await sendDebugLCMessage(read, modify, data.room, 'Salesforce Chat API endpoint not found.', data.agent);
			console.log('Salesforce Chat API endpoint not found.');
			return;
		}
		const LAChatEndedMessage: string = (await read.getEnvironmentReader().getSettings().getById('la_chat_ended_message')).value;

		async function subscribeToLiveAgent(callback: any) {
			await pullMessages(http, salesforceChatApiEndpoint, persisantAffinity, persistantKey)
				.then(async (response) => {
					if (response.statusCode === 403) {
						console.log('Pulling Messages using Subscribe Function, Session Expired.');
						callback(LAChatEndedMessage);
						return;
					} else if (response.statusCode === 204 || response.statusCode === 409) {
						console.log('Pulling Messages using Subscribe Function, Empty Response.', response);

						const persistantData = await retrievePersistentTokens(read, assoc);
						persisantAffinity = persistantData.persisantAffinity;
						persistantKey = persistantData.persistantKey;

						if (persisantAffinity && persistantKey) {
							await subscribeToLiveAgent(callback);
						} else {
							console.log('Pulling Messages using Subscribe Function, Session Expired.');
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
							callback(LAChatEndedMessage);
						} else {
							await messageFilter(modify, read, data.room, data.agent, messageArray);
							const persistantData = await retrievePersistentTokens(read, assoc);
							persisantAffinity = persistantData.persisantAffinity;
							persistantKey = persistantData.persistantKey;

							if (persisantAffinity && persistantKey) {
								await subscribeToLiveAgent(callback);
							} else {
								console.log('Pulling Messages using Subscribe Function, Session Expired.');
								return;
							}
						}
					}
				})
				.catch(async (error) => {
					console.log('Pulling Messages using Subscribe Function, error here:', error);
					const persistantData = await retrievePersistentTokens(read, assoc);
					persisantAffinity = persistantData.persisantAffinity;
					persistantKey = persistantData.persistantKey;

					if (persisantAffinity && persistantKey) {
						await subscribeToLiveAgent(callback);
					} else {
						console.log('Pulling Messages using Subscribe Function, Session Expired.');
						return;
					}
				});
		}

		if (persisantAffinity && persistantKey) {
			console.log('Executing Subscribe Function, MAIN ENTRY');
			await subscribeToLiveAgent(handleEndChatCallback);
		}
	}

	public async executePostMessageSent(message: IMessage, read: IRead, http: IHttp, persistence: IPersistence, modify: IModify): Promise<void> {
		const salesforceBotUsername: string = (await read.getEnvironmentReader().getSettings().getById('salesforce_bot_username')).value;
		if (message.sender.username === salesforceBotUsername) {
			return;
		} else if (message.room.type !== 'l') {
			return;
		}

		const lmessage: ILivechatMessage = message;
		const lroom: ILivechatRoom = lmessage.room as ILivechatRoom;
		const LcAgent: IUser = lroom.servedBy ? lroom.servedBy : message.sender;

		if (message.text === 'initiate_salesforce_session') {
			const initiateSalesforceSessionhandler = new InitiateSalesforceSession(message, read, http, persistence, modify);
			await initiateSalesforceSessionhandler.exec();
		}

		if (LcAgent.username === salesforceBotUsername) {
			const liveAgentSession = new LiveAgentSession(message, read, http, persistence, modify);
			await liveAgentSession.exec();
		}
	}

	public async extendConfiguration(configuration: IConfigurationExtend): Promise<void> {
		AppSettings.forEach((setting) => configuration.settings.provideSetting(setting));
	}
}
