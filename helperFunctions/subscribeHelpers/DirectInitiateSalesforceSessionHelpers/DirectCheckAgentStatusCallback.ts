import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatEventContext } from '@rocket.chat/apps-engine/definition/livechat';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { Logs } from '../../../enum/Logs';
import { getServerSettingValue, sendDebugLCMessage, sendLCMessage } from '../../LivechatMessageHelpers';
import { HandleEndChatCallback } from '../SalesforceAgentAssignedHelpers/HandleEndChatCallback';

export class CheckAgentStatusDirectCallback {
	constructor(
		private app: IApp,
		private http: IHttp,
		private modify: IModify,
		private persistence: IPersistence,
		private data: ILivechatEventContext,
		private read: IRead,
		private technicalDifficultyMessage: string,
	) {}

	public async checkAgentStatusCallbackError(error: string) {
		const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.ROOM, this.data.room.id);

		let rocketChatServerUrl: string = await getServerSettingValue(this.read, 'Site_Url');
		try {
			rocketChatServerUrl = rocketChatServerUrl.replace(/\/?$/, '/');
		} catch (error) {
			await sendLCMessage(this.modify, this.data.room, this.technicalDifficultyMessage, this.data.agent);
			await sendDebugLCMessage(this.read, this.modify, this.data.room, Logs.ERROR_ROCKETCHAT_SERVER_URL_NOT_FOUND, this.data.agent);
			console.log(Logs.ERROR_ROCKETCHAT_SERVER_URL_NOT_FOUND);
			return;
		}

		const handleEndChatCallback = new HandleEndChatCallback(
			this.app,
			this.modify,
			this.data,
			this.read,
			this.persistence,
			this.http,
			error,
			assoc,
			rocketChatServerUrl,
			this.technicalDifficultyMessage,
		);

		await handleEndChatCallback.handleEndChat();
		return;
	}
}
