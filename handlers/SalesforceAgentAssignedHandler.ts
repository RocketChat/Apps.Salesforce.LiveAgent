import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatEventContext } from '@rocket.chat/apps-engine/definition/livechat';
import { AppSettingId } from '../enum/AppSettingId';
import { ErrorLogs } from '../enum/ErrorLogs';
import { InfoLogs } from '../enum/InfoLogs';
import { sendDebugLCMessage, sendLCMessage } from '../helperFunctions/LivechatMessageHelpers';
import { getRoomAssoc, retrievePersistentData, retrievePersistentTokens } from '../helperFunctions/PersistenceHelpers';
import { SubscribeToLiveAgent } from '../helperFunctions/subscribeHelpers/SalesforceAgentAssignedHelpers/SubsribeToLiveAgentHelper';
import { getAppSettingValue } from '../lib/Settings';

export class SalesforceAgentAssigned {
	constructor(
		private app: IApp,
		private data: ILivechatEventContext,
		private read: IRead,
		private http: IHttp,
		private persistence: IPersistence,
		private modify: IModify,
	) {}

	public async exec() {
		const salesforceBotUsername: string = await getAppSettingValue(this.read, AppSettingId.SALESFORCE_BOT_USERNAME);
		if (this.data.agent.username !== salesforceBotUsername) {
			return;
		}

		const assoc = getRoomAssoc(this.data.room.id);
		const persitedData = await retrievePersistentTokens(this.read, assoc);
		const { persisantAffinity, persistantKey } = persitedData;
		const salesforceAgentName = (await retrievePersistentData(this.read, assoc)).salesforceAgentName;
		const technicalDifficultyMessage: string = await getAppSettingValue(this.read, AppSettingId.TECHNICAL_DIFFICULTY_MESSAGE);

		let salesforceChatApiEndpoint: string = await getAppSettingValue(this.read, AppSettingId.SALESFORCE_CHAT_API_ENDPOINT);
		try {
			salesforceChatApiEndpoint = salesforceChatApiEndpoint.replace(/\/?$/, '/');
		} catch (error) {
			await sendLCMessage(this.read, this.modify, this.data.room, technicalDifficultyMessage, this.data.agent);
			await sendDebugLCMessage(this.read, this.modify, this.data.room, ErrorLogs.SALESFORCE_CHAT_API_NOT_FOUND, this.data.agent);
			console.error(ErrorLogs.SALESFORCE_CHAT_API_NOT_FOUND, error);
			return;
		}
		const LAChatEndedMessage: string = await getAppSettingValue(this.read, AppSettingId.LIVEAGENT_CHAT_ENDED_MESSAGE);

		const connectedToAgentMessage = `${ InfoLogs.CONNECTING_TO_SALESFORCE_LIVEAGENT } ${ salesforceAgentName }.`;
		await sendLCMessage(this.read, this.modify, this.data.room, connectedToAgentMessage, this.data.agent);

		if (persisantAffinity !== null && persistantKey !== null) {
			// Executing subscribe function to listen to Liveagent messages.
			const subscribeLiveAgentClass = new SubscribeToLiveAgent(
				this.app,
				this.read,
				this.http,
				this.modify,
				this.persistence,
				this.data,
				assoc,
				salesforceChatApiEndpoint,
				LAChatEndedMessage,
				technicalDifficultyMessage,
				persisantAffinity,
				persistantKey,
			);
			await subscribeLiveAgentClass.subscribeToLiveAgent();
		}
	}
}
