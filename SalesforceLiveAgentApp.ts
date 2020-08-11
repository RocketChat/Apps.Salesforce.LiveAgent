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
import { ILivechatEventContext, IPostLivechatAgentAssigned } from '@rocket.chat/apps-engine/definition/livechat';
import { IMessage, IPostMessageSent } from '@rocket.chat/apps-engine/definition/messages';
import { IAppInfo } from '@rocket.chat/apps-engine/definition/metadata';
import { AppSettings } from './config/AppSettings';
import { SalesforceAgentAssigned } from './handlers/SalesforceAgentAssignedHandler';
import { AgentAssignedClassInitiate } from './lib/AgentAssignedClassInitiateHandler';
import { PostMessageClassInitiate } from './lib/PostMessageClassInitiateHandler';

export class SalesforcePluginApp extends App implements IPostMessageSent, IPostLivechatAgentAssigned {
	constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
		super(info, logger, accessors);
	}

	public async initialize(configurationExtend: IConfigurationExtend, environmentRead: IEnvironmentRead): Promise<void> {
		await this.extendConfiguration(configurationExtend);
		this.getLogger().log('App Initialized');
	}

	public async executePostLivechatAgentAssigned(data: ILivechatEventContext, read: IRead, http: IHttp, persistence: IPersistence, modify: IModify) {
		const salesforceAgentAssigned = new AgentAssignedClassInitiate(this, data, read, http, persistence, modify);
		await salesforceAgentAssigned.exec();
	}

	public async executePostMessageSent(message: IMessage, read: IRead, http: IHttp, persistence: IPersistence, modify: IModify): Promise<void> {
		const postMessageClassInitiate = new PostMessageClassInitiate(this, message, read, http, persistence, modify);
		await postMessageClassInitiate.exec();
	}

	public async extendConfiguration(configuration: IConfigurationExtend): Promise<void> {
		AppSettings.forEach((setting) => configuration.settings.provideSetting(setting));
	}
}
