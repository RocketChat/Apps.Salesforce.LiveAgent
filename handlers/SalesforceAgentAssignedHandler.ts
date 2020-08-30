import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatEventContext } from '@rocket.chat/apps-engine/definition/livechat';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { AppSettingId } from '../enum/AppSettingId';
import { ErrorLogs } from '../enum/ErrorLogs';
import { getServerSettingValue, sendDebugLCMessage, sendLCMessage } from '../helperFunctions/LivechatMessageHelpers';
import { retrievePersistentTokens } from '../helperFunctions/PersistenceHelpers';
import { SubscribeToLiveAgent } from '../helperFunctions/subscribeHelpers/SalesforceAgentAssignedHelpers/SubsribeToLiveAgentHelper';

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
		const salesforceBotUsername: string = (await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.SALESFORCE_BOT_USERNAME)).value;
		if (this.data.agent.username !== salesforceBotUsername) {
			return;
		}

		const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, `SFLAIA-${this.data.room.id}`);
		const persitedData = await retrievePersistentTokens(this.read, assoc);
		const { persisantAffinity, persistantKey } = persitedData;
		const technicalDifficultyMessage: string = (await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.TECHNICAL_DIFFICULTY_MESSAGE))
			.value;

		let rocketChatServerUrl: string = await getServerSettingValue(this.read, 'Site_Url');
		try {
			rocketChatServerUrl = rocketChatServerUrl.replace(/\/?$/, '/');
		} catch (error) {
			await sendLCMessage(this.modify, this.data.room, technicalDifficultyMessage, this.data.agent);
			await sendDebugLCMessage(this.read, this.modify, this.data.room, ErrorLogs.ROCKETCHAT_SERVER_URL_NOT_FOUND, this.data.agent);
			console.log(ErrorLogs.ROCKETCHAT_SERVER_URL_NOT_FOUND, error);
			return;
		}

		let salesforceChatApiEndpoint: string = (await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.SALESFORCE_CHAT_API_ENDPOINT)).value;
		try {
			salesforceChatApiEndpoint = salesforceChatApiEndpoint.replace(/\/?$/, '/');
		} catch (error) {
			await sendLCMessage(this.modify, this.data.room, technicalDifficultyMessage, this.data.agent);
			await sendDebugLCMessage(this.read, this.modify, this.data.room, ErrorLogs.SALESFORCE_CHAT_API_NOT_FOUND, this.data.agent);
			console.log(ErrorLogs.SALESFORCE_CHAT_API_NOT_FOUND, error);
			return;
		}
		const LAChatEndedMessage: string = (await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.LIVEAGENT_CHAT_ENDED_MESSAGE)).value;

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
				rocketChatServerUrl,
				LAChatEndedMessage,
				technicalDifficultyMessage,
				persisantAffinity,
				persistantKey,
			);
			await subscribeLiveAgentClass.subscribeToLiveAgent();
		}
	}
}
