import { IHttp, IHttpRequest, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatEventContext, ILivechatRoom } from '@rocket.chat/apps-engine/definition/livechat';
import { AppSettingId } from '../enum/AppSettingId';
import { ErrorLogs } from '../enum/ErrorLogs';
import { InfoLogs } from '../enum/InfoLogs';
import { sendDebugLCMessage, sendLCMessage } from '../helperFunctions/LivechatMessageHelpers';

export class DialogflowAgentAssignedClass {
	constructor(
		private app: IApp,
		private data: ILivechatEventContext,
		private read: IRead,
		private http: IHttp,
		private persistence: IPersistence,
		private modify: IModify,
	) {}

	public async exec() {
		const isDialogflowEndEventEnabled: boolean = (await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.DIALOGFLOW_ENABLE_END_EVENT))
			.value;
		if (isDialogflowEndEventEnabled === false) {
			console.log(InfoLogs.ENDCHAT_EVENT_NOT_ENABLED);
			return;
		}

		const lroom: ILivechatRoom = this.data.room as ILivechatRoom;
		const oldAgentUsername: string = this.data.agent.username;
		const salesforceBotUsername: string = (await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.SALESFORCE_BOT_USERNAME)).value;
		const chatBotUsername: string = (await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.CHATBOT_USERNAME)).value;
		const { customFields } = this.data.room;

		let serverUrl = await this.read.getEnvironmentReader().getServerSettings().getValueById('Site_Url');
		try {
			serverUrl = serverUrl.replace(/\/?$/, '/');
		} catch (error) {
			await sendLCMessage(this.modify, this.data.room, ErrorLogs.ROCKETCHAT_SERVERURL_NOT_FOUND, this.data.agent);
			await sendDebugLCMessage(this.read, this.modify, this.data.room, ErrorLogs.ROCKETCHAT_SERVERURL_NOT_FOUND, this.data.agent);
			console.log(ErrorLogs.ROCKETCHAT_SERVERURL_NOT_FOUND);
			return;
		}

		const dialogflowEndChatEventName: string = (
			await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.DIALOGFLOW_AGENT_ENDED_CHAT_EVENT_NAME)
		).value;
		const dialogflowAgentUnavailableEventName: string = (
			await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.DIALOGFLOW_AGENT_UNAVAILABLE_EVENT_NAME)
		).value;
		const dialogflowSessionErrorEventName: string = (
			await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.DIALOGFLOW_SESSION_ERROR_EVENT_NAME)
		).value;
		const dialogflowEndChatEventLCode: string = (
			await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.DIALOGFLOW_END_EVENT_LANGUAGE_CODE)
		).value;

		if (lroom.servedBy) {
			const newAgentUsername = lroom.servedBy.username;
			if (newAgentUsername === chatBotUsername && oldAgentUsername === salesforceBotUsername && dialogflowEndChatEventLCode) {
				const eventParams = {
					name: '',
					languageCode: dialogflowEndChatEventLCode,
				};

				if (customFields && customFields.agentEndedChat === true && dialogflowEndChatEventName) {
					console.log(InfoLogs.DIALOGFLOW_AGENT_ENDED_CHAT);
					eventParams.name = dialogflowEndChatEventName;
				} else if (customFields && customFields.agentUnavailable === true && dialogflowAgentUnavailableEventName) {
					console.log(InfoLogs.DIALOGFLOW_AGENT_UNAVAILABLE_SESSION);
					eventParams.name = dialogflowAgentUnavailableEventName;
				} else if (customFields && customFields.errorSession === true && dialogflowSessionErrorEventName) {
					console.log(ErrorLogs.DIALOGFLOW_ERROR_SESSION);
					eventParams.name = dialogflowSessionErrorEventName;
				}

				const appEventEndpoint = `${serverUrl}api/apps/public/21b7d3ba-031b-41d9-8ff2-fbbfa081ae90/incoming`;
				const appEventEndpointHttpRequest: IHttpRequest = {
					data: {
						action: 'trigger-event',
						sessionId: lroom.id,
						actionData: {
							event: eventParams,
						},
					},
				};
				try {
					await this.http.post(appEventEndpoint, appEventEndpointHttpRequest);
					return;
				} catch (error) {
					console.log(ErrorLogs.ENDCHAT_EVENT_API_CALL_FAIL, error);
					return;
				}
			} else {
				console.log(ErrorLogs.ENDCHAT_EVENT_PARAMS_ISSUE);
				return;
			}
		} else {
			console.log(ErrorLogs.SERVEDBY_NOT_FOUND);
			return;
		}
	}
}
