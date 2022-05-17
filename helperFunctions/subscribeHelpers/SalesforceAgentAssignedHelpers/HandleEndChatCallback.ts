import { IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatEventContext } from '@rocket.chat/apps-engine/definition/livechat';
import { ILivechatRoom } from '@rocket.chat/apps-engine/definition/livechat';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { AppSettingId } from '../../../enum/AppSettingId';
import { ErrorLogs } from '../../../enum/ErrorLogs';
import { InfoLogs } from '../../../enum/InfoLogs';
import { getAppSettingValue } from '../../../lib/Settings';
import { performHandover } from '../../HandoverHelpers';
import { sendDebugLCMessage, sendLCMessage } from '../../LivechatMessageHelpers';

export class HandleEndChatCallback {
	constructor(
		private app: IApp,
		private modify: IModify,
		private data: ILivechatEventContext,
		private read: IRead,
		private persistence: IPersistence,
		private endChatReason: string,
		private assoc: RocketChatAssociationRecord,
		private technicalDifficultyMessage: string,
	) {}

	public handleEndChat = async () => {
		await this.persistence.removeByAssociation(this.assoc);
		const CBHandoverDepartmentName: string = await getAppSettingValue(this.read, AppSettingId.CB_HANDOVER_DEPARTMENT_NAME);

		if (CBHandoverDepartmentName) {
			await sendLCMessage(this.read, this.modify, this.data.room, this.endChatReason, this.data.agent);

			try {
				await performHandover(this.modify, this.read, this.data.room.id, CBHandoverDepartmentName);
			} catch (error) {
				console.error(ErrorLogs.HANDOVER_REQUEST_FAILED, error);
				await sendLCMessage(this.read, this.modify, this.data.room, this.technicalDifficultyMessage, this.data.agent);
				await sendDebugLCMessage(this.read, this.modify, this.data.room, `${ErrorLogs.HANDOVER_REQUEST_FAILED}: ${error}`, this.data.agent);
			}
		} else {
			try {
				const room: ILivechatRoom = (await this.read.getRoomReader().getById(this.data.room.id)) as ILivechatRoom;
				if (!room) {
					throw new Error(ErrorLogs.INVALID_ROOM_ID);
				}

				const { isOpen } = room;
				if (!isOpen) {
					return;
				}

				const data: IMessage = {
					room,
					sender: this.data.agent,
				};

				const messageBuilder = this.modify.getCreator().startMessage(data);
				messageBuilder.setText(this.endChatReason);

				await this.modify.getCreator().finish(messageBuilder);
				console.log(InfoLogs.LIVEAGENT_SESSION_CLOSED);
				await this.modify.getUpdater().getLivechatUpdater().closeRoom(room, 'Chat closed by visitor.');
			} catch (error) {
				throw new Error(error);
			}
		}
	};
}
