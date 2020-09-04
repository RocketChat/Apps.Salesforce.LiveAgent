import { IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { ILivechatEventContext } from '@rocket.chat/apps-engine/definition/livechat';
import { RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { BlockElementType, ButtonStyle, ConditionalBlockFiltersEngine, IButtonElement, TextObjectType } from '@rocket.chat/apps-engine/definition/uikit';
import { AppSettingId } from '../../../enum/AppSettingId';
import { ErrorLogs } from '../../../enum/ErrorLogs';
import { InfoLogs } from '../../../enum/InfoLogs';
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
		const CBHandoverDepartmentName: string = (await this.read.getEnvironmentReader().getSettings().getById(AppSettingId.CB_HANDOVER_DEPARTMENT_NAME)).value;

		if (CBHandoverDepartmentName) {
			await sendLCMessage(this.modify, this.data.room, this.endChatReason, this.data.agent);

			try {
				await performHandover(this.modify, this.read, this.data.room.id, CBHandoverDepartmentName);
			} catch (error) {
				console.log(ErrorLogs.HANDOVER_REQUEST_FAILED, error);
				await sendLCMessage(this.modify, this.data.room, this.technicalDifficultyMessage, this.data.agent);
				await sendDebugLCMessage(this.read, this.modify, this.data.room, `${ErrorLogs.HANDOVER_REQUEST_FAILED}: ${error}`, this.data.agent);
			}
		} else {
			try {
				console.log(InfoLogs.CHATBOT_NOT_CONFIGURED);
				const messageBuilder = this.modify.getCreator().startMessage();

				const btn: IButtonElement = {
					type: BlockElementType.BUTTON,
					text: {
						type: TextObjectType.PLAINTEXT,
						text: 'Close Chat',
					},
					actionId: 'SFLAIA_CLOSE_ROOM_BUTTON',
					style: ButtonStyle.DANGER,
				};

				const blocks = this.modify.getCreator().getBlockBuilder();
				const innerBlocks = this.modify.getCreator().getBlockBuilder();

				blocks.addConditionalBlock(
					innerBlocks.addActionsBlock({
						elements: [btn],
					}),
					{ engine: [ConditionalBlockFiltersEngine.LIVECHAT] },
				);

				messageBuilder.setRoom(this.data.room).setText(this.endChatReason).setSender(this.data.agent).addBlocks(blocks);
				await this.modify.getCreator().finish(messageBuilder);
			} catch (error) {
				throw new Error(error);
			}
		}
	}
}
