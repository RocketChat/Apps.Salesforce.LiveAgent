import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatEventContext, ILivechatMessage, ILivechatRoom } from '@rocket.chat/apps-engine/definition/livechat';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata/RocketChatAssociations';
import { InitiateSalesforceSessionDirect } from '../handlers/InitiateSalesforceSessionHandlerDirect';
import { SalesforceAgentAssigned } from '../handlers/SalesforceAgentAssignedHandler';
import { retrievePersistentTokens } from '../helperFunctions/GeneralHelpers';

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
		const salesforceBotUsername: string = (await this.read.getEnvironmentReader().getSettings().getById('salesforce_bot_username')).value;
		const { persisantAffinity, persistantKey } = await retrievePersistentTokens(this.read, assoc);
		if (persisantAffinity === null && persistantKey === null && this.data.agent.username === salesforceBotUsername) {
			const initiateSalesforceSession = new InitiateSalesforceSessionDirect(this.app, this.data, this.read, this.http, this.persistence, this.modify);
			await initiateSalesforceSession.exec();
		} else {
			const salesforceAgentAssigned = new SalesforceAgentAssigned(this.app, this.data, this.read, this.http, this.persistence, this.modify);
			await salesforceAgentAssigned.exec();
		}
	}
}
