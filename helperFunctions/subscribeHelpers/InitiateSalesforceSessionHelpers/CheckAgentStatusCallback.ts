import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatEventContext } from '@rocket.chat/apps-engine/definition/livechat';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { AppSettingId } from '../../../enum/AppSettingId';
import { updateRoomCustomFields } from '../../RoomCustomFieldsHelper';
import { HandleEndChatCallback } from '../SalesforceAgentAssignedHelpers/HandleEndChatCallback';

export class CheckAgentStatusCallback {
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
		const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, `SFLAIA-${this.data.room.id}`);

		const NoLiveagentAvailableMessage: string = (
			await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.NO_LIVEAGENT_AGENT_AVAILABLE_MESSAGE)
		).value;

		if (error === NoLiveagentAvailableMessage) {
			updateRoomCustomFields(this.data.room.id, { agentUnavailable: true }, this.read, this.modify);
		} else {
			updateRoomCustomFields(this.data.room.id, { errorSession: true }, this.read, this.modify);
		}

		const handleEndChatCallback = new HandleEndChatCallback(
			this.app,
			this.modify,
			this.data,
			this.read,
			this.persistence,
			error,
			assoc,
			this.technicalDifficultyMessage,
		);

		await handleEndChatCallback.handleEndChat();
		return;
	}
}
