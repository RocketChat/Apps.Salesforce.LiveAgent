import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatEventContext } from '@rocket.chat/apps-engine/definition/livechat';
import { AppSettingId } from '../enum/AppSettingId';
import { InitiateSalesforceSession } from '../handlers/InitiateSalesforceSessionHandler';
import { SalesforceAgentAssigned } from '../handlers/SalesforceAgentAssignedHandler';
import { sendLCMessage } from '../helperFunctions/LivechatMessageHelpers';
import { getRoomAssoc, retrievePersistentTokens } from '../helperFunctions/PersistenceHelpers';
import { getAppSettingValue } from '../lib/Settings';

export class SalesforceAgentAssignedClass {
	constructor(
		private app: IApp,
		private data: ILivechatEventContext,
		private read: IRead,
		private http: IHttp,
		private persistence: IPersistence,
		private modify: IModify,
	) {}

	public async exec() {
		const assoc = getRoomAssoc(this.data.room.id);
		const salesforceBotUsername: string = await getAppSettingValue(this.read, AppSettingId.SALESFORCE_BOT_USERNAME);
		const { persisantAffinity, persistantKey } = await retrievePersistentTokens(this.read, assoc);
		const FindingLiveagentMessage: string = await getAppSettingValue(this.read, AppSettingId.FINDING_LIVEAGENT_MESSAGE);

		if (persisantAffinity === null && persistantKey === null && this.data.agent.username === salesforceBotUsername) {
			const initiateSalesforceSession = new InitiateSalesforceSession(this.app, this.data, this.read, this.http, this.persistence, this.modify);
			await sendLCMessage(this.modify, this.data.room, FindingLiveagentMessage, this.data.agent, true);
			await initiateSalesforceSession.exec();
		} else {
			const salesforceAgentAssigned = new SalesforceAgentAssigned(this.app, this.data, this.read, this.http, this.persistence, this.modify);
			await salesforceAgentAssigned.exec();
		}
	}
}
