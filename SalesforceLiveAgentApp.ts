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

	const persistantData = await retrievePersistentTokens(read, assoc);
	const agentName = persistantData.persistantagentName;

	greetingMessage = greetingMessage.replace('%s', agentName);
	sendLCMessage(modify, data.room, greetingMessage, data.agent);

	// RUN SUBSCRIBE FUNCTION HERE
	// ADD An object in Persistence data to check whether or not to run subscribe function
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
