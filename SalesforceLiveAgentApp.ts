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
import { ApiSecurity, ApiVisibility } from '@rocket.chat/apps-engine/definition/api';
import { App } from '@rocket.chat/apps-engine/definition/App';
import { ILivechatEventContext, IPostLivechatAgentAssigned, IPostLivechatAgentUnassigned } from '@rocket.chat/apps-engine/definition/livechat';
import { IMessage, IPostMessageSent } from '@rocket.chat/apps-engine/definition/messages';
import { IAppInfo } from '@rocket.chat/apps-engine/definition/metadata';
import { IRoomUserTyping, IRoomUserTypingContext } from '@rocket.chat/apps-engine/definition/rooms';
import { IUIKitLivechatInteractionHandler, IUIKitResponse, UIKitLivechatBlockInteractionContext } from '@rocket.chat/apps-engine/definition/uikit';
import { AppSettings } from './config/AppSettings';
import { AvailabilityEndpoint } from './endpoints/AvailabilityEndpoint';
import { HandoverEndpoint } from './endpoints/HandoverEndpoint';
import { DialogflowAgentAssignedClass } from './lib/DialogflowAgentAssignedHandler';
import { LivechatBlockActionClassInitiate } from './lib/LivechatBlockActionHandler';
import { OnUserTypingHandler } from './lib/OnUserTypingHandler';
import { PostMessageClassInitiate } from './lib/PostMessageClassInitiateHandler';
import { SalesforceAgentAssignedClass } from './lib/SalesforceAgentAssignedHandler';

export class SalesforcePluginApp
	extends App
	implements IPostMessageSent, IPostLivechatAgentAssigned, IPostLivechatAgentUnassigned, IRoomUserTyping, IUIKitLivechatInteractionHandler {
	constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
		super(info, logger, accessors);
	}

	public async initialize(configurationExtend: IConfigurationExtend, environmentRead: IEnvironmentRead): Promise<void> {
		await this.extendConfiguration(configurationExtend);
		this.getLogger().log('App Initialized');
	}

	public async executeLivechatBlockActionHandler(
		context: UIKitLivechatBlockInteractionContext,
		read: IRead,
		http: IHttp,
		persistence: IPersistence,
		modify: IModify,
	): Promise<IUIKitResponse> {
		const livechatBlockActionClassInitiate = new LivechatBlockActionClassInitiate(this, context, read, http, persistence, modify);
		await livechatBlockActionClassInitiate.exec();
		return context.getInteractionResponder().successResponse();
	}

	public async executePostLivechatAgentAssigned(data: ILivechatEventContext, read: IRead, http: IHttp, persistence: IPersistence, modify: IModify) {
		const salesforceAgentAssigned = new SalesforceAgentAssignedClass(this, data, read, http, persistence, modify);
		await salesforceAgentAssigned.exec();
	}

	public async executePostLivechatAgentUnassigned(data: ILivechatEventContext, read: IRead, http: IHttp, persistence: IPersistence, modify: IModify) {
		const dialogflowAgentAssigned = new DialogflowAgentAssignedClass(this, data, read, http, persistence, modify);
		await dialogflowAgentAssigned.exec();
	}

	public async executePostMessageSent(message: IMessage, read: IRead, http: IHttp, persistence: IPersistence, modify: IModify): Promise<void> {
		const postMessageClassInitiate = new PostMessageClassInitiate(this, message, read, http, persistence, modify);
		await postMessageClassInitiate.exec();
	}

	public async executeOnRoomUserTyping(data: IRoomUserTypingContext, read: IRead, http: IHttp, persistence: IPersistence): Promise<void> {
		const onUserTypingHandler = new OnUserTypingHandler(this, data, read, http, persistence);
		await onUserTypingHandler.exec();
	}

	public async extendConfiguration(configuration: IConfigurationExtend): Promise<void> {
		configuration.api.provideApi({
			visibility: ApiVisibility.PUBLIC,
			security: ApiSecurity.UNSECURE,
			endpoints: [new HandoverEndpoint(this), new AvailabilityEndpoint(this)],
		});

		AppSettings.forEach((setting) => configuration.settings.provideSetting(setting));
	}
}
