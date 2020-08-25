import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatEventContext } from '@rocket.chat/apps-engine/definition/livechat';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata/RocketChatAssociations';
import { AppSettingId } from '../enum/AppSettingId';
import { InitiateSalesforceSessionDirect } from '../handlers/DirectInitiateSalesforceSessionHandler';
import { SalesforceAgentAssigned } from '../handlers/SalesforceAgentAssignedHandler';
import { sendLCMessage } from '../helperFunctions/LivechatMessageHelpers';
import { retrievePersistentTokens } from '../helperFunctions/PersistenceHelpers';

export class AgentAssignedClassInitiate {
	constructor(
		private app: IApp,
		private data: ILivechatEventContext,
		private read: IRead,
		private http: IHttp,
		private persistence: IPersistence,
		private modify: IModify,
	) {}

	public async exec() {
		const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.ROOM, this.data.room.id);
		const salesforceBotUsername: string = (await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.SALESFORCE_BOT_USERNAME)).value;
		const { persisantAffinity, persistantKey } = await retrievePersistentTokens(this.read, assoc);
		const FindingLiveagentMessage: string = (await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.FINDING_LIVEAGENT_MESSAGE))
			.value;

		if (persisantAffinity === null && persistantKey === null && this.data.agent.username === salesforceBotUsername) {
			const initiateSalesforceSession = new InitiateSalesforceSessionDirect(this.app, this.data, this.read, this.http, this.persistence, this.modify);
			await sendLCMessage(this.modify, this.data.room, FindingLiveagentMessage, this.data.agent);
			await initiateSalesforceSession.exec();
		} else {
			const salesforceAgentAssigned = new SalesforceAgentAssigned(this.app, this.data, this.read, this.http, this.persistence, this.modify);
			await salesforceAgentAssigned.exec();
		}
	}
}
