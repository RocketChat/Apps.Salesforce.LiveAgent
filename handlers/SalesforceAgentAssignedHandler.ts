import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ILivechatEventContext } from '@rocket.chat/apps-engine/definition/livechat';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { getServerSettingValue, retrievePersistentTokens, sendDebugLCMessage, sendLCMessage } from '../helperFunctions/GeneralHelpers';
import { subscribeToLiveAgent } from '../helperFunctions/SalesforceAgentAssignedHelpers/SubsribeToLiveAgentHelper';

export class SalesforceAgentAssigned {
	constructor(private data: ILivechatEventContext, private read: IRead, private http: IHttp, private persistence: IPersistence, private modify: IModify) {}

	public async exec() {
		const salesforceBotUsername: string = (await this.read.getEnvironmentReader().getSettings().getById('salesforce_bot_username')).value;
		if (this.data.agent.username !== salesforceBotUsername) {
			return;
		}

		const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.ROOM, this.data.room.id);
		const persitedData = await retrievePersistentTokens(this.read, assoc);
		const { persisantAffinity, persistantKey } = persitedData;
		const technicalDifficultyMessage: string = (await this.read.getEnvironmentReader().getSettings().getById('technical_difficulty_message')).value;

		let rocketChatServerUrl: string = await getServerSettingValue(this.read, 'Site_Url');
		try {
			rocketChatServerUrl = rocketChatServerUrl.replace(/\/?$/, '/');
		} catch (error) {
			await sendLCMessage(this.modify, this.data.room, technicalDifficultyMessage, this.data.agent);
			await sendDebugLCMessage(this.read, this.modify, this.data.room, 'Rocket Chat server url not found.', this.data.agent);
			console.log('Rocket Chat server url not found.');
			return;
		}

		let salesforceChatApiEndpoint: string = (await this.read.getEnvironmentReader().getSettings().getById('salesforce_chat_api_endpoint')).value;
		try {
			salesforceChatApiEndpoint = salesforceChatApiEndpoint.replace(/\/?$/, '/');
		} catch (error) {
			await sendLCMessage(this.modify, this.data.room, technicalDifficultyMessage, this.data.agent);
			await sendDebugLCMessage(this.read, this.modify, this.data.room, 'Salesforce Chat API endpoint not found.', this.data.agent);
			console.log('Salesforce Chat API endpoint not found.');
			return;
		}
		const LAChatEndedMessage: string = (await this.read.getEnvironmentReader().getSettings().getById('la_chat_ended_message')).value;

		if (persisantAffinity && persistantKey) {
			console.log('Executing Subscribe Function, MAIN ENTRY');
			await subscribeToLiveAgent(
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
			);
		}
	}
}
