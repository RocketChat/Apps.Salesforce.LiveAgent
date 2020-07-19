import {
  IAppAccessors,
  IConfigurationExtend,
  IEnvironmentRead,
  IHttp,
  ILogger,
  IModify,
  IPersistence,
  IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import { App } from '@rocket.chat/apps-engine/definition/App';
import {
  ILivechatEventContext,
  ILivechatMessage,
  ILivechatRoom,
  IPostLivechatAgentAssigned,
} from '@rocket.chat/apps-engine/definition/livechat';
import {
  IMessage,
  IPostMessageSent,
} from '@rocket.chat/apps-engine/definition/messages';
import {
  IAppInfo,
  RocketChatAssociationModel,
  RocketChatAssociationRecord,
} from '@rocket.chat/apps-engine/definition/metadata';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { AppSettings } from './AppSettings';
import { InitiateSalesforceSession } from './handlers/InitiateSalesforceSession';
import { LiveAgentSession } from './handlers/LiveAgentSession';
import { retrievePersistentTokens, sendLCMessage } from './helperFunctions/GeneralHelpers';
import { SalesforceHelpers } from './helperFunctions/SalesforceHelpers';

export class SalesforcePluginApp extends App
  implements IPostMessageSent, IPostLivechatAgentAssigned {
  constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
	super(info, logger, accessors);
  }

  public async initialize(
	configurationExtend: IConfigurationExtend,
	environmentRead: IEnvironmentRead,
  ): Promise<void> {
	await this.extendConfiguration(configurationExtend);
	this.getLogger().log('App Initialized');
  }

  public async executePostLivechatAgentAssigned(
	data: ILivechatEventContext,
	read: IRead,
	http: IHttp,
	persistence: IPersistence,
	modify: IModify,
  ) {
	console.log('executeLivechatAssignAgentHandler', { data });

	const salesforceBotUsername: string = (
		await read
		.getEnvironmentReader()
		.getSettings()
		.getById('salesforce_bot_username')
	).value;

	if (data.agent.username !== salesforceBotUsername) {
		return;
	}

	let greetingMessage: string = (
		await read
		.getEnvironmentReader()
		.getSettings()
		.getById('salesforce_greeting_message')
	).value;

	const assoc = new RocketChatAssociationRecord(
		RocketChatAssociationModel.ROOM,
		data.room.id,
	);

	let {
		persisantAffinity,
		persistantKey,
		// tslint:disable-next-line: prefer-const
		persistantagentName,
	} = await retrievePersistentTokens(read, assoc);

	greetingMessage = greetingMessage.replace('%s', persistantagentName);
	sendLCMessage(modify, data.room, greetingMessage, data.agent);

	// RUN SUBSCRIBE FUNCTION HERE
	// ADD An object in Persistence data to check whether or not to run subscribe function

	const salesforceHelpers: SalesforceHelpers = new SalesforceHelpers();

	let salesforceChatApiEndpoint: string = (
		await read
			.getEnvironmentReader()
			.getSettings()
			.getById('salesforce_chat_api_endpoint')
		).value;
	salesforceChatApiEndpoint = salesforceChatApiEndpoint.replace(
		/\/?$/,
		'/',
		);

	// your callback gets executed automatically once the data is received
	const handleEndChatCallback = async (endChatdata, error) => {
		if (error) {
			console.error(error);

			if (error === 'out of retries') {
			await sendLCMessage(
				modify,
				data.room,
				'Connection lost',
				data.agent,
			);
			}
			return;
		}

		await persistence.removeByAssociation(assoc);
		await sendLCMessage(modify, data.room, endChatdata, data.agent);
		return;
		// PROBABLY ADD A CHECK TO LET USER DECIDE WHETHER TO REINITIATE SESSION
		};

	async function subscribeToLiveAgent(/*retries: number,*/ callback: any) {
		await salesforceHelpers
			.pullMessages(
			http,
			salesforceChatApiEndpoint,
			persisantAffinity,
			persistantKey,
			)
			.then(async (response) => {
			if (response.statusCode === 403) {
				console.log(
				'Pulling Messages using Subscribe Function, Session Expired.',
				);
				callback('Chat Session Expired');

				return;
			} else if (
				response.statusCode === 204 ||
				response.statusCode === 409
			) {
				console.log(
				'Pulling Messages using Subscribe Function, Empty Response.',
				response,
				);

				// if (retries > 0) {
				// console.log(
				// 	'Executing Subscribe Function, EMPTY RESPONSE ENTRY, Retries Remaining: ',
				// 	retries,
				// );

				const persistantData = await retrievePersistentTokens(read, assoc);
				persisantAffinity = persistantData.persisantAffinity;
				persistantKey = persistantData.persistantKey;

				if (persisantAffinity && persistantKey) {
					await subscribeToLiveAgent(
						// --retries,
						callback,
						// persisantAffinity,
						// persistantKey,
					);
				} else {
					console.log(
						'Pulling Messages using Subscribe Function, Session Expired.',
					);
					return;
				}
				// } else {
				// // no retries left, calling callback with error
				// callback([], 'out of retries');
				// }
			} else {
				// request successful
				console.log(
				'Pulling Messages using Subscribe Function, response here:',
				response,
				);

				const { content } = response;
				const contentParsed = JSON.parse(content || '{}');

				const messageArray = contentParsed.messages;
				const isEndChat = salesforceHelpers.checkForEvent(
				messageArray,
				'ChatEnded',
				);
				console.log('Chat ended by Agent: ', isEndChat);

				if (isEndChat === true) {
				console.log(
					'Pulling Messages using Subscribe Function, Chat Ended By Live Agent.',
				);
				callback('Chat Ended By Live Agent');
				} else {
				// server not done yet
				// retry, if any retries left

				await salesforceHelpers.messageFilter(
					modify,
					read,
					// persistence,
					// assoc,
					data.room,
					data.agent,
					messageArray,
				);

				// if (retries > 0) {
				// 	console.log(
				// 	'Executing Subscribe Function, MESSAGE RESPONSE ENTRY, Retries Remaining: ',
				// 	retries,
				// 	);
				const persistantData = await retrievePersistentTokens(read, assoc);
				persisantAffinity = persistantData.persisantAffinity;
				persistantKey = persistantData.persistantKey;

				if (persisantAffinity && persistantKey) {
					await subscribeToLiveAgent(
						// --retries,
						callback,
						// persisantAffinity,
						// persistantKey,
					);
				} else {
					console.log(
						'Pulling Messages using Subscribe Function, Session Expired.',
					);
					return;
				}
				// } else {
				// 	// no retries left, calling callback with error
				// 	callback([], 'out of retries');
				// }
				}
			}
			})
			.catch(async (error) => {
			console.log(
				'Pulling Messages using Subscribe Function, error here:',
				error,
			);
			// ajax error occurred
			// would be better to not retry on 404, 500 and other unrecoverable HTTP errors
			// retry, if any retries left
			// if (retries > 0) {
			// 	console.log(
			// 	'Executing Subscribe Function, CATCH ENTRY, Retries Remaining: ',
			// 	retries,
			// 	);
			const persistantData = await retrievePersistentTokens(read, assoc);
			persisantAffinity = persistantData.persisantAffinity;
			persistantKey = persistantData.persistantKey;

			if (persisantAffinity && persistantKey) {
					await subscribeToLiveAgent(
						// --retries,
						callback,
						// persisantAffinity,
						// persistantKey,
					);
			} else {
				console.log(
					'Pulling Messages using Subscribe Function, Session Expired.',
				);
				return;
			}
			// } else {
			// 	// no retries left, calling callback with error
			// 	callback([], error);
			// }
			});
		}

	if (persisantAffinity && persistantKey) {
		console.log(
			'Executing Subscribe Function, MAIN ENTRY',
		);
		await subscribeToLiveAgent(handleEndChatCallback);
		}
  }

  public async executePostMessageSent(
	message: IMessage,
	read: IRead,
	http: IHttp,
	persistence: IPersistence,
	modify: IModify,
  ): Promise<void> {
	const dialogflowBotUsername: string = (
		await read
		.getEnvironmentReader()
		.getSettings()
		.getById('dialogflow_bot_username')
	).value;
	const salesforceBotUsername: string = (
		await read
		.getEnvironmentReader()
		.getSettings()
		.getById('salesforce_bot_username')
	).value;

	if (message.sender.username === dialogflowBotUsername) {
		return;
	} else if (message.room.type !== 'l') {
		return;
	}

	const lmessage: ILivechatMessage = message;
	const lroom: ILivechatRoom = lmessage.room as ILivechatRoom;
	const LcAgent: IUser = lroom.servedBy ? lroom.servedBy : message.sender;

	if (message.text === 'initiate_salesforce_session') {
		const initiateSalesforceSessionhandler = new InitiateSalesforceSession(
		message,
		read,
		http,
		persistence,
		modify,
		);

		try {
		initiateSalesforceSessionhandler.exec();
		} catch (error) {
		console.log(error);
		}
	}

	if (LcAgent.username === salesforceBotUsername) {
		const liveAgentSession = new LiveAgentSession(
		message,
		read,
		http,
		persistence,
		modify,
		);

		try {
		liveAgentSession.exec();
		} catch (error) {
		console.log(error);
		}
	}
  }

  public async extendConfiguration(
	configuration: IConfigurationExtend,
  ): Promise<void> {
	AppSettings.forEach((setting) =>
		configuration.settings.provideSetting(setting),
	);
  }
}
