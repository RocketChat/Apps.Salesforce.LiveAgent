import { IHttp, IHttpRequest, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatRoom } from '@rocket.chat/apps-engine/definition/livechat';
import { AppSettingId } from '../enum/AppSettingId';
import { ErrorLogs } from '../enum/ErrorLogs';
import { InfoLogs } from '../enum/InfoLogs';
import { sendDebugLCMessage, sendLCMessage } from '../helperFunctions/LivechatMessageHelpers';
import { getRoomAssoc, retrievePersistentTokens } from '../helperFunctions/PersistenceHelpers';
import { closeChat, getSalesforceChatAPIEndpoint } from '../helperFunctions/SalesforceAPIHelpers';
import { getAppSettingValue } from '../lib/Settings';

export class LivechatRoomClosedClass {
	constructor(
		private app: IApp,
		private room: ILivechatRoom,
		private read: IRead,
		private http: IHttp,
		private persistence: IPersistence,
		private modify: IModify,
	) { }

	public async closeChatFromSalesforce() {
		const { customFields, id: rid } = this.room;
		const { persisantAffinity, persistantKey } = await retrievePersistentTokens(this.read, getRoomAssoc(rid));
		const salesforceChatApiEndpoint = await getSalesforceChatAPIEndpoint(this.read);

		if (persisantAffinity !== null && persistantKey !== null) {
			let reason = '';
			if (customFields && customFields.customerIdleTimeout === true) {
				reason = 'clientIdleTimeout';

			}
			await closeChat(this.http, salesforceChatApiEndpoint, persisantAffinity, persistantKey, reason).then(async () => {
				console.log(InfoLogs.LIVEAGENT_SESSION_CLOSED);
				await this.persistence.removeByAssociation(getRoomAssoc(rid));
				await this.modify.getScheduler().cancelJobByDataQuery({rid, taskType: 'sessionTimeout'});
			}).catch((error) => {
				console.error(ErrorLogs.CLOSING_LIVEAGENT_SESSION_ERROR, error);
			});
		}
	}

	public async exec() {
		await this.closeChatFromSalesforce();

		const isDialogflowEndEventEnabled: boolean = await getAppSettingValue(this.read, AppSettingId.DIALOGFLOW_ENABLE_END_EVENT);

		if (isDialogflowEndEventEnabled === false) {
			console.log(InfoLogs.ENDCHAT_EVENT_NOT_ENABLED);
			return;
		}

		const lroom: ILivechatRoom = this.room as ILivechatRoom;
		const salesforceBotUsername: string = await getAppSettingValue(this.read, AppSettingId.SALESFORCE_BOT_USERNAME);
		const { customFields } = this.room;

		let serverUrl = await this.read.getEnvironmentReader().getServerSettings().getValueById('Site_Url');
		try {
			serverUrl = serverUrl.replace(/\/?$/, '/');
		} catch (error) {
			const user = await this.read.getUserReader().getByUsername(salesforceBotUsername);
			await sendLCMessage(this.read, this.modify, this.room, ErrorLogs.ROCKETCHAT_SERVERURL_NOT_FOUND, user);
			await sendDebugLCMessage(this.read, this.modify, this.room, ErrorLogs.ROCKETCHAT_SERVERURL_NOT_FOUND, user);
			console.error(ErrorLogs.ROCKETCHAT_SERVERURL_NOT_FOUND);
			return;
		}

		const dialogflowEndChatEventName: string = await getAppSettingValue(this.read, AppSettingId.DIALOGFLOW_AGENT_ENDED_CHAT_EVENT_NAME);
		const dialogflowCustomerEndChatEventName: string = await getAppSettingValue(this.read, AppSettingId.DIALOGFLOW_CUSTOMER_ENDED_CHAT_EVENT_NAME);
		const dialogflowAgentUnavailableEventName: string = await getAppSettingValue(this.read, AppSettingId.DIALOGFLOW_AGENT_UNAVAILABLE_EVENT_NAME);
		const dialogflowCustomerIdleTimeoutEventName: string = await getAppSettingValue(this.read, AppSettingId.DIALOGFLOW_CUSTOMER_IDLE_TIMEOUT_EVENT_NAME);
		const dialogflowSessionErrorEventName: string = await getAppSettingValue(this.read, AppSettingId.DIALOGFLOW_SESSION_ERROR_EVENT_NAME);
		const dialogflowEndChatEventLCode: string = await getAppSettingValue(this.read, AppSettingId.DIALOGFLOW_END_EVENT_LANGUAGE_CODE);

		const isHandedOverFromDialogFlow = (customFields && customFields.isHandedOverFromDialogFlow === true) || false;

		if (lroom.servedBy) {
			if (isHandedOverFromDialogFlow && dialogflowEndChatEventLCode) {
				const eventParams = {
					name: '',
					languageCode: dialogflowEndChatEventLCode,
				};

				if (customFields && customFields.agentEndedChat === true && dialogflowEndChatEventName) {
					console.log(InfoLogs.DIALOGFLOW_AGENT_ENDED_CHAT);
					eventParams.name = dialogflowEndChatEventName;
				} else if (customFields && customFields.customerIdleTimeout === true && dialogflowCustomerIdleTimeoutEventName) {
					console.log(InfoLogs.DIALOGFLOW_CUSTOMER_IDLE_TIMEOUT);
					eventParams.name = dialogflowCustomerIdleTimeoutEventName;
				} else if (customFields && customFields.agentUnavailable === true && dialogflowAgentUnavailableEventName) {
					console.log(InfoLogs.DIALOGFLOW_AGENT_UNAVAILABLE_SESSION);
					eventParams.name = dialogflowAgentUnavailableEventName;
				} else if (customFields && customFields.errorSession === true && dialogflowSessionErrorEventName) {
					console.log(ErrorLogs.DIALOGFLOW_ERROR_SESSION);
					eventParams.name = dialogflowSessionErrorEventName;
				} else if (dialogflowCustomerEndChatEventName) {
					console.log(InfoLogs.DIALOGFLOW_CUSTOMER_ENDED_CHAT);
					eventParams.name = dialogflowCustomerEndChatEventName;
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
					console.error(ErrorLogs.ENDCHAT_EVENT_API_CALL_FAIL, error);
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
