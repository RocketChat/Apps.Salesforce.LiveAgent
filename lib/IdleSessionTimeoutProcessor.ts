import { IHttp, IHttpRequest, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatRoom } from '@rocket.chat/apps-engine/definition/livechat';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IJobContext, IProcessor } from '@rocket.chat/apps-engine/definition/scheduler';
import { AppSettingId } from '../enum/AppSettingId';
import { ErrorLogs } from '../enum/ErrorLogs';
import { InfoLogs } from '../enum/InfoLogs';
import { LiveAgentSession } from '../handlers/LiveAgentSessionHandler';
import { sendDebugLCMessage, sendLCMessage } from '../helperFunctions/LivechatMessageHelpers';
import { retrievePersistentTokens } from '../helperFunctions/PersistenceHelpers';
import { updateRoomCustomFields } from '../helperFunctions/RoomCustomFieldsHelper';
import { closeChat, getSalesforceChatAPIEndpoint } from '../helperFunctions/SalesforceAPIHelpers';
import { getAppSettingValue } from './Settings';

export class IdleSessionTimeoutProcessor implements IProcessor {
	public id: string;
	public app: IApp;
	public message: IMessage;

	constructor(id: string, app?: IApp, message?: IMessage) {
		this.id = id;
		if (app && message) {
			this.app = app;
			this.message = message;
		}
	}

	public async processor(jobContext: IJobContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
		console.log('salesforce logout');

		const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, `SFLAIA-${jobContext.rid}`);
		const { persisantAffinity, persistantKey } = await retrievePersistentTokens(read, assoc);
		const salesforceChatApiEndpoint = await getSalesforceChatAPIEndpoint(read);

		const reason = 'clientIdleTimeout';

		if (persisantAffinity !== null && persistantKey !== null) {
			console.log('pers not null');
			updateRoomCustomFields(jobContext.rid , {customerIdleTimeout: true}, read, modify);
			await closeChat(http, salesforceChatApiEndpoint, persisantAffinity, persistantKey, reason)
			.then(async () => {
				console.log(InfoLogs.LIVEAGENT_SESSION_CLOSED);
				await persis.removeByAssociation(assoc);
			})
			.catch((error) => {
				console.log('Close Chat Error')
				console.error(ErrorLogs.CLOSING_LIVEAGENT_SESSION_ERROR, error);
			});
		} else {
			console.log('pers null');
			console.error(ErrorLogs.CLOSING_LIVEAGENT_SESSION_ERROR);
		}

		const liveAgentSession = new LiveAgentSession(this.app, jobContext.message, read, modify, http, persis);
		await liveAgentSession.exec();

		return;
	}
}
